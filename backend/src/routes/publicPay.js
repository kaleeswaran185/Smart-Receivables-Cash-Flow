import express from 'express';
import { getDatabase } from '../db.js';
import { formatIndianCurrency } from '../lib/money.js';
import { getToday } from '../lib/dateUtils.js';
import { disputeInvoice } from '../services/reminderService.js';

const router = express.Router();

function findInvoiceByToken(db, token) {
  let invoice = db.prepare(`
    SELECT
      i.*,
      c.name as customer_name,
      c.company_name as customer_company,
      c.email as customer_email,
      c.phone as customer_phone,
      b.name as business_name,
      b.trade_name as business_trade_name,
      b.upi_id as business_upi_id,
      b.bank_name as business_bank_name,
      b.bank_account_no as business_bank_account_no,
      b.bank_ifsc as business_bank_ifsc,
      b.bank_branch as business_bank_branch
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    JOIN business b ON i.business_id = b.id
    WHERE i.payment_token = ?
  `).get(token);

  if (!invoice && /^\d+$/.test(token)) {
    // Fallback to numeric invoice id
    invoice = db.prepare(`
      SELECT
        i.*,
        c.name as customer_name,
        c.company_name as customer_company,
        c.email as customer_email,
        c.phone as customer_phone,
        b.name as business_name,
        b.trade_name as business_trade_name,
        b.upi_id as business_upi_id,
        b.bank_name as business_bank_name,
        b.bank_account_no as business_bank_account_no,
        b.bank_ifsc as business_bank_ifsc,
        b.bank_branch as business_bank_branch
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      JOIN business b ON i.business_id = b.id
      WHERE i.id = ?
    `).get(token);
  }

  return invoice;
}

/**
 * GET /api/public/pay/:token
 * Public payment page data for customer.
 */
