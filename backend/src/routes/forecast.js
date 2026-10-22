import express from 'express';
import { getDatabase } from '../db.js';
import { calculateCashForecast } from '../services/forecastService.js';

const router = express.Router();

/**
 * GET /api/forecast
 * Returns 13-week cash flow forecast with optional scenario parameter.
 * Query params: ?scenario=late_customer | supplier_delayed | early_customer
 */
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const { scenario, targetCustomerId, targetInvoiceId, openingCashPaise, safetyBufferPaise } = req.query;

    const result = calculateCashForecast(db, {
      scenario,
      targetCustomerId: targetCustomerId ? parseInt(targetCustomerId, 10) : undefined,
      targetInvoiceId: targetInvoiceId ? parseInt(targetInvoiceId, 10) : undefined,
      openingCashPaise: openingCashPaise ? parseInt(openingCashPaise, 10) : undefined,
      safetyBufferPaise: safetyBufferPaise ? parseInt(safetyBufferPaise, 10) : undefined
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_CALCULATE_FORECAST', message: err.message });
  }
});

export default router;
