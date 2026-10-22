/**
 * Customer statistics and credit reliability calculation.
 * Computes:
 * - Average payment delay (in days)
 * - Percentage of payments made on time
 * - Reliability Grade (A, B, C) with qualitative explanation
 */

/**
 * Calculates date difference in whole days (dateA - dateB).
 * Positive means dateA is after dateB (delayed).
 * @param {string|Date} dateA
 * @param {string|Date} dateB
 * @returns {number} Difference in days
 */
export function differenceInDays(dateA, dateB) {
  const d1 = new Date(dateA);
  const d2 = new Date(dateB);
  const diffTime = d1.getTime() - d2.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculates reliability metrics and grades for a customer.
 *
 * Grade Criteria:
 * - Grade A: >= 80% on-time and average delay <= 5 days and 0 overdue (Excellent track record)
 * - Grade B: 50% - 79% on-time and average delay <= 15 days (Moderate credit risk)
 * - Grade C: < 50% on-time OR average delay > 15 days OR multiple overdue (High credit risk)
 *
 * @param {object} params
 * @param {Array<object>} params.invoices - Customer's invoices
 * @param {Array<object>} params.payments - Customer's payments
 * @param {string} [params.demoDate='2026-10-22'] - Reference demo date
 * @returns {object} Calculated stats
 */
export function calculateCustomerStats({ invoices = [], payments = [], demoDate = '2026-10-22' }) {
  const invoiceMap = new Map();
  invoices.forEach(inv => invoiceMap.set(inv.id, inv));

  let totalInvoicesCount = invoices.length;
  let totalBilledPaise = 0;
  let totalPaidPaise = 0;
  let totalOutstandingPaise = 0;
  let overdueInvoicesCount = 0;

  invoices.forEach(inv => {
    totalBilledPaise += Number(inv.total_paise || 0);
    totalPaidPaise += Number(inv.paid_paise || 0);
    totalOutstandingPaise += Number(inv.balance_paise || 0);

    const isUnpaid = inv.balance_paise > 0 && inv.status !== 'CANCELLED' && inv.status !== 'PAID';
    if (isUnpaid && inv.due_date && differenceInDays(demoDate, inv.due_date) > 0) {
      overdueInvoicesCount++;
    }
  });

  // Track payments per invoice
  const paymentsByInvoice = new Map();
  payments.forEach(p => {
    if (p.invoice_id) {
      if (!paymentsByInvoice.has(p.invoice_id)) {
        paymentsByInvoice.set(p.invoice_id, []);
      }
      paymentsByInvoice.get(p.invoice_id).push(p);
    }
  });

  // Calculate payment delays
  let totalDelayDays = 0;
  let paymentsMeasuredCount = 0;
  let onTimePaymentsCount = 0;

  invoices.forEach(inv => {
    const invPayments = paymentsByInvoice.get(inv.id) || [];
    if (invPayments.length > 0) {
      invPayments.forEach(pay => {
        const delay = differenceInDays(pay.payment_date, inv.due_date);
        totalDelayDays += delay;
        paymentsMeasuredCount++;

        if (delay <= 0) {
          onTimePaymentsCount++;
        }
      });
    }
  });

  // Average delay: average days after due date (can be negative if paid early)
  const averagePaymentDelayDays = paymentsMeasuredCount > 0
    ? Number((totalDelayDays / paymentsMeasuredCount).toFixed(1))
    : 0;

  // On-time percentage
  const onTimePercentage = paymentsMeasuredCount > 0
    ? Number(((onTimePaymentsCount / paymentsMeasuredCount) * 100).toFixed(1))
    : (totalInvoicesCount > 0 && overdueInvoicesCount === 0 ? 100 : 0);

  // Reliability Grade A / B / C
  let reliabilityGrade = 'A';
  let reliabilityExplanation = '';

  if (totalInvoicesCount === 0) {
    reliabilityGrade = 'A';
    reliabilityExplanation = 'New customer with no prior invoice history. Baseline Grade A.';
  } else if (onTimePercentage >= 80 && averagePaymentDelayDays <= 5 && overdueInvoicesCount === 0) {
    reliabilityGrade = 'A';
    reliabilityExplanation = 'Excellent credit profile. Consistently pays invoices on time with zero or negligible delay.';
  } else if (onTimePercentage >= 50 && averagePaymentDelayDays <= 15 && overdueInvoicesCount <= 1) {
    reliabilityGrade = 'B';
    reliabilityExplanation = 'Moderate credit risk. Occasional minor delays, but generally clears outstanding dues within reasonable buffer.';
  } else {
    reliabilityGrade = 'C';
    reliabilityExplanation = 'High credit risk. Frequent late payments, extended payment delays, or significant overdue balances.';
  }

  return {
    totalInvoicesCount,
    totalBilledPaise,
    totalPaidPaise,
    totalOutstandingPaise,
    overdueInvoicesCount,
    paymentsMeasuredCount,
    onTimePercentage,
    averagePaymentDelayDays,
    reliabilityGrade,
    reliabilityExplanation
  };
}
