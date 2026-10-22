import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Building2,
  Phone,
  Mail,
  Award,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  CreditCard,
  ChevronRight,
  TrendingDown,
  RefreshCw,
  X
} from 'lucide-react';
import api from '../services/api';
import { formatIndianCurrency, formatDate } from '../utils/money';
import { StatusBadge } from '../components/common/StatusBadge';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';

export function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get('/customers');
      setCustomers(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const openCustomerDetail = async (c) => {
    setSelectedCustomer(c);
    try {
      setDetailLoading(true);
      const res = await api.get(`/customers/${c.id}`);
      setCustomerDetail(res);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const term = search.toLowerCase();
    const matchesSearch =
      !term ||
      c.name?.toLowerCase().includes(term) ||
      c.company_name?.toLowerCase().includes(term) ||
      c.city?.toLowerCase().includes(term) ||
      c.gstin?.toLowerCase().includes(term);

    const matchesGrade =
      gradeFilter === 'ALL' || c.stats?.reliabilityGrade === gradeFilter;

    return matchesSearch && matchesGrade;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Customer Reliability & Accounts Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Credit terms, behavioral payment delay stats, and AI reliability grading (A/B/C)
          </p>
        </div>

        <button
          type="button"
          onClick={fetchCustomers}
          className="min-h-[48px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4 text-slate-500" />
          <span>Refresh Accounts</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name, company, GSTIN or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-[48px] pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="min-h-[48px] px-4 rounded-xl border border-slate-200 text-sm bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Reliability Grades</option>
            <option value="A">Grade A (Prompt Payer)</option>
            <option value="B">Grade B (Moderate Delay)</option>
            <option value="C">Grade C (High Delay Risk)</option>
          </select>
        </div>
      </div>

      {/* Main Customers Grid */}
      {loading ? (
        <Loading message="Calculating customer delay profiles..." />
      ) : error ? (
        <ErrorState title="Error Loading Customers" message={error} onRetry={fetchCustomers} />
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
          No customer accounts found matching search criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCustomers.map((c) => {
            const stats = c.stats || {};
            const grade = stats.reliabilityGrade || 'B';
            const outstandingPaise = stats.outstandingPaise || 0;
            const overduePaise = stats.overduePaise || 0;

            return (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 p-5 shadow-sm hover:shadow transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top Bar with Name & Grade */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-900 text-base leading-tight truncate">
                        {c.name}
                      </h3>
                      {c.company_name && (
                        <div className="text-xs font-medium text-slate-500 truncate mt-0.5">
                          {c.company_name}
                        </div>
                      )}
                    </div>

                    <StatusBadge
                      status={grade === 'A' ? 'GRADE_A' : grade === 'B' ? 'GRADE_B' : 'GRADE_C'}
                      label={`Grade ${grade}`}
                      size="sm"
                    />
                  </div>

                  {/* Location & GSTIN */}
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{c.city}, {c.state}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                      <span>GSTIN:</span>
                      <span className="font-bold text-slate-700">{c.gstin || 'Unregistered'}</span>
                    </div>
                  </div>

                  {/* Financial Stats Grid */}
                  <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50/80 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Outstanding</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {formatIndianCurrency(outstandingPaise)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Overdue</span>
                      <span className={`font-mono font-bold text-sm ${overduePaise > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                        {formatIndianCurrency(overduePaise)}
                      </span>
                    </div>

                    <div className="pt-1 border-t border-slate-200/60">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Avg Delay</span>
                      <span className="font-mono font-bold text-slate-800">
                        {stats.averagePaymentDelayDays || 0} days
                      </span>
                    </div>

                    <div className="pt-1 border-t border-slate-200/60">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">On-Time %</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {stats.onTimePercentage || 0}%
                      </span>
                    </div>
                  </div>

                  {/* Grade Explanation */}
                  <div className="p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-100 text-[11px] text-slate-700 leading-relaxed">
                    <strong className="text-indigo-950 font-semibold">Reliability Profile:</strong>{' '}
                    <span>{stats.gradeExplanation || `Grade ${grade} account.`}</span>
                  </div>
                </div>

                {/* 48px Action Buttons */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => openCustomerDetail(c)}
                    className="flex-1 min-h-[48px] rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span>View Invoices & History</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(`/invoices/new?customer_id=${c.id}`)}
                    className="min-h-[48px] min-w-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center transition-colors shadow-sm"
                    title="Invoice this customer"
                    aria-label="Create Invoice"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Customer Detail Drawer / Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-5 shadow-2xl border border-slate-200 animate-fade-in">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selectedCustomer.name}</h2>
                <div className="text-xs text-slate-500">{selectedCustomer.company_name} • {selectedCustomer.city}, {selectedCustomer.state}</div>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedCustomer(null); setCustomerDetail(null); }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading ? (
              <Loading message="Fetching transaction history..." />
            ) : customerDetail ? (
              <div className="space-y-5 text-xs sm:text-sm">
                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Credit Limit</span>
                    <strong className="font-mono text-slate-900">{formatIndianCurrency(customerDetail.credit_limit_paise)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Credit Period</span>
                    <strong className="font-mono text-slate-900">{customerDetail.credit_period_days} Days</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Avg Delay</span>
                    <strong className="font-mono text-slate-900">{customerDetail.stats?.averagePaymentDelayDays}d</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">On-Time %</span>
                    <strong className="font-mono text-emerald-700">{customerDetail.stats?.onTimePercentage}%</strong>
                  </div>
                </div>

                {/* Invoices List */}
                <div>
                  <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>Recent Invoices ({customerDetail.invoices?.length || 0})</span>
                  </h3>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {customerDetail.invoices?.map(inv => (
                      <div key={inv.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <button
                            type="button"
                            onClick={() => { setSelectedCustomer(null); navigate(`/invoices/${inv.id}`); }}
                            className="font-mono font-bold text-indigo-600 hover:underline"
                          >
                            {inv.invoice_number}
                          </button>
                          <div className="text-[11px] text-slate-400 font-mono">Date: {formatDate(inv.invoice_date)}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-slate-900">{formatIndianCurrency(inv.total_paise)}</div>
                          <StatusBadge status={inv.status} size="xs" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payments List */}
                <div>
                  <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    <span>Settlement History ({customerDetail.payments?.length || 0})</span>
                  </h3>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {customerDetail.payments?.map(p => (
                      <div key={p.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <div className="font-semibold text-slate-800">{p.payment_mode} {p.reference_no ? `• ${p.reference_no}` : ''}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{formatDate(p.payment_date)}</div>
                        </div>
                        <div className="text-right font-mono font-bold text-emerald-700">
                          {formatIndianCurrency(p.amount_paise)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => { setSelectedCustomer(null); setCustomerDetail(null); }}
                className="min-h-[48px] px-6 rounded-xl bg-slate-900 text-white font-semibold text-xs"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomersPage;
