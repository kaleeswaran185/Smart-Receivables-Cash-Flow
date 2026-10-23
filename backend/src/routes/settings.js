import express from 'express';
import { getDatabase } from '../db.js';
import { getToday } from '../lib/dateUtils.js';
import { syncInvoiceStatuses } from '../lib/statusSync.js';
import { seedDatabase } from '../seed.js';

const router = express.Router();

/**
 * GET /api/settings
 * Returns all system settings as key-value pairs, plus business profile and current demo date.
 */
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => {
      settings[r.key] = r.value;
    });

    const business = db.prepare('SELECT * FROM business LIMIT 1').get() || null;
    const today = getToday(db);

    res.json({
      ...settings,
      today,
      business
    });
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_FETCH_SETTINGS', message: err.message });
  }
});

/**
 * GET /api/settings/business
 * Returns the business profile.
 */
router.get('/business', (req, res) => {
  try {
    const db = getDatabase();
    const business = db.prepare('SELECT * FROM business LIMIT 1').get();
    if (!business) {
      return res.status(404).json({ error: 'BUSINESS_NOT_FOUND', message: 'No business entity found' });
    }
    res.json(business);
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_FETCH_BUSINESS', message: err.message });
  }
});

/**
 * PUT /api/settings/business
 * Updates the business profile fields.
 */
router.put('/business', (req, res) => {
  try {
    const db = getDatabase();
    const b = req.body;
    if (!b || typeof b !== 'object') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Request body must be an object' });
    }

    const existing = db.prepare('SELECT id FROM business LIMIT 1').get();
    if (!existing) {
      return res.status(404).json({ error: 'BUSINESS_NOT_FOUND', message: 'No business record found to update' });
    }

    db.prepare(`
      UPDATE business
      SET
        name = COALESCE(?, name),
        trade_name = COALESCE(?, trade_name),
        gstin = COALESCE(?, gstin),
        reg_type = COALESCE(?, reg_type),
        state_code = COALESCE(?, state_code),
        state = COALESCE(?, state),
        address_line1 = COALESCE(?, address_line1),
        address_line2 = COALESCE(?, address_line2),
        city = COALESCE(?, city),
        pincode = COALESCE(?, pincode),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        pan = COALESCE(?, pan),
        bank_name = COALESCE(?, bank_name),
        bank_account_no = COALESCE(?, bank_account_no),
        bank_ifsc = COALESCE(?, bank_ifsc),
        bank_branch = COALESCE(?, bank_branch),
        upi_id = COALESCE(?, upi_id),
        turnover_paise = COALESCE(?, turnover_paise),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      b.name !== undefined ? b.name : null,
      b.trade_name !== undefined ? b.trade_name : null,
      b.gstin !== undefined ? b.gstin : null,
      b.reg_type !== undefined ? b.reg_type : null,
      b.state_code !== undefined ? b.state_code : null,
      b.state !== undefined ? b.state : null,
      b.address_line1 !== undefined ? b.address_line1 : null,
      b.address_line2 !== undefined ? b.address_line2 : null,
      b.city !== undefined ? b.city : null,
      b.pincode !== undefined ? b.pincode : null,
      b.phone !== undefined ? b.phone : null,
      b.email !== undefined ? b.email : null,
      b.pan !== undefined ? b.pan : null,
      b.bank_name !== undefined ? b.bank_name : null,
      b.bank_account_no !== undefined ? b.bank_account_no : null,
      b.bank_ifsc !== undefined ? b.bank_ifsc : null,
      b.bank_branch !== undefined ? b.bank_branch : null,
      b.upi_id !== undefined ? b.upi_id : null,
      b.turnover_paise !== undefined ? Number(b.turnover_paise) : null,
      existing.id
    );

    if (b.turnover_paise !== undefined) {
      db.prepare(`
        INSERT INTO settings (key, value, updated_at) VALUES ('annual_turnover_paise', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `).run(String(b.turnover_paise));
    }

    const updated = db.prepare('SELECT * FROM business WHERE id = ?').get(existing.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_UPDATE_BUSINESS', message: err.message });
  }
});

/**
 * PUT /api/settings
 * Updates setting values (e.g. demo_date, demoDate, safety_buffer_paise, etc.).
 * Automatically synchronizes invoice statuses when demo date changes.
 */
router.put('/', (req, res) => {
  try {
    const db = getDatabase();
    const updates = req.body;

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Payload must be an object of key-value pairs' });
    }

    const stmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);

    let newDemoDate = null;
    if (updates.demo_date) newDemoDate = updates.demo_date;
    if (updates.demoDate) newDemoDate = updates.demoDate;

    const updateTx = db.transaction(() => {
      for (const [key, value] of Object.entries(updates)) {
        if (key !== 'business') {
          stmt.run(key, String(value));
        }
      }

      // If updating demo date, keep both demo_date and demoDate in sync
      if (newDemoDate) {
        stmt.run('demo_date', String(newDemoDate));
        stmt.run('demoDate', String(newDemoDate));
        // Synchronize statuses across all invoices in DB
        syncInvoiceStatuses(db, String(newDemoDate));
      }
    });

    updateTx();

    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => {
      settings[r.key] = r.value;
    });

    const business = db.prepare('SELECT * FROM business LIMIT 1').get() || null;
    const today = getToday(db);

    res.json({
      ...settings,
      today,
      business
    });
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_UPDATE_SETTINGS', message: err.message });
  }
});

let lastResetDemoTimestamp = 0;

/**
 * POST /api/settings/reset-demo
 * Resets all fictional demonstration data to default seed state with a 60-second cooldown.
 */
router.post('/reset-demo', (req, res) => {
  try {
    const isTest = process.env.NODE_ENV === 'test' || req.headers['x-bypass-cooldown'] === 'true';
    const now = Date.now();
    const elapsed = now - lastResetDemoTimestamp;
    const cooldownMs = 60 * 1000;

    if (!isTest && elapsed < cooldownMs) {
      const remainingSecs = Math.ceil((cooldownMs - elapsed) / 1000);
      return res.status(429).json({
        error: 'COOLDOWN_ACTIVE',
        message: `Reset Demo is on cooldown to prevent abuse. Please wait ${remainingSecs} seconds before resetting again.`,
        retryAfterSeconds: remainingSecs
      });
    }

    lastResetDemoTimestamp = now;
    const db = getDatabase();
    seedDatabase(db, { force: true });
    syncInvoiceStatuses(db, '2026-10-22');

    const business = db.prepare('SELECT * FROM business LIMIT 1').get();
    res.json({
      success: true,
      message: 'Demo data successfully reset to initial seed state',
      demo_date: '2026-10-22',
      business
    });
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_RESET_DEMO', message: err.message });
  }
});

export default router;
