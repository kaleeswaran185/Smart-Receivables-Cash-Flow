import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, QrCode, CheckCircle2, AlertTriangle, Building2, Copy, Check } from 'lucide-react';
import api from '../services/api';
import { formatIndianCurrency, formatDate } from '../utils/money';
import { StatusBadge } from '../components/common/StatusBadge';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';

export function PublicPayPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [claimSubmitted, setClaimSubmitted] = useState(false);
  const [claimNotes, setClaimNotes] = useState('');
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadPublicPay() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/public/pay/${token}`);
        setData(res);
      } catch (err) {
        setError(err.message || 'Payment link expired or invalid.');
      } finally {
        setLoading(false);
      }
    }
    loadPublicPay();
  }, [token]);

  const handleCopyUpi = () => {
    if (data?.business?.upi_id) {
      navigator.clipboard.writeText(data.business.upi_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAlreadyPaid = async () => {
    try {
      await api.post(`/public/pay/${token}/already-paid`, {
        payment_date: new Date().toISOString().split('T')[0],
        amount_paise: data.balance_paise,
        payment_mode: 'UPI',
        reference_no: 'UPI-' + Math.floor(100000 + Math.random() * 900000),
        notes: claimNotes || 'Paid via UPI'
      });
      setClaimSubmitted(true);
      setShowClaimModal(false);
    } catch (err) {
      alert('Failed to submit claim: ' + err.message);
    }
  };

  if (loading) return <Loading fullPage message="Securing payment gateway..." />;
  if (error || !data) return <ErrorState title="Invoice Link Not Found" message={error} />;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 antialiased">
      <div className="max-w-md w-full mx-auto my-auto space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>Verified Merchant Payment</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">{data.business?.name || 'Sharma Packaging'}</h1>
          <p className="text-xs text-slate-400 font-mono">Invoice #{data.invoice_number}</p>
        </div>

        {/* Bill Summary Card */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 shadow-2xl backdrop-blur-md space-y-5">
          <div className="text-center pb-4 border-b border-slate-700/60">
            <span className="text-xs text-slate-400 uppercase font-semibold">Amount Outstanding</span>
            <div className="text-3xl font-black font-mono text-emerald-400 mt-1 tracking-tight">
              {formatIndianCurrency(data.balance_paise)}
            </div>
            <div className="mt-2 flex items-center justify-center gap-2">
              <StatusBadge status={data.status} />
              <span className="text-xs text-slate-400 font-mono">Due: {formatDate(data.due_date)}</span>
            </div>
          </div>

          {claimSubmitted ? (
            <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-xl text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="text-sm font-bold text-white">Payment Claim Submitted!</div>
              <div className="text-xs text-slate-300">
                Thank you! Our accounting desk has received your payment reference and will verify settlement.
              </div>
            </div>
          ) : (
            <>
              {/* UPI QR & Pay Action */}
              <div className="space-y-3">
                <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-700 text-center space-y-2">
                  <div className="text-xs font-semibold text-slate-400">Direct UPI ID</div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono text-white font-bold text-sm">
                      {data.business?.upi_id || 'sharmapackaging@icici'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyUpi}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="Copy UPI"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <a
                  href={`upi://pay?pa=${data.business?.upi_id || 'sharmapackaging@icici'}&pn=${encodeURIComponent(data.business?.name || 'Sharma Packaging')}&am=${data.balance_paise / 100}&cu=INR`}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-600/20"
                >
                  <QrCode className="w-5 h-5" />
                  <span>Pay Now via Any UPI App</span>
                </a>

                <button
                  type="button"
                  onClick={() => setShowClaimModal(true)}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-750 text-slate-200 font-medium text-xs sm:text-sm flex items-center justify-center transition-colors"
                >
                  I've Already Paid This Invoice
                </button>
              </div>
            </>
          )}
        </div>

        {/* Claim modal */}
        {showClaimModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
              <h3 className="text-base font-bold text-white">Confirm Payment Submission</h3>
              <p className="text-xs text-slate-300">
                Provide payment transaction ID or notes for instant verification:
              </p>
              <textarea
                value={claimNotes}
                onChange={(e) => setClaimNotes(e.target.value)}
                placeholder="e.g., UTR / UPI Ref 412384918237 paid via PhonePe..."
                className="w-full h-24 p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  className="flex-1 min-h-[48px] rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAlreadyPaid}
                  className="flex-1 min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  Submit Confirmation
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-[11px] text-slate-500">
          Powered by Baaki • Automated Receivables & Cash Flow Management
        </div>
      </div>
    </div>
  );
}

export default PublicPayPage;
