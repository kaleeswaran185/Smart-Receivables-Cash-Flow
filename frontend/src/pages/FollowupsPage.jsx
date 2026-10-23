import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Flame,
  MessageSquare,
  Mail,
  Smartphone,
  CheckCircle2,
  Clock,
  Calendar,
  Share2,
  Copy,
  Check,
  AlertTriangle,
  FileText,
  Building2,
  RefreshCw,
  X,
  ExternalLink
} from 'lucide-react';
import api from '../services/api';
import { formatIndianCurrency, formatDate } from '../utils/money';
import { StatusBadge } from '../components/common/StatusBadge';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';

export function FollowupsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Snooze Modal State
  const [snoozeModal, setSnoozeModal] = useState(null); // followup item
  const [snoozeDays, setSnoozeDays] = useState(7);
  const [snoozing, setSnoozing] = useState(false);

  // Promise Modal State
  const [promiseModal, setPromiseModal] = useState(null); // followup item
  const [promisedDate, setPromisedDate] = useState('2026-11-15');
  const [promisedAmount, setPromisedAmount] = useState('');
  const [promiseNotes, setPromiseNotes] = useState('');
  const [promising, setPromising] = useState(false);

  const [actionSuccess, setActionSuccess] = useState(null);

  const loadFollowups = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get('/followups');
      setFollowups(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load follow-ups ladder');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFollowups();
    const handleDateChange = () => loadFollowups();
    window.addEventListener('baaki_demo_date_changed', handleDateChange);
    return () => window.removeEventListener('baaki_demo_date_changed', handleDateChange);
  }, []);

  const handleCopyLink = (f) => {
    const origin = window.location.origin;
    const url = f.payment_token
      ? `${origin}/pay/${f.payment_token}`
      : `${origin}/pay/${f.invoice_id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(f.invoice_id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleMarkSent = async (f, channel = 'WHATSAPP') => {
    try {
      await api.post(`/reminders/${f.invoice_id}/sent`, {
        stage: f.stage,
        channel,
        message_body: f.suggested_message
      });
      setActionSuccess(`Reminder marked as SENT for ${f.invoice_number}`);
      setTimeout(() => setActionSuccess(null), 3000);
      loadFollowups();
    } catch (err) {
      alert('Failed to record reminder: ' + err.message);
    }
  };

  const handleSnoozeSubmit = async (e) => {
    e.preventDefault();
    if (!snoozeModal) return;
    try {
      setSnoozing(true);
      await api.post(`/invoices/${snoozeModal.invoice_id}/snooze`, {
        days: Number(snoozeDays)
      });
      setActionSuccess(`Invoice ${snoozeModal.invoice_number} snoozed for ${snoozeDays} days.`);
      setTimeout(() => setActionSuccess(null), 3000);
      setSnoozeModal(null);
      loadFollowups();
    } catch (err) {
      alert('Failed to snooze invoice: ' + err.message);
    } finally {
      setSnoozing(false);
    }
  };

  const handlePromiseSubmit = async (e) => {
    e.preventDefault();
    if (!promiseModal) return;
    try {
      setPromising(true);
      const amountPaise = promisedAmount ? Math.round(Number(promisedAmount) * 100) : promiseModal.balance_paise;
      await api.post(`/invoices/${promiseModal.invoice_id}/promise`, {
        promised_date: promisedDate,
        amount_paise: amountPaise,
        notes: promiseNotes || 'Customer promised settlement'
      });
      setActionSuccess(`Promise to pay recorded for ${promiseModal.invoice_number} until ${promisedDate}. Ladder paused.`);
      setTimeout(() => setActionSuccess(null), 3000);
      setPromiseModal(null);
      loadFollowups();
    } catch (err) {
      alert('Failed to record promise: ' + err.message);
    } finally {
      setPromising(false);
    }
  };

  const getCleanPhone = (phone) => {
    return (phone || '').replace(/[^0-9]/g, '');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-rose-100 text-rose-600">
              <Flame className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Today's Follow-ups & Escalation Ladder
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Escalation stages (-3, 0, 7, 15, 30, 45 days) • Disputed & active promised invoices automatically paused
          </p>
        </div>

        <button
          type="button"
          onClick={loadFollowups}
          className="min-h-[48px] px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4 text-slate-500" />
          <span>Sync Follow-ups</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2 animate-fade-in shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {loading ? (
        <Loading message="Evaluating escalation ladder and overdue thresholds..." />
      ) : error ? (
        <ErrorState title="Error Loading Follow-ups" message={error} onRetry={loadFollowups} />
      ) : followups.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">All Reminders Up To Date</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
            No active invoices match the escalation criteria for today. Disputed invoices and promised payments remain safely paused.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {followups.map((f) => {
            const daysOverdue = f.days_overdue !== undefined ? f.days_overdue : f.stage;
            const payUrl = `${window.location.origin}/pay/${f.payment_token || f.invoice_id}`;
            const cleanPhone = getCleanPhone(f.customer_phone);
            const waUrl = `https://wa.me/${cleanPhone ? (cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`) : ''}?text=${encodeURIComponent(f.suggested_message)}`;
            const mailtoUrl = `mailto:${f.customer_email || ''}?subject=${encodeURIComponent(`Payment Follow-up: Invoice ${f.invoice_number}`)}&body=${encodeURIComponent(f.suggested_message)}`;
            const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(f.suggested_message)}`;

            return (
              <div
                key={`${f.invoice_id}-${f.stage}`}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 p-5 sm:p-6 shadow-sm hover:shadow transition-all space-y-4"
              >
                {/* Top Row: Customer & Balance */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/invoices/${f.invoice_id}`)}
                        className="font-mono font-bold text-base text-slate-900 hover:text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        <span>{f.invoice_number}</span>
                      </button>

                      <StatusBadge
                        status={daysOverdue > 30 ? 'CRITICAL' : daysOverdue > 0 ? 'OVERDUE' : 'DUE_SOON'}
                        label={daysOverdue > 0 ? `${daysOverdue}d Overdue` : daysOverdue === 0 ? 'Due Today' : `Due in ${Math.abs(daysOverdue)}d`}
                        size="xs"
                      />

                      <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Stage: Day {f.stage >= 0 ? `+${f.stage}` : f.stage}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-bold text-slate-900 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {f.customer_name} {f.customer_company ? `(${f.customer_company})` : ''}
                      </span>
                      {f.customer_phone && (
                        <span className="font-mono text-slate-500">{f.customer_phone}</span>
                      )}
                      <span className="text-slate-400">
                        Due: <strong className="font-mono text-slate-600">{formatDate(f.due_date)}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Outstanding Balance</span>
                    <span className="text-2xl font-black font-mono text-emerald-700 tracking-tight">
                      {formatIndianCurrency(f.balance_paise)}
                    </span>
                  </div>
                </div>

                {/* Message Body Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>Generated Message ({f.stage === -3 ? 'Courtesy Notice' : f.stage === 0 ? 'Due Today Reminder' : f.stage === 7 ? 'Gentle Overdue' : f.stage === 15 ? 'Firm Reminder' : f.stage === 30 ? 'Urgent Warning' : 'Final Legal Demand'}):</span>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(f)}
                      className="text-indigo-600 hover:text-indigo-800 text-[11px] flex items-center gap-1 font-mono min-h-[32px]"
                    >
                      {copiedId === f.invoice_id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === f.invoice_id ? 'Pay Link Copied!' : 'Copy Pay Link'}</span>
                    </button>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 font-mono whitespace-pre-wrap leading-relaxed select-all">
                    {f.suggested_message}
                  </div>
                </div>

                {/* 48px Action Buttons Grid */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  {/* Dispatch Channels */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* WhatsApp */}
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[48px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors"
                      title="Open WhatsApp"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>WhatsApp</span>
                    </a>

                    {/* Email */}
                    <a
                      href={mailtoUrl}
                      className="min-h-[48px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-colors"
                      title="Send Email"
                    >
                      <Mail className="w-4 h-4" />
                      <span>Email</span>
                    </a>

                    {/* SMS */}
                    <a
                      href={smsUrl}
                      className="min-h-[48px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-colors"
                      title="Send SMS"
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>SMS</span>
                    </a>
                  </div>

                  {/* Ledger Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Mark as Sent */}
                    <button
                      type="button"
                      onClick={() => handleMarkSent(f)}
                      className="min-h-[48px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Mark Sent</span>
                    </button>

                    {/* Snooze */}
                    <button
                      type="button"
                      onClick={() => setSnoozeModal(f)}
                      className="min-h-[48px] px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-800 border border-amber-200 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-colors"
                    >
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>Snooze</span>
                    </button>

                    {/* Promise to Pay */}
                    <button
                      type="button"
                      onClick={() => {
                        setPromiseModal(f);
                        setPromisedAmount((f.balance_paise / 100).toString());
                      }}
                      className="min-h-[48px] px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 border border-indigo-200 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-colors"
                    >
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      <span>Promise to Pay</span>
                    </button>

                    {/* Demand Letter */}
                    <button
                      type="button"
                      onClick={() => navigate(`/invoices/${f.invoice_id}/demand-letter`)}
                      className="min-h-[48px] px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 active:bg-purple-200 text-purple-700 border border-purple-200 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-colors"
                      title="Generate Payment Demand Letter"
                    >
                      <FileText className="w-4 h-4 text-purple-600" />
                      <span>Demand Letter</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Snooze Modal */}
      {snoozeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-fade-in">
            <div className="flex items-start justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-base">Snooze Reminders</h3>
              </div>
              <button
                type="button"
                onClick={() => setSnoozeModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Pause reminders for <strong className="text-slate-900">Invoice {snoozeModal.invoice_number}</strong> ({snoozeModal.customer_name}).
            </p>

            <form onSubmit={handleSnoozeSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Pause Duration</label>
                <select
                  value={snoozeDays}
                  onChange={(e) => setSnoozeDays(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 text-sm font-semibold bg-white text-slate-900"
                >
                  <option value="3">3 Days (Customer processing cheque)</option>
                  <option value="7">7 Days (Audit / Account verification)</option>
                  <option value="14">14 Days (Next billing cycle)</option>
                  <option value="30">30 Days (Extended credit approval)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSnoozeModal(null)}
                  className="min-h-[48px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={snoozing}
                  className="min-h-[48px] px-6 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition-colors"
                >
                  {snoozing ? 'Snoozing...' : 'Confirm Snooze'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Promise to Pay Modal */}
      {promiseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-fade-in">
            <div className="flex items-start justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">Record Promise to Pay</h3>
              </div>
              <button
                type="button"
                onClick={() => setPromiseModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Customer commitment for <strong className="text-slate-900">Invoice {promiseModal.invoice_number}</strong>. The reminder ladder pauses until the promised date.
            </p>

            <form onSubmit={handlePromiseSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Promised Date *</label>
                <input
                  type="date"
                  value={promisedDate}
                  onChange={(e) => setPromisedDate(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 font-mono text-sm text-slate-900"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Promised Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={promisedAmount}
                  onChange={(e) => setPromisedAmount(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 font-mono font-bold text-sm text-slate-900"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Notes / Customer Conversation</label>
                <input
                  type="text"
                  placeholder="e.g. Accounts head confirmed RTGS release on Friday"
                  value={promiseNotes}
                  onChange={(e) => setPromiseNotes(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 text-sm text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPromiseModal(null)}
                  className="min-h-[48px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={promising}
                  className="min-h-[48px] px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm transition-colors"
                >
                  {promising ? 'Recording...' : 'Register Promise'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default FollowupsPage;
