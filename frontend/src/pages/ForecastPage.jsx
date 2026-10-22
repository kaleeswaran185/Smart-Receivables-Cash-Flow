import React, { useState, useEffect } from 'react';
import { TrendingUp, AlertTriangle, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';
import api from '../services/api';
import { formatIndianCurrency, formatDate } from '../utils/money';
import { StatusBadge } from '../components/common/StatusBadge';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';

export function ForecastPage() {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scenario, setScenario] = useState('base');

  const loadForecast = async (sc = scenario) => {
    try {
      setLoading(true);
      setError(null);
      const url = sc === 'base' ? '/forecast' : `/forecast?scenario=${sc}`;
      const data = await api.get(url);
      setForecast(data);
    } catch (err) {
      setError(err.message || 'Failed to calculate forecast');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForecast(scenario);
  }, [scenario]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            13-Week Cash Flow Forecast
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Opening cash, expected customer collections, payroll & expense projections
          </p>
        </div>

        {/* Scenario Switcher */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">What-If Scenario:</label>
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            className="min-h-[48px] px-3.5 rounded-xl border border-slate-300 text-sm font-semibold bg-white text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="base">Baseline Ledger</option>
            <option value="late_customer">Customer Delays 30 Days</option>
            <option value="supplier_delayed">Supplier Payment Postponed</option>
            <option value="early_customer">Big Customer Pays Early</option>
          </select>
        </div>
      </div>

      {loading ? (
        <Loading message="Simulating cash flows across 13 weekly buckets..." />
      ) : error ? (
        <ErrorState title="Forecast Calculation Failed" message={error} onRetry={() => loadForecast(scenario)} />
      ) : !forecast ? null : (
        <>
          {/* Buffer Summary */}
          {forecast.firstShortageWeek && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Safety Buffer Warning in Week {forecast.firstShortageWeek.weekNumber}:</strong>{' '}
                Projected closing cash ({forecast.firstShortageWeek.formattedClosingCash}) breaches the ₹5,00,000 threshold by{' '}
                <span className="font-mono font-bold text-rose-700">{forecast.firstShortageWeek.formattedDeficit}</span>.
              </div>
            </div>
          )}

          {/* 13-Week Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm font-mono">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-sans font-semibold uppercase text-[11px] tracking-wider">
                    <th className="p-3 sm:p-4">Week</th>
                    <th className="p-3 sm:p-4">Date Range</th>
                    <th className="p-3 sm:p-4 text-right">Opening Cash</th>
                    <th className="p-3 sm:p-4 text-right">Collections</th>
                    <th className="p-3 sm:p-4 text-right">Expenses</th>
                    <th className="p-3 sm:p-4 text-right">Closing Cash</th>
                    <th className="p-3 sm:p-4 text-center font-sans">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {forecast.weeks?.map((w) => (
                    <tr
                      key={w.weekNumber}
                      className={`hover:bg-slate-50 transition-colors ${
                        w.isBelowSafetyBuffer ? 'bg-amber-50/40 font-semibold' : ''
                      }`}
                    >
                      <td className="p-3 sm:p-4 font-sans font-bold text-slate-900">
                        W{w.weekNumber}
                      </td>
                      <td className="p-3 sm:p-4 text-slate-600 font-sans text-xs">
                        {formatDate(w.startDate)} - {formatDate(w.endDate)}
                      </td>
                      <td className="p-3 sm:p-4 text-right text-slate-700">
                        {w.formattedOpeningCash}
                      </td>
                      <td className="p-3 sm:p-4 text-right text-emerald-700 font-bold">
                        +{w.formattedExpectedCollections}
                      </td>
                      <td className="p-3 sm:p-4 text-right text-rose-700">
                        -{w.formattedTotalExpenses}
                      </td>
                      <td className="p-3 sm:p-4 text-right font-black text-slate-900">
                        {w.formattedClosingCash}
                      </td>
                      <td className="p-3 sm:p-4 text-center font-sans">
                        <StatusBadge
                          status={w.isBelowSafetyBuffer ? 'OVERDUE' : 'CONFIRMED'}
                          label={w.isBelowSafetyBuffer ? 'Deficit' : 'Safe'}
                          size="xs"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ForecastPage;
