import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Flame,
  Zap,
  Clock,
  Calendar,
  RefreshCw,
  Sliders,
  RotateCcw,
  ExternalLink
} from 'lucide-react';
import api from '../services/api';
import { formatIndianCurrency, formatDate } from '../utils/money';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';
import { StatusBadge } from '../components/common/StatusBadge';
import { useTranslation } from '../utils/i18n';

export function ForecastPage() {
  const navigate = useNavigate();
  const { t, language } = useTranslation('forecast');
  const [forecast, setForecast] = useState(null);
  const [baseForecast, setBaseForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scenario, setScenario] = useState('base');

  const loadForecast = useCallback(async (targetScenario = scenario) => {
    try {
      setLoading(true);
      setError(null);

      if (targetScenario === 'base') {
        const data = await api.get('/forecast');
        setForecast(data);
        setBaseForecast(data);
      } else {
        // Fetch both base (if not cached) and scenario forecast for side-by-side comparison
        const promises = [api.get(`/forecast?scenario=${targetScenario}`)];
        if (!baseForecast) {
          promises.push(api.get('/forecast'));
        }
        const [scenData, freshBaseData] = await Promise.all(promises);
        setForecast(scenData);
        if (freshBaseData) {
          setBaseForecast(freshBaseData);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to calculate cash forecast');
    } finally {
      setLoading(false);
    }
  }, [scenario, baseForecast]);

  useEffect(() => {
    loadForecast(scenario);
  }, [scenario]);

  useEffect(() => {
    const handleSettingsOrDateChange = () => {
      loadForecast(scenario);
    };

    window.addEventListener('baaki_demo_date_changed', handleSettingsOrDateChange);
    window.addEventListener('baaki_settings_changed', handleSettingsOrDateChange);

    return () => {
      window.removeEventListener('baaki_demo_date_changed', handleSettingsOrDateChange);
      window.removeEventListener('baaki_settings_changed', handleSettingsOrDateChange);
    };
  }, [scenario, loadForecast]);

  const scenarios = [
    {
      id: 'base',
      label: t('baseline_forecast', 'Baseline Forecast'),
      subtitle: t('baseline_subtitle', 'Expected delay behavior'),
      icon: TrendingUp,
      color: 'indigo'
    },
    {
      id: 'late_customer',
      label: t('customer_30d_late', 'Customer 30d Late'),
      subtitle: t('customer_30d_late_subtitle', 'Collections delayed by 30 days'),
      icon: Clock,
      color: 'amber'
    },
    {
      id: 'supplier_delayed',
      label: t('supplier_delayed', 'Supplier Delayed'),
      subtitle: t('supplier_delayed_subtitle', 'Outflows pushed back 21 days'),
      icon: Sliders,
      color: 'purple'
    },
    {
      id: 'early_customer',
      label: t('early_customer', 'Customer Pays Early'),
      subtitle: t('early_customer_subtitle', 'Advance settlement today'),
      icon: Zap,
      color: 'emerald'
    }
  ];

  if (loading && !forecast) {
    return <Loading fullPage message="Simulating 13-week cash flow scenarios..." />;
  }

  if (error && !forecast) {
    return (
      <ErrorState
        title="Forecast Calculation Failed"
        message={error}
        onRetry={() => loadForecast(scenario)}
      />
    );
  }

  const weeks = forecast?.weeks || [];
  const baseWeeks = baseForecast?.weeks || [];
  const shortage = forecast?.firstShortageWeek;
  const gapCoverers = forecast?.gapCoveringInvoices || [];
  const safetyBufferPaise = Number(forecast?.safetyBufferPaise || 50000000);

  // Maximum cash for proportional bar heights (ensuring buffer line is visible)
  const maxCashPaise = Math.max(
    safetyBufferPaise * 1.5,
    ...weeks.map((w) => Math.max(Number(w.closingCashPaise || 0), Number(w.openingCashPaise || 0)))
  );

  const activeScenarioObj = scenarios.find((s) => s.id === scenario) || scenarios[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-indigo-100 text-indigo-700">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {t('title', '13-Week Cash Flow Forecast')}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {t('subtitle', 'Predictive weekly liquidity model factoring historical payment delays')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {scenario !== 'base' && (
            <button
              type="button"
              id="reset-scenario-btn"
              onClick={() => setScenario('base')}
              className="min-h-[48px] px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors"
            >
              <RotateCcw className="w-4 h-4 text-amber-700" />
              <span>{t('reset_to_base', 'Reset to Baseline')}</span>
            </button>
          )}

          <button
            type="button"
            id="recalculate-forecast-btn"
            onClick={() => loadForecast(scenario)}
            className="min-h-[48px] px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            <span>{t('common.sync_data', 'Recalculate')}</span>
          </button>
        </div>
      </div>

      {/* What-If Scenario Selection Buttons */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {t('what_if_title', 'Interactive What-If Scenario Simulations')}
          </span>
          <span className="text-xs text-slate-500 font-medium">
            {t('current_scenario', {
              scenario: activeScenarioObj.label,
              defaultValue: `Current: ${activeScenarioObj.label}`
            })}
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

      {/* Shortage Alert Banner or Healthy Liquidity Banner */}
      {shortage ? (
        <div
          id="shortage-alert-banner"
          className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-transparent border border-amber-300 text-slate-900 shadow-sm space-y-2 animate-fade-in"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500 text-white flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-base text-amber-950">
                  {t('shortage_banner_title', {
                    week: shortage.weekNumber,
                    startDate: formatDate(shortage.startDate, language),
                    endDate: formatDate(shortage.endDate, language),
                    defaultValue: `Cash Deficit Detected in Week ${shortage.weekNumber} (${formatDate(shortage.startDate, language)} - ${formatDate(shortage.endDate, language)})`
                  })}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold badge-rose shadow-sm">
                  {t('shortage_banner_deficit', {
                    deficit: shortage.formattedDeficit || formatIndianCurrency(shortage.deficitPaise),
                    defaultValue: `Deficit: ${shortage.formattedDeficit || formatIndianCurrency(shortage.deficitPaise)}`
                  })}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                {t('shortage_banner_desc', {
                  closing: shortage.formattedClosingCash || formatIndianCurrency(shortage.closingCashPaise),
                  buffer: formatIndianCurrency(safetyBufferPaise),
                  defaultValue: `Projected closing cash dips to ${shortage.formattedClosingCash || formatIndianCurrency(shortage.closingCashPaise)}, breaching the statutory safety buffer of ${formatIndianCurrency(safetyBufferPaise)}.`
                })}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div
          id="liquidity-healthy-banner"
          className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3"
        >
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="text-xs sm:text-sm">
            <strong className="font-bold mr-1">Liquidity Healthy:</strong>
            {t('liquidity_healthy', {
              scenario: activeScenarioObj.label,
              buffer: formatIndianCurrency(safetyBufferPaise),
              defaultValue: `Under the ${activeScenarioObj.label} scenario, closing cash stays comfortably above the ${formatIndianCurrency(safetyBufferPaise)} safety buffer in all 13 weeks.`
            })}
          </div>
        </div>
      )}

      {/* Visual 13-Week Trajectory Bar Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              {t('trajectory_title', '13-Week Cash Flow Trajectory & Buffer Threshold')}
            </h2>
            <p className="text-xs text-slate-500">
              {t('trajectory_subtitle', 'Closing cash per week vs. minimum safety buffer')}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500" />
              <span className="text-slate-600">{t('above_buffer', 'Above Buffer')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-500" />
              <span className="text-slate-600">{t('below_buffer', 'Below Buffer')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t-2 border-dashed border-rose-500" />
              <span className="text-slate-600 font-semibold">
                {t('safety_buffer_label', {
                  amount: formatIndianCurrency(safetyBufferPaise),
                  defaultValue: `Buffer: ${formatIndianCurrency(safetyBufferPaise)}`
                })}
              </span>
            </div>
          </div>
        </div>

        {/* CSS Scaled Chart */}
        <div className="pt-6 pb-2">
          <div className="relative h-56 sm:h-64 flex items-end justify-between gap-1 sm:gap-2 px-1">
            {/* Horizontal Buffer Floor */}
            <div
              className="absolute left-0 right-0 border-t-2 border-dashed border-rose-400 z-10 flex items-center justify-end pr-2 pointer-events-none"
              style={{
                bottom: `${Math.min(90, Math.max(10, (safetyBufferPaise / maxCashPaise) * 100))}%`
              }}
            >
              <span className="bg-rose-50 text-rose-700 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-rose-200 shadow-sm">
                {t('safety_buffer_label', {
                  amount: formatIndianCurrency(safetyBufferPaise),
                  defaultValue: `Safety Buffer: ${formatIndianCurrency(safetyBufferPaise)}`
                })}
              </span>
            </div>

            {/* Weekly Bars */}
            {weeks.map((w, idx) => {
              const closingCash = Number(w.closingCashPaise || 0);
              const heightPercent = Math.min(100, Math.max(8, (closingCash / maxCashPaise) * 100));
              const isShort = Boolean(w.isBelowBuffer ?? w.isBelowSafetyBuffer);
              const baseWeek = baseWeeks[idx];
              const diffPaise = baseWeek ? closingCash - Number(baseWeek.closingCashPaise || 0) : 0;

              return (
                <div
                  key={w.weekNumber}
                  className="relative flex-1 flex flex-col items-center h-full justify-end group"
                >
                  {/* Tooltip on Hover */}
                  <div className="absolute -top-16 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[11px] rounded-lg py-1 px-2.5 pointer-events-none whitespace-nowrap z-30 shadow-lg font-mono">
                    <div className="font-bold">
                      W{w.weekNumber}: {w.formattedClosingCash || w.formattedClosing || formatIndianCurrency(closingCash)}
                    </div>
                    <div className="text-[10px] text-slate-300">
                      +{w.formattedCollections || formatIndianCurrency(w.expectedCollectionsPaise || w.collectionsPaise)} / -{w.formattedExpenses || formatIndianCurrency(w.expensesPaise || w.scheduledExpensesPaise)}
                    </div>
                    {scenario !== 'base' && diffPaise !== 0 && (
                      <div className={`text-[10px] font-bold ${diffPaise > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {diffPaise > 0 ? `+${formatIndianCurrency(diffPaise)}` : formatIndianCurrency(diffPaise)} vs Base
                      </div>
                    )}
                  </div>

                  {/* Vertical Bar */}
                  <div
                    className={`w-full max-w-[36px] rounded-t-lg transition-all duration-300 ${
                      isShort
                        ? 'bg-amber-500 hover:bg-amber-400 ring-2 ring-rose-500/50'
                        : 'bg-emerald-600 hover:bg-emerald-500'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />

                  {/* Week Label */}
                  <div className="mt-2 text-center">
                    <span
                      className={`text-[11px] font-bold block ${
                        isShort ? 'text-rose-600 font-extrabold' : 'text-slate-600'
                      }`}
                    >
                      W{w.weekNumber}
                    </span>
                    {isShort && (
                      <span className="text-[9px] font-bold text-rose-600 uppercase block tracking-tighter">
                        {t('deficit', 'Deficit')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Gap-Covering Invoices Section (Smallest set of at most 3) */}
      {gapCoverers.length > 0 && (
        <div id="gap-covering-section" className="bg-white rounded-2xl border border-amber-200/90 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-amber-100">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-amber-100 text-amber-800">
                <Flame className="w-5 h-5 text-amber-600" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t('gap_covering_title', 'These Invoices Can Cover the Gap')}
                </h3>
                <p className="text-xs text-slate-500">
                  {t('gap_covering_subtitle', 'Smallest set of active invoices to bridge the deficit')}
                </p>
              </div>
            </div>

            <button
              type="button"
              id="chase-all-followups-btn"
              onClick={() => navigate('/followups')}
              className="min-h-[48px] px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 active:bg-amber-950 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors shadow-sm self-start sm:self-auto"
            >
              <span>{t('chase_all_shortcut', 'Chase All via Follow-ups')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {gapCoverers.map((inv) => {
              const targetId = inv.invoice_id || inv.id;
              const cumulativeFormatted = inv.formatted_cumulative_amount || formatIndianCurrency(inv.cumulative_amount_paise || inv.balance_paise);
              const shortfallFormatted = inv.formatted_shortfall || shortage?.formattedDeficit || formatIndianCurrency(shortage?.deficitPaise || 0);

              return (
                <div
                  key={targetId || inv.invoice_number}
                  className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 bg-slate-50/70 hover:bg-white transition-all space-y-3 cursor-pointer group"
                  onClick={() => navigate(`/invoices/${targetId}`)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono font-bold text-slate-900 text-sm block group-hover:text-indigo-600 transition-colors">
                        {inv.invoice_number}
                      </span>
                      <span className="text-xs font-semibold text-slate-700 block truncate max-w-[170px]">
                        {inv.customer_name}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                      {inv.covers_entire_deficit
                        ? t('covers_deficit', 'Covers 100% of Deficit')
                        : t('coverage_percent', {
                            percentage: inv.coverage_percentage || 100,
                            defaultValue: `${inv.coverage_percentage || 100}% Coverage`
                          })}
                    </span>
                  </div>

                  {/* Cumulative vs Shortfall Metric */}
                  <div className="bg-amber-50 border border-amber-200/80 rounded-lg p-2 text-[11px] text-amber-900 font-mono font-semibold">
                    {t('cumulative_vs_shortfall', {
                      cumulative: cumulativeFormatted,
                      shortfall: shortfallFormatted,
                      defaultValue: `Cumulative: ${cumulativeFormatted} vs Shortfall: ${shortfallFormatted}`
                    })}
                  </div>

                  <div className="flex items-baseline justify-between pt-1 border-t border-slate-200/60 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        {t('balance_due', 'Balance Due')}
                      </span>
                      <span className="font-mono font-bold text-emerald-700 text-sm">
                        {inv.formatted_balance || formatIndianCurrency(inv.balance_paise)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        {t('due_date', 'Due Date')}
                      </span>
                      <span className="font-mono text-xs text-slate-600">
                        {formatDate(inv.due_date, language)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/invoices/${targetId}`);
                    }}
                    className="w-full min-h-[48px] px-3 py-2 rounded-xl bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Flame className="w-4 h-4 text-amber-500" />
                    <span>
                      {t('chase_invoice', {
                        invoice: inv.invoice_number,
                        defaultValue: `Chase Invoice ${inv.invoice_number}`
                      })}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 ml-1" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 13-Week Detailed Schedule Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden space-y-2">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              {t('schedule_title', '13-Week Cash Flow Schedule')}
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              {t('invariant_note', 'Invariant: Week N Closing === Week N+1 Opening')}
            </span>
          </div>

          {scenario !== 'base' && (
            <div className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
              {t('comparison_diff', 'Simulated Impact')}: {activeScenarioObj.label} vs {t('baseline_forecast', 'Baseline')}
            </div>
          )}
        </div>

        {/* Responsive Table scrolling inside its container with no page overflow */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm font-mono">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-sans font-semibold uppercase text-[11px] tracking-wider">
                <th className="p-3 sm:p-4">{t('week', 'Week')}</th>
                <th className="p-3 sm:p-4">{t('date_range', 'Date Range')}</th>
                <th className="p-3 sm:p-4 text-right">{t('opening_balance', 'Opening Cash')}</th>
                <th className="p-3 sm:p-4 text-right">{t('expected_collections', 'Expected Collections')}</th>
                <th className="p-3 sm:p-4 text-right">{t('planned_expenses', 'Scheduled Expenses')}</th>
                <th className="p-3 sm:p-4 text-right">{t('net_flow', 'Net Flow')}</th>
                <th className="p-3 sm:p-4 text-right">{t('closing_balance', 'Closing Balance')}</th>
                {scenario !== 'base' && (
                  <>
                    <th className="p-3 sm:p-4 text-right text-slate-500">{t('comparison_base_closing', 'Base Closing')}</th>
                    <th className="p-3 sm:p-4 text-right text-indigo-700 font-bold">{t('comparison_diff', 'Impact')}</th>
                  </>
                )}
                <th className="p-3 sm:p-4 text-center font-sans">{t('safety_buffer_status', 'Status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {weeks.map((w, idx) => {
                const isShort = Boolean(w.isBelowBuffer ?? w.isBelowSafetyBuffer);
                const openingCash = Number(w.openingCashPaise || 0);
                const closingCash = Number(w.closingCashPaise || 0);
                const collections = Number(w.expectedCollectionsPaise ?? w.collectionsPaise ?? 0);
                const expenses = Number(w.expensesPaise ?? w.scheduledExpensesPaise ?? 0);
                const netCash = Number(w.netCashPaise ?? w.netCashFlowPaise ?? (collections - expenses));

                const collectionsFormatted = w.formattedCollections || formatIndianCurrency(collections);
                const expensesFormatted = w.formattedExpenses || formatIndianCurrency(expenses);
                const openingFormatted = w.formattedOpeningCash || w.formattedOpening || formatIndianCurrency(openingCash);
                const closingFormatted = w.formattedClosingCash || w.formattedClosing || formatIndianCurrency(closingCash);
                const netFormatted = w.formattedNet || w.formattedNetCashFlow || formatIndianCurrency(netCash);

                const baseWeek = baseWeeks[idx];
                const baseClosingCash = baseWeek ? Number(baseWeek.closingCashPaise || 0) : closingCash;
                const variancePaise = closingCash - baseClosingCash;

                return (
                  <tr
                    key={w.weekNumber}
                    className={`hover:bg-slate-50 transition-colors ${
                      isShort ? 'bg-amber-50/80 font-semibold' : ''
                    }`}
                  >
                    <td className="p-3 sm:p-4 font-sans font-bold text-slate-900">
                      W{w.weekNumber}
                    </td>
                    <td className="p-3 sm:p-4 text-slate-600 font-sans text-xs whitespace-nowrap">
                      {formatDate(w.startDate, language)} - {formatDate(w.endDate, language)}
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
                        netCash >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {netCash >= 0 ? `+${netFormatted}` : netFormatted}
                    </td>
                    <td className="p-3 sm:p-4 text-right font-black text-slate-900 text-sm">
                      {closingFormatted}
                    </td>

                    {scenario !== 'base' && (
                      <>
                        <td className="p-3 sm:p-4 text-right text-slate-500 font-mono text-xs">
                          {formatIndianCurrency(baseClosingCash)}
                        </td>
                        <td
                          className={`p-3 sm:p-4 text-right font-bold font-mono text-xs ${
                            variancePaise > 0
                              ? 'text-emerald-700'
                              : variancePaise < 0
                              ? 'text-rose-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {variancePaise > 0
                            ? `+${formatIndianCurrency(variancePaise)}`
                            : variancePaise < 0
                            ? formatIndianCurrency(variancePaise)
                            : '—'}
                        </td>
                      </>
                    )}

                    <td className="p-3 sm:p-4 text-center font-sans">
                      <StatusBadge
                        status={isShort ? 'OVERDUE' : 'CONFIRMED'}
                        label={isShort ? t('deficit', 'Deficit') : t('safe', 'Safe')}
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
