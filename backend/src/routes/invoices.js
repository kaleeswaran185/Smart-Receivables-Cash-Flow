import express from 'express';
import { getDatabase } from '../db.js';
import { calculateInvoice } from '../lib/gst.js';
import { formatIndianCurrency, rupeesToPaise } from '../lib/money.js';

const router = express.Router();

function getDemoDate(db) {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'demo_date'").get();
  return row ? row.value : '2026-10-22';
}

/**
 * GET /api/invoices
 * Lists invoices with search and filters (status, customer_id, from_date, to_date).
 */
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const demoDate = getDemoDate(db);

    const {
      status,
      customer_id,
      from_date,
      to_date,
      search
    } = req.query;

    let query = `
      SELECT
        i.*,
        c.name as customer_name,
        c.company_name as customer_company,
        c.gstin as customer_gstin,
        c.state as customer_state,
        c.phone as customer_phone
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE 1=1
    `;

    const params = [];

    if (customer_id) {
      query += ' AND i.customer_id = ?';
      params.push(customer_id);
    }

    if (from_date) {
      query += ' AND i.invoice_date >= ?';
      params.push(from_date);
    }

    if (to_date) {
      query += ' AND i.invoice_date <= ?';
      params.push(to_date);
    }

    if (status) {
      const lowerStatus = status.toLowerCase();
      if (lowerStatus === 'due_soon') {
        // Due within 7 days from demoDate, unpaid
        query += `
          AND (
            LOWER(i.status) = 'due_soon'
            OR (
              i.due_date >= ?
              AND i.due_date <= date(?, '+7 day')
              AND i.balance_paise > 0
              AND i.status NOT IN ('PAID', 'CANCELLED', 'DRAFT')
            )
          )
        `;
        params.push(demoDate, demoDate);
      } else if (lowerStatus === 'overdue') {
        // Due date past demoDate, unpaid
        query += `
          AND (
            LOWER(i.status) = 'overdue'
            OR (
              i.due_date < ?
              AND i.balance_paise > 0
              AND i.status NOT IN ('PAID', 'CANCELLED', 'DRAFT')
            )
          )
        `;
        params.push(demoDate);
      } else {
        query += ' AND LOWER(i.status) = LOWER(?)';
        params.push(status);
      }
    }

    if (search && search.trim()) {
      query += ' AND (i.invoice_number LIKE ? OR c.name LIKE ? OR c.company_name LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY i.invoice_date DESC, i.id DESC';

    const invoices = db.prepare(query).all(...params);

    const formatted = invoices.map(inv => ({
      ...inv,
      formatted_total: formatIndianCurrency(inv.total_paise),
      formatted_balance: formatIndianCurrency(inv.balance_paise),
      formatted_paid: formatIndianCurrency(inv.paid_paise)
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_FETCH_INVOICES', message: err.message });
  }
});

/**
 * GET /api/invoices/:id
 * Returns full invoice details with items, payments, reminders, disputes, promises, and timeline.
 */
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const invoice = db.prepare(`
      SELECT
        i.*,
        c.name as customer_name,
        c.company_name as customer_company,
        c.gstin as customer_gstin,
        c.state as customer_state,
        c.state_code as customer_state_code,
        c.address as customer_address,
        c.city as customer_city,
        c.pincode as customer_pincode,
        c.phone as customer_phone,
        c.email as customer_email,
        b.name as business_name,
        b.gstin as business_gstin,
        b.state as business_state,
        b.pan as business_pan,
        b.bank_name,
        b.bank_account_no,
        b.bank_ifsc,
        b.upi_id
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      JOIN business b ON i.business_id = b.id
      WHERE i.id = ?
    `).get(req.params.id);

    if (!invoice) {
      return res.status(404).json({ error: 'INVOICE_NOT_FOUND', message: 'Invoice does not exist' });
    }

    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC').all(invoice.id);
    const payments = db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date ASC').all(invoice.id);
    const reminders = db.prepare('SELECT * FROM reminders WHERE invoice_id = ? ORDER BY scheduled_at ASC').all(invoice.id);
    const disputes = db.prepare('SELECT * FROM disputes WHERE invoice_id = ? ORDER BY created_at ASC').all(invoice.id);
    const promises = db.prepare('SELECT * FROM promises WHERE invoice_id = ? ORDER BY promised_date ASC').all(invoice.id);

    // Build chronological timeline of all events
    const timeline = [];

    // Event 1: Invoice Created
    timeline.push({
      date: invoice.invoice_date,
      type: 'INVOICE_CREATED',
      title: 'Invoice Issued',
      description: `Invoice ${invoice.invoice_number} generated for ${formatIndianCurrency(invoice.total_paise)}`
    });

    // Event: Reminders
    reminders.forEach(r => {
      timeline.push({
        date: r.sent_at || r.scheduled_at,
        type: 'REMINDER_SENT',
        title: `Reminder: ${r.reminder_type.replace('_', ' ')}`,
        description: `Sent via ${r.channel}: ${r.message_body || 'Standard reminder'}`
      });
    });

    // Event: Payments
    payments.forEach(p => {
      timeline.push({
        date: p.payment_date,
        type: 'PAYMENT_RECEIVED',
        title: `Payment Received: ${formatIndianCurrency(p.amount_paise)}`,
        description: `Mode: ${p.payment_mode}${p.reference_no ? `, Ref: ${p.reference_no}` : ''}`
      });
    });

    // Event: Disputes
    disputes.forEach(d => {
      timeline.push({
        date: d.created_at,
        type: 'DISPUTE_RAISED',
        title: `Dispute Raised (${d.status})`,
        description: `${d.reason} (Disputed: ${formatIndianCurrency(d.disputed_amount_paise)})`
      });
    });

    // Event: Promises
    promises.forEach(pr => {
      timeline.push({
        date: pr.created_at || pr.promised_date,
        type: 'PROMISE_MADE',
        title: `Promise to Pay (${pr.status})`,
        description: `Customer committed to pay ${formatIndianCurrency(pr.promised_amount_paise)} by ${pr.promised_date}`
      });
    });

    // Sort timeline chronologically
    timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      ...invoice,
      formatted_total: formatIndianCurrency(invoice.total_paise),
      formatted_balance: formatIndianCurrency(invoice.balance_paise),
      formatted_paid: formatIndianCurrency(invoice.paid_paise),
      items: items.map(item => ({
        ...item,
        formatted_rate: formatIndianCurrency(item.rate_paise),
        formatted_taxable: formatIndianCurrency(item.taxable_paise),
        formatted_total: formatIndianCurrency(item.total_paise)
      })),
      payments,
      reminders,
      disputes,
      promises,
      timeline
    });
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_FETCH_INVOICE', message: err.message });
  }
});

