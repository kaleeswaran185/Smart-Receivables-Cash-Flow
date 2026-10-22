import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, FileText, ArrowUpDown } from 'lucide-react';
import api from '../services/api';
import { formatIndianCurrency, formatDate } from '../utils/money';
import { StatusBadge } from '../components/common/StatusBadge';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';

export function InvoicesPage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get('/invoices');
      setInvoices(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch =
      inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Invoices & Receivables Ledger
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage tax invoices, monitor due dates, and track settlement status
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/invoices/new')}
          className="min-h-[48px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>New Tax Invoice</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search invoice number or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-[48px] pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-[48px] px-4 rounded-xl border border-slate-200 text-sm bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="OVERDUE">Overdue</option>
            <option value="SENT">Sent / Due Soon</option>
            <option value="PART_PAID">Part Paid</option>
            <option value="PAID">Paid</option>
            <option value="DISPUTED">Disputed</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <Loading message="Loading invoices ledger..." />
      ) : error ? (
        <ErrorState title="Failed to load invoices" message={error} onRetry={fetchInvoices} />
      ) : filteredInvoices.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
          No invoices match your search filters.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px] tracking-wider">
                  <th className="p-3 sm:p-4">Invoice #</th>
                  <th className="p-3 sm:p-4">Customer</th>
                  <th className="p-3 sm:p-4">Due Date</th>
                  <th className="p-3 sm:p-4 text-right">Total Amount</th>
                  <th className="p-3 sm:p-4 text-right">Balance Due</th>
                  <th className="p-3 sm:p-4">Status</th>
                  <th className="p-3 sm:p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 sm:p-4 font-mono font-bold text-slate-900">
                      {inv.invoice_number}
                    </td>
                    <td className="p-3 sm:p-4 font-medium text-slate-800">
                      <div>{inv.customer_name}</div>
                      {inv.customer_company && (
                        <div className="text-[11px] text-slate-400 font-normal">{inv.customer_company}</div>
                      )}
                    </td>
                    <td className="p-3 sm:p-4 font-mono text-slate-600">
                      {formatDate(inv.due_date)}
                    </td>
                    <td className="p-3 sm:p-4 text-right font-mono font-bold text-slate-700">
                      {formatIndianCurrency(inv.total_paise)}
                    </td>
                    <td className="p-3 sm:p-4 text-right font-mono font-bold text-emerald-700">
                      {formatIndianCurrency(inv.balance_paise)}
                    </td>
                    <td className="p-3 sm:p-4">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="p-3 sm:p-4 text-center">
                      <button
                        type="button"
                        onClick={() => navigate(`/invoices/${inv.id}`)}
                        className="min-h-[48px] px-3 py-1.5 rounded-lg text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 font-semibold text-xs transition-colors inline-flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
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

export default InvoicesPage;
