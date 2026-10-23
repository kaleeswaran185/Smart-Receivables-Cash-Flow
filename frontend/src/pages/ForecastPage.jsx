import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Flame,
  Zap,
  Clock,
  Building2,
  Calendar,
  CheckCircle2,
  RefreshCw,
  Sliders,
  DollarSign
} from 'lucide-react';
import api from '../services/api';
import { formatIndianCurrency, formatDate } from '../utils/money';
import { StatusBadge } from '../components/common/StatusBadge';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';

export function ForecastPage() {
  const navigate = useNavigate();
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scenario, setScenario] = useState('base'); // 'base', 'late_customer', 'supplier_delayed', 'early_customer'

  const loadForecast = async (sc = scenario) => {
    try {
      setLoading(true);
      setError(null);
      const url = sc === 'base' ? '/forecast' : `/forecast?scenario=${sc}`;
      const data = await api.get(url);
      setForecast(data);
    } catch (err) {
      setError(err.message || 'Failed to calculate cash forecast');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForecast(scenario);
    const handleDateChange = () => loadForecast(scenario);
    window.addEventListener('baaki_demo_date_changed', handleDateChange);
    return () => window.removeEventListener('baaki_demo_date_changed', handleDateChange);
  }, [scenario]);

  const scenarios = [
    {
      id: 'base',
      label: 'Baseline Forecast',
      subtitle: 'Expected delay behavior',
      icon: TrendingUp,
      color: 'indigo'
    },
    {
      id: 'late_customer',
      label: 'Customer 30d Late',
      subtitle: 'Collections delayed',
      icon: Clock,
      color: 'amber'
    },
    {
      id: 'supplier_delayed',
      label: 'Supplier Delayed',
      subtitle: 'Expenses pushed back',
      icon: Sliders,
      color: 'purple'
    },
    {
      id: 'early_customer',
      label: 'Customer Pays Early',
      subtitle: 'Advance settlement',
      icon: Zap,
      color: 'emerald'
    }
  ];

  if (loading && !forecast) return <Loading fullPage message="Simulating 13-week cash flow scenarios..." />;
  if (error && !forecast) return <ErrorState title="Forecast Calculation Failed" message={error} onRetry={() => loadForecast(scenario)} />;

  const weeks = forecast?.weeks || [];
  const shortage = forecast?.firstShortageWeek;
  const gapCoverers = forecast?.gapCoveringInvoices || [];
  const safetyBufferPaise = forecast?.safetyBufferPaise || 50000000;

  // Chart scaling calculations
  const maxCashPaise = Math.max(
    safetyBufferPaise * 1.5,
    ...weeks.map((w) => Math.max(w.closingCashPaise, w.openingCashPaise))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-indigo-100 text-indigo-700">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              13-Week Cash Flow Forecast
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Opening cash, collections adjusted for customer delays, operational expenses & safety buffer analysis
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadForecast(scenario)}
          className="min-h-[48px] px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4 text-slate-500" />
          <span>Recalculate</span>
        </button>
      </div>

      {/* What-If Scenario Action Buttons */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            What-If Scenario Simulation
          </span>
          <span className="text-xs text-slate-400">
            Current: <strong className="text-indigo-600 uppercase font-semibold">{scenario.replace('_', ' ')}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {scenarios.map((sc) => {
            const Icon = sc.icon;
            const isActive = scenario === sc.id;

            return (
              <button
                key={sc.id}
                type="button"
                id={`scenario-${sc.id}-btn`}
                onClick={() => setScenario(sc.id)}
                className={`min-h-[56px] p-3 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                  isActive
                    ? 'bg-slate-900 border-slate-900 text-white shadow-md ring-2 ring-slate-900/10'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm'
                }`}
              >
                <div
                  className={`p-2 rounded-xl flex-shrink-0 ${
                    isActive ? 'bg-slate-800 text-emerald-400' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold truncate">{sc.label}</div>
                  <div className={`text-[10px] sm:text-xs truncate ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                    {sc.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Shortage Alert Banner */}
      {shortage ? (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-transparent border border-amber-300 text-slate-900 shadow-sm space-y-2 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500 text-white flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-base text-amber-950">
                  Cash Deficit Detected in Week {shortage.weekNumber} ({formatDate(shortage.startDate)} - {formatDate(shortage.endDate)})
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold badge-rose shadow-sm">
                  Deficit: {shortage.formattedDeficit || formatIndianCurrency(shortage.deficitPaise)}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                Projected closing cash dips to <strong className="font-mono text-slate-900">{shortage.formattedClosingCash || formatIndianCurrency(shortage.closingCashPaise)}</strong>, breaching the statutory safety buffer of <strong className="font-mono text-slate-900">{formatIndianCurrency(safetyBufferPaise)}</strong> due to concentrated supplier payouts, monthly rent, and GST liabilities.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="text-xs sm:text-sm">
            <strong className="font-bold">Liquidity Healthy:</strong> Under the <span className="font-semibold uppercase">{scenario.replace('_', ' ')}</span> scenario, closing cash stays comfortably above the ₹5,00,000 safety buffer in all 13 weeks.
          </div>
        </div>
      )}

      {/* Interactive 13-Week Visual Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              13-Week Cash Flow Trajectory & Buffer Threshold
            </h2>
            <p className="text-xs text-slate-500">
              Closing cash per week vs. minimum ₹5 Lakh safety buffer
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500"></span>
              <span className="text-slate-600">Above Buffer</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-500"></span>
              <span className="text-slate-600">Below Buffer</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t-2 border-dashed border-rose-500"></span>
              <span className="text-slate-600 font-semibold">₹5L Buffer</span>
            </div>
          </div>
        </div>

        {/* CSS Bar Chart */}
        <div className="pt-6 pb-2">
          <div className="relative h-56 sm:h-64 flex items-end justify-between gap-1 sm:gap-2 px-1">
            {/* Safety Buffer Horizontal Line */}
            <div
              className="absolute left-0 right-0 border-t-2 border-dashed border-rose-400 z-10 flex items-center justify-end pr-2 pointer-events-none"
              style={{
                bottom: `${Math.min(90, Math.max(10, (safetyBufferPaise / maxCashPaise) * 100))}%`
              }}
            >
              <span className="bg-rose-50 text-rose-700 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-rose-200">
                Safety Buffer: {formatIndianCurrency(safetyBufferPaise)}
              </span>
            </div>

            {/* Bars for Each Week */}
            {weeks.map((w) => {
              const heightPercent = Math.min(100, Math.max(8, (w.closingCashPaise / maxCashPaise) * 100));
              const isShort = w.isBelowSafetyBuffer;

              return (
                <div
                  key={w.weekNumber}
                  className="relative flex-1 flex flex-col items-center h-full justify-end group"
                >
                  {/* Tooltip on Hover */}
                  <div className="absolute -top-14 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[11px] rounded-lg py-1 px-2 pointer-events-none whitespace-nowrap z-30 shadow-lg font-mono">
                    <div>W{w.weekNumber}: {w.formattedClosingCash || formatIndianCurrency(w.closingCashPaise)}</div>
                    <div className="text-[10px] text-slate-300">
                      +{formatIndianCurrency(w.expectedCollectionsPaise)} / -{formatIndianCurrency(w.expensesPaise)}
                    </div>
                  </div>

                  {/* Bar */}
                  <div
                    className={`w-full max-w-[36px] rounded-t-lg transition-all duration-300 ${
                      isShort
                        ? 'bg-amber-500 hover:bg-amber-400 ring-2 ring-rose-500/40'
                        : 'bg-emerald-600 hover:bg-emerald-500'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  ></div>

                  {/* Week Label */}
                  <div className="mt-2 text-center">
                    <span
                      className={`text-[11px] font-bold block ${
                        isShort ? 'text-rose-600 font-extrabold' : 'text-slate-600'
                      }`}
                    >
                      W{w.weekNumber}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Invoices that can Cover the Gap */}
      {gapCoverers.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200/90 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-amber-100">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-amber-100 text-amber-800">
                <Flame className="w-5 h-5 text-amber-600" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Invoices That Can Cover the Cash Deficit
                </h3>
                <p className="text-xs text-slate-500">
                  Collecting any of these active invoices before Week {shortage?.weekNumber} will prevent the cash shortage
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/followups')}
              className="min-h-[48px] px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 active:bg-amber-950 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors shadow-sm self-start sm:self-auto"
            >
              <span>Chase All via Follow-ups</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {gapCoverers.map((inv) => (
              <div
                key={inv.invoice_id}
                className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 bg-slate-50/60 hover:bg-white transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono font-bold text-slate-900 text-sm block">
                      {inv.invoice_number}
                    </span>
                    <span className="text-xs font-semibold text-slate-700 block truncate max-w-[160px]">
                      {inv.customer_name}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                    {inv.coverage_percentage}% Coverage
                  </span>
                </div>

                <div className="flex items-baseline justify-between pt-1 border-t border-slate-200/60">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Balance Due</span>
                    <span className="font-mono font-bold text-emerald-700 text-base">
                      {inv.formatted_balance || formatIndianCurrency(inv.balance_paise)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Due Date</span>
                    <span className="font-mono text-xs text-slate-600">
                      {formatDate(inv.due_date)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(`/invoices/${inv.invoice_id}`)}
                  className="w-full min-h-[48px] px-3 py-2 rounded-xl bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Flame className="w-4 h-4 text-amber-500" />
                  <span>Chase Invoice {inv.invoice_number}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 13-Week Detailed Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden space-y-2">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base">
            13-Week Cash Flow Schedule
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            Invariant: Week N Closing === Week N+1 Opening
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm font-mono">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-sans font-semibold uppercase text-[11px] tracking-wider">
                <th className="p-3 sm:p-4">Week</th>
                <th className="p-3 sm:p-4">Date Range</th>
                <th className="p-3 sm:p-4 text-right">Opening Cash</th>
                <th className="p-3 sm:p-4 text-right">Expected Collections</th>
                <th className="p-3 sm:p-4 text-right">Scheduled Expenses</th>
                <th className="p-3 sm:p-4 text-right">Net Flow</th>
                <th className="p-3 sm:p-4 text-right">Closing Cash</th>
                <th className="p-3 sm:p-4 text-center font-sans">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {weeks.map((w) => {
                const collectionsFormatted = w.formattedCollections || formatIndianCurrency(w.expectedCollectionsPaise);
                const expensesFormatted = w.formattedExpenses || formatIndianCurrency(w.expensesPaise);
                const openingFormatted = w.formattedOpeningCash || formatIndianCurrency(w.openingCashPaise);
                const closingFormatted = w.formattedClosingCash || formatIndianCurrency(w.closingCashPaise);
                const netFormatted = formatIndianCurrency(w.netCashFlowPaise);

                return (
                  <tr
                    key={w.weekNumber}
                    className={`hover:bg-slate-50 transition-colors ${
                      w.isBelowSafetyBuffer ? 'bg-amber-50/50 font-semibold' : ''
                    }`}
                  >
                    <td className="p-3 sm:p-4 font-sans font-bold text-slate-900">
                      W{w.weekNumber}
                    </td>
                    <td className="p-3 sm:p-4 text-slate-600 font-sans text-xs whitespace-nowrap">
                      {formatDate(w.startDate)} - {formatDate(w.endDate)}
                    </td>
                    <td className="p-3 sm:p-4 text-right text-slate-700">
                      {openingFormatted}
                    </td>
                    <td className="p-3 sm:p-4 text-right text-emerald-700 font-bold">
                      +{collectionsFormatted}
                    </td>
                    <td className="p-3 sm:p-4 text-right text-rose-700">
                      -{expensesFormatted}
                    </td>
                    <td
                      className={`p-3 sm:p-4 text-right font-bold ${
                        w.netCashFlowPaise >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {w.netCashFlowPaise >= 0 ? `+${netFormatted}` : netFormatted}
                    </td>
                    <td className="p-3 sm:p-4 text-right font-black text-slate-900 text-sm">
                      {closingFormatted}
                    </td>
                    <td className="p-3 sm:p-4 text-center font-sans">
                      <StatusBadge
                        status={w.isBelowSafetyBuffer ? 'OVERDUE' : 'CONFIRMED'}
                        label={w.isBelowSafetyBuffer ? 'Deficit' : 'Safe'}
                        size="xs"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ForecastPage;
