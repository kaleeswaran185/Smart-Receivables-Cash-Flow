import express from 'express';
import { getDatabase } from '../db.js';

const router = express.Router();

/**
 * GET /api/settings
 * Returns all system settings as key-value pairs.
 */
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => {
      settings[r.key] = r.value;
    });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_FETCH_SETTINGS', message: err.message });
  }
});

/**
 * PUT /api/settings
 * Updates setting values (e.g. demo_date).
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

    const updateTx = db.transaction(() => {
      for (const [key, value] of Object.entries(updates)) {
        stmt.run(key, String(value));
      }
    });

    updateTx();

    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => {
      settings[r.key] = r.value;
    });

    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_UPDATE_SETTINGS', message: err.message });
  }
});

export default router;
