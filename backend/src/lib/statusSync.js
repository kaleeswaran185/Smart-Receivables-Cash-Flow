import { addDays } from './dateUtils.js';

/**
 * Derives invoice status at read time.
 * Invariant priority:
 * 1. Paid: confirmed payments >= total_paise (total_paise > 0)
 * 2. Disputed: has an open dispute
 * 3. Part Paid: confirmed payments > 0 and < total_paise
 * 4. Overdue: due_date < today
 * 5. Due Soon: today <= due_date <= today + dueSoonDays (0-7 days, configurable)
 * 6. Sent: sent flag is true or invoice is not draft
 * 7. Draft: draft status
 *
 * @param {object} invoice
 * @param {object} options
 * @param {string} options.today - YYYY-MM-DD
 * @param {number} [options.dueSoonDays=7]
 * @param {number} [options.confirmedPaidPaise]
 * @param {boolean} [options.hasOpenDispute]
 * @returns {string} Derived status string
 */
export function deriveInvoiceStatus(invoice, { today, dueSoonDays = 7, confirmedPaidPaise = null, hasOpenDispute = null } = {}) {
  if (invoice.status === 'CANCELLED') {
    return 'CANCELLED';
  }

  const totalPaise = Number(invoice.total_paise || 0);
  const paidPaise = confirmedPaidPaise !== null ? Number(confirmedPaidPaise) : Number(invoice.paid_paise || 0);
  const isDraft = invoice.status === 'DRAFT' || invoice.is_draft === 1 || invoice.is_draft === true;

  // 1. Paid
  if (totalPaise > 0 && paidPaise >= totalPaise) {
    return 'PAID';
  }

  // 2. Disputed
  if (hasOpenDispute === true || invoice.has_open_dispute === 1 || invoice.status === 'DISPUTED') {
    return 'DISPUTED';
  }

  // 3. Part Paid
  if (paidPaise > 0 && paidPaise < totalPaise) {
    return 'PARTIALLY_PAID';
  }

  // 4. Overdue (due_date < today)
  if (invoice.due_date && today && invoice.due_date < today) {
    return 'OVERDUE';
  }

  // 5. Due Soon (today <= due_date <= today + dueSoonDays)
  if (invoice.due_date && today) {
    const dueSoonEnd = addDays(today, Number(dueSoonDays) || 7);
    if (invoice.due_date >= today && invoice.due_date <= dueSoonEnd) {
      return 'DUE_SOON';
    }
  }

  // 6. Sent
  if (!isDraft) {
    return 'SENT';
  }

  // 7. Draft
  return 'DRAFT';
}

/**
 * Compatibility helper. In accordance with SPEC Section B.4, volatile statuses
 * (OVERDUE, DUE_SOON, PARTIALLY_PAID, PAID) are NOT stored in the database.
 * Status is derived at read time by deriveInvoiceStatus.
 */
export function syncInvoiceStatuses(db, today) {
  // No-op to preserve database integrity and ensure read-time derivation
  return;
}

export default deriveInvoiceStatus;
