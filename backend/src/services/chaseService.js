/**
 * Chase-First Prioritization Service
 * Computes a multi-factor priority score (0-100) combining:
 * 1. Days overdue
 * 2. Outstanding balance amount
 * 3. Customer reliability grade & historical delay
 * 4. Impact on projected cash shortage
 *
 * Invariant: Must NOT be simple amount-only sorting.
 * Returns human-readable `reason` string and label (🔥 Chase First, etc.).
 */

import { getToday, diffDays } from '../lib/dateUtils.js';
import { calculateCustomerStats } from '../lib/customerStats.js';
import { calculateCashForecast } from './forecastService.js';
import { formatIndianCurrency } from '../lib/money.js';

/**
 * Calculates chase priority for all active invoices.
 * @param {object} db - better-sqlite3 database instance
 * @param {object} [options={}]
 * @returns {Array<object>} Ranked list of chase recommendations
 */
export function calculateChasePriority(db, options = {}) {
  const today = getToday(db);

  // 1. Run cash forecast to identify if any week experiences a cash shortage
  const forecast = calculateCashForecast(db, options);
  const shortage = forecast.firstShortageWeek;
  const deficitPaise = shortage ? shortage.deficitPaise : 0;
  const shortageWeekNumber = shortage ? shortage.weekNumber : null;

  // 2. Fetch all active invoices (excluding draft and cancelled)
  const invoices = db.prepare(`
    SELECT
      i.*,
      c.name as customer_name,
      c.company_name as customer_company,
      c.phone as customer_phone,
      c.email as customer_email,
      c.credit_period_days as customer_credit_days
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.status NOT IN ('PAID', 'CANCELLED', 'DRAFT')
      AND i.balance_paise > 0
    ORDER BY i.due_date ASC
  `).all();

  // 3. Cache customer reliability stats
  const customerStatsMap = new Map();
  const customerIds = [...new Set(invoices.map(i => i.customer_id))];
  customerIds.forEach(cid => {
    customerStatsMap.set(cid, calculateCustomerStats(db, cid, today));
  });

  // 4. Fetch open disputes to flag disputed invoices
  const openDisputes = db.prepare(`
    SELECT invoice_id FROM disputes WHERE status = 'OPEN'
  `).all();
  const disputedInvoiceSet = new Set(openDisputes.map(d => d.invoice_id));

  // 5. Score each invoice
  const scoredInvoices = invoices.map(inv => {
    const isDisputed = inv.status === 'DISPUTED' || disputedInvoiceSet.has(inv.id);
    const stats = customerStatsMap.get(inv.customer_id) || {
      reliabilityGrade: 'B',
      averagePaymentDelayDays: 0,
      onTimePercentage: 50
    };

    const daysOverdue = diffDays(today, inv.due_date);

    // Component 1: Days Overdue Score (0 to 30)
    let overdueScore = 0;
    if (daysOverdue >= 45) {
      overdueScore = 30;
    } else if (daysOverdue >= 30) {
      overdueScore = 26;
    } else if (daysOverdue >= 15) {
      overdueScore = 20;
    } else if (daysOverdue > 0) {
      overdueScore = 14;
    } else if (daysOverdue === 0) {
      overdueScore = 8; // Due today
    } else if (daysOverdue >= -3) {
      overdueScore = 4; // Due in next 3 days
    } else {
      overdueScore = 0;
    }

    // Component 2: Outstanding Amount Score (0 to 25)
    // Benchmark: ₹5 Lakh (50000000 paise)
    const amountScore = Math.min(25, Math.round((inv.balance_paise / 50000000) * 25));

    // Component 3: Customer Reliability & Delay Risk Score (0 to 20)
    let reliabilityScore = 0;
    if (stats.reliabilityGrade === 'C') {
      reliabilityScore = 20; // High urgency: customer rarely pays without persistent chasing
    } else if (stats.reliabilityGrade === 'B') {
      reliabilityScore = 12; // Moderate delay tendency
    } else {
      reliabilityScore = 5;  // Grade A: typically pays promptly
    }

    // Component 4: Shortage Impact Score (0 to 25)
    let shortageScore = 0;
    let shortageReasonSnippet = '';
    if (shortage && deficitPaise > 0) {
      if (inv.balance_paise >= deficitPaise) {
        shortageScore = 25;
        shortageReasonSnippet = `collecting ${formatIndianCurrency(inv.balance_paise)} completely covers Week ${shortageWeekNumber} cash deficit of ${formatIndianCurrency(deficitPaise)}`;
      } else if (inv.balance_paise >= deficitPaise * 0.5) {
        shortageScore = 15;
        shortageReasonSnippet = `covers 50%+ of Week ${shortageWeekNumber} cash deficit`;
      } else {
        shortageScore = Math.min(10, Math.round((inv.balance_paise / deficitPaise) * 10));
        shortageReasonSnippet = `partially offsets Week ${shortageWeekNumber} cash shortage`;
      }
    }

    // If invoice is disputed, reduce actionable score because legal/dispute resolution is required first
    let rawScore = overdueScore + amountScore + reliabilityScore + shortageScore;
    if (isDisputed) {
      rawScore = Math.round(rawScore * 0.4); // Down-weight disputed invoices
    }

    const totalScore = Math.min(100, Math.max(0, rawScore));

    // Label determination
    let label = 'ℹ️ On Track';
    if (totalScore >= 85) {
      label = '🔥 Chase First';
    } else if (totalScore >= 65) {
      label = '⚡ High Priority';
    } else if (totalScore >= 40) {
      label = '⚠️ Medium Priority';
    }

    // Build human-readable reason string
    const reasonParts = [];
    if (isDisputed) {
      reasonParts.push('Under dispute; resolve issue before active collections');
    } else {
      if (daysOverdue > 0) {
        reasonParts.push(`Overdue by ${daysOverdue} days from ${stats.reliabilityGrade === 'C' ? 'high-delay customer (Grade C)' : stats.reliabilityGrade === 'B' ? 'moderate-delay customer (Grade B)' : 'Grade A customer'}`);
      } else if (daysOverdue === 0) {
        reasonParts.push('Due today; follow-up to ensure payment release');
      } else if (daysOverdue >= -3) {
        reasonParts.push(`Due soon (in ${Math.abs(daysOverdue)} days); courtesy reminder recommended`);
      } else {
        reasonParts.push(`Payment due in ${Math.abs(daysOverdue)} days`);
      }

      if (shortageReasonSnippet) {
        reasonParts.push(shortageReasonSnippet);
      } else {
        reasonParts.push(`outstanding balance ${formatIndianCurrency(inv.balance_paise)}`);
      }
    }

    const reason = reasonParts.join('; ') + '.';

    return {
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      customer_id: inv.customer_id,
      customer_name: inv.customer_name,
      customer_company: inv.customer_company,
      customer_phone: inv.customer_phone,
      customer_email: inv.customer_email,
      balance_paise: inv.balance_paise,
      total_paise: inv.total_paise,
      formatted_balance: formatIndianCurrency(inv.balance_paise),
      due_date: inv.due_date,
      days_overdue: daysOverdue,
      status: inv.status,
      is_disputed: isDisputed,
      customer_grade: stats.reliabilityGrade,
      customer_avg_delay: stats.averagePaymentDelayDays,
      priority_score: totalScore,
      score: totalScore,
      label,
      reason,
      score_breakdown: {
        overdueScore,
        amountScore,
        reliabilityScore,
        shortageScore
      }
    };
  });

  // Sort descending by priority_score
  scoredInvoices.sort((a, b) => b.priority_score - a.priority_score);

  return scoredInvoices;
}

export default calculateChasePriority;
