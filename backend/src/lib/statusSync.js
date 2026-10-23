import { addDays } from './dateUtils.js';

/**
 * Synchronizes invoice statuses in the database against the given reference 'today' date.
 * - Invoices with balance_paise > 0 and paid_paise == 0:
 *   - due_date < today -> 'OVERDUE'
 *   - due_date >= today and due_date <= today + 7 days -> 'DUE_SOON'
 *   - due_date > today + 7 days -> 'SENT'
 * Preserves 'PAID', 'CANCELLED', 'DRAFT', 'DISPUTED', and 'PARTIALLY_PAID'.
 *
 * @param {object} db - better-sqlite3 database instance
 * @param {string} today - Reference date string in YYYY-MM-DD
 */
export function syncInvoiceStatuses(db, today) {
  if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return;
  }

  const dueSoonCutoff = addDays(today, 7);

  // 1. Mark overdue for invoices with due_date < today
  db.prepare(`
    UPDATE invoices
    SET status = 'OVERDUE', updated_at = CURRENT_TIMESTAMP
    WHERE status IN ('SENT', 'UNPAID', 'DUE_SOON')
      AND due_date < ?
      AND balance_paise > 0
      AND paid_paise = 0
  `).run(today);

  // 2. Mark due soon for invoices due within next 7 days [today, today + 7]
  db.prepare(`
    UPDATE invoices
    SET status = 'DUE_SOON', updated_at = CURRENT_TIMESTAMP
    WHERE status IN ('SENT', 'UNPAID', 'OVERDUE')
      AND due_date >= ?
      AND due_date <= ?
      AND balance_paise > 0
      AND paid_paise = 0
  `).run(today, dueSoonCutoff);

  // 3. Mark sent for invoices due beyond 7 days
  db.prepare(`
    UPDATE invoices
    SET status = 'SENT', updated_at = CURRENT_TIMESTAMP
    WHERE status IN ('OVERDUE', 'DUE_SOON')
      AND due_date > ?
      AND balance_paise > 0
      AND paid_paise = 0
  `).run(dueSoonCutoff);
}

export default syncInvoiceStatuses;