/**
 * POST /api/invoices
 * Creates invoice. Recalculates all totals on the backend.
 * Never trusts frontend numbers.
 */
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const demoDate = getDemoDate(db);

    const {
      customer_id,
      invoice_number,
      invoice_date = demoDate,
      due_date,
      place_of_supply,
      items = [],
      notes,
      terms,
      status = 'SENT'
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'customer_id is required' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invoice must contain at least one line item' });
    }

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
    if (!customer) {
      return res.status(404).json({ error: 'CUSTOMER_NOT_FOUND', message: 'Selected customer does not exist' });
    }

    const business = db.prepare('SELECT * FROM business LIMIT 1').get();
    if (!business) {
      return res.status(500).json({ error: 'BUSINESS_NOT_FOUND', message: 'Business record missing' });
    }

    // Backend recalculation - IGNORES any frontend provided totals!
    const calculation = calculateInvoice({
      business: {
        gstin: business.gstin,
        stateCode: business.state_code,
        state: business.state,
        regType: business.reg_type
      },
      customer: {
        gstin: customer.gstin,
        stateCode: customer.state_code,
        state: customer.state
      },
      items,
      placeOfSupply: place_of_supply || customer.state
    });

    const { summary, items: calculatedItems } = calculation;

    // Generate unique invoice number if not provided
    let finalInvNumber = invoice_number;
    if (!finalInvNumber || !finalInvNumber.trim()) {
      const countRow = db.prepare('SELECT COUNT(*) as count FROM invoices').get();
      finalInvNumber = `INV-2026-${1000 + countRow.count + 1}`;
    }

    // Default due date = invoice_date + customer credit period
    let finalDueDate = due_date;
    if (!finalDueDate) {
      const d = new Date(invoice_date);
      d.setDate(d.getDate() + (customer.credit_period_days || 30));
      finalDueDate = d.toISOString().split('T')[0];
    }

    let initialStatus = status.toUpperCase();
    if (!['DRAFT', 'SENT', 'UNPAID', 'DUE_SOON', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'DISPUTED'].includes(initialStatus)) {
      initialStatus = 'SENT';
    }

    const insertTx = db.transaction(() => {
      const invStmt = db.prepare(`
        INSERT INTO invoices (
          business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, place_of_supply,
          subtotal_paise, discount_paise, taxable_paise, cgst_paise, sgst_paise, igst_paise,
          round_off_paise, total_paise, paid_paise, balance_paise, status, notes, terms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const invRes = invStmt.run(
        business.id,
        customer.id,
        finalInvNumber.trim(),
        calculation.invoiceType,
        invoice_date,
        finalDueDate,
        calculation.placeOfSupply || customer.state,
        summary.subtotalPaise,
        summary.discountPaise,
        summary.taxablePaise,
        summary.cgstPaise,
        summary.sgstPaise,
        summary.igstPaise,
        summary.roundOffPaise,
        summary.totalPaise,
        0, // paid_paise
        summary.totalPaise, // balance_paise
        initialStatus,
        notes || null,
        terms || null
      );

      const invoiceId = invRes.lastInsertRowid;

      const itemStmt = db.prepare(`
        INSERT INTO invoice_items (
          invoice_id, description, hsn_code, qty, unit, rate_paise, discount_paise,
          taxable_paise, gst_rate, cgst_paise, sgst_paise, igst_paise, total_paise
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      calculatedItems.forEach(item => {
        itemStmt.run(
          invoiceId,
          item.description,
          item.hsnCode,
          item.qty,
          item.unit,
          item.ratePaise,
          item.discountPaise,
          item.taxablePaise,
          item.gstRate,
          item.cgstPaise,
          item.sgstPaise,
          item.igstPaise,
          item.totalPaise
        );
      });

      return invoiceId;
    });

    const newInvoiceId = insertTx();
    const createdInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(newInvoiceId);
    const createdItems = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(newInvoiceId);

    res.status(201).json({
      ...createdInvoice,
      items: createdItems,
      calculation
    });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed: invoices.invoice_number')) {
      return res.status(400).json({ error: 'DUPLICATE_INVOICE_NUMBER', message: 'Invoice number already exists' });
    }
    res.status(500).json({ error: 'FAILED_TO_CREATE_INVOICE', message: err.message });
  }
});

/**
 * PUT /api/invoices/:id
 * Updates invoice status, notes, or recalculates items.
 */
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);

    if (!invoice) {
      return res.status(404).json({ error: 'INVOICE_NOT_FOUND', message: 'Invoice does not exist' });
    }

    const { status, notes, terms, due_date } = req.body;

    const updates = [];
    const params = [];

    if (status !== undefined) {
      const validStatus = status.toUpperCase();
      updates.push('status = ?');
      params.push(validStatus);
    }

    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }

    if (terms !== undefined) {
      updates.push('terms = ?');
      params.push(terms);
    }

    if (due_date !== undefined) {
      updates.push('due_date = ?');
      params.push(due_date);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    if (updates.length > 1) {
      params.push(invoice.id);
      db.prepare(`UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_UPDATE_INVOICE', message: err.message });
  }
});

export default router;
