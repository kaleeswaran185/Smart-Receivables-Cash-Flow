import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Calendar, FileText, Share2, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { formatIndianCurrency, formatDate } from '../utils/money';
import { StatusBadge } from '../components/common/StatusBadge';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';

export function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchDetail() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.get(`/invoices/${id}`);
        setInvoice(data);
      } catch (err) {
        setError(err.message || 'Invoice not found');
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [id]);

  if (loading) return <Loading fullPage message="Loading invoice particulars..." />;
  if (error || !invoice) return <ErrorState title="Invoice Not Found" message={error} onRetry={() => navigate('/invoices')} />;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="min-h-[48px] min-w-[48px] rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-50 transition-colors"
            aria-label="Back to Invoices"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tracking-tight">
                {invoice.invoice_number}
              </h1>
              <StatusBadge status={invoice.status} />
            </div>
            <p className="text-xs sm:text-sm text-slate-500">
              Tax Invoice Issued on {formatDate(invoice.invoice_date)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {invoice.payment_token && (
            <button
              type="button"
              onClick={() => navigate(`/pay/${invoice.payment_token}`)}
              className="min-h-[48px] px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-xs sm:text-sm border border-indigo-200 flex items-center gap-2 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span>Public Pay Page</span>
            </button>
          )}
        </div>
      </div>

      {/* Invoice Overview Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Billed To</div>
            <div className="text-base font-bold text-slate-900 mt-1">{invoice.customer_name}</div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">GSTIN: {invoice.customer_gstin || 'Unregistered'}</div>
          </div>
          <div className="sm:text-right">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Balance Due</div>
            <div className="text-2xl font-black font-mono text-emerald-700 mt-1">
              {formatIndianCurrency(invoice.balance_paise)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Due Date: <span className="font-mono font-medium text-slate-700">{formatDate(invoice.due_date)}</span>
            </div>
          </div>
        </div>

        {/* Items */}
        {invoice.items && invoice.items.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Invoice Items</h3>
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden text-xs sm:text-sm">
              {invoice.items.map((item, idx) => (
                <div key={idx} className="p-3.5 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <div className="font-semibold text-slate-800">{item.description}</div>
                    <div className="text-xs text-slate-500 font-mono">
                      Qty: {item.quantity} × {formatIndianCurrency(item.unit_price_paise)} • GST {item.gst_rate}%
                    </div>
                  </div>
                  <div className="font-mono font-bold text-slate-900">
                    {formatIndianCurrency(item.total_paise)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default InvoiceDetailPage;
