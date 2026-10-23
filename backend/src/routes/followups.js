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
/**
 * POST /api/reminders/:id/sent
 * Marks an existing or newly dispatched reminder as sent.
 */
remindersRouter.post('/:id/sent', (req, res) => {
  try {
    const db = getDatabase();
    const idParam = req.params.id;
    const { stage, channel, message_body, sent_at } = req.body;

    // Check if :id is an invoice ID
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(idParam);

    if (invoice) {
      if (invoice.status === 'PAID' || invoice.balance_paise === 0) {
        return res.status(400).json({ error: 'INVOICE_ALREADY_PAID', message: 'Cannot send reminder for an invoice that is already settled' });
      }
      if (invoice.status === 'CANCELLED') {
        return res.status(400).json({ error: 'INVOICE_CANCELLED', message: 'Cannot send reminder on a cancelled invoice' });
      }
      if (invoice.status === 'DISPUTED') {
        return res.status(400).json({ error: 'INVOICE_DISPUTED', message: 'Reminders are paused because this invoice is under dispute' });
      }

      const targetStage = stage !== undefined ? stage : 0;
      const created = recordReminderSent(db, {
        invoiceId: invoice.id,
        stage: targetStage,
        channel: channel || 'WHATSAPP',
        messageBody: message_body,
        sentAt: sent_at
      });

      return res.status(201).json({ message: `Reminder marked as sent for Invoice ${invoice.invoice_number}`, reminder: created });
    }

    // Otherwise, check if :id is a numeric reminder record ID
    const existingReminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(idParam);
    if (existingReminder) {
      if (existingReminder.status === 'SENT') {
        return res.status(400).json({
          error: 'REMINDER_ALREADY_SENT',
          message: 'Reminder has already been marked as sent'
        });
      }

      db.prepare(`
        UPDATE reminders
        SET status = 'SENT', sent_at = COALESCE(?, CURRENT_TIMESTAMP), message_body = COALESCE(?, message_body)
        WHERE id = ?
      `).run(sent_at || null, message_body || null, idParam);

      const updated = db.prepare('SELECT * FROM reminders WHERE id = ?').get(idParam);
      return res.json({ message: 'Reminder marked as sent', reminder: updated });
    }

    return res.status(404).json({ error: 'REMINDER_NOT_FOUND', message: 'No reminder or invoice found with given ID' });
  } catch (err) {
    if (err.code === 'REMINDER_ALREADY_SENT') {
      return res.status(400).json({ error: 'REMINDER_ALREADY_SENT', message: err.message });
    }
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

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice_id);
    if (!invoice) {
      return res.status(404).json({ error: 'INVOICE_NOT_FOUND', message: 'Invoice not found' });
    }
    if (invoice.status === 'PAID' || invoice.balance_paise === 0) {
      return res.status(400).json({ error: 'INVOICE_ALREADY_PAID', message: 'Cannot send reminder for an invoice that is already settled' });
    }
    if (invoice.status === 'CANCELLED') {
      return res.status(400).json({ error: 'INVOICE_CANCELLED', message: 'Cannot send reminder on a cancelled invoice' });
    }
    if (invoice.status === 'DISPUTED') {
      return res.status(400).json({ error: 'INVOICE_DISPUTED', message: 'Reminders are paused because this invoice is under dispute' });
    }

    const targetStage = stage !== undefined ? stage : 0;
    const created = recordReminderSent(db, {
      invoiceId: invoice_id,
      stage: targetStage,
      channel: channel || 'WHATSAPP',
      messageBody: message_body,
      sentAt: sent_at
    });

    res.status(201).json({ message: 'Reminder recorded as sent', reminder: created });
  } catch (err) {
    if (err.code === 'REMINDER_ALREADY_SENT') {
      return res.status(400).json({ error: 'REMINDER_ALREADY_SENT', message: err.message });
    }
    res.status(500).json({ error: 'FAILED_TO_RECORD_REMINDER', message: err.message });
  }
});

export default router;
