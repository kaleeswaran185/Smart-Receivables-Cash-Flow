import express from 'express';
import { getDatabase } from '../db.js';
import { calculateChasePriority, getDisputeList } from '../services/chaseService.js';

const router = express.Router();

/**
 * GET /api/chase
 * Returns prioritized invoices with 0-100 score, reasons, and labels.
 */
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const result = calculateChasePriority(db, req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_CALCULATE_CHASE_PRIORITY', message: err.message });
  }
});

/**
 * GET /api/chase/disputes
 * Returns separate resolve dispute list for excluded disputed invoices.
 */
router.get('/disputes', (req, res) => {
  try {
    const db = getDatabase();
    const result = getDisputeList(db, req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_GET_DISPUTE_LIST', message: err.message });
  }
});

export default router;
