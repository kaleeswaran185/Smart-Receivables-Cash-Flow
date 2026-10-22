import express from 'express';
import { getDatabase } from '../db.js';
import { getToday, diffDays } from '../lib/dateUtils.js';
import { formatIndianCurrency } from '../lib/money.js';
import { calculateCashForecast } from '../services/forecastService.js';
import { calculateChasePriority } from '../services/chaseService.js';

const router = express.Router();

/**
 * GET /api/dashboard
 * Aggregated dashboard metrics:
 * - Totals (receivables, collected, overdue, disputed)
 * - Ageing buckets (0-30, 31-60, 61-90, 90+)
 * - Expected cash this week & this month
 * - Lowest forecast week & safety buffer deficit
 * - Top 5 chase priority invoices
 */
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const today = getToday(db);

    // 1. Fetch active invoices
    const allInvoices = db.prepare(`
      SELECT * FROM invoices
      WHERE status NOT IN ('CANCELLED', 'DRAFT')
    `).all();

    const activeInvoices = allInvoices.filter(i => i.status !== 'PAID' && i.balance_paise > 0);

    // Totals
    const totalReceivablesPaise = activeInvoices.reduce((sum, i) => sum + i.balance_paise, 0);

    const collectedRow = db.prepare('SELECT COALESCE(SUM(amount_paise), 0) as total FROM payments').get();
    const totalCollectedPaise = collectedRow.total;

    const overdueInvoices = activeInvoices.filter(i => i.due_date < today);
    const totalOverduePaise = overdueInvoices.reduce((sum, i) => sum + i.balance_paise, 0);

    const disputedInvoices = allInvoices.filter(i => i.status === 'DISPUTED' && i.balance_paise > 0);
    const totalDisputedPaise = disputedInvoices.reduce((sum, i) => sum + i.balance_paise, 0);

    // 2. Ageing Buckets (Overdue intervals)
    const ageing = {
      '0_30': { amount_paise: 0, count: 0 },
      '31_60': { amount_paise: 0, count: 0 },
      '61_90': { amount_paise: 0, count: 0 },
      '90_plus': { amount_paise: 0, count: 0 },
      not_due: { amount_paise: 0, count: 0 }
    };

    activeInvoices.forEach(inv => {
      const days = diffDays(today, inv.due_date);
      if (days < 0) {
        ageing.not_due.amount_paise += inv.balance_paise;
        ageing.not_due.count += 1;
      } else if (days <= 30) {
        ageing['0_30'].amount_paise += inv.balance_paise;
        ageing['0_30'].count += 1;
      } else if (days <= 60) {
        ageing['31_60'].amount_paise += inv.balance_paise;
        ageing['31_60'].count += 1;
      } else if (days <= 90) {
        ageing['61_90'].amount_paise += inv.balance_paise;
        ageing['61_90'].count += 1;
      } else {
        ageing['90_plus'].amount_paise += inv.balance_paise;
        ageing['90_plus'].count += 1;
      }
    });

    // Add formatted amounts
    Object.keys(ageing).forEach(key => {
      ageing[key].formatted_amount = formatIndianCurrency(ageing[key].amount_paise);
    });

    // 3. Cash Forecast Analysis
    const forecast = calculateCashForecast(db);
    const week1 = forecast.weeks[0];
    const expectedThisWeekPaise = week1 ? week1.expectedCollectionsPaise : 0;

    // Expected this month: first 4 weeks
    const first4Weeks = forecast.weeks.slice(0, 4);
    const expectedThisMonthPaise = first4Weeks.reduce((sum, w) => sum + w.expectedCollectionsPaise, 0);

    // Lowest forecast week
    let lowestWeek = forecast.weeks[0];
    forecast.weeks.forEach(w => {
      if (w.closingCashPaise < lowestWeek.closingCashPaise) {
        lowestWeek = w;
      }
    });

    const lowestForecast = {
      week_number: lowestWeek.weekNumber,
      start_date: lowestWeek.startDate,
      end_date: lowestWeek.endDate,
      closing_cash_paise: lowestWeek.closingCashPaise,
      safety_buffer_paise: lowestWeek.safetyBufferPaise,
      deficit_paise: lowestWeek.deficitPaise,
      is_deficit: lowestWeek.isBelowSafetyBuffer,
      formatted_closing_cash: lowestWeek.formattedClosingCash,
      formatted_deficit: lowestWeek.formattedDeficit
    };

    // 4. Top 5 Chase List
    const chaseList = calculateChasePriority(db);
    const topChaseList = chaseList.slice(0, 5);

    res.json({
      today,
      totals: {
        total_receivables_paise: totalReceivablesPaise,
        total_collected_paise: totalCollectedPaise,
        total_overdue_paise: totalOverduePaise,
        total_disputed_paise: totalDisputedPaise,
        formatted_receivables: formatIndianCurrency(totalReceivablesPaise),
        formatted_collected: formatIndianCurrency(totalCollectedPaise),
        formatted_overdue: formatIndianCurrency(totalOverduePaise),
        formatted_disputed: formatIndianCurrency(totalDisputedPaise)
      },
      ageing_buckets: ageing,
      expected_this_week_paise: expectedThisWeekPaise,
      formatted_expected_this_week: formatIndianCurrency(expectedThisWeekPaise),
      expected_this_month_paise: expectedThisMonthPaise,
      formatted_expected_this_month: formatIndianCurrency(expectedThisMonthPaise),
      lowest_forecast: lowestForecast,
      top_chase_list: topChaseList
    });
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_LOAD_DASHBOARD', message: err.message });
  }
});

export default router;