router.get('/:token', (req, res) => {
  try {
    const db = getDatabase();
    const invoice = findInvoiceByToken(db, req.params.token);

    if (!invoice) {
      return res.status(404).json({ error: 'INVOICE_NOT_FOUND', message: 'Invalid payment link or invoice not found' });
    }

    const items = db.prepare('SELECT id, description, hsn_code, qty, unit, rate_paise, taxable_paise, gst_rate, total_paise FROM invoice_items WHERE invoice_id = ?').all(invoice.id);

    res.json({
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date,
      status: invoice.status,
      invoice_type: invoice.invoice_type,
      total_paise: invoice.total_paise,
      paid_paise: invoice.paid_paise,
      balance_paise: invoice.balance_paise,
      formatted_total: formatIndianCurrency(invoice.total_paise),
      formatted_paid: formatIndianCurrency(invoice.paid_paise),
      formatted_balance: formatIndianCurrency(invoice.balance_paise),
      items: items.map(item => ({
        ...item,
        formatted_rate: formatIndianCurrency(item.rate_paise),
        formatted_total: formatIndianCurrency(item.total_paise)
      })),
      customer: {
        name: invoice.customer_name,
        company_name: invoice.customer_company
      },
      business: {
        name: invoice.business_name,
        trade_name: invoice.business_trade_name,
        upi_id: invoice.business_upi_id,
        bank_name: invoice.business_bank_name,
        bank_account_no: invoice.business_bank_account_no,
        bank_ifsc: invoice.business_bank_ifsc,
        bank_branch: invoice.business_bank_branch
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_LOAD_PAY_PAGE', message: err.message });
  }
});

/**
 * POST /api/public/pay/:token
 * Record an online settlement via public checkout.
 */
router.post('/:token', (req, res) => {
  try {
    const db = getDatabase();
    const invoice = findInvoiceByToken(db, req.params.token);

    if (!invoice) {
      return res.status(404).json({ error: 'INVOICE_NOT_FOUND', message: 'Invoice not found' });
    }

    const { amount_paise, payment_mode = 'UPI', reference_no, notes } = req.body;
    const paymentAmount = amount_paise ? parseInt(amount_paise, 10) : invoice.balance_paise;

    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({ error: 'INVALID_AMOUNT', message: 'Payment amount must be greater than 0' });
    }

    if (paymentAmount > invoice.balance_paise) {
      return res.status(400).json({
        error: 'OVERPAYMENT_NOT_ALLOWED',
        message: 'Payment amount exceeds invoice balance',
        balance_paise: invoice.balance_paise
      });
    }

    const today = getToday(db);

    const tx = db.transaction(() => {
      // 1. Insert payment record
      const payStmt = db.prepare(`
        INSERT INTO payments (
          business_id, customer_id, invoice_id, payment_date, amount_paise, payment_mode, reference_no, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const payRes = payStmt.run(
        invoice.business_id,
        invoice.customer_id,
        invoice.id,
        today,
        paymentAmount,
        payment_mode,
        reference_no || `ONLINE-${Date.now()}`,
        notes || 'Settled via public pay link'
      );

      // 2. Update invoice balance and status
      const newPaidPaise = invoice.paid_paise + paymentAmount;
      const newBalancePaise = invoice.total_paise - newPaidPaise;
      const newStatus = (newBalancePaise === 0) ? 'PAID' : 'PARTIALLY_PAID';

      db.prepare(`
        UPDATE invoices
        SET paid_paise = ?, balance_paise = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newPaidPaise, newBalancePaise, newStatus, invoice.id);

      return {
        payment_id: payRes.lastInsertRowid,
        amount_paise: paymentAmount,
        paid_paise: newPaidPaise,
        balance_paise: newBalancePaise,
        status: newStatus
      };
    });

    const result = tx();

    res.status(201).json({
      message: 'Payment received successfully',
      ...result,
      formatted_amount: formatIndianCurrency(result.amount_paise),
      formatted_balance: formatIndianCurrency(result.balance_paise)
    });
  } catch (err) {
    res.status(500).json({ error: 'PAYMENT_FAILED', message: err.message });
  }
});

/**
 * POST /api/public/pay/:token/already-paid
 * "I've already paid" claim by customer -> creates an inbox item.
 */
router.post('/:token/already-paid', (req, res) => {
  try {
    const db = getDatabase();
    const invoice = findInvoiceByToken(db, req.params.token);

    if (!invoice) {
      return res.status(404).json({ error: 'INVOICE_NOT_FOUND', message: 'Invoice not found' });
    }

    const today = getToday(db);
    const { payment_date = today, amount_paise, payment_mode = 'UPI', reference_no, notes } = req.body;

    const claimAmount = amount_paise ? parseInt(amount_paise, 10) : invoice.balance_paise;

    const insert = db.prepare(`
      INSERT INTO inbox_items (
        business_id, invoice_id, customer_id, type, payment_date, amount_paise, payment_mode, reference_no, notes, status
      ) VALUES (?, ?, ?, 'PAYMENT_CLAIM', ?, ?, ?, ?, ?, 'PENDING')
    `).run(
      invoice.business_id,
      invoice.id,
      invoice.customer_id,
      payment_date,
      claimAmount,
      payment_mode,
      reference_no || null,
      notes || 'Customer stated payment already completed'
    );

    const createdItem = db.prepare('SELECT * FROM inbox_items WHERE id = ?').get(insert.lastInsertRowid);

    res.status(201).json({
      message: 'Payment notification submitted to accounting inbox for verification',
      inbox_item: createdItem
    });
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_SUBMIT_CLAIM', message: err.message });
  }
});

/**
 * POST /api/public/pay/:token/dispute
 * Customer raises a dispute directly from the public pay page.
 * Pauses the reminder escalation ladder.
 */
router.post('/:token/dispute', (req, res) => {
  try {
    const db = getDatabase();
    const invoice = findInvoiceByToken(db, req.params.token);

    if (!invoice) {
      return res.status(404).json({ error: 'INVOICE_NOT_FOUND', message: 'Invoice not found' });
    }

    const { reason, amount_paise } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dispute reason is required' });
    }

    const result = disputeInvoice(db, invoice.id, {
      reason: reason.trim(),
      amountPaise: amount_paise
    });

    res.status(201).json({
      message: 'Dispute submitted successfully. Reminders are paused pending resolution.',
      dispute_id: result.disputeId,
      status: 'DISPUTED'
    });
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_SUBMIT_DISPUTE', message: err.message });
  }
});

export default router;
