import express from 'express';
import { getDatabase } from '../db.js';
import { diffDays } from '../lib/dateUtils.js';
import { formatIndianCurrency } from '../lib/money.js';
import { getSharedCashModel } from '../services/sharedCashService.js';

const router = express.Router();

/**
 * GET /api/dashboard
 * Aggregated dashboard metrics:
 * - Totals (receivables, collected, overdue, disputed)
 * - Ageing buckets (not_due: due_date >= today; 1-30, 31-60, 61-90, 90+)
 * - Expected cash this week & this month (strictly matches forecast)
 * - Lowest forecast week & safety buffer deficit
 * - Top 5 chase priority invoices
 */
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const model = getSharedCashModel(db);
    const today = model.today;

    // 1. Fetch active invoices for totals & ageing
    const allInvoices = db.prepare(`
      SELECT
        i.*,
        c.name as customer_name,
        (SELECT IFNULL(SUM(amount_paise), 0) FROM payments WHERE invoice_id = i.id AND status = 'confirmed') as confirmed_paid_paise,
        (SELECT COUNT(*) FROM disputes WHERE invoice_id = i.id AND status = 'OPEN') as open_dispute_count
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.status NOT IN ('CANCELLED', 'DRAFT')
    `).all();

    const activeInvoices = allInvoices.map(inv => {
      const confirmedPaid = Number(inv.confirmed_paid_paise || 0);
      const total = Number(inv.total_paise || 0);
      const balance = Math.max(0, total - confirmedPaid);
      return {
        ...inv,
        paid_paise: confirmedPaid,
        balance_paise: balance,
        is_disputed: inv.open_dispute_count > 0 || inv.status === 'DISPUTED'
      };
    }).filter(i => i.balance_paise > 0);

    const totalReceivablesPaise = activeInvoices.reduce((sum, i) => sum + i.balance_paise, 0);

    const collectedRow = db.prepare("SELECT COALESCE(SUM(amount_paise), 0) as total FROM payments WHERE status = 'confirmed'").get();
    const totalCollectedPaise = collectedRow.total;

    const overdueInvoices = activeInvoices.filter(i => i.due_date < today && !i.is_disputed);
    const totalOverduePaise = overdueInvoices.reduce((sum, i) => sum + i.balance_paise, 0);

    const disputedInvoices = activeInvoices.filter(i => i.is_disputed);
    const totalDisputedPaise = disputedInvoices.reduce((sum, i) => sum + i.balance_paise, 0);

    // 2. Ageing Buckets (Overdue intervals)
    // Not Due: due_date >= today
    // 1-30, 31-60, 61-90, 90+
    const ageing = {
      '1_30': { amount_paise: 0, count: 0 },
      '31_60': { amount_paise: 0, count: 0 },
      '61_90': { amount_paise: 0, count: 0 },
      '90_plus': { amount_paise: 0, count: 0 },
      not_due: { amount_paise: 0, count: 0 }
    };

    activeInvoices.forEach(inv => {
      if (inv.due_date >= today) {
        ageing.not_due.amount_paise += inv.balance_paise;
        ageing.not_due.count += 1;
      } else {
        const daysOverdue = diffDays(today, inv.due_date);
        if (daysOverdue >= 1 && daysOverdue <= 30) {
          ageing['1_30'].amount_paise += inv.balance_paise;
          ageing['1_30'].count += 1;
        } else if (daysOverdue <= 60) {
          ageing['31_60'].amount_paise += inv.balance_paise;
          ageing['31_60'].count += 1;
        } else if (daysOverdue <= 90) {
          ageing['61_90'].amount_paise += inv.balance_paise;
          ageing['61_90'].count += 1;
        } else {
          ageing['90_plus'].amount_paise += inv.balance_paise;
          ageing['90_plus'].count += 1;
        }
      }
    });

    // Provide '0_30' alias for backwards compatibility
    ageing['0_30'] = ageing['1_30'];

    Object.keys(ageing).forEach(key => {
      ageing[key].formatted_amount = formatIndianCurrency(ageing[key].amount_paise);
    });

    // 3. Lowest Forecast
    let lowestWeek = model.weeks[0];
    model.weeks.forEach(w => {
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
      is_deficit: lowestWeek.isBelowBuffer,
      formatted_closing_cash: lowestWeek.formattedClosing,
      formatted_deficit: formatIndianCurrency(lowestWeek.deficitPaise)
    };

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
      expected_this_week_paise: model.summary.expectedThisWeekPaise,
      formatted_expected_this_week: model.summary.formattedExpectedThisWeek,
      expected_this_month_paise: model.summary.expectedThisMonthPaise,
      formatted_expected_this_month: model.summary.formattedExpectedThisMonth,
      lowest_forecast: lowestForecast,
      top_chase_list: model.chaseList.slice(0, 5),
      at_risk_invoices: model.atRiskInvoices,
      total_at_risk_paise: model.totalAtRiskPaise
    });
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_LOAD_DASHBOARD', message: err.message });
  }
});

export default router;
