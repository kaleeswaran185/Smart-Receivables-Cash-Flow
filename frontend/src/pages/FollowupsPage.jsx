import React, { useState, useEffect } from 'react';
import { Flame, MessageSquare, Clock, ShieldAlert, Check, Calendar } from 'lucide-react';
import api from '../services/api';
import { formatIndianCurrency, formatDate } from '../utils/money';
import { StatusBadge } from '../components/common/StatusBadge';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';

export function FollowupsPage() {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sentInvoiceIds, setSentInvoiceIds] = useState(new Set());

  const loadFollowups = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get('/followups');
      setFollowups(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load followups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFollowups();
  }, []);

  const handleMarkSent = async (f) => {
    try {
      await api.post(`/reminders/${f.invoice_id}/sent`, {
        stage: f.stage,
        channel: 'WHATSAPP',
        message_body: f.suggested_message
      });
      setSentInvoiceIds(prev => new Set([...prev, f.invoice_id]));
      setTimeout(() => {
        loadFollowups();
      }, 500);
    } catch (err) {
      alert('Failed to record reminder: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-rose-100 text-rose-600">
              <Flame className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Actionable Follow-ups & Reminders
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Escalation ladder (-3, 0, 7, 15, 30, 45 days) • Disputed invoices automatically paused
          </p>
        </div>
      </div>

      {loading ? (
        <Loading message="Fetching pending reminder ladder..." />
      ) : error ? (
        <ErrorState title="Error Loading Reminders" message={error} onRetry={loadFollowups} />
      ) : followups.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
          🎉 All follow-up actions are completed for today.
        </div>
      ) : (
        <div className="space-y-4">
          {followups.map((f) => (
            <div key={`${f.invoice_id}-${f.stage}`} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-slate-900">{f.invoice_number}</span>
                  <span className="font-semibold text-slate-800">• {f.customer_name}</span>
                  <StatusBadge
                    status={f.stage > 15 ? 'CRITICAL' : f.stage > 0 ? 'OVERDUE' : 'DUE_SOON'}
                    label={`Stage: Day ${f.stage >= 0 ? `+${f.stage}` : f.stage}`}
                  />
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400 uppercase font-semibold">Balance: </span>
                  <span className="font-mono font-bold text-emerald-700 text-base">
                    {formatIndianCurrency(f.balance_paise)}
                  </span>
                </div>
              </div>

              {/* Message preview */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">
                {f.suggested_message}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleMarkSent(f)}
                  disabled={sentInvoiceIds.has(f.invoice_id)}
                  className="min-h-[48px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{sentInvoiceIds.has(f.invoice_id) ? 'Dispatched' : 'Send via WhatsApp'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FollowupsPage;
