import { getSharedCashModel } from './sharedCashService.js';
import { formatIndianCurrency } from '../lib/money.js';

/**
 * Calculates 13-week rolling cash flow forecast using the shared core service.
 * @param {object} db - better-sqlite3 database instance
 * @param {object} [options={}]
 * @returns {object} Forecast result with 13 weeks, shortage detection, gap covering invoices, scenarios
 */
export function calculateCashForecast(db, options = {}) {
  const model = getSharedCashModel(db, options);

  // Use the canonical smallest gap-covering set computed in sharedCashService
  const gapCoveringInvoices = model.gapCoveringInvoices || [];

  return {
    today: model.today,
    horizonStartDate: model.weeks[0]?.startDate,
    horizonEndDate: model.weeks[model.weeks.length - 1]?.endDate,
    initialOpeningCashPaise: model.openingCashPaise,
    safetyBufferPaise: model.safetyBufferPaise,
    scenario: options.scenario || null,
    hasShortage: Boolean(model.firstShortageWeek),
    firstShortageWeek: model.firstShortageWeek ? {
      weekNumber: model.firstShortageWeek.weekNumber,
      startDate: model.firstShortageWeek.startDate,
      endDate: model.firstShortageWeek.endDate,
      closingCashPaise: model.firstShortageWeek.closingCashPaise,
      deficitPaise: model.firstShortageWeek.deficitPaise,
      formattedClosingCash: formatIndianCurrency(model.firstShortageWeek.closingCashPaise),
      formattedDeficit: model.firstShortageWeek.formattedDeficit
    } : null,
    gapCoveringInvoices,
    weeks: model.weeks,
    atRiskInvoices: model.atRiskInvoices,
    totalAtRiskPaise: model.totalAtRiskPaise,
    expectedThisWeekPaise: model.summary.expectedThisWeekPaise,
    expectedThisMonthPaise: model.summary.expectedThisMonthPaise,
    summary: model.summary
  };
}

export default calculateCashForecast;
