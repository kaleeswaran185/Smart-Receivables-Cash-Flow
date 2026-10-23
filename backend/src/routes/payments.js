import express from 'express';
import { getDatabase } from '../db.js';
import { formatIndianCurrency, rupeesToPaise } from '../lib/money.js';
import { getToday } from '../lib/dateUtils.js';

const router = express.Router();

/**
 * GET /api/payments
 * Lists recorded payments with optional filters.
 */
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const { invoice_id, customer_id, from_date, to_date } = req.query;

    let query = `
      SELECT
        p.*,
        i.invoice_number,
        i.total_paise as invoice_total_paise,
        i.balance_paise as invoice_balance_paise,
        i.status as invoice_status,
        c.name as customer_name
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      JOIN customers c ON p.customer_id = c.id
      WHERE 1=1
    `;

    const params = [];

    if (invoice_id) {
      query += ' AND p.invoice_id = ?';
      params.push(invoice_id);
    }

    if (customer_id) {
      query += ' AND p.customer_id = ?';
      params.push(customer_id);
    }

    if (from_date) {
      query += ' AND p.payment_date >= ?';
      params.push(from_date);
    }

    if (to_date) {
      query += ' AND p.payment_date <= ?';
      params.push(to_date);
    }

    query += ' ORDER BY p.payment_date DESC, p.id DESC';

    const payments = db.prepare(query).all(...params);

    const formatted = payments.map(p => ({
      ...p,
      formatted_amount: formatIndianCurrency(p.amount_paise)
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_FETCH_PAYMENTS', message: err.message });
  }
});

