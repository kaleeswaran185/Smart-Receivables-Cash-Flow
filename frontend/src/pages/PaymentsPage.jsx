import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import { formatIndianCurrency, formatDate } from '../utils/money';
import { StatusBadge } from '../components/common/StatusBadge';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';

export function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadPayments() {
      try {
        setLoading(true);
        const data = await api.get('/payments');
        setPayments(data || []);
      } catch (err) {
        setError(err.message || 'Failed to load payments');
      } finally {
        setLoading(false);
      }
    }
    loadPayments();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Payments & Receipts</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Reconciled receipts, UPI payments, and explicit confirmation audits
        </p>
      </div>

      {loading ? (
        <Loading message="Loading settlement records..." />
      ) : error ? (
        <ErrorState title="Failed to load payments" message={error} />
      ) : payments.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
          No payment records found.
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
                  <th className="p-3 sm:p-4">Mode</th>
                  <th className="p-3 sm:p-4 text-right">Amount</th>
                  <th className="p-3 sm:p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 sm:p-4 font-mono text-slate-600">
                      {formatDate(p.payment_date)}
                    </td>
                    <td className="p-3 sm:p-4 font-mono font-bold text-slate-900">
                      {p.invoice_number || `INV-${p.invoice_id}`}
                    </td>
                    <td className="p-3 sm:p-4 font-medium text-slate-800">
                      {p.customer_name || 'Customer'}
                    </td>
                    <td className="p-3 sm:p-4 font-mono text-xs text-slate-600">
                      {p.payment_mode || 'BANK_TRANSFER'}
                    </td>
                    <td className="p-3 sm:p-4 text-right font-mono font-bold text-emerald-700">
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
    </div>
  );
}

export default PaymentsPage;
