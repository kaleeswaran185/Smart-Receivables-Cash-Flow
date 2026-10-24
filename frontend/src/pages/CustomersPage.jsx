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
  Plus,
  X
} from 'lucide-react';
import api from '../services/api';
import { formatIndianCurrency, formatDate } from '../utils/money';
import { StatusBadge } from '../components/common/StatusBadge';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';
import { useTranslation } from '../utils/i18n';

export function CustomersPage() {
  const navigate = useNavigate();
  const { t, language } = useTranslation('customers');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    company_name: '',
    gstin: '',
    city: '',
    state: 'Maharashtra',
    state_code: '27',
    phone: '',
    email: '',
    credit_period_days: '30',
    credit_limit_rupees: '200000',
    preferred_language: 'en'
  });
  const [addError, setAddError] = useState(null);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    setAddError(null);
    if (!addForm.name.trim()) {
      setAddError(t('errors.ERR_VALIDATION', 'Customer name is required.'));
      return;
    }
    try {
      setSubmittingAdd(true);
      const res = await api.post('/customers', {
        name: addForm.name.trim(),
        company_name: addForm.company_name.trim() || null,
        gstin: addForm.gstin.trim() || null,
        city: addForm.city.trim() || null,
        state: addForm.state || 'Maharashtra',
        state_code: addForm.state_code || '27',
        phone: addForm.phone.trim() || null,
        email: addForm.email.trim() || null,
        credit_period_days: Number(addForm.credit_period_days) || 30,
        credit_limit_rupees: Number(addForm.credit_limit_rupees) || 0,
        preferred_language: addForm.preferred_language || 'en'
      });
      setShowAddModal(false);
      setAddForm({
        name: '',
        company_name: '',
        gstin: '',
        city: '',
        state: 'Maharashtra',
        state_code: '27',
        phone: '',
        email: '',
        credit_period_days: '30',
        credit_limit_rupees: '200000',
        preferred_language: 'en'
      });
      setToastMessage(`Customer ${res.name} added successfully!`);
      setTimeout(() => setToastMessage(null), 4000);
      await fetchCustomers();
    } catch (err) {
      setAddError(err.message || 'Failed to add customer.');
    } finally {
      setSubmittingAdd(false);
    }
  };

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
            {t('title', 'Customers & Parties')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {t('subtitle', 'Manage commercial credit limits, GST compliance, and reliability scores')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchCustomers}
            className="min-h-[48px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            <span>{t('common.sync_data', 'Refresh Accounts')}</span>
          </button>

          <button
            type="button"
            onClick={() => { setAddError(null); setShowAddModal(true); }}
            className="min-h-[48px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('add_customer', 'Add Customer')}</span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div role="status" className="p-4 rounded-xl bg-emerald-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t('common.search_customers', 'Search customers by name, company, or GSTIN...')}
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
            <option value="ALL">{t('grade', 'Reliability Grade')}</option>
            <option value="A">{t('grade_a', 'Grade A (Prompt Payers)')}</option>
            <option value="B">{t('grade_b', 'Grade B (Moderate Delays)')}</option>
            <option value="C">{t('grade_c', 'Grade C (Chronic Delays)')}</option>
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
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">{t('total_outstanding', 'Current Balance')}</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {formatIndianCurrency(outstandingPaise)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">{t('statuses.OVERDUE', 'Overdue')}</span>
                      <span className={`font-mono font-bold text-sm ${overduePaise > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                        {formatIndianCurrency(overduePaise)}
                      </span>
                    </div>

                    <div className="pt-1 border-t border-slate-200/60">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">{t('average_delay', 'Avg Delay')}</span>
                      <span className="font-mono font-bold text-slate-800">
                        {stats.averagePaymentDelayDays || 0} {t('days_suffix_plural', 'days')}
                      </span>
                    </div>

                    <div className="pt-1 border-t border-slate-200/60">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">{t('on_time', 'On-time')} %</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {stats.onTimePercentage || 0}%
                      </span>
                    </div>
                  </div>

                  {/* Grade Explanation */}
                  <div className="p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-100 text-[11px] text-slate-700 leading-relaxed">
                    <strong className="text-indigo-950 font-semibold">{t('grade', 'Reliability Grade')}:</strong>{' '}
                    <span>{stats.gradeExplanation || `Grade ${grade} account.`}</span>
                  </div>
                </div>

                {/* 48px Action Buttons */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    aria-label="View Invoices & History"
                    onClick={() => openCustomerDetail(c)}
                    className="flex-1 min-h-[48px] rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{t('recent_invoices', 'Recent Invoices')}</span>
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

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl border border-slate-200 animate-fade-in">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">{t('create_customer_title', 'Add New Customer')}</h2>
                  <p className="text-xs text-slate-500">Create debtor account with GSTIN & credit terms</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>{addError}</div>
              </div>
            )}

            <form onSubmit={handleAddCustomer} className="space-y-4 text-xs sm:text-sm">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Logistics Private Limited"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Company / Trade Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Logistics"
                    value={addForm.company_name}
                    onChange={(e) => setAddForm({ ...addForm, company_name: e.target.value })}
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">GSTIN (15 Digits)</label>
                  <input
                    type="text"
                    placeholder="e.g. 27AAACA1234A1Z5"
                    maxLength={15}
                    value={addForm.gstin}
                    onChange={(e) => setAddForm({ ...addForm, gstin: e.target.value.toUpperCase() })}
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 font-mono text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Pune"
                    value={addForm.city}
                    onChange={(e) => setAddForm({ ...addForm, city: e.target.value })}
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">State</label>
                  <select
                    value={addForm.state}
                    onChange={(e) => {
                      const st = e.target.value;
                      const code = st === 'Maharashtra' ? '27' : st === 'Gujarat' ? '24' : st === 'Karnataka' ? '29' : '07';
                      setAddForm({ ...addForm, state: st, state_code: code });
                    }}
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Maharashtra">Maharashtra (27)</option>
                    <option value="Gujarat">Gujarat (24)</option>
                    <option value="Karnataka">Karnataka (29)</option>
                    <option value="Delhi">Delhi (07)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Phone</label>
                  <input
                    type="tel"
                    placeholder="+91 98220 12345"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Email</label>
                  <input
                    type="email"
                    placeholder="finance@apexlogistics.in"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Credit Period (Days)</label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={addForm.credit_period_days}
                    onChange={(e) => setAddForm({ ...addForm, credit_period_days: e.target.value })}
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">{t('credit_limit', 'Credit Limit (₹)')}</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={addForm.credit_limit_rupees}
                    onChange={(e) => setAddForm({ ...addForm, credit_limit_rupees: e.target.value })}
                    className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Preferred Language selector */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">{t('preferred_language', 'Preferred Communication Language')}</label>
                <select
                  value={addForm.preferred_language}
                  onChange={(e) => setAddForm({ ...addForm, preferred_language: e.target.value })}
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 text-slate-900 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="en">English (Default)</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                  <option value="ta">தமிழ் (Tamil)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="min-h-[48px] px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="min-h-[48px] px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{submittingAdd ? 'Saving Account...' : 'Save Customer Account'}</span>
                </button>
              </div>
            </form>
          </div>
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
