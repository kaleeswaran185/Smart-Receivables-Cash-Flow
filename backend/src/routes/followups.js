import express from 'express';
import { getDatabase } from '../db.js';
import { getActionableFollowups, recordReminderSent } from '../services/reminderService.js';

const router = express.Router();

/**
 * GET /api/followups
 * Retrieves all actionable invoice reminders eligible to be sent today.
 */
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const followups = getActionableFollowups(db);
    res.json(followups);
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_GET_FOLLOWUPS', message: err.message });
  }
});

/**
 * Helper router for reminders
 */
export const remindersRouter = express.Router();

/**
 * POST /api/reminders/:id/sent
 * Marks an existing or newly dispatched reminder as sent.
 */
remindersRouter.post('/:id/sent', (req, res) => {
  try {
    const db = getDatabase();
    const reminderId = req.params.id;
    const { stage, channel, message_body, sent_at } = req.body;

    // Check if :id is a numeric existing reminder ID or an invoice ID
    const existingReminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(reminderId);

    if (existingReminder) {
      db.prepare(`
        UPDATE reminders
        SET status = 'SENT', sent_at = COALESCE(?, CURRENT_TIMESTAMP), message_body = COALESCE(?, message_body)
        WHERE id = ?
      `).run(sent_at || null, message_body || null, reminderId);

      const updated = db.prepare('SELECT * FROM reminders WHERE id = ?').get(reminderId);
      return res.json({ message: 'Reminder marked as sent', reminder: updated });
    } else {
      // If :id was actually passed as the invoice ID or a new record is requested
      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(reminderId);
      if (invoice) {
        const created = recordReminderSent(db, {
          invoiceId: invoice.id,
          stage: stage !== undefined ? stage : 0,
          channel: channel || 'WHATSAPP',
          messageBody: message_body,
          sentAt: sent_at
        });
        return res.status(201).json({ message: 'Reminder created and marked as sent', reminder: created });
      }
      return res.status(404).json({ error: 'REMINDER_NOT_FOUND', message: 'No reminder or invoice found with given ID' });
    }
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_MARK_REMINDER_SENT', message: err.message });
  }
});

/**
 * POST /api/reminders/sent
 * Records a dispatched reminder for an invoice.
 */
remindersRouter.post('/sent', (req, res) => {
  try {
    const db = getDatabase();
    const { invoice_id, stage, channel, message_body, sent_at } = req.body;

    if (!invoice_id) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'invoice_id is required' });
    }

    const created = recordReminderSent(db, {
      invoiceId: invoice_id,
      stage: stage !== undefined ? stage : 0,
      channel: channel || 'WHATSAPP',
      messageBody: message_body,
      sentAt: sent_at
    });

    res.status(201).json({ message: 'Reminder recorded as sent', reminder: created });
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_RECORD_REMINDER', message: err.message });
  }
});

export default router;
