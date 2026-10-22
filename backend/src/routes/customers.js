import express from 'express';
import { getDatabase } from '../db.js';
import { validateGSTIN, stateFromGSTIN } from '../lib/gst.js';
import { calculateCustomerStats } from '../lib/customerStats.js';
import { rupeesToPaise } from '../lib/money.js';

const router = express.Router();

/**
 * GET /api/customers
 * Returns all customers with their real-time payment stats & reliability grading.
 */
router.get('/', (req, res) => {
  try {
    const db = getDatabase();

    const customers = db.prepare(`
      SELECT * FROM customers ORDER BY name ASC
    `).all();

    const demoDateSetting = db.prepare("SELECT value FROM settings WHERE key = 'demo_date'").get();
    const demoDate = demoDateSetting ? demoDateSetting.value : '2026-10-22';

    const invoices = db.prepare('SELECT * FROM invoices').all();
    const payments = db.prepare('SELECT * FROM payments').all();

    // Group invoices and payments by customer_id
    const invoicesByCust = new Map();
    invoices.forEach(inv => {
      if (!invoicesByCust.has(inv.customer_id)) invoicesByCust.set(inv.customer_id, []);
      invoicesByCust.get(inv.customer_id).push(inv);
    });

    const paymentsByCust = new Map();
    payments.forEach(pay => {
      if (!paymentsByCust.has(pay.customer_id)) paymentsByCust.set(pay.customer_id, []);
      paymentsByCust.get(pay.customer_id).push(pay);
    });

    const enriched = customers.map(cust => {
      const custInvoices = invoicesByCust.get(cust.id) || [];
      const custPayments = paymentsByCust.get(cust.id) || [];

      const stats = calculateCustomerStats({
        invoices: custInvoices,
        payments: custPayments,
        demoDate
      });

      return {
        ...cust,
        stats
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_FETCH_CUSTOMERS', message: err.message });
  }
});

/**
 * GET /api/customers/:id
 * Returns single customer with stats, recent invoices, and payments.
 */
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);

    if (!customer) {
      return res.status(404).json({ error: 'CUSTOMER_NOT_FOUND', message: 'Customer does not exist' });
    }

    const demoDateSetting = db.prepare("SELECT value FROM settings WHERE key = 'demo_date'").get();
    const demoDate = demoDateSetting ? demoDateSetting.value : '2026-10-22';

    const invoices = db.prepare('SELECT * FROM invoices WHERE customer_id = ? ORDER BY invoice_date DESC').all(customer.id);
    const payments = db.prepare('SELECT * FROM payments WHERE customer_id = ? ORDER BY payment_date DESC').all(customer.id);

    const stats = calculateCustomerStats({
      invoices,
      payments,
      demoDate
    });

    res.json({
      ...customer,
      stats,
      invoices,
      payments
    });
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_FETCH_CUSTOMER', message: err.message });
  }
});

/**
 * POST /api/customers
 * Creates a new customer with GSTIN validation and state extraction.
 */
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const {
      name,
      company_name,
      gstin,
      state_code,
      state,
      address,
      city,
      pincode,
      phone,
      email,
      credit_limit_paise,
      credit_limit_rupees,
      credit_period_days = 30,
      notes
    } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Customer name is required' });
    }

    let cleanGSTIN = null;
    let resolvedStateCode = state_code || null;
    let resolvedState = state || null;

    if (gstin && typeof gstin === 'string' && gstin.trim()) {
      cleanGSTIN = gstin.trim().toUpperCase();
      if (!validateGSTIN(cleanGSTIN)) {
        return res.status(400).json({
          error: 'INVALID_GSTIN',
          message: `The provided GSTIN '${cleanGSTIN}' is structurally invalid or fails the Mod-36 checksum.`
        });
      }
      resolvedStateCode = cleanGSTIN.substring(0, 2);
      resolvedState = stateFromGSTIN(cleanGSTIN);
    } else if (resolvedStateCode) {
      resolvedState = stateFromGSTIN(resolvedStateCode) || resolvedState;
    }

    // Default business_id = 1
    const defaultBiz = db.prepare('SELECT id FROM business LIMIT 1').get();
    const businessId = defaultBiz ? defaultBiz.id : 1;

    let parsedCreditLimit = 0;
    if (credit_limit_paise !== undefined) {
      parsedCreditLimit = Math.round(Number(credit_limit_paise));
    } else if (credit_limit_rupees !== undefined) {
      parsedCreditLimit = rupeesToPaise(credit_limit_rupees);
    }

    const insertStmt = db.prepare(`
      INSERT INTO customers (
        business_id, name, company_name, gstin, state_code, state,
        address, city, pincode, phone, email, credit_limit_paise, credit_period_days, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      businessId,
      name.trim(),
      company_name ? company_name.trim() : null,
      cleanGSTIN,
      resolvedStateCode,
      resolvedState,
      address || null,
      city || null,
      pincode || null,
      phone || null,
      email || null,
      parsedCreditLimit,
      Number(credit_period_days) || 30,
      notes || null
    );

    const created = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_CREATE_CUSTOMER', message: err.message });
  }
});

export default router;
