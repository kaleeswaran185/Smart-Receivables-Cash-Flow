/**
 * Shared Core Cash Flow & Receivables Service
 * Used as the single source of truth by:
 * - Dashboard (/api/dashboard)
 * - Cash Forecast (/api/forecast)
 * - Chase-First Priority List (/api/chase)
 *
 * Guaranteed Invariants:
 * 1. Week N closing cash strictly equals Week N+1 opening cash.
 * 2. Dashboard 'expected this week' strictly equals Forecast Week 1 expected collections.
 * 3. Dashboard 'expected this month' strictly equals Forecast Weeks 1-4 expected collections.
 * 4. Expected collection date = due date + customer avg delay (using outstanding balance only).
 *    If date < today, placed into Week 1 (today).
 *    A promise date overrides the expected date.
 *    Disputed invoices are excluded from collections and shown as 'at risk'.
 */

import { getToday, addDays, diffDays, getWeeklyBuckets, isDateInRange } from '../lib/dateUtils.js';
import { calculateCustomerStats } from '../lib/customerStats.js';
import { formatIndianCurrency } from '../lib/money.js';

/**
 * Calculates complete cash flow model, 13-week buckets, and chase list from a single shared run.
 * @param {object} db - better-sqlite3 database instance
 * @param {object} [options={}]
 * @returns {object} Shared cash model
 */
