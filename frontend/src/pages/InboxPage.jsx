import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Inbox,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  CreditCard,
  Building2,
  Phone,
  FileText,
  Clock,
  ArrowRight,
  ExternalLink,
  Pause,
  Play,
  Check,
  RefreshCw,
  X
} from 'lucide-react';
import api from '../services/api';
import { formatIndianCurrency, formatDate } from '../utils/money';
import { StatusBadge } from '../components/common/StatusBadge';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';

export function InboxPage() {
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'claims', 'disputes', 'promises'
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [processingClaimId, setProcessingClaimId] = useState(null);
  const [processingPromiseId, setProcessingPromiseId] = useState(null);

  // Resolve Dispute Modal
  const [resolveModal, setResolveModal] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  const loadInbox = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/inbox');
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load inbox items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInbox();
  }, []);

  const handleAcceptClaim = async (claim) => {
    setProcessingClaimId(claim.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await api.post(`/inbox/claims/${claim.id}/accept`);
      setActionSuccess(res?.message || `Claim accepted! Payment recorded & Invoice ${claim.invoice_number} updated.`);
      setTimeout(() => setActionSuccess(null), 4000);
      await loadInbox();
    } catch (err) {
      setActionError(err.message || 'Failed to accept claim');
    } finally {
      setProcessingClaimId(null);
    }
  };

  const handleRejectClaim = async (claim) => {
    if (!window.confirm(`Reject payment claim for Invoice ${claim.invoice_number}? The reminder ladder will remain active.`)) return;
    try {
      await api.post(`/inbox/claims/${claim.id}/reject`);
      setActionSuccess(`Payment claim for ${claim.invoice_number} rejected.`);
      setTimeout(() => setActionSuccess(null), 3000);
      loadInbox();
    } catch (err) {
      alert('Failed to reject claim: ' + err.message);
    }
  };

  const handleToggleDisputeReminders = async (dispute, pause) => {
    try {
      await api.post(`/inbox/disputes/${dispute.dispute_id}/toggle-reminders`, { pause });
      setActionSuccess(pause ? `Reminders paused for Invoice ${dispute.invoice_number}.` : `Reminders resumed for Invoice ${dispute.invoice_number}.`);
      setTimeout(() => setActionSuccess(null), 3000);
      loadInbox();
    } catch (err) {
      alert('Failed to update reminder status: ' + err.message);
    }
  };

  const handleResolveDisputeSubmit = async (e) => {
    e.preventDefault();
    if (!resolveModal) return;
    try {
      setResolving(true);
      await api.post(`/inbox/disputes/${resolveModal.dispute_id}/resolve`, {
        resolution_notes: resolutionNotes.trim() || 'Dispute resolved with customer',
        resume_reminders: true
      });
      setActionSuccess(`Dispute for ${resolveModal.invoice_number} resolved successfully.`);
      setTimeout(() => setActionSuccess(null), 3000);
      setResolveModal(null);
      setResolutionNotes('');
      loadInbox();
    } catch (err) {
      alert('Failed to resolve dispute: ' + err.message);
    } finally {
      setResolving(false);
    }
  };

  const handleFulfillPromise = async (promise) => {
    setProcessingPromiseId(promise.promise_id);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await api.post(`/inbox/promises/${promise.promise_id}/fulfill`);
      setActionSuccess(res?.message || `Payment recorded and Promise fulfilled for Invoice ${promise.invoice_number}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      await loadInbox();
    } catch (err) {
      setActionError(err.message || 'Failed to fulfill promise');
    } finally {
      setProcessingPromiseId(null);
    }
  };

  const handleCancelPromise = async (promise) => {
    if (!window.confirm(`Cancel promise for Invoice ${promise.invoice_number}? Reminders will resume.`)) return;
    try {
      await api.post(`/inbox/promises/${promise.promise_id}/cancel`);
      setActionSuccess(`Promise cancelled for ${promise.invoice_number}. Reminder ladder resumed.`);
      setTimeout(() => setActionSuccess(null), 3000);
      loadInbox();
    } catch (err) {
      alert('Failed to cancel promise: ' + err.message);
    }
  };

  if (loading) return <Loading fullPage message="Auditing incoming claims, disputes, and commitments..." />;
  if (error || !data) return <ErrorState title="Error Loading Inbox" message={error} onRetry={loadInbox} />;

  const claims = data.payment_claims || [];
  const disputes = data.disputes || [];
  const promises = data.promises || [];
  const summary = data.summary || {
    total_pending: 0,
    payment_claims_count: 0,
    disputes_count: 0,
    promises_count: 0
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-indigo-100 text-indigo-700">
              <Inbox className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Action Inbox & Customer Responses
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Audit customer payment claims, manage billing disputes, and track promised payment dates
          </p>
        </div>

        <button
          type="button"
          onClick={loadInbox}
          className="min-h-[48px] px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4 text-slate-500" />
          <span>Refresh Inbox</span>
        </button>
      </div>

      {actionSuccess && (
        <div role="status" className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs sm:text-sm flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{actionSuccess}</span>
          </div>
          <button type="button" onClick={() => setActionSuccess(null)} className="p-1 text-emerald-700 hover:text-emerald-950">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs sm:text-sm flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span className="font-semibold">{actionError}</span>
          </div>
          <button type="button" onClick={() => setActionError(null)} className="p-1 text-rose-700 hover:text-rose-950">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`min-h-[48px] px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'all'
              ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>All Pending</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${activeTab === 'all' ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900' : 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-600'}`}>
            {summary.total_pending}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('claims')}
          className={`min-h-[48px] px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'claims'
              ? 'bg-emerald-700 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Payment Claims</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${activeTab === 'claims' ? 'bg-emerald-900 dark:bg-emerald-700 text-white' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-100 border border-emerald-400 dark:border-emerald-700'}`}>
            {summary.payment_claims_count}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('disputes')}
          className={`min-h-[48px] px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'disputes'
              ? 'bg-rose-700 dark:bg-rose-500 text-white dark:text-slate-950 shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Open Disputes</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${activeTab === 'disputes' ? 'bg-rose-900 dark:bg-rose-700 text-white' : 'bg-rose-100 dark:bg-rose-950 text-rose-950 dark:text-rose-100 border border-rose-400 dark:border-rose-700'}`}>
            {summary.disputes_count}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('promises')}
          className={`min-h-[48px] px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'promises'
              ? 'bg-indigo-700 dark:bg-indigo-400 text-white dark:text-slate-950 shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Payment Promises</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${activeTab === 'promises' ? 'bg-indigo-900 dark:bg-indigo-700 text-white' : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-950 dark:text-indigo-100 border border-indigo-400 dark:border-indigo-700'}`}>
            {summary.promises_count}
          </span>
        </button>
      </div>

      {summary.total_pending === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Inbox Zero Reached</h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
            All customer payment claims have been reconciled, reported disputes resolved, and payment promises tracked.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECTION 1: PAYMENT CLAIMS */}
          {(activeTab === 'all' || activeTab === 'claims') && claims.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>Customer Payment Claims ({claims.length})</span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {claims.map((claim) => (
                  <div
                    key={claim.id}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 p-5 shadow-sm space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-base text-slate-900">
                            {claim.invoice_number || `Invoice #${claim.invoice_id}`}
                          </span>
                          <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Claimed via Public Link
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 flex items-center gap-2 mt-0.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <strong className="text-slate-800">{claim.customer_name}</strong>
                          {claim.customer_company && <span>({claim.customer_company})</span>}
                          {claim.customer_phone && <span className="font-mono text-slate-500">• {claim.customer_phone}</span>}
                        </div>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Claimed Amount</span>
                        <span className="text-2xl font-black font-mono text-emerald-600">
                          {claim.formatted_amount}
                        </span>
                        <span className="text-[11px] text-slate-500 block font-mono">
                          Invoice Balance: {claim.formatted_invoice_balance}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Payment Method</span>
                        <span className="font-semibold text-slate-800">{claim.payment_mode || 'UPI'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Reference / UTR</span>
                        <span className="font-mono font-bold text-slate-900">{claim.reference_no || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Payment Date</span>
                        <span className="font-mono text-slate-700">{formatDate(claim.payment_date)}</span>
                      </div>
                      {claim.notes && (
                        <div className="sm:col-span-3 pt-1 border-t border-slate-200/60 text-slate-600">
                          <span className="font-semibold text-slate-700">Customer Note:</span> "{claim.notes}"
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => navigate(`/invoices/${claim.invoice_id}`)}
                        className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs flex items-center gap-1 min-h-[48px] px-2"
                      >
                        <FileText className="w-4 h-4" />
                        <span>View / Edit Invoice</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRejectClaim(claim)}
                          className="min-h-[48px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-colors"
                        >
                          <XCircle className="w-4 h-4 text-slate-500" />
                          <span>Reject</span>
                        </button>

                        <button
                          type="button"
                          aria-label="Mark as paid"
                          disabled={processingClaimId === claim.id}
                          onClick={() => handleAcceptClaim(claim)}
                          className={`min-h-[48px] px-5 py-2 rounded-xl text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors shadow-sm ${
                            processingClaimId === claim.id
                              ? 'bg-emerald-800/70 cursor-not-allowed opacity-80'
                              : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 cursor-pointer'
                          }`}
                        >
                          {processingClaimId === claim.id ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
                              <span>Marking as Paid...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Mark as Paid</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 2: OPEN DISPUTES */}
          {(activeTab === 'all' || activeTab === 'disputes') && disputes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Open Invoice Disputes ({disputes.length})</span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {disputes.map((dispute) => {
                  const isRemindersPaused = dispute.invoice_status === 'DISPUTED';

                  return (
                    <div
                      key={dispute.dispute_id}
                      className="bg-white rounded-2xl border border-rose-200/80 hover:border-rose-300 p-5 shadow-sm space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-base text-slate-900">
                              {dispute.invoice_number}
                            </span>
                            <StatusBadge status="DISPUTED" size="xs" />
                            {isRemindersPaused ? (
                              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                <Pause className="w-3 h-3 text-amber-600" />
                                Reminders Paused
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                <Play className="w-3 h-3 text-emerald-600" />
                                Reminders Active
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 flex items-center gap-2 mt-0.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <strong className="text-slate-800">{dispute.customer_name}</strong>
                            {dispute.customer_company && <span>({dispute.customer_company})</span>}
                            {dispute.customer_phone && <span className="font-mono text-slate-500">• {dispute.customer_phone}</span>}
                          </div>
                        </div>

                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Disputed Amount</span>
                          <span className="text-2xl font-black font-mono text-rose-600">
                            {dispute.formatted_amount}
                          </span>
                          <span className="text-[11px] text-slate-500 block font-mono">
                            Total Balance: {dispute.formatted_invoice_balance}
                          </span>
                        </div>
                      </div>

                      {/* Dispute Details */}
                      <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100 text-xs space-y-1">
                        <div className="font-bold text-rose-900">Reported Issue:</div>
                        <p className="text-slate-800 italic">"{dispute.reason}"</p>
                        <div className="text-[11px] text-slate-400 pt-1">
                          Reported on {formatDate(dispute.created_at)}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => navigate(`/invoices/${dispute.invoice_id}`)}
                          className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs flex items-center gap-1 min-h-[48px] px-2"
                        >
                          <FileText className="w-4 h-4" />
                          <span>Edit / View Invoice</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleDisputeReminders(dispute, !isRemindersPaused)}
                            className="min-h-[48px] px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-colors"
                          >
                            {isRemindersPaused ? (
                              <>
                                <Play className="w-4 h-4 text-emerald-600" />
                                <span>Resume Reminders</span>
                              </>
                            ) : (
                              <>
                                <Pause className="w-4 h-4 text-amber-600" />
                                <span>Pause Reminders</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setResolveModal(dispute)}
                            className="min-h-[48px] px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors shadow-sm"
                          >
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span>Resolve Dispute</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 3: PAYMENT PROMISES */}
          {(activeTab === 'all' || activeTab === 'promises') && promises.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>Pending Payment Commitments ({promises.length})</span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {promises.map((promise) => (
                  <div
                    key={promise.promise_id}
                    className="bg-white rounded-2xl border border-indigo-100 hover:border-indigo-200 p-5 shadow-sm space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-base text-slate-900">
                            {promise.invoice_number || `Invoice #${promise.invoice_id}`}
                          </span>
                          <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Payment Commitment
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 flex items-center gap-2 mt-0.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <strong className="text-slate-800">{promise.customer_name}</strong>
                          {promise.customer_company && <span>({promise.customer_company})</span>}
                          {promise.customer_phone && <span className="font-mono text-slate-500">• {promise.customer_phone}</span>}
                        </div>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Promised Amount</span>
                        <span className="text-2xl font-black font-mono text-indigo-700">
                          {promise.formatted_amount}
                        </span>
                        <span className="text-[11px] text-slate-500 block font-mono">
                          Promised Date: <strong className="text-slate-800">{formatDate(promise.promised_date)}</strong>
                        </span>
                      </div>
                    </div>

                    {promise.notes && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
                        <span className="font-semibold text-slate-800">Promise Context:</span> "{promise.notes}"
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => navigate(`/invoices/${promise.invoice_id}`)}
                        className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs flex items-center gap-1 min-h-[48px] px-2"
                      >
                        <FileText className="w-4 h-4" />
                        <span>View Invoice</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCancelPromise(promise)}
                          className="min-h-[48px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-colors"
                        >
                          <X className="w-4 h-4 text-slate-500" />
                          <span>Cancel Promise</span>
                        </button>

                        <button
                          type="button"
                          aria-label="Mark as paid"
                          disabled={processingPromiseId === promise.promise_id}
                          onClick={() => handleFulfillPromise(promise)}
                          className={`min-h-[48px] px-5 py-2 rounded-xl text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors shadow-sm ${
                            processingPromiseId === promise.promise_id
                              ? 'bg-indigo-800/70 cursor-not-allowed opacity-80'
                              : 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 cursor-pointer'
                          }`}
                        >
                          {processingPromiseId === promise.promise_id ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
                              <span>Marking as Paid...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Mark as Paid</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resolve Dispute Modal */}
      {resolveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-fade-in">
            <div className="flex items-start justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">Resolve Dispute</h3>
              </div>
              <button
                type="button"
                onClick={() => setResolveModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Resolving dispute for <strong className="text-slate-900">Invoice {resolveModal.invoice_number}</strong> ({resolveModal.customer_name}). Reminders will safely resume based on overdue status.
            </p>

            <form onSubmit={handleResolveDisputeSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Resolution Notes</label>
                <textarea
                  required
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="e.g. Credit note issued for damaged items; customer agreed to settle balance..."
                  className="w-full h-24 p-3 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolveModal(null)}
                  className="flex-1 min-h-[48px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolving}
                  className="flex-1 min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md"
                >
                  {resolving ? 'Resolving...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default InboxPage;
