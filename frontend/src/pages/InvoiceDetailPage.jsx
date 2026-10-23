import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Calendar,
  FileText,
  CreditCard,
  Share2,
  MessageSquare,
  AlertCircle,
  Clock,
  ShieldAlert,
  CheckCircle2,
  HandCoins,
  Copy,
  Check,
  Printer,
  Edit3,
  Save,
  X
} from 'lucide-react';
import api from '../services/api';
import { formatIndianCurrency, formatDate, amountInWords } from '../utils/money';
import { StatusBadge } from '../components/common/StatusBadge';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';

export function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    due_date: '',
    notes: '',
    terms: '',
    status: ''
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get(`/invoices/${id}`);
      setInvoice(data);
      setEditForm({
        due_date: data.due_date || '',
        notes: data.notes || '',
        terms: data.terms || '',
        status: data.status || 'SENT'
      });
    } catch (err) {
      setError(err.message || 'Invoice not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleOpenEdit = () => {
    if (invoice) {
      setEditForm({
        due_date: invoice.due_date || '',
        notes: invoice.notes || '',
        terms: invoice.terms || '',
        status: invoice.status || 'SENT'
      });
      setEditError(null);
      setShowEditModal(true);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError(null);
    try {
      setSavingEdit(true);
      await api.put(`/invoices/${id}`, {
        due_date: editForm.due_date,
        notes: editForm.notes,
        terms: editForm.terms,
        status: editForm.status
      });
      setShowEditModal(false);
      setToastMessage('Invoice updated successfully!');
      setTimeout(() => setToastMessage(null), 3000);
      await fetchDetail();
    } catch (err) {
      setEditError(err.message || 'Failed to update invoice');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCopyLink = () => {
    if (invoice?.payment_token) {
      const url = `${window.location.origin}/pay/${invoice.payment_token}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) return <Loading fullPage message="Fetching invoice, tax breakdown, and history..." />;
  if (error || !invoice) return <ErrorState title="Invoice Not Found" message={error} onRetry={() => navigate('/invoices')} />;

  const isIntraState = invoice.cgst_paise > 0 || invoice.sgst_paise > 0;
  const isInterState = invoice.igst_paise > 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="min-h-[48px] min-w-[48px] rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm"
            aria-label="Back to Invoices"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tracking-tight">
                {invoice.invoice_number}
              </h1>
              <StatusBadge status={invoice.status} />
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                {invoice.invoice_type || 'Tax Invoice'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Issued on <strong className="text-slate-700">{formatDate(invoice.invoice_date)}</strong> • Due on <strong className="text-slate-700">{formatDate(invoice.due_date)}</strong>
            </p>
          </div>
        </div>

        {/* 48px Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/invoices/${invoice.id}/print`)}
            className="min-h-[48px] px-4 py-2 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold text-xs sm:text-sm border border-slate-200 flex items-center gap-2 transition-colors shadow-sm"
            title="Print or Save Invoice as PDF"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print Invoice</span>
          </button>

          <button
            type="button"
            onClick={() => navigate(`/invoices/${invoice.id}/demand-letter`)}
            className="min-h-[48px] px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 font-semibold text-xs sm:text-sm border border-rose-200 flex items-center gap-2 transition-colors"
            title="Generate Formal Payment Demand Letter"
          >
            <FileText className="w-4 h-4 text-rose-600" />
            <span>Demand Letter</span>
          </button>

          <button
            type="button"
            onClick={handleOpenEdit}
            className="min-h-[48px] px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 font-semibold text-xs sm:text-sm border border-indigo-200 flex items-center gap-2 transition-colors cursor-pointer"
            title="Edit Due Date, Notes, or Terms"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit Details</span>
          </button>

          {invoice.payment_token && (
            <button
              type="button"
              onClick={handleCopyLink}
              className="min-h-[48px] px-4 py-2 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-medium text-xs sm:text-sm border border-slate-200 flex items-center gap-2 transition-colors shadow-sm"
              title="Copy Customer Pay Link"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              <span>{copied ? 'Link Copied!' : 'Copy Pay Link'}</span>
            </button>
          )}

          {invoice.balance_paise > 0 && invoice.status !== 'PAID' && (
            <>
              <button
                type="button"
                onClick={() => navigate(`/followups?invoice_id=${invoice.id}`)}
                className="min-h-[48px] px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 font-semibold text-xs sm:text-sm border border-indigo-200 flex items-center gap-2 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp Chase</span>
              </button>

              <button
                type="button"
                onClick={() => navigate(`/payments?invoice_id=${invoice.id}`)}
                className="min-h-[48px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors shadow-sm"
              >
                <CreditCard className="w-4 h-4" />
                <span>Record Payment</span>
              </button>
            </>
          )}
        </div>
      </div>

      {toastMessage && (
        <div role="status" className="p-4 rounded-xl bg-emerald-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl border border-slate-200 animate-fade-in">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Edit Invoice {invoice.invoice_number}</h2>
                  <p className="text-xs text-slate-500">Update due date, notes, terms, or status</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>{editError}</div>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs sm:text-sm">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Due Date</label>
                <input
                  type="date"
                  required
                  value={editForm.due_date}
                  onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 text-slate-900 bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="SENT">SENT (Open Unpaid)</option>
                  <option value="DUE_SOON">DUE_SOON (Approaching Maturity)</option>
                  <option value="OVERDUE">OVERDUE (Past Agreed Terms)</option>
                  <option value="PARTIALLY_PAID">PARTIALLY_PAID (Part Settled)</option>
                  <option value="PAID">PAID (Settled in Full)</option>
                  <option value="DISPUTED">DISPUTED (Under Query)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Notes / Customer Remarks</label>
                <textarea
                  rows={2}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="e.g. Special packing instructions or customer delivery notes"
                  className="w-full p-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Payment Terms</label>
                <textarea
                  rows={2}
                  value={editForm.terms}
                  onChange={(e) => setEditForm({ ...editForm, terms: e.target.value })}
                  placeholder="e.g. Payment due within 30 days. Interest applicable on delayed settlement."
                  className="w-full p-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="min-h-[48px] px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingEdit}
                  className="min-h-[48px] px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingEdit ? 'Saving Updates...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Overview Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-8 shadow-sm space-y-6">
        {/* Parties Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100">
          {/* Supplier (Sharma Packaging) */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Seller / Supplier</span>
            <div className="text-base font-extrabold text-slate-900">{invoice.business_name || 'Sharma Packaging'}</div>
            <div className="text-xs text-slate-600">Pune, Maharashtra • State Code: 27</div>
            <div className="text-xs text-slate-600 font-mono">GSTIN: {invoice.business_gstin || '27AAACS1234A1Z5'}</div>
            {invoice.bank_name && (
              <div className="text-[11px] text-slate-500 font-mono mt-1">
                Bank: {invoice.bank_name} • A/C: {invoice.bank_account_no} • IFSC: {invoice.bank_ifsc}
              </div>
            )}
          </div>

          {/* Customer */}
          <div className="space-y-1 md:text-right">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Buyer / Billed To</span>
            <div className="text-base font-extrabold text-slate-900">{invoice.customer_name}</div>
            {invoice.customer_company && (
              <div className="text-xs font-medium text-slate-700">{invoice.customer_company}</div>
            )}
            <div className="text-xs text-slate-600">
              {invoice.customer_city || ''} {invoice.customer_state ? `(${invoice.customer_state})` : ''}
            </div>
            <div className="text-xs text-slate-600 font-mono">
              GSTIN: {invoice.customer_gstin || 'Unregistered'}
            </div>
            <div className="text-xs text-slate-500">
              Place of Supply: <strong className="text-slate-800">{invoice.place_of_supply || invoice.customer_state || 'Maharashtra'}</strong>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Invoice Line Particulars
          </h2>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px] tracking-wider">
                    <th className="p-3">#</th>
                    <th className="p-3">Item Description</th>
                    <th className="p-3">HSN/SAC</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Rate</th>
                    <th className="p-3 text-right">Taxable Val</th>
                    <th className="p-3 text-center">GST %</th>
                    <th className="p-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.items?.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50/50">
                      <td className="p-3 text-slate-400 font-mono text-xs">{idx + 1}</td>
                      <td className="p-3 font-medium text-slate-900">{item.description}</td>
                      <td className="p-3 font-mono text-slate-500 text-xs">{item.hsn_code || '—'}</td>
                      <td className="p-3 text-right font-mono font-medium text-slate-800">
                        {item.qty} {item.unit || ''}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">
                        {formatIndianCurrency(item.rate_paise)}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700">
                        {formatIndianCurrency(item.taxable_paise)}
                      </td>
                      <td className="p-3 text-center font-mono text-xs">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                          {item.gst_rate}%
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {formatIndianCurrency(item.total_paise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Tax Breakdown & Round Off Calculation Grid */}
        <div className="flex flex-col md:flex-row justify-between gap-6 pt-4 border-t border-slate-100">
          {/* Amount in words & Notes */}
          <div className="flex-1 space-y-3">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Amount In Words
              </span>
              <p className="text-xs sm:text-sm font-semibold text-slate-800 italic bg-slate-50 p-3 rounded-xl border border-slate-200/80 mt-1">
                "{amountInWords(invoice.total_paise)}"
              </p>
            </div>

            {invoice.notes && (
              <div className="text-xs text-slate-600 bg-slate-50/60 p-3 rounded-xl border border-slate-100">
                <span className="font-semibold text-slate-700">Notes:</span> {invoice.notes}
              </div>
            )}
          </div>

          {/* Totals Table */}
          <div className="w-full md:w-80 space-y-2 text-xs sm:text-sm font-mono">
            <div className="flex justify-between text-slate-600 py-1">
              <span className="font-sans">Subtotal:</span>
              <span className="font-bold">{formatIndianCurrency(invoice.subtotal_paise)}</span>
            </div>

            {invoice.discount_paise > 0 && (
              <div className="flex justify-between text-emerald-700 py-1">
                <span className="font-sans">Discount:</span>
                <span>-{formatIndianCurrency(invoice.discount_paise)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-700 py-1 border-t border-slate-100">
              <span className="font-sans">Taxable Value:</span>
              <span className="font-bold">{formatIndianCurrency(invoice.taxable_paise)}</span>
            </div>

            {isIntraState && (
              <>
                <div className="flex justify-between text-slate-600 py-0.5">
                  <span className="font-sans">CGST:</span>
                  <span>+{formatIndianCurrency(invoice.cgst_paise)}</span>
                </div>
                <div className="flex justify-between text-slate-600 py-0.5">
                  <span className="font-sans">SGST:</span>
                  <span>+{formatIndianCurrency(invoice.sgst_paise)}</span>
                </div>
              </>
            )}

            {isInterState && (
              <div className="flex justify-between text-slate-600 py-0.5">
                <span className="font-sans">IGST (Inter-state):</span>
                <span>+{formatIndianCurrency(invoice.igst_paise)}</span>
              </div>
            )}

            {invoice.round_off_paise !== undefined && invoice.round_off_paise !== 0 && (
              <div className="flex justify-between text-slate-500 py-0.5 text-xs">
                <span className="font-sans">Round Off:</span>
                <span>
                  {invoice.round_off_paise > 0 ? `+` : ''}
                  {formatIndianCurrency(invoice.round_off_paise, { showDecimals: true })}
                </span>
              </div>
            )}

            <div className="flex justify-between text-slate-900 py-2 border-t-2 border-slate-900 text-base font-black">
              <span className="font-sans">Grand Total:</span>
              <span>{formatIndianCurrency(invoice.total_paise)}</span>
            </div>

            <div className="flex justify-between text-emerald-700 py-1 border-t border-slate-100">
              <span className="font-sans">Amount Paid:</span>
              <span className="font-bold">-{formatIndianCurrency(invoice.paid_paise)}</span>
            </div>

            <div className="flex justify-between text-rose-600 py-2 border-t-2 border-rose-200 bg-rose-50/50 px-2 rounded-lg text-sm font-black">
              <span className="font-sans">Balance Due:</span>
              <span>{formatIndianCurrency(invoice.balance_paise)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Settlement, Reminders, Disputes & Timeline Tabs/Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Payments, Disputes & Promises */}
        <div className="space-y-6">
          {/* Payment History */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Payment History</h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {invoice.payments?.length || 0} receipt(s)
              </span>
            </div>

            {invoice.payments && invoice.payments.length > 0 ? (
              <div className="divide-y divide-slate-100 text-xs">
                {invoice.payments.map((p, i) => (
                  <div key={i} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">
                        {p.payment_mode} {p.reference_no ? `• Ref: ${p.reference_no}` : ''}
                      </div>
                      <div className="text-slate-400 font-mono text-[11px]">{formatDate(p.payment_date)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-700 font-mono text-sm">
                        {formatIndianCurrency(p.amount_paise)}
                      </div>
                      <StatusBadge status="CONFIRMED" label="Settled" size="xs" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">
                No payments recorded yet for this invoice.
              </div>
            )}
          </div>

          {/* Disputes & Promises History */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-purple-600" />
                <h3 className="font-bold text-slate-900 text-sm">Disputes & Promises</h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {(invoice.disputes?.length || 0) + (invoice.promises?.length || 0)} item(s)
              </span>
            </div>

            {((invoice.disputes?.length || 0) + (invoice.promises?.length || 0)) > 0 ? (
              <div className="space-y-2 text-xs">
                {invoice.disputes?.map((d, i) => (
                  <div key={`d-${i}`} className="p-3 rounded-xl bg-purple-50/60 border border-purple-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-900">Dispute: {d.status}</span>
                      <span className="font-mono text-purple-700 font-bold">{formatIndianCurrency(d.disputed_amount_paise)}</span>
                    </div>
                    <p className="text-slate-700">{d.reason}</p>
                    {d.resolution_notes && (
                      <p className="text-slate-500 italic text-[11px]">Resolution: {d.resolution_notes}</p>
                    )}
                  </div>
                ))}

                {invoice.promises?.map((pr, i) => (
                  <div key={`p-${i}`} className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-900">Promise to Pay ({pr.status})</span>
                      <span className="font-mono text-indigo-700 font-bold">{formatIndianCurrency(pr.promised_amount_paise)}</span>
                    </div>
                    <div className="text-slate-700 font-mono">Promised Settlement Date: {formatDate(pr.promised_date)}</div>
                    {pr.notes && <p className="text-slate-500 text-[11px]">{pr.notes}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">
                No active disputes or deferred payment commitments.
              </div>
            )}
          </div>
        </div>

        {/* Right: Chronological Timeline */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">Chronological Timeline</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">Full Ledger Audit</span>
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {invoice.timeline?.map((event, idx) => (
              <div key={idx} className="relative group">
                {/* Node icon */}
                <div className={`absolute -left-[27px] top-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${
                  event.type === 'INVOICE_CREATED' ? 'bg-indigo-600' :
                  event.type === 'PAYMENT_RECEIVED' ? 'bg-emerald-600' :
                  event.type === 'REMINDER_SENT' ? 'bg-amber-500' :
                  event.type === 'DISPUTE_RAISED' ? 'bg-purple-600' : 'bg-slate-500'
                }`} />

                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">{event.title}</span>
                    <span className="font-mono text-[11px] text-slate-400">{formatDate(event.date)}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{event.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default InvoiceDetailPage;