export function getSharedCashModel(db, options = {}) {
  const today = getToday(db);

  // 1. Settings: Opening cash & Safety buffer
  let openingCashPaise = options.openingCashPaise;
  if (openingCashPaise === undefined) {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'opening_cash_paise'").get();
    openingCashPaise = row ? parseInt(row.value, 10) : 40000000; // default ₹4,00,000
  }

  let safetyBufferPaise = options.safetyBufferPaise;
  if (safetyBufferPaise === undefined) {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'safety_buffer_paise'").get();
    safetyBufferPaise = row ? parseInt(row.value, 10) : 50000000; // default ₹5,00,000
  }

  const scenario = options.scenario || null;

  // 2. Weekly Buckets (13 weeks starting on today)
  const weeklyBuckets = getWeeklyBuckets(today, 13);
  const horizonEnd = weeklyBuckets[12].endDate;

  // 3. Customer Delay & Reliability Stats Map
  const customers = db.prepare('SELECT id, name, company_name, credit_period_days FROM customers').all();
  const customerStatsMap = new Map();
  customers.forEach(c => {
    const stats = calculateCustomerStats(db, c.id, today);
    customerStatsMap.set(c.id, stats);
  });

  // 4. Fetch Invoices with confirmed payments & disputes
  const rawInvoices = db.prepare(`
    SELECT
      i.*,
      c.name as customer_name,
      c.company_name as customer_company,
      c.phone as customer_phone,
      c.email as customer_email,
      (SELECT IFNULL(SUM(amount_paise), 0) FROM payments WHERE invoice_id = i.id AND status = 'confirmed') as confirmed_paid_paise,
      (SELECT COUNT(*) FROM disputes WHERE invoice_id = i.id AND status = 'OPEN') as open_dispute_count
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.status NOT IN ('CANCELLED', 'DRAFT')
    ORDER BY i.due_date ASC
  `).all();

  // 5. Fetch Pending Promises
  const pendingPromises = db.prepare("SELECT * FROM promises WHERE status = 'PENDING'").all();
  const promiseByInvoice = new Map();
  pendingPromises.forEach(p => promiseByInvoice.set(p.invoice_id, p));

  // Categorize invoices
  const scheduledCollections = [];
  const atRiskInvoices = [];
  let totalAtRiskPaise = 0;

  // Identify largest invoice for early customer scenario
  let maxInvoiceId = null;
  let maxBal = -1;
  rawInvoices.forEach(inv => {
    const confirmedPaid = Number(inv.confirmed_paid_paise || 0);
    const balancePaise = Math.max(0, Number(inv.total_paise || 0) - confirmedPaid);
    if (balancePaise > maxBal) {
      maxBal = balancePaise;
      maxInvoiceId = inv.id;
    }
  });

  rawInvoices.forEach(inv => {
    const confirmedPaid = Number(inv.confirmed_paid_paise || 0);
    const totalPaise = Number(inv.total_paise || 0);
    const balancePaise = Math.max(0, totalPaise - confirmedPaid);

    if (balancePaise <= 0) return; // Fully paid

    const hasOpenDispute = inv.open_dispute_count > 0 || inv.status === 'DISPUTED';

    if (hasOpenDispute) {
      // Disputed invoices are EXCLUDED from collections and shown as 'at risk'
      atRiskInvoices.push({
        id: inv.id,
        invoice_number: inv.invoice_number,
        customer_id: inv.customer_id,
        customer_name: inv.customer_name,
        customer_company: inv.customer_company,
        due_date: inv.due_date,
        balance_paise: balancePaise,
        formatted_balance: formatIndianCurrency(balancePaise),
        reason: 'Open dispute on invoice'
      });
      totalAtRiskPaise += balancePaise;
      return;
    }

    // Expected collection date = due date + customer average delay, using outstanding amount only
    const custStats = customerStatsMap.get(inv.customer_id) || { averagePaymentDelayDays: 0 };
    const avgDelay = Math.round(custStats.averagePaymentDelayDays || 0);
    const promise = promiseByInvoice.get(inv.id);

    let expectedDate;
    if (promise && promise.promised_date >= today) {
      // A promise date overrides the expected date
      expectedDate = promise.promised_date;
    } else {
      expectedDate = addDays(inv.due_date, Math.max(0, avgDelay));
    }

    // Apply Scenario Transformations
    if (scenario === 'late_customer' || scenario === 'customer_delay_30') {
      if (!options.targetCustomerId || options.targetCustomerId === inv.customer_id) {
        expectedDate = addDays(expectedDate, 30);
      }
    } else if (scenario === 'early_customer' || scenario === 'big_customer_pays_early') {
      const isTarget = options.targetInvoiceId ? (inv.id === options.targetInvoiceId) : (inv.id === maxInvoiceId);
      if (isTarget) {
        expectedDate = today;
      }
    }

    // Rule: If expected collection date is before today, place it in Week 1 (today)
    let effectiveDate = expectedDate;
    if (effectiveDate < today) {
      effectiveDate = today;
    }

    scheduledCollections.push({
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      customer_id: inv.customer_id,
      customer_name: inv.customer_name,
      customer_company: inv.customer_company,
      customer_phone: inv.customer_phone,
      customer_email: inv.customer_email,
      due_date: inv.due_date,
      balance_paise: balancePaise,
      total_paise: totalPaise,
      expected_collection_date: effectiveDate,
      has_promise: Boolean(promise),
      promised_date: promise?.promised_date || null
    });
  });

  // 6. Fetch Expenses
  const rawExpenses = db.prepare(`
    SELECT * FROM expenses
    WHERE expense_date >= ?
    ORDER BY expense_date ASC
  `).all(today);

  const scheduledExpenses = rawExpenses.map(exp => {
    let effectiveDate = exp.expense_date;
    if (scenario === 'supplier_delayed' || scenario === 'supplier_delayed_14' || scenario === 'delayed_supplier') {
      if (exp.category === 'SUPPLIER' || exp.category === 'PURCHASE') {
        effectiveDate = addDays(effectiveDate, 21);
      }
    }
    return {
      id: exp.id,
      category: exp.category,
      amount_paise: exp.amount_paise,
      vendor: exp.vendor,
      original_date: exp.expense_date,
      effective_date: effectiveDate
    };
  });

  // 7. Build 13 Weeks Forecast Table
  let rollingCash = openingCashPaise;
  const weeks = [];
  let firstShortageWeek = null;
  let maxDeficitPaise = 0;

  for (let i = 0; i < weeklyBuckets.length; i++) {
    const bucket = weeklyBuckets[i];
    const weekOpenCash = rollingCash;

    // Collections in this week
    const weekInvoices = scheduledCollections.filter(c =>
      isDateInRange(c.expected_collection_date, bucket.startDate, bucket.endDate)
    );
    const collectionsPaise = weekInvoices.reduce((s, c) => s + c.balance_paise, 0);

    // Expenses in this week
    const weekExpenses = scheduledExpenses.filter(e =>
      isDateInRange(e.effective_date, bucket.startDate, bucket.endDate)
    );
    const expensesPaise = weekExpenses.reduce((s, e) => s + e.amount_paise, 0);

    const netCashPaise = collectionsPaise - expensesPaise;
    const weekCloseCash = weekOpenCash + netCashPaise;

    const isBelowBuffer = weekCloseCash < safetyBufferPaise;
    const deficitPaise = isBelowBuffer ? (safetyBufferPaise - weekCloseCash) : 0;

    if (isBelowBuffer && firstShortageWeek === null) {
      firstShortageWeek = {
        weekNumber: bucket.weekNumber,
        startDate: bucket.startDate,
        endDate: bucket.endDate,
        closingCashPaise: weekCloseCash,
        safetyBufferPaise,
        deficitPaise,
        formattedDeficit: formatIndianCurrency(deficitPaise),
        code: 'SHORTAGE_DEFICIT',
        params: {
          weekNumber: bucket.weekNumber,
          deficit: formatIndianCurrency(deficitPaise),
          deficitPaise,
          closingBalance: formatIndianCurrency(weekCloseCash),
          startDate: bucket.startDate,
          endDate: bucket.endDate,
          safetyBuffer: formatIndianCurrency(safetyBufferPaise)
        }
      };
    }

    if (deficitPaise > maxDeficitPaise) {
      maxDeficitPaise = deficitPaise;
    }

    weeks.push({
      weekNumber: bucket.weekNumber,
      label: bucket.label,
      startDate: bucket.startDate,
      endDate: bucket.endDate,
      openingCashPaise: weekOpenCash,
      expectedCollectionsPaise: collectionsPaise,
      collectionsPaise,
      expensesPaise,
      scheduledExpensesPaise: expensesPaise,
      netCashPaise,
      closingCashPaise: weekCloseCash,
      safetyBufferPaise,
      isBelowBuffer,
      isBelowSafetyBuffer: isBelowBuffer,
      deficitPaise,
      netCashFlowPaise: netCashPaise,
      formattedOpening: formatIndianCurrency(weekOpenCash),
      formattedOpeningCash: formatIndianCurrency(weekOpenCash),
      formattedCollections: formatIndianCurrency(collectionsPaise),
      formattedExpenses: formatIndianCurrency(expensesPaise),
      formattedNet: formatIndianCurrency(netCashPaise),
      formattedNetCashFlow: formatIndianCurrency(netCashPaise),
      formattedClosing: formatIndianCurrency(weekCloseCash),
      formattedClosingCash: formatIndianCurrency(weekCloseCash),
      formattedBuffer: formatIndianCurrency(safetyBufferPaise),
      invoiceCount: weekInvoices.length,
      expenseCount: weekExpenses.length,
      collectionsCount: weekInvoices.length,
      expensesCount: weekExpenses.length,
      collectionsBreakdown: weekInvoices,
      expensesBreakdown: weekExpenses
    });

    // Advance rolling cash: Week N closing == Week N+1 opening
    rollingCash = weekCloseCash;
  }

  // Consistency Guarantee for Dashboard:
  const expectedThisWeekPaise = weeks[0] ? weeks[0].expectedCollectionsPaise : 0;
  const expectedThisMonthPaise = weeks.slice(0, 4).reduce((sum, w) => sum + w.expectedCollectionsPaise, 0);

  // 8. Build Chase Priority List
  // Rules:
  // - Exclude Paid (already excluded by balance_paise > 0)
  // - Exclude not-yet-due (due_date >= today)
  // - Exclude Disputed (placed into resolveDisputeList)
  const chaseCandidates = [];
  rawInvoices.forEach(inv => {
    const confirmedPaid = Number(inv.confirmed_paid_paise || 0);
    const balancePaise = Math.max(0, Number(inv.total_paise || 0) - confirmedPaid);

    if (balancePaise <= 0) return; // Paid
    if (inv.due_date >= today) return; // Not yet due
    if (inv.open_dispute_count > 0 || inv.status === 'DISPUTED') return; // Disputed

    chaseCandidates.push({
      ...inv,
      balance_paise: balancePaise
    });
  });

  // Calculate scores (0 to 100)
  // Documented weights: amount 30, days overdue 25, shortage impact 20, reliability 15, expected delay 10
  const maxOutstanding = chaseCandidates.reduce((m, i) => Math.max(m, i.balance_paise), 1);
  const shortageDeficit = firstShortageWeek ? firstShortageWeek.deficitPaise : 0;
  const shortageWeekNum = firstShortageWeek ? firstShortageWeek.weekNumber : null;

  const chaseList = chaseCandidates.map(inv => {
    const daysOverdue = diffDays(today, inv.due_date);
    const custStats = customerStatsMap.get(inv.customer_id) || {
      grade: 'B',
      averagePaymentDelayDays: 14
    };

    // 1. Amount weight (30 pts)
    const amountScore = Math.min(30, Math.round((inv.balance_paise / maxOutstanding) * 30));

    // 2. Days Overdue weight (25 pts, normalized against 30 days)
    const overdueScore = Math.min(25, Math.round((Math.max(0, daysOverdue) / 30) * 25));

    // 3. Shortage Impact weight (20 pts)
    // "Define 'can cover the gap' as: collecting the invoice by the shortage week raises that week's projected cash to or above the safety buffer, or reduces the gap."
    let shortageScore = 0;
    let coversShortage = false;
    let reducesGap = false;

    if (firstShortageWeek && shortageDeficit > 0) {
      if (inv.balance_paise >= shortageDeficit) {
        shortageScore = 20; // Fully covers deficit
        coversShortage = true;
      } else {
        shortageScore = Math.min(15, Math.max(8, Math.round((inv.balance_paise / shortageDeficit) * 20)));
        reducesGap = true;
      }
    }

    // 4. Customer Reliability Grade weight (15 pts)
    // Grade C = 15 (urgent intervention), B = 10, A = 5
    const custGrade = custStats.reliabilityGrade || custStats.grade || 'B';
    let gradeScore = 10;
    if (custGrade === 'C') gradeScore = 15;
    else if (custGrade === 'A') gradeScore = 5;

    // 5. Expected Payment Delay weight (10 pts, normalized against 25 days)
    const delayScore = Math.min(10, Math.round((Math.max(0, custStats.averagePaymentDelayDays) / 25) * 10));

    const totalScore = Math.min(100, Math.max(0, amountScore + overdueScore + shortageScore + gradeScore + delayScore));

    let label = 'ℹ️ On Track';
    if (totalScore >= 85) label = '🔥 Chase First';
    else if (totalScore >= 65) label = '⚡ High Priority';
    else if (totalScore >= 40) label = '⚠️ Medium Priority';

    // Construct detailed action reason string and structured translation codes
    const balFormatted = formatIndianCurrency(inv.balance_paise);
    let reason = `${balFormatted} Overdue ${daysOverdue} days (Grade ${custGrade} customer).`;
    let reason_code = 'CHASE_REASON_OVERDUE_GENERAL';

    if (coversShortage) {
      reason += ` Collecting this covers the Week ${shortageWeekNum} cash deficit (${firstShortageWeek.formattedDeficit} below safety buffer).`;
      reason_code = 'CHASE_REASON_OVERDUE_SHORTAGE';
    } else if (reducesGap) {
      reason += ` Collecting this substantially bridges the Week ${shortageWeekNum} cash gap.`;
      reason_code = 'CHASE_REASON_OVERDUE_REDUCES_GAP';
    } else if (daysOverdue > 30) {
      reason += ` High aging risk past ${daysOverdue} days.`;
      reason_code = 'CHASE_REASON_OVERDUE_HIGH_AGING';
    } else {
      reason += ` High priority collection for working capital.`;
      reason_code = 'CHASE_REASON_OVERDUE_GENERAL';
    }

    const reason_params = {
      amountPaise: inv.balance_paise,
      formattedAmount: balFormatted,
      daysOverdue,
      customerGrade: custGrade,
      shortageWeek: shortageWeekNum,
      deficitFormatted: firstShortageWeek ? firstShortageWeek.formattedDeficit : '',
      formattedDeficit: firstShortageWeek ? firstShortageWeek.formattedDeficit : ''
    };

    return {
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      customer_id: inv.customer_id,
      customer_name: inv.customer_name,
      customer_company: inv.customer_company,
      customer_phone: inv.customer_phone,
      balance_paise: inv.balance_paise,
      formatted_balance: balFormatted,
      due_date: inv.due_date,
      days_overdue: daysOverdue,
      score: totalScore,
      priority_score: totalScore,
      label,
      priority_breakdown: {
        amount: amountScore,
        overdue: overdueScore,
        shortage: shortageScore,
        reliability: gradeScore,
        delay: delayScore
      },
      reason,
      reason_code,
      reason_params,
      code: reason_code,
      params: reason_params,
      can_cover_gap: coversShortage,
      reduces_gap: reducesGap,
      customer_grade: custGrade,
      payment_token: inv.payment_token
    };
  });

  // Sort chase list by score DESC
  chaseList.sort((a, b) => b.score - a.score || b.balance_paise - a.balance_paise);

  // Smallest set (at most 3, ranked by priority) with cumulative amount vs shortfall
  const gapCoveringInvoices = [];
  if (firstShortageWeek) {
    const neededPaise = firstShortageWeek.deficitPaise;
    
    // Evaluate candidates from priority chaseList
    const priorityCandidates = chaseList.filter(inv => inv.balance_paise > 0);

    // 1. Try single invoice (smallest set = 1)
    const single = priorityCandidates.find(inv => inv.balance_paise >= neededPaise);
    if (single) {
      gapCoveringInvoices.push({
        invoice_id: single.invoice_id,
        invoice_number: single.invoice_number,
        customer_name: single.customer_name,
        balance_paise: single.balance_paise,
        formatted_balance: formatIndianCurrency(single.balance_paise),
        due_date: single.due_date,
        status: 'OVERDUE',
        score: single.score,
        cumulative_amount_paise: single.balance_paise,
        formatted_cumulative_amount: formatIndianCurrency(single.balance_paise),
        shortfall_paise: neededPaise,
        formatted_shortfall: firstShortageWeek.formattedDeficit,
        coverage_percentage: Math.round((single.balance_paise / neededPaise) * 100),
        covers_entire_deficit: true
      });
    } else {
      // 2. Accumulate up to 3 priority invoices
      let runningSum = 0;
      for (const inv of priorityCandidates.slice(0, 3)) {
        runningSum += inv.balance_paise;
        gapCoveringInvoices.push({
          invoice_id: inv.invoice_id,
          invoice_number: inv.invoice_number,
          customer_name: inv.customer_name,
          balance_paise: inv.balance_paise,
          formatted_balance: formatIndianCurrency(inv.balance_paise),
          due_date: inv.due_date,
          status: 'OVERDUE',
          score: inv.score,
          cumulative_amount_paise: runningSum,
          formatted_cumulative_amount: formatIndianCurrency(runningSum),
          shortfall_paise: neededPaise,
          formatted_shortfall: firstShortageWeek.formattedDeficit,
          coverage_percentage: Math.round((runningSum / neededPaise) * 100),
          covers_entire_deficit: runningSum >= neededPaise
        });
        if (runningSum >= neededPaise) break;
      }
    }
  }

  return {
    today,
    openingCashPaise,
    safetyBufferPaise,
    weeks,
    hasShortage: Boolean(firstShortageWeek),
    firstShortageWeek,
    gapCoveringInvoices,
    scheduledCollections,
    scheduledExpenses,
    atRiskInvoices,
    totalAtRiskPaise,
    chaseList,
    resolveDisputeList: atRiskInvoices,
    summary: {
      expectedThisWeekPaise,
      expectedThisMonthPaise,
      formattedExpectedThisWeek: formatIndianCurrency(expectedThisWeekPaise),
      formattedExpectedThisMonth: formatIndianCurrency(expectedThisMonthPaise)
    }
  };
}

export const calculateCashForecast = getSharedCashModel;
export default getSharedCashModel;
