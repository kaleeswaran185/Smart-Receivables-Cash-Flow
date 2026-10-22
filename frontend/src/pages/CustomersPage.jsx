import React, { useState, useEffect } from 'react';
import { Users, Search, Building2, Phone, Mail, Award } from 'lucide-react';
import api from '../services/api';
import { formatIndianCurrency } from '../utils/money';
import { StatusBadge } from '../components/common/StatusBadge';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';

export function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadCustomers() {
      try {
        setLoading(true);
        const data = await api.get('/customers');
        setCustomers(data || []);
      } catch (err) {
        setError(err.message || 'Failed to load customers');
      } finally {
        setLoading(false);
      }
    }
    loadCustomers();
  }, []);

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Customer Directory</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Payment history, reliability grading (A/B/C), and credit parameters
        </p>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name, company, or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-[48px] pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {loading ? (
        <Loading message="Loading customer profiles..." />
      ) : error ? (
        <ErrorState title="Failed to load customers" message={error} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{c.name}</h3>
                  <div className="text-xs text-slate-500">{c.company_name}</div>
                </div>
                {c.stats && (
                  <StatusBadge
                    status={c.stats.reliabilityGrade === 'A' ? 'GRADE_A' : c.stats.reliabilityGrade === 'B' ? 'GRADE_B' : 'GRADE_C'}
                    label={`Grade ${c.stats.reliabilityGrade}`}
                  />
                )}
              </div>

              <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>{c.city}, {c.state}</span>
                </div>
                {c.phone && (
                  <div className="flex items-center gap-2 font-mono">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{c.phone}</span>
                  </div>
                )}
              </div>

              {c.stats && (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs flex justify-between items-center">
                  <span className="text-slate-500">Avg Payment Delay:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {c.stats.averagePaymentDelayDays} days
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CustomersPage;
