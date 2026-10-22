import express from 'express';
import { getDatabase } from '../db.js';
import { formatIndianCurrency, rupeesToPaise } from '../lib/money.js';
import { getToday } from '../lib/dateUtils.js';

const router = express.Router();

/**
 * GET /api/inbox
 * Returns all active inbox items: payment claims, open disputes, and pending promises.
 */
router.get('/', (req, res) => {
  try {
    const db = getDatabase();

    // 1. Fetch payment claims from inbox_items
    const paymentClaims = db.prepare(`
      SELECT
        ii.*,
        i.invoice_number,
        i.total_paise as invoice_total_paise,
        i.balance_paise as invoice_balance_paise,
        i.status as invoice_status,
        c.name as customer_name,
        c.company_name as customer_company,
        c.phone as customer_phone
      FROM inbox_items ii
      LEFT JOIN invoices i ON ii.invoice_id = i.id
      LEFT JOIN customers c ON ii.customer_id = c.id
      WHERE ii.status = 'PENDING'
      ORDER BY ii.created_at DESC
    `).all();

    // 2. Fetch open disputes
    const openDisputes = db.prepare(`
      SELECT
        d.id as dispute_id,
        d.invoice_id,
        d.customer_id,
        'DISPUTE' as type,
        d.reason,
        d.disputed_amount_paise,
        d.status,
        d.resolution_notes,
        d.created_at,
        i.invoice_number,
        i.total_paise as invoice_total_paise,
        i.balance_paise as invoice_balance_paise,
        i.status as invoice_status,
        c.name as customer_name,
        c.company_name as customer_company,
        c.phone as customer_phone
      FROM disputes d
      JOIN invoices i ON d.invoice_id = i.id
      JOIN customers c ON d.customer_id = c.id
      WHERE d.status IN ('OPEN', 'UNDER_REVIEW')
      ORDER BY d.created_at DESC
    `).all();

    // 3. Fetch pending promises
    const pendingPromises = db.prepare(`
      SELECT
        pr.id as promise_id,
        pr.invoice_id,
        pr.customer_id,
        'PROMISE' as type,
        pr.promised_date,
        pr.promised_amount_paise,
        pr.status,
        pr.notes,
        pr.created_at,
        i.invoice_number,
        i.total_paise as invoice_total_paise,
        i.balance_paise as invoice_balance_paise,
        i.status as invoice_status,
        c.name as customer_name,
        c.company_name as customer_company,
        c.phone as customer_phone
      FROM promises pr
      LEFT JOIN invoices i ON pr.invoice_id = i.id
      JOIN customers c ON pr.customer_id = c.id
      WHERE pr.status = 'PENDING'
      ORDER BY pr.created_at DESC
    `).all();

    res.json({
      summary: {
        total_pending: paymentClaims.length + openDisputes.length + pendingPromises.length,
        payment_claims_count: paymentClaims.length,
        disputes_count: openDisputes.length,
        promises_count: pendingPromises.length
      },
      payment_claims: paymentClaims.map(p => ({
        ...p,
        formatted_amount: formatIndianCurrency(p.amount_paise),
        formatted_invoice_balance: formatIndianCurrency(p.invoice_balance_paise)
      })),
      disputes: openDisputes.map(d => ({
        ...d,
        formatted_amount: formatIndianCurrency(d.disputed_amount_paise),
        formatted_invoice_balance: formatIndianCurrency(d.invoice_balance_paise)
      })),
      promises: pendingPromises.map(pr => ({
        ...pr,
        formatted_amount: formatIndianCurrency(pr.promised_amount_paise),
        formatted_invoice_balance: formatIndianCurrency(pr.invoice_balance_paise || 0)
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_FETCH_INBOX', message: err.message });
  }
});

/**
 * POST /api/inbox/claims/:id/accept
 * Accepts a customer payment claim and records the payment into ledger.
 */
router.post('/claims/:id/accept', (req, res) => {
  try {
    const db = getDatabase();
    const claim = db.prepare('SELECT * FROM inbox_items WHERE id = ?').get(req.params.id);

    if (!claim) {
      return res.status(404).json({ error: 'CLAIM_NOT_FOUND', message: 'Payment claim not found' });
    }

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(claim.invoice_id);
    if (!invoice) {
      return res.status(404).json({ error: 'INVOICE_NOT_FOUND', message: 'Associated invoice not found' });
    }

    const today = getToday(db);
    const amountPaise = claim.amount_paise || invoice.balance_paise;

    const tx = db.transaction(() => {
      // 1. Mark claim accepted
      db.prepare("UPDATE inbox_items SET status = 'ACCEPTED' WHERE id = ?").run(claim.id);

      // 2. Record in payments table
      const payStmt = db.prepare(`
        INSERT INTO payments (
          business_id, customer_id, invoice_id, payment_date, amount_paise, payment_mode, reference_no, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      payStmt.run(
        invoice.business_id,
        invoice.customer_id,
        invoice.id,
        claim.payment_date || today,
        amountPaise,
        claim.payment_mode || 'UPI',
        claim.reference_no,
        claim.notes || 'Verified customer online claim'
      );

      // 3. Update invoice balance and status
      const newPaidPaise = invoice.paid_paise + amountPaise;
      const newBalancePaise = Math.max(0, invoice.total_paise - newPaidPaise);
      const newStatus = (newBalancePaise === 0) ? 'PAID' : 'PARTIALLY_PAID';

      db.prepare(`
        UPDATE invoices
        SET paid_paise = ?, balance_paise = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newPaidPaise, newBalancePaise, newStatus, invoice.id);

      return { newPaidPaise, newBalancePaise, newStatus };
    });

    const result = tx();

    res.json({
      message: `Payment claim accepted and verified for Invoice ${invoice.invoice_number}`,
      ...result,
      formatted_balance: formatIndianCurrency(result.newBalancePaise)
    });
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_ACCEPT_CLAIM', message: err.message });
  }
});

/**
 * POST /api/inbox/claims/:id/reject
 * Rejects an invalid or unverified customer payment claim.
 */
router.post('/claims/:id/reject', (req, res) => {
  try {
    const db = getDatabase();
    const claim = db.prepare('SELECT * FROM inbox_items WHERE id = ?').get(req.params.id);

    if (!claim) {
      return res.status(404).json({ error: 'CLAIM_NOT_FOUND', message: 'Payment claim not found' });
    }

    db.prepare("UPDATE inbox_items SET status = 'REJECTED' WHERE id = ?").run(claim.id);

    res.json({ message: 'Payment claim rejected; reminder schedule remains active' });
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_REJECT_CLAIM', message: err.message });
  }
});

/**
 * POST /api/inbox/disputes/:id/resolve
 * Resolves a dispute and allows resuming reminder escalation.
 */
router.post('/disputes/:id/resolve', (req, res) => {
  try {
    const db = getDatabase();
    const dispute = db.prepare('SELECT * FROM disputes WHERE id = ?').get(req.params.id);

    if (!dispute) {
      return res.status(404).json({ error: 'DISPUTE_NOT_FOUND', message: 'Dispute not found' });
    }

    const { resolution_notes, resume_reminders = true } = req.body;
    const today = getToday(db);

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE disputes
        SET status = 'RESOLVED', resolution_notes = ?, resolved_at = ?
        WHERE id = ?
      `).run(resolution_notes || 'Dispute resolved with customer', today, dispute.id);

      // If resume reminders, check invoice balance
      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(dispute.invoice_id);
      if (invoice && invoice.status === 'DISPUTED') {
        const newStatus = (invoice.balance_paise === 0) ? 'PAID'
          : (invoice.due_date < today) ? 'OVERDUE'
          : (invoice.paid_paise > 0) ? 'PARTIALLY_PAID'
          : 'SENT';

        db.prepare('UPDATE invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, invoice.id);
      }
    });

    tx();

    res.json({ message: 'Dispute resolved successfully' });
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_RESOLVE_DISPUTE', message: err.message });
  }
});

/**
 * POST /api/inbox/disputes/:id/toggle-reminders
 * Pause or resume reminders on a disputed invoice without necessarily closing the dispute.
 */
router.post('/disputes/:id/toggle-reminders', (req, res) => {
  try {
    const db = getDatabase();
    const dispute = db.prepare('SELECT * FROM disputes WHERE id = ?').get(req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: 'DISPUTE_NOT_FOUND', message: 'Dispute not found' });
    }

    const { pause } = req.body;
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(dispute.invoice_id);
    if (!invoice) {
      return res.status(404).json({ error: 'INVOICE_NOT_FOUND', message: 'Invoice not found' });
    }

    const today = getToday(db);
    let newStatus;
    if (pause) {
      newStatus = 'DISPUTED';
    } else {
      newStatus = (invoice.balance_paise === 0) ? 'PAID'
        : (invoice.due_date < today) ? 'OVERDUE'
        : (invoice.paid_paise > 0) ? 'PARTIALLY_PAID'
        : 'SENT';
    }

    db.prepare('UPDATE invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, invoice.id);

    res.json({
      message: pause ? 'Reminders paused for invoice' : 'Reminders resumed for invoice',
      status: newStatus
    });
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_TOGGLE_REMINDERS', message: err.message });
  }
});

/**
 * POST /api/inbox/promises/:id/fulfill
 * Mark a promise as fulfilled and record the payment against the invoice.
 */
router.post('/promises/:id/fulfill', (req, res) => {
  try {
    const db = getDatabase();
    const promise = db.prepare('SELECT * FROM promises WHERE id = ?').get(req.params.id);
    if (!promise) {
      return res.status(404).json({ error: 'PROMISE_NOT_FOUND', message: 'Promise not found' });
    }

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(promise.invoice_id);
    if (!invoice) {
      return res.status(404).json({ error: 'INVOICE_NOT_FOUND', message: 'Invoice not found' });
    }

    const today = getToday(db);
    const amountPaise = promise.promised_amount_paise || invoice.balance_paise;

    const tx = db.transaction(() => {
      // 1. Mark promise fulfilled
      db.prepare("UPDATE promises SET status = 'FULFILLED' WHERE id = ?").run(promise.id);

      // 2. Record payment
      const payStmt = db.prepare(`
        INSERT INTO payments (
          business_id, customer_id, invoice_id, payment_date, amount_paise, payment_mode, reference_no, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      payStmt.run(
        invoice.business_id,
        invoice.customer_id,
        invoice.id,
        today,
        amountPaise,
        'UPI',
        `PROMISE-FULFILLED-${promise.id}`,
        promise.notes || 'Settled as per customer promise'
      );

      // 3. Update invoice
      const newPaidPaise = invoice.paid_paise + amountPaise;
      const newBalancePaise = Math.max(0, invoice.total_paise - newPaidPaise);
      const newStatus = (newBalancePaise === 0) ? 'PAID' : 'PARTIALLY_PAID';

      db.prepare(`
        UPDATE invoices
        SET paid_paise = ?, balance_paise = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newPaidPaise, newBalancePaise, newStatus, invoice.id);

      return { newPaidPaise, newBalancePaise, newStatus };
    });

    const result = tx();

    res.json({
      message: `Promise marked fulfilled and payment recorded for Invoice ${invoice.invoice_number}`,
      ...result,
      formatted_balance: formatIndianCurrency(result.newBalancePaise)
    });
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_FULFILL_PROMISE', message: err.message });
  }
});

/**
 * POST /api/inbox/promises/:id/cancel
 * Cancel a promise to pay and resume reminders.
 */
router.post('/promises/:id/cancel', (req, res) => {
  try {
    const db = getDatabase();
    const promise = db.prepare('SELECT * FROM promises WHERE id = ?').get(req.params.id);
    if (!promise) {
      return res.status(404).json({ error: 'PROMISE_NOT_FOUND', message: 'Promise not found' });
    }

    db.prepare("UPDATE promises SET status = 'CANCELLED' WHERE id = ?").run(promise.id);

    res.json({ message: 'Promise cancelled; reminder ladder resumed' });
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_CANCEL_PROMISE', message: err.message });
  }
});

export default router;