/**
 * POST /api/payments
 * Records a payment against an invoice.
 *
 * Payment logic rules:
 * - full payment gives 'PAID'
 * - partial gives 'PARTIALLY_PAID' with correct remaining amount
 * - overpayment is flagged and rejected
 * - A payment must never auto-mark an invoice paid without an explicit confirm step (confirm: true or confirmPaid: true)
 */
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const demoDate = getToday(db);

    const {
      invoice_id,
      customer_id,
      amount_paise,
      amount_rupees,
      payment_date = demoDate,
      payment_mode = 'UPI',
      reference_no,
      notes,
      status: reqStatus = 'confirmed',
      confirm = false,
      confirmPaid = false,
      allowOverpayment = false,
      recordCredit = false
    } = req.body;

    const paymentStatus = reqStatus.toLowerCase();
    if (!['pending', 'confirmed', 'rejected'].includes(paymentStatus)) {
      return res.status(400).json({
        error: 'INVALID_STATUS',
        message: "Payment status must be 'pending', 'confirmed', or 'rejected'"
      });
    }

    let parsedAmountPaise = 0;
    if (amount_paise !== undefined) {
      parsedAmountPaise = Math.round(Number(amount_paise));
    } else if (amount_rupees !== undefined) {
      parsedAmountPaise = rupeesToPaise(amount_rupees);
    } else {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'amount_paise or amount_rupees is required' });
    }

    if (parsedAmountPaise <= 0 || isNaN(parsedAmountPaise)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Payment amount must be greater than zero' });
    }

    const validModes = ['CASH', 'UPI', 'NEFT', 'RTGS', 'CHEQUE', 'CARD', 'OTHER'];
    const mode = (payment_mode || 'UPI').toUpperCase();
    if (!validModes.includes(mode)) {
      return res.status(400).json({
        error: 'INVALID_PAYMENT_MODE',
        message: `Invalid payment mode '${payment_mode}'. Must be one of: ${validModes.join(', ')}`
      });
    }

    // Case 1: Unmatched Payment (no invoice_id, customer_id provided)
    if (!invoice_id) {
      if (!customer_id) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'invoice_id or customer_id is required' });
      }
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
      if (!customer) {
        return res.status(404).json({ error: 'CUSTOMER_NOT_FOUND', message: 'Customer does not exist' });
      }

      const payStmt = db.prepare(`
        INSERT INTO payments (
          business_id, customer_id, invoice_id, payment_date, amount_paise, payment_mode, reference_no, notes, status
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)
      `);
      const payRes = payStmt.run(
        customer.business_id,
        customer.id,
        payment_date,
        parsedAmountPaise,
        mode,
        reference_no ? reference_no.trim() : null,
        notes ? notes.trim() : null,
        paymentStatus
      );

      const createdPayment = db.prepare('SELECT * FROM payments WHERE id = ?').get(payRes.lastInsertRowid);
      return res.status(201).json({
        payment: {
          ...createdPayment,
          formatted_amount: formatIndianCurrency(createdPayment.amount_paise)
        },
        message: 'Unmatched payment recorded and kept unlinked'
      });
    }

    // Case 2: Invoice-linked Payment
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice_id);
    if (!invoice) {
      return res.status(404).json({ error: 'INVOICE_NOT_FOUND', message: 'Invoice does not exist' });
    }

    if (invoice.status === 'PAID' || invoice.balance_paise === 0) {
      return res.status(400).json({ error: 'INVOICE_ALREADY_PAID', message: 'Invoice is already settled in full' });
    }

    if (invoice.status === 'CANCELLED') {
      return res.status(400).json({ error: 'INVOICE_CANCELLED', message: 'Cannot record payment on a cancelled invoice' });
    }

    // Rule: Overpayment is flagged & recorded as customer credit (never auto-applied)
    let isOverpayment = false;
    let overpaymentPaise = 0;
    if (parsedAmountPaise > invoice.balance_paise) {
      if (allowOverpayment || recordCredit) {
        isOverpayment = true;
        overpaymentPaise = parsedAmountPaise - invoice.balance_paise;
      } else {
        return res.status(400).json({
          error: 'OVERPAYMENT_FLAGGED',
          message: `Payment amount (${formatIndianCurrency(parsedAmountPaise)}) exceeds the invoice outstanding balance (${formatIndianCurrency(invoice.balance_paise)}). Overpayment is recorded as customer credit only upon confirmation.`,
          invoiceBalancePaise: invoice.balance_paise,
          paymentAmountPaise: parsedAmountPaise,
          overpaymentPaise: parsedAmountPaise - invoice.balance_paise
        });
      }
    }

    const isFullSettlement = (parsedAmountPaise >= invoice.balance_paise);
    const isExplicitlyConfirmed = (confirm === true || confirmPaid === true);

    // Rule: A payment must never auto-mark an invoice paid without an explicit confirm step
    if (isFullSettlement && !isExplicitlyConfirmed && !isOverpayment) {
      return res.status(400).json({
        requiresConfirmation: true,
        code: 'CONFIRM_PAID_REQUIRED',
        message: `This payment of ${formatIndianCurrency(parsedAmountPaise)} will clear the remaining balance. To mark the invoice as PAID, please submit with 'confirm: true'.`,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        amountPaise: parsedAmountPaise,
        currentBalancePaise: invoice.balance_paise,
        newBalancePaise: 0
      });
    }

    // Only confirmed payments reduce outstanding balance
    const appliedToInvoicePaise = isOverpayment ? invoice.balance_paise : parsedAmountPaise;
    const shouldReduceBalance = (paymentStatus === 'confirmed');

    let newStatus = 'PARTIALLY_PAID';
    if (isFullSettlement && isExplicitlyConfirmed) {
      newStatus = 'PAID';
    }

    const newPaidPaise = shouldReduceBalance ? (invoice.paid_paise + appliedToInvoicePaise) : invoice.paid_paise;
    const newBalancePaise = shouldReduceBalance ? (invoice.balance_paise - appliedToInvoicePaise) : invoice.balance_paise;

    const recordTx = db.transaction(() => {
      const payStmt = db.prepare(`
        INSERT INTO payments (
          business_id, customer_id, invoice_id, payment_date, amount_paise, payment_mode, reference_no, notes, status, is_overpayment, overpayment_paise
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const payRes = payStmt.run(
        invoice.business_id,
        invoice.customer_id,
        invoice.id,
        payment_date,
        parsedAmountPaise,
        mode,
        reference_no ? reference_no.trim() : null,
        notes ? notes.trim() : null,
        paymentStatus,
        isOverpayment ? 1 : 0,
        overpaymentPaise
      );

      // Record credit if overpayment occurred and payment is confirmed
      if (isOverpayment && shouldReduceBalance) {
        db.prepare(`
          INSERT INTO customer_credits (customer_id, payment_id, amount_paise, notes)
          VALUES (?, ?, ?, ?)
        `).run(
          invoice.customer_id,
          payRes.lastInsertRowid,
          overpaymentPaise,
          `Overpayment credit from invoice ${invoice.invoice_number}`
        );
      }

      if (shouldReduceBalance) {
        db.prepare(`
          UPDATE invoices
          SET paid_paise = ?, balance_paise = ?, status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newPaidPaise, newBalancePaise, newStatus, invoice.id);
      }

      return payRes.lastInsertRowid;
    });

    const paymentId = recordTx();
    const createdPayment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
    const updatedInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice.id);

    res.status(201).json({
      payment: {
        ...createdPayment,
        formatted_amount: formatIndianCurrency(createdPayment.amount_paise)
      },
      invoice: {
        id: updatedInvoice.id,
        invoice_number: updatedInvoice.invoice_number,
        status: updatedInvoice.status,
        paid_paise: updatedInvoice.paid_paise,
        balance_paise: updatedInvoice.balance_paise,
        formatted_paid: formatIndianCurrency(updatedInvoice.paid_paise),
        formatted_balance: formatIndianCurrency(updatedInvoice.balance_paise)
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_RECORD_PAYMENT', message: err.message });
  }
});

export default router;
