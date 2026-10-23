import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ArrowUpRight,
  Flame,
  Calendar,
  Building2,
  Phone,
  MessageSquare,
  FileText,
  ChevronRight,
  RefreshCw,
  Wallet,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import api from '../services/api';
import { formatIndianCurrency, formatDate } from '../utils/money';
import { StatusBadge } from '../components/common/StatusBadge';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';

export function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/dashboard');
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError(err.message || 'Unable to load dashboard data. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const handleDateChange = () => fetchDashboardData();
    window.addEventListener('baaki_demo_date_changed', handleDateChange);
    return () => window.removeEventListener('baaki_demo_date_changed', handleDateChange);
  }, []);

  const handleQuickRemind = (invoice) => {
    setActionFeedback(`Opening follow-up channel for ${invoice.invoice_number} (${invoice.customer_name})...`);
    setTimeout(() => {
      navigate(`/followups?invoice_id=${invoice.invoice_id}`);
    }, 400);
  };

  if (loading) {
    return <Loading fullPage message="Crunching receivables & cash forecast..." />;
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <ErrorState
          title="Dashboard Unavailable"
          message={error || 'Could not retrieve receivables summary.'}
          onRetry={fetchDashboardData}
        />
      </div>
    );
  }

  const {
    totals,
    ageing_buckets,
    expected_this_week_paise,
    formatted_expected_this_week,
    expected_this_month_paise,
    formatted_expected_this_month,
    lowest_forecast,
    top_chase_list,
    today
  } = data;

  // Calculate total ageing sum for progress bars
  const totalAgeingOverduePaise =
    (ageing_buckets['0_30']?.amount_paise || 0) +
    (ageing_buckets['31_60']?.amount_paise || 0) +
    (ageing_buckets['61_90']?.amount_paise || 0) +
    (ageing_buckets['90_plus']?.amount_paise || 0);

  const getPercentage = (paise) => {
    if (!totalAgeingOverduePaise || totalAgeingOverduePaise <= 0) return 0;
    return Math.round((paise / totalAgeingOverduePaise) * 100);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Feedback */}
      {actionFeedback && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-3 animate-fade-in text-sm">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Page Header with Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Cash Flow & Receivables Command Center
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time aging analysis and AI-prioritized invoice recovery for Sharma Packaging
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchDashboardData}
            className="min-h-[48px] px-4 py-2 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-medium text-xs sm:text-sm border border-slate-200 flex items-center gap-2 shadow-sm transition-colors"
            title="Refresh Ledger Data"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            <span>Sync Data</span>
          </button>
        </div>
      </div>

      {/* 1. Shortage Alert Banner (Conditional when deficit detected) */}
      {lowest_forecast?.is_deficit && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-900 via-rose-800 to-amber-900 text-white p-5 sm:p-6 shadow-xl border border-rose-700/60">
          <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full bg-rose-500/10 blur-2xl pointer-events-none" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
            <div className="space-y-2 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-rose-950 text-white border border-rose-400 shadow-sm">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-300" />
                  Shortage Alert
                </span>
                <span className="text-xs font-semibold text-rose-200">
                  Week {lowest_forecast.week_number} Deficit Warning
                </span>
              </div>

              <h2 className="text-lg sm:text-2xl font-extrabold tracking-tight text-white">
                Projected Cash Shortage of{' '}
                <span className="text-amber-300 underline decoration-amber-400/60 decoration-wavy">
                  {lowest_forecast.formatted_deficit}
                </span>{' '}
                in Week {lowest_forecast.week_number}
              </h2>

              <p className="text-xs sm:text-sm text-rose-100/90 leading-relaxed">
                Projected closing cash drops to <strong className="text-white">{lowest_forecast.formatted_closing_cash}</strong> (below the ₹5,00,000 safety buffer) between{' '}
                <strong className="text-white">{formatDate(lowest_forecast.start_date)}</strong> and{' '}
                <strong className="text-white">{formatDate(lowest_forecast.end_date)}</strong>. Recovering the high-priority invoices below will completely avert this cash crunch.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-shrink-0">
              <a
                href="#chase-first-section"
                className="min-h-[48px] px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Flame className="w-4 h-4 text-rose-700" />
                <span>Chase Top Invoices</span>
              </a>

              <button
                type="button"
                onClick={() => navigate('/forecast')}
                className="min-h-[48px] px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-semibold text-sm border border-white/20 flex items-center justify-center gap-2 transition-all"
              >
                <TrendingUp className="w-4 h-4 text-amber-300" />
                <span>View 13-Week Forecast</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. The 8 Summary Cards Grid */}
      <section aria-label="Receivables and Cash Summary">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          Financial Position Summary
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Receivables */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Total Receivables
              </span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">
              {totals.formatted_receivables}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500">Active Ledger Balance</span>
              <StatusBadge status="ACTIVE" label="Open" size="xs" />
            </div>
          </div>

          {/* Card 2: Total Overdue */}
          <div className="bg-white border border-rose-200/90 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-rose-600 uppercase tracking-wide">
                Total Overdue
              </span>
              <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-rose-600 tracking-tight font-mono">
              {totals.formatted_overdue}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500">Past agreed credit terms</span>
              <StatusBadge status="OVERDUE" label="Critical" size="xs" />
            </div>
          </div>

          {/* Card 3: Total Collected */}
          <div className="bg-white border border-emerald-200/90 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                Total Collected
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-emerald-700 tracking-tight font-mono">
              {totals.formatted_collected}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500">Confirmed bank deposits</span>
              <StatusBadge status="PAID" label="Settled" size="xs" />
            </div>
          </div>

          {/* Card 4: Disputed Amount */}
          <div className="bg-white border border-purple-200/90 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                Disputed Amount
              </span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-purple-700 tracking-tight font-mono">
              {totals.formatted_disputed}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500">Reminders paused</span>
              <StatusBadge status="DISPUTED" label="Under Review" size="xs" />
            </div>
          </div>

          {/* Card 5: Expected This Week */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Expected This Week
              </span>
              <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">
              {formatted_expected_this_week}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500">Week 1 collection forecast</span>
              <StatusBadge status="SENT" label="Velocity" size="xs" />
            </div>
          </div>

          {/* Card 6: Expected This Month */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Expected This Month
              </span>
              <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">
              {formatted_expected_this_month}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500">First 4 weeks projected</span>
              <StatusBadge status="PAID" label="30d Inflow" size="xs" />
            </div>
          </div>

          {/* Card 7: Lowest Projected Cash */}
          <div className={`border rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow transition-shadow ${
            lowest_forecast?.is_deficit ? 'bg-amber-50/80 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700' : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-950 dark:text-amber-200 uppercase tracking-wide">
                Lowest Cash (Runway)
              </span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                lowest_forecast?.is_deficit ? 'bg-amber-200 text-amber-950 dark:bg-amber-900 dark:text-amber-100' : 'bg-slate-100 text-slate-700'
              }`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">
              {lowest_forecast?.formatted_closing_cash || '—'}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Week {lowest_forecast?.week_number || 1} Projected Low
              </span>
              <StatusBadge
                status={lowest_forecast?.is_deficit ? 'OVERDUE' : 'CONFIRMED'}
                label={lowest_forecast?.is_deficit ? 'Deficit Week' : 'Safe'}
                size="xs"
              />
            </div>
          </div>

          {/* Card 8: Buffer Deficit / Safety Cushion */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Safety Buffer Target
              </span>
              <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs">
                MIN
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">
              ₹5,00,000
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500">Current Deficit</span>
              <span className="font-mono font-bold text-rose-600">
                {lowest_forecast?.is_deficit ? lowest_forecast.formatted_deficit : '₹0 (Safe)'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Ageing Breakdown Section */}
      <section aria-label="Receivables Ageing Breakdown" className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Receivables Ageing Analysis
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Distribution of overdue customer balances across ageing brackets
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg self-start sm:self-auto">
            Total Overdue: <strong className="text-rose-600 font-mono">{totals.formatted_overdue}</strong>
          </div>
        </div>

        {/* Responsive Ageing Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {/* 0-30 Days */}
          <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-teal-800 uppercase tracking-wide">0 - 30 Days</span>
              <StatusBadge status="CONFIRMED" label="Early Overdue" size="xs" />
            </div>
            <div className="text-xl font-extrabold text-slate-900 font-mono">
              {ageing_buckets['0_30']?.formatted_amount || '₹0'}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>{ageing_buckets['0_30']?.count || 0} Invoices</span>
              <span className="font-bold text-teal-700">{getPercentage(ageing_buckets['0_30']?.amount_paise || 0)}%</span>
            </div>
            {/* Visual Bar */}
            <div className="w-full bg-teal-100 h-2 rounded-full mt-2.5 overflow-hidden">
              <div
                className="bg-teal-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(4, getPercentage(ageing_buckets['0_30']?.amount_paise || 0)))}%` }}
              />
            </div>
          </div>

          {/* 31-60 Days */}
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">31 - 60 Days</span>
              <StatusBadge status="DUE_SOON" label="Moderate Risk" size="xs" />
            </div>
            <div className="text-xl font-extrabold text-slate-900 font-mono">
              {ageing_buckets['31_60']?.formatted_amount || '₹0'}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>{ageing_buckets['31_60']?.count || 0} Invoices</span>
              <span className="font-bold text-amber-700">{getPercentage(ageing_buckets['31_60']?.amount_paise || 0)}%</span>
            </div>
            {/* Visual Bar */}
            <div className="w-full bg-amber-100 h-2 rounded-full mt-2.5 overflow-hidden">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(4, getPercentage(ageing_buckets['31_60']?.amount_paise || 0)))}%` }}
              />
            </div>
          </div>

          {/* 61-90 Days */}
          <div className="p-4 rounded-xl border border-orange-200 bg-orange-50/50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-orange-800 uppercase tracking-wide">61 - 90 Days</span>
              <StatusBadge status="OVERDUE" label="High Priority" size="xs" />
            </div>
            <div className="text-xl font-extrabold text-slate-900 font-mono">
              {ageing_buckets['61_90']?.formatted_amount || '₹0'}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>{ageing_buckets['61_90']?.count || 0} Invoices</span>
              <span className="font-bold text-orange-700">{getPercentage(ageing_buckets['61_90']?.amount_paise || 0)}%</span>
            </div>
            {/* Visual Bar */}
            <div className="w-full bg-orange-100 h-2 rounded-full mt-2.5 overflow-hidden">
              <div
                className="bg-orange-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(4, getPercentage(ageing_buckets['61_90']?.amount_paise || 0)))}%` }}
              />
            </div>
          </div>

          {/* 90+ Days */}
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-rose-800 uppercase tracking-wide">90+ Days</span>
              <StatusBadge status="CRITICAL" label="Legal Risk" size="xs" />
            </div>
            <div className="text-xl font-extrabold text-rose-600 font-mono">
              {ageing_buckets['90_plus']?.formatted_amount || '₹0'}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>{ageing_buckets['90_plus']?.count || 0} Invoices</span>
              <span className="font-bold text-rose-700">{getPercentage(ageing_buckets['90_plus']?.amount_paise || 0)}%</span>
            </div>
            {/* Visual Bar */}
            <div className="w-full bg-rose-100 h-2 rounded-full mt-2.5 overflow-hidden">
              <div
                className="bg-rose-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(4, getPercentage(ageing_buckets['90_plus']?.amount_paise || 0)))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Not Due Yet note */}
        {ageing_buckets?.not_due && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
            <span>
              ℹ️ Current Unmatured Receivables (Not yet due): <strong className="font-mono text-slate-900">{ageing_buckets.not_due.formatted_amount}</strong> across {ageing_buckets.not_due.count} invoices
            </span>
            <button
              type="button"
              onClick={() => navigate('/invoices')}
              className="min-h-[48px] px-3 font-semibold text-indigo-600 hover:text-indigo-800 active:text-indigo-900 flex items-center gap-1"
            >
              <span>View Invoices Ledger</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </section>

      {/* 4. "CHASE THESE FIRST" Top-5 List */}
      <section
        id="chase-first-section"
        aria-label="Chase These First Recommendations"
        className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-rose-100 text-rose-600">
                <Flame className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                CHASE THESE FIRST
              </h2>
              <span className="bg-rose-700 text-white font-extrabold text-xs px-2.5 py-0.5 rounded-full border border-rose-800 shadow-sm">
                Top 5
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Smart priority ranked by overdue duration, balance impact on projected deficit, and customer reliability grade
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/followups')}
            className="min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors self-start sm:self-auto"
          >
            <span>View All Follow-ups</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        {/* List of Top 5 Invoices */}
        <div className="space-y-4">
          {top_chase_list && top_chase_list.length > 0 ? (
            top_chase_list.map((item, index) => {
              const isTop = index === 0;
              return (
                <div
                  key={item.invoice_id}
                  className={`rounded-2xl border transition-all ${
                    isTop
                      ? 'border-rose-300 dark:border-rose-800 bg-gradient-to-br from-rose-50/60 via-white to-amber-50/40 dark:from-rose-950/40 dark:via-slate-900 dark:to-slate-900 shadow-sm p-4 sm:p-5'
                      : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 p-4 sm:p-5'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Invoice and Customer Details */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Rank Badge */}
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isTop ? 'bg-rose-700 text-white' : 'bg-slate-700 text-white'
                        }`}>
                          #{index + 1}
                        </span>

                        {/* Priority Score & Label */}
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-700 dark:bg-rose-500 text-white dark:text-slate-950 border border-rose-800 dark:border-rose-400 shadow-sm">
                          <span>{item.label}</span>
                          <span className="font-mono bg-white text-rose-950 px-1 rounded font-black">
                            {item.priority_score}
                          </span>
                        </span>

                        {/* Invoice Number */}
                        <button
                          type="button"
                          onClick={() => navigate(`/invoices/${item.invoice_id}`)}
                          className="font-mono font-bold text-slate-900 text-sm hover:text-indigo-600 hover:underline min-h-[48px] py-1 flex items-center"
                        >
                          {item.invoice_number}
                        </button>

                        {/* Overdue Badge */}
                        <StatusBadge
                          status={item.days_overdue > 30 ? 'CRITICAL' : 'OVERDUE'}
                          label={`${item.days_overdue}d Overdue`}
                          size="xs"
                        />

                        {/* Customer Reliability Grade */}
                        <StatusBadge
                          status={item.customer_grade === 'C' ? 'GRADE_C' : item.customer_grade === 'B' ? 'GRADE_B' : 'GRADE_A'}
                          label={`Grade ${item.customer_grade} (${item.customer_avg_delay}d avg delay)`}
                          size="xs"
                        />
                      </div>

                      {/* Customer Info */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-700">
                        <span className="font-bold text-slate-900 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {item.customer_name}
                        </span>
                        {item.customer_phone && (
                          <span className="text-slate-500 flex items-center gap-1 font-mono text-xs">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {item.customer_phone}
                          </span>
                        )}
                        <span className="text-slate-400">
                          Due Date: <strong className="text-slate-600 font-mono">{formatDate(item.due_date)}</strong>
                        </span>
                      </div>

                      {/* Reason String - SPEC requirement */}
                      <div className="p-3 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 leading-relaxed font-medium">
                        <strong className="text-slate-950 dark:text-white font-bold">Priority Driver:</strong>{' '}
                        <span>{item.reason}</span>
                      </div>
                    </div>

                    {/* Right: Amount & 48px Action Buttons */}
                    <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 flex-shrink-0">
                      <div className="text-left sm:text-right">
                        <div className="text-xs text-slate-400 uppercase font-semibold">
                          Balance Due
                        </div>
                        <div className="text-2xl font-black text-slate-900 font-mono tracking-tight text-emerald-700">
                          {item.formatted_balance}
                        </div>
                      </div>

                      {/* 48px Touch Buttons */}
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => handleQuickRemind(item)}
                          className="flex-1 sm:flex-initial min-h-[48px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>WhatsApp / Chase</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => navigate(`/invoices/${item.invoice_id}`)}
                          className="min-h-[48px] min-w-[48px] px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-medium text-xs sm:text-sm flex items-center justify-center transition-colors"
                          title="View Invoice"
                          aria-label="View Invoice"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-slate-500 text-sm">
              🎉 No overdue invoices requiring immediate chasing! All payments are currently up to date.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;
