/**
 * Cash Flow Forecast Service (13-Week Rolling Horizon)
 * Anchored deterministically to `today` read from settings (demoDate / demo_date).
 * Invariant: Week N closing cash MUST strictly equal Week N+1 opening cash.
 */

import { getToday, addDays, getWeeklyBuckets } from '../lib/dateUtils.js';
import { calculateCustomerStats } from '../lib/customerStats.js';
import { formatIndianCurrency } from '../lib/money.js';

/**
 * Calculates 13-week rolling cash flow forecast.
 * @param {object} db - better-sqlite3 database instance
 * @param {object} [options={}]
 * @param {number} [options.openingCashPaise]
 * @param {number} [options.safetyBufferPaise]
 * @param {string} [options.scenario] - 'late_customer' | 'supplier_delayed' | 'early_customer' | null
 * @param {number} [options.targetCustomerId]
 * @param {number} [options.targetInvoiceId]
 * @returns {object} Forecast result with 13 weeks, shortage detection, gap covering invoices, scenarios
 */
export function calculateCashForecast(db, options = {}) {
  const today = getToday(db);

  // Read opening cash and safety buffer from settings if not passed
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

  // 1. Generate 13 weekly buckets
  const weeklyBuckets = getWeeklyBuckets(today, 13);
  const horizonEnd = weeklyBuckets[12].endDate;

  // 2. Pre-calculate customer stats for payment delay estimates
  const customers = db.prepare('SELECT id, name, credit_period_days FROM customers').all();
  const customerDelayMap = new Map();
  customers.forEach(c => {
    const stats = calculateCustomerStats(db, c.id, today);
    customerDelayMap.set(c.id, stats.averagePaymentDelayDays || 0);
  });

  // 3. Fetch active unpaid / partially paid invoices
  const activeInvoices = db.prepare(`
    SELECT
      i.*,
      c.name as customer_name,
      c.company_name as customer_company
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.status NOT IN ('PAID', 'CANCELLED', 'DRAFT')
      AND i.balance_paise > 0
    ORDER BY i.due_date ASC
  `).all();

  // 4. Fetch pending promises
  const promises = db.prepare(`
    SELECT * FROM promises
    WHERE status = 'PENDING'
  `).all();
  const promiseByInvoice = new Map();
  promises.forEach(p => promiseByInvoice.set(p.invoice_id, p));

  // Determine expected collection date for each invoice
  // Identify largest invoice if early_customer scenario is active
  let maxInvoiceId = null;
  let maxBalance = -1;
  activeInvoices.forEach(inv => {
    if (inv.balance_paise > maxBalance) {
      maxBalance = inv.balance_paise;
      maxInvoiceId = inv.id;
    }
  });

  const scheduledCollections = [];

  activeInvoices.forEach(inv => {
    const avgDelay = customerDelayMap.get(inv.customer_id) || 0;
    const promise = promiseByInvoice.get(inv.id);

    let expectedDate;
    if (promise && promise.promised_date >= today) {
      expectedDate = promise.promised_date;
    } else {
      expectedDate = addDays(inv.due_date, avgDelay);
    }

    // Apply Scenario Transformations
    if (scenario === 'late_customer' || scenario === 'customer_delay_30') {
      if (!options.targetCustomerId || options.targetCustomerId === inv.customer_id) {
        // Delayed by 30 days
        expectedDate = addDays(expectedDate, 30);
      }
    } else if (scenario === 'early_customer' || scenario === 'big_customer_pays_early') {
      const isTarget = options.targetInvoiceId ? (inv.id === options.targetInvoiceId) : (inv.id === maxInvoiceId);
      if (isTarget) {
        // Big customer pays early (pull into Week 1 / today)
        expectedDate = today;
      }
    }

    // If expected date has already passed relative to today, project collection
    // into future weeks based on customer's typical delay from today
    let effectiveCollectionDate;
    if (expectedDate < today) {
      const futureOffset = Math.max(14, Math.round(avgDelay) || 14);
      effectiveCollectionDate = addDays(today, futureOffset);
    } else {
      effectiveCollectionDate = expectedDate;
    }

    scheduledCollections.push({
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      customer_id: inv.customer_id,
      customer_name: inv.customer_name,
      balance_paise: inv.balance_paise,
      original_due_date: inv.due_date,
      expected_collection_date: effectiveCollectionDate
    });
  });

  // 5. Fetch future expenses
  const rawExpenses = db.prepare(`
    SELECT * FROM expenses
    WHERE expense_date >= ?
    ORDER BY expense_date ASC
  `).all(today);

  const scheduledExpenses = rawExpenses.map(exp => {
    let effectiveDate = exp.expense_date;

    // Apply Scenario: supplier delayed
    if (scenario === 'supplier_delayed' || scenario === 'delayed_supplier') {
      // Delay supplier expenses by 21 days
      if (exp.category === 'SUPPLIER') {
        effectiveDate = addDays(effectiveDate, 21);
      }
    }

    return {
      ...exp,
      effective_expense_date: effectiveDate
    };
  });

  // 6. Build the 13 Weekly Cash Flow Table
  let runningCash = openingCashPaise;
  const weeks = [];
  let firstShortageWeek = null;

  for (let idx = 0; idx < weeklyBuckets.length; idx++) {
    const bucket = weeklyBuckets[idx];
    const weekOpening = runningCash;

    // Collections in this week
    const weekCollections = scheduledCollections.filter(c =>
      c.expected_collection_date >= bucket.startDate && c.expected_collection_date <= bucket.endDate
    );
    const collectionsPaise = weekCollections.reduce((sum, c) => sum + c.balance_paise, 0);

    // Expenses in this week
    const weekExpenses = scheduledExpenses.filter(e =>
      e.effective_expense_date >= bucket.startDate && e.effective_expense_date <= bucket.endDate
    );
    const expensesPaise = weekExpenses.reduce((sum, e) => sum + e.amount_paise, 0);

    const netCashFlowPaise = collectionsPaise - expensesPaise;
    const weekClosing = weekOpening + netCashFlowPaise;

    const isBelowSafetyBuffer = weekClosing < safetyBufferPaise;
    const deficitPaise = isBelowSafetyBuffer ? (safetyBufferPaise - weekClosing) : 0;

    const weekData = {
      weekNumber: bucket.weekNumber,
      startDate: bucket.startDate,
      endDate: bucket.endDate,
      label: bucket.label,
      openingCashPaise: weekOpening,
      expectedCollectionsPaise: collectionsPaise,
      collectionsCount: weekCollections.length,
      collectionsBreakdown: weekCollections,
      expensesPaise: expensesPaise,
      expensesCount: weekExpenses.length,
      expensesBreakdown: weekExpenses.map(e => ({
        id: e.id,
        category: e.category,
        vendor: e.vendor,
        amount_paise: e.amount_paise,
        date: e.effective_expense_date,
        description: e.notes
      })),
      netCashFlowPaise,
      closingCashPaise: weekClosing,
      safetyBufferPaise,
      isBelowSafetyBuffer,
      deficitPaise,
      // Formatted fields for clean UI/API consumption
      formattedOpeningCash: formatIndianCurrency(weekOpening),
      formattedCollections: formatIndianCurrency(collectionsPaise),
      formattedExpenses: formatIndianCurrency(expensesPaise),
      formattedClosingCash: formatIndianCurrency(weekClosing),
      formattedDeficit: formatIndianCurrency(deficitPaise)
    };

    weeks.push(weekData);

    // Check if this is the first week breaching the safety buffer
    if (isBelowSafetyBuffer && !firstShortageWeek) {
      firstShortageWeek = weekData;
    }

    // Next week's opening strictly equals this week's closing
    runningCash = weekClosing;
  }

  // 7. Find gap-covering invoices if there is a shortage
  const gapCoveringInvoices = [];
  if (firstShortageWeek) {
    const neededPaise = firstShortageWeek.deficitPaise;
    // Find active invoices that can cover the gap
    activeInvoices.forEach(inv => {
      if (inv.balance_paise >= neededPaise) {
        gapCoveringInvoices.push({
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          customer_name: inv.customer_name,
          balance_paise: inv.balance_paise,
          formatted_balance: formatIndianCurrency(inv.balance_paise),
          due_date: inv.due_date,
          status: inv.status,
          coverage_percentage: Math.round((inv.balance_paise / neededPaise) * 100),
          covers_entire_deficit: true
        });
      }
    });

    // Sort gap coverers by closest balance or largest coverage
    gapCoveringInvoices.sort((a, b) => b.balance_paise - a.balance_paise);
  }

  return {
    today,
    horizonStartDate: weeklyBuckets[0].startDate,
    horizonEndDate: horizonEnd,
    initialOpeningCashPaise: openingCashPaise,
    safetyBufferPaise,
    scenario,
    hasShortage: !!firstShortageWeek,
    firstShortageWeek: firstShortageWeek ? {
      weekNumber: firstShortageWeek.weekNumber,
      startDate: firstShortageWeek.startDate,
      endDate: firstShortageWeek.endDate,
      closingCashPaise: firstShortageWeek.closingCashPaise,
      deficitPaise: firstShortageWeek.deficitPaise,
      formattedClosingCash: firstShortageWeek.formattedClosingCash,
      formattedDeficit: firstShortageWeek.formattedDeficit
    } : null,
    gapCoveringInvoices,
    weeks
  };
}

export default calculateCashForecast;
