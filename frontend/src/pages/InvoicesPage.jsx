import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  FileText,
  Calendar,
  Building2,
  Clock,
  ArrowUpDown,
  CreditCard,
  RefreshCw,
  X
} from 'lucide-react';
import api from '../services/api';
import { formatIndianCurrency, formatDate } from '../utils/money';
import { StatusBadge } from '../components/common/StatusBadge';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';

export function InvoicesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [customerFilter, setCustomerFilter] = useState(searchParams.get('customer_id') || 'ALL');
  const [overdueFilter, setOverdueFilter] = useState('ALL'); // ALL, OVERDUE, OVERDUE_15, OVERDUE_30, OVERDUE_45
  const [sortField, setSortField] = useState('due_date');
  const [sortOrder, setSortOrder] = useState('asc'); // asc, desc

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [invData, custData] = await Promise.all([
        api.get('/invoices'),
        api.get('/customers')
      ]);
      setInvoices(invData || []);
      setCustomers(custData || []);
    } catch (err) {
      setError(err.message || 'Failed to load invoices data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const demoDate = '2026-10-22';

  // Calculate days overdue
  const getDaysOverdue = (dueDate) => {
    if (!dueDate) return 0;
    const diff = Math.round((new Date(demoDate) - new Date(dueDate)) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const filteredInvoices = invoices.filter(inv => {
    // Search
    const term = search.toLowerCase();
    const matchesSearch =
      !term ||
      inv.invoice_number?.toLowerCase().includes(term) ||
      inv.customer_name?.toLowerCase().includes(term) ||
      inv.customer_company?.toLowerCase().includes(term);

    // Status
    let matchesStatus = true;
    if (statusFilter !== 'ALL') {
      const s = (inv.status || '').toUpperCase();
      const target = statusFilter.toUpperCase();
      if (target === 'OVERDUE') {
        matchesStatus = s === 'OVERDUE' || (inv.due_date < demoDate && inv.balance_paise > 0 && s !== 'PAID');
      } else if (target === 'DUE_SOON') {
        matchesStatus = s === 'DUE_SOON' || (inv.due_date >= demoDate && inv.due_date <= '2026-10-29' && inv.balance_paise > 0);
      } else {
        matchesStatus = s === target;
      }
    }

    // Customer
    const matchesCustomer =
      customerFilter === 'ALL' || String(inv.customer_id) === String(customerFilter);

    // Overdue range
    const daysOverdue = getDaysOverdue(inv.due_date);
    let matchesOverdue = true;
    if (overdueFilter === 'OVERDUE') {
      matchesOverdue = daysOverdue > 0 && inv.balance_paise > 0 && inv.status !== 'PAID';
    } else if (overdueFilter === 'OVERDUE_15') {
      matchesOverdue = daysOverdue >= 15 && inv.balance_paise > 0 && inv.status !== 'PAID';
    } else if (overdueFilter === 'OVERDUE_30') {
      matchesOverdue = daysOverdue >= 30 && inv.balance_paise > 0 && inv.status !== 'PAID';
    } else if (overdueFilter === 'OVERDUE_45') {
      matchesOverdue = daysOverdue >= 45 && inv.balance_paise > 0 && inv.status !== 'PAID';
    }

    return matchesSearch && matchesStatus && matchesCustomer && matchesOverdue;
  });

  // Sort
  filteredInvoices.sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = (valB || '').toLowerCase();
    }
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setCustomerFilter('ALL');
    setOverdueFilter('ALL');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Invoices & Receivables Ledger
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Monitor receivables, track customer credit periods, and verify payment settlements
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="min-h-[48px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors"
            title="Refresh Invoices"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/invoices/new')}
            className="min-h-[48px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>New Tax Invoice</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search invoice # or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full min-h-[48px] pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Customer Filter */}
          <div>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 text-sm bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Customers ({customers.length})</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company_name ? `(${c.company_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 text-sm bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="OVERDUE">Overdue Only</option>
              <option value="DUE_SOON">Due Soon (Next 7 Days)</option>
              <option value="SENT">Sent / Unpaid</option>
              <option value="PARTIALLY_PAID">Part Paid</option>
              <option value="PAID">Fully Paid</option>
              <option value="DISPUTED">Disputed</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>

          {/* Overdue Ageing Filter */}
          <div>
            <select
              value={overdueFilter}
              onChange={(e) => setOverdueFilter(e.target.value)}
              className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 text-sm bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">Any Overdue Days</option>
              <option value="OVERDUE">Any Overdue (&gt;0 days)</option>
              <option value="OVERDUE_15">&gt; 15 Days Overdue</option>
              <option value="OVERDUE_30">&gt; 30 Days Overdue</option>
              <option value="OVERDUE_45">&gt; 45 Days Overdue (Legal Risk)</option>
            </select>
          </div>
        </div>

        {/* Active filter pills & Reset */}
        {(search || statusFilter !== 'ALL' || customerFilter !== 'ALL' || overdueFilter !== 'ALL') && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              Showing <strong>{filteredInvoices.length}</strong> of {invoices.length} invoices
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-[36px] px-3 rounded-lg text-rose-600 hover:bg-rose-50 font-semibold flex items-center gap-1 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear All Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <Loading message="Filtering invoices ledger..." />
      ) : error ? (
        <ErrorState title="Failed to load invoices" message={error} onRetry={loadData} />
      ) : filteredInvoices.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No Invoices Match Your Criteria</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
            Try adjusting your search terms or clearing status and customer filters.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-[48px] px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px] tracking-wider select-none">
                    <th
                      className="p-3 sm:p-4 cursor-pointer hover:bg-slate-100"
                      onClick={() => toggleSort('invoice_number')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Invoice #</span>
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </th>
                    <th
                      className="p-3 sm:p-4 cursor-pointer hover:bg-slate-100"
                      onClick={() => toggleSort('customer_name')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Customer</span>
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </th>
                    <th
                      className="p-3 sm:p-4 cursor-pointer hover:bg-slate-100"
                      onClick={() => toggleSort('due_date')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Due Date</span>
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </th>
                    <th className="p-3 sm:p-4">Overdue</th>
                    <th
                      className="p-3 sm:p-4 text-right cursor-pointer hover:bg-slate-100"
                      onClick={() => toggleSort('total_paise')}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Total (₹)</span>
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </th>
                    <th
                      className="p-3 sm:p-4 text-right cursor-pointer hover:bg-slate-100"
                      onClick={() => toggleSort('balance_paise')}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Balance Due</span>
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </th>
                    <th className="p-3 sm:p-4">Status</th>
                    <th className="p-3 sm:p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.map((inv) => {
                    const daysOverdue = getDaysOverdue(inv.due_date);
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 sm:p-4 font-mono font-bold text-slate-900">
                          <button
                            type="button"
                            onClick={() => navigate(`/invoices/${inv.id}`)}
                            className="text-indigo-600 hover:text-indigo-800 hover:underline min-h-[32px] flex items-center"
                          >
                            {inv.invoice_number}
                          </button>
                        </td>
                        <td className="p-3 sm:p-4 font-medium text-slate-800">
                          <div>{inv.customer_name}</div>
                          {inv.customer_company && (
                            <div className="text-[11px] text-slate-400 font-normal truncate max-w-[200px]">
                              {inv.customer_company}
                            </div>
                          )}
                        </td>
                        <td className="p-3 sm:p-4 font-mono text-slate-600">
                          {formatDate(inv.due_date)}
                        </td>
                        <td className="p-3 sm:p-4">
                          {inv.balance_paise > 0 && inv.status !== 'PAID' ? (
                            daysOverdue > 0 ? (
                              <span className="font-mono text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                {daysOverdue}d
                              </span>
                            ) : (
                              <span className="font-mono text-xs text-slate-500">
                                In {-daysOverdue}d
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
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
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => navigate(`/invoices/${inv.id}`)}
                              className="min-h-[48px] px-3 py-1.5 rounded-lg text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 font-semibold text-xs transition-colors inline-flex items-center gap-1"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>

                            {inv.balance_paise > 0 && inv.status !== 'PAID' && (
                              <button
                                type="button"
                                onClick={() => navigate(`/payments?invoice_id=${inv.id}`)}
                                className="min-h-[48px] px-3 py-1.5 rounded-lg text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 font-semibold text-xs transition-colors inline-flex items-center gap-1"
                                title="Record Settlement"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Pay</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View (< 768px, no horizontal scroll, 360px safe) */}
          <div className="md:hidden space-y-3">
            {filteredInvoices.map((inv) => {
              const daysOverdue = getDaysOverdue(inv.due_date);
              return (
                <div
                  key={inv.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <button
                        type="button"
                        onClick={() => navigate(`/invoices/${inv.id}`)}
                        className="font-mono font-bold text-indigo-600 text-sm hover:underline"
                      >
                        {inv.invoice_number}
                      </button>
                      <div className="text-xs font-semibold text-slate-800 mt-0.5">{inv.customer_name}</div>
                      {inv.customer_company && (
                        <div className="text-[11px] text-slate-400">{inv.customer_company}</div>
                      )}
                    </div>
                    <StatusBadge status={inv.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Due Date</span>
                      <span className="font-mono text-slate-700">{formatDate(inv.due_date)}</span>
                      {daysOverdue > 0 && inv.balance_paise > 0 && inv.status !== 'PAID' && (
                        <span className="text-rose-600 font-bold block text-[10px]">{daysOverdue} days overdue</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Balance Due</span>
                      <span className="font-mono font-bold text-emerald-700 text-base">
                        {formatIndianCurrency(inv.balance_paise)}
                      </span>
                    </div>
                  </div>

                  {/* 48px Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                      className="flex-1 min-h-[48px] rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      <span>View Details</span>
                    </button>

                    {inv.balance_paise > 0 && inv.status !== 'PAID' && (
                      <button
                        type="button"
                        onClick={() => navigate(`/payments?invoice_id=${inv.id}`)}
                        className="flex-1 min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Record Pay</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default InvoicesPage;
