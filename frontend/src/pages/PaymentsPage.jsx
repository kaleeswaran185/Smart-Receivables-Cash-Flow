import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Building2,
  Calendar,
  ShieldCheck,
  RefreshCw,
  X,
  AlertCircle
} from 'lucide-react';
import api from '../services/api';
import { formatIndianCurrency, formatDate, rupeesToPaise, paiseToRupees } from '../utils/money';
import { StatusBadge } from '../components/common/StatusBadge';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';

export function PaymentsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  // Record Payment Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [paymentAmountRupees, setPaymentAmountRupees] = useState('');
  const [paymentDate, setPaymentDate] = useState('2026-10-22');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Confirmation Step State
  const [pendingConfirmation, setPendingConfirmation] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [payData, invData] = await Promise.all([
        api.get('/payments'),
        api.get('/invoices')
      ]);
      setPayments(payData || []);
      setInvoices(invData || []);

      // If URL has ?invoice_id=X, auto-open record payment modal
      const targetInvId = searchParams.get('invoice_id');
      if (targetInvId) {
        const found = invData.find(i => String(i.id) === String(targetInvId));
        if (found && found.balance_paise > 0) {
          setSelectedInvoiceId(found.id);
          setPaymentAmountRupees((found.balance_paise / 100).toString());
          setShowModal(true);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openRecordModal = (preselectId = '') => {
    setFormError(null);
    setPendingConfirmation(null);
    if (preselectId) {
      const inv = invoices.find(i => String(i.id) === String(preselectId));
      if (inv) {
        setSelectedInvoiceId(inv.id);
        setPaymentAmountRupees((inv.balance_paise / 100).toString());
      }
    } else {
      const firstUnpaid = invoices.find(i => i.balance_paise > 0 && i.status !== 'PAID');
      if (firstUnpaid) {
        setSelectedInvoiceId(firstUnpaid.id);
        setPaymentAmountRupees((firstUnpaid.balance_paise / 100).toString());
      }
    }
    setShowModal(true);
  };

  const handleInvoiceChange = (id) => {
    setSelectedInvoiceId(id);
    setFormError(null);
    const inv = invoices.find(i => String(i.id) === String(id));
    if (inv) {
      setPaymentAmountRupees((inv.balance_paise / 100).toString());
    }
  };

  const selectedInvoice = invoices.find(i => String(i.id) === String(selectedInvoiceId));

  // Form Submission
  const handleSubmitPayment = async (e, forceConfirm = false) => {
    if (e) e.preventDefault();
    setFormError(null);

    if (!selectedInvoiceId) {
      setFormError('Please choose an invoice to apply payment.');
      return;
    }

    const amountRupees = Number(paymentAmountRupees);
    if (!amountRupees || isNaN(amountRupees) || amountRupees <= 0) {
      setFormError('Payment amount must be greater than zero.');
      return;
    }

    const amountPaise = rupeesToPaise(amountRupees);
    const balancePaise = selectedInvoice?.balance_paise || 0;

    // Check Overpayment
    if (amountPaise > balancePaise) {
      setFormError(
        `Overpayment Flagged: The entered amount (${formatIndianCurrency(amountPaise)}) exceeds the invoice balance (${formatIndianCurrency(balancePaise)}). Overpayment is not permitted.`
      );
      return;
    }

    // Check Full Settlement confirmation step
    const isFullSettlement = (amountPaise === balancePaise);
    if (isFullSettlement && !forceConfirm) {
      setPendingConfirmation({
        amountPaise,
        invoiceNumber: selectedInvoice.invoice_number,
        customerName: selectedInvoice.customer_name,
        newStatus: 'PAID'
      });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        invoice_id: Number(selectedInvoiceId),
        amount_paise: amountPaise,
        payment_date: paymentDate,
        payment_mode: paymentMode,
        reference_no: referenceNo?.trim() || null,
        notes: notes?.trim() || null,
        confirm: forceConfirm
      };

      await api.post('/payments', payload);
      setShowModal(false);
      setPendingConfirmation(null);
      await loadData();
    } catch (err) {
      // Backend may also require confirmation
      if (err.data?.requiresConfirmation || err.data?.code === 'CONFIRM_PAID_REQUIRED') {
        setPendingConfirmation({
          amountPaise,
          invoiceNumber: selectedInvoice.invoice_number,
          customerName: selectedInvoice.customer_name,
          newStatus: 'PAID'
        });
      } else {
        setFormError(err.message || 'Failed to record payment');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPayments = payments.filter(p => {
    const term = search.toLowerCase();
    return (
      !term ||
      p.invoice_number?.toLowerCase().includes(term) ||
      p.customer_name?.toLowerCase().includes(term) ||
      p.reference_no?.toLowerCase().includes(term) ||
      p.payment_mode?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Payments & Collections Ledger
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Audit customer settlements, partial remittances, and explicit confirmation approvals
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="min-h-[48px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => openRecordModal()}
            className="min-h-[48px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Record Settlement</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by invoice number, customer name, payment mode, or UTR/reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-[48px] pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <Loading message="Fetching settlement audit log..." />
      ) : error ? (
        <ErrorState title="Error Loading Payments" message={error} onRetry={loadData} />
      ) : filteredPayments.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <CreditCard className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No Payment Records Found</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
            Record customer remittances via UPI, NEFT, Cheque, or RTGS against open tax invoices.
          </p>
          <button
            type="button"
            onClick={() => openRecordModal()}
            className="min-h-[48px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
          >
            Record First Payment
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px] tracking-wider">
                  <th className="p-3 sm:p-4">Receipt Date</th>
                  <th className="p-3 sm:p-4">Invoice #</th>
                  <th className="p-3 sm:p-4">Customer</th>
                  <th className="p-3 sm:p-4">Payment Mode</th>
                  <th className="p-3 sm:p-4">Reference / UTR</th>
                  <th className="p-3 sm:p-4 text-right">Amount Received</th>
                  <th className="p-3 sm:p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 sm:p-4 font-mono text-slate-600">
                      {formatDate(p.payment_date)}
                    </td>
                    <td className="p-3 sm:p-4 font-mono font-bold text-slate-900">
                      <button
                        type="button"
                        onClick={() => navigate(`/invoices/${p.invoice_id}`)}
                        className="text-indigo-600 hover:underline min-h-[32px] flex items-center"
                      >
                        {p.invoice_number || `INV-${p.invoice_id}`}
                      </button>
                    </td>
                    <td className="p-3 sm:p-4 font-medium text-slate-800">
                      {p.customer_name || 'Customer'}
                    </td>
                    <td className="p-3 sm:p-4 font-mono text-xs text-slate-700">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-semibold">
                        {p.payment_mode}
                      </span>
                    </td>
                    <td className="p-3 sm:p-4 font-mono text-slate-500 text-xs">
                      {p.reference_no || '—'}
                    </td>
                    <td className="p-3 sm:p-4 text-right font-mono font-bold text-emerald-700 text-sm">
                      {formatIndianCurrency(p.amount_paise)}
                    </td>
                    <td className="p-3 sm:p-4">
                      <StatusBadge status="CONFIRMED" label="Settled" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl border border-slate-200 animate-fade-in">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Record Customer Payment</h2>
                  <p className="text-xs text-slate-500">Apply partial or full settlement to an invoice</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>{formError}</div>
              </div>
            )}

            {/* Confirmation Step (Required for Full Payment / Marking Paid) */}
            {pendingConfirmation ? (
              <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-extrabold text-sm text-amber-950">
                      Confirmation Required: Mark Invoice as PAID
                    </h3>
                    <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                      This payment of{' '}
                      <strong className="text-slate-950 font-mono">
                        {formatIndianCurrency(pendingConfirmation.amountPaise)}
                      </strong>{' '}
                      will completely clear the balance for{' '}
                      <strong className="text-slate-950">Invoice {pendingConfirmation.invoiceNumber}</strong> ({pendingConfirmation.customerName}).
                    </p>
                    <p className="text-[11px] text-amber-700 mt-1 font-semibold">
                      Under system audit rules, an invoice is never auto-marked as PAID without explicit confirmation.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200">
                  <button
                    type="button"
                    onClick={() => setPendingConfirmation(null)}
                    className="min-h-[48px] px-4 rounded-xl bg-white border border-amber-300 text-slate-700 font-semibold text-xs hover:bg-amber-100"
                  >
                    Go Back & Adjust
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSubmitPayment(null, true)}
                    className="min-h-[48px] px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{submitting ? 'Confirming...' : 'Yes, Confirm & Settle Invoice'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={(e) => handleSubmitPayment(e, false)} className="space-y-4 text-xs sm:text-sm">
                {/* Invoice Select */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Target Invoice *</label>
                  <select
                    value={selectedInvoiceId}
                    onChange={(e) => handleInvoiceChange(e.target.value)}
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 font-semibold bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">-- Choose Invoice to Settle --</option>
                    {invoices
                      .filter(i => i.balance_paise > 0 && i.status !== 'PAID')
                      .map(inv => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoice_number} • {inv.customer_name} (Balance: {formatIndianCurrency(inv.balance_paise)})
                        </option>
                      ))}
                  </select>
                </div>

                {selectedInvoice && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Invoice Val</span>
                      <strong className="font-mono text-slate-800">{formatIndianCurrency(selectedInvoice.total_paise)}</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Outstanding Balance</span>
                      <strong className="font-mono text-emerald-700 text-sm">{formatIndianCurrency(selectedInvoice.balance_paise)}</strong>
                    </div>
                  </div>
                )}

                {/* Amount */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Payment Amount (₹) *</label>
                    {selectedInvoice && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentAmountRupees((selectedInvoice.balance_paise / 100).toString())}
                          className="text-[11px] text-indigo-600 hover:underline font-semibold"
                        >
                          Full Balance
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setPaymentAmountRupees(Math.round(selectedInvoice.balance_paise / 200).toString())}
                          className="text-[11px] text-indigo-600 hover:underline font-semibold"
                        >
                          50% Partial
                        </button>
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={paymentAmountRupees}
                    onChange={(e) => setPaymentAmountRupees(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 font-mono font-bold text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                {/* Date & Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Payment Date *</label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full min-h-[48px] px-3 rounded-xl border border-slate-200 font-mono text-slate-900"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Payment Mode *</label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full min-h-[48px] px-3 rounded-xl border border-slate-200 font-semibold bg-white text-slate-900"
                      required
                    >
                      <option value="UPI">UPI (Google Pay / PhonePe / QR)</option>
                      <option value="NEFT">NEFT Bank Transfer</option>
                      <option value="RTGS">RTGS Real-Time Settlement</option>
                      <option value="CHEQUE">Bank Cheque</option>
                      <option value="CASH">Cash at Gate</option>
                      <option value="OTHER">Other Remittance</option>
                    </select>
                  </div>
                </div>

                {/* Reference */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">UTR / Reference / Cheque No</label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="e.g. UPI-REF-4820194812"
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 font-mono text-slate-900"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Auditor Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Settlement confirmed via bank statement"
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 text-slate-900"
                  />
                </div>

                {/* 48px Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="min-h-[48px] px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="min-h-[48px] px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{submitting ? 'Recording...' : 'Record Payment'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PaymentsPage;
