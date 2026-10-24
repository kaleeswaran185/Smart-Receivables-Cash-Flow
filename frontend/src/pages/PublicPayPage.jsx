import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, QrCode, CheckCircle2, AlertTriangle, Building2, Copy, Check, FileText, HelpCircle, ArrowLeft } from 'lucide-react';
import api from '../services/api';
import { formatIndianCurrency, formatDate } from '../utils/money';
import { StatusBadge } from '../components/common/StatusBadge';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';
import i18n, { useTranslation } from '../utils/i18n';

export function PublicPayPage() {
  const { token } = useParams();
  const { t, language } = useTranslation('pay');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleLanguageChange = (lng) => {
    i18n.changeLanguage(lng);
    if (typeof window !== 'undefined') {
      localStorage.setItem('baaki_language', lng);
      document.documentElement.lang = lng;
    }
  };

  // Claim modal state ("I've already paid")
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimNotes, setClaimNotes] = useState('');
  const [claimReference, setClaimReference] = useState('');
  const [claimPaymentMode, setClaimPaymentMode] = useState('UPI');
  const [claimSubmitted, setClaimSubmitted] = useState(false);
  const [submittingClaim, setSubmittingClaim] = useState(false);

  // Dispute modal state ("Something is wrong")
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeAmount, setDisputeAmount] = useState('');
  const [disputeSubmitted, setDisputeSubmitted] = useState(false);
  const [submittingDispute, setSubmittingDispute] = useState(false);

  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);

  const loadPublicPay = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/public/pay/${token}`);
      setData(res);
      if (res?.customer?.preferred_language && !localStorage.getItem('baaki_language')) {
        handleLanguageChange(res.customer.preferred_language);
      }
      if (res?.status === 'DISPUTED') {
        setDisputeSubmitted(true);
      }
    } catch (err) {
      setError(err.message || 'Payment link expired or invalid.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPublicPay();
  }, [token]);

  const handleCopyUpi = () => {
    if (data?.business?.upi_id) {
      navigator.clipboard.writeText(data.business.upi_id);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  const handleCopyAccount = () => {
    if (data?.business?.bank_account_no) {
      navigator.clipboard.writeText(data.business.bank_account_no);
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
    }
  };

  const handleAlreadyPaid = async (e) => {
    e.preventDefault();
    try {
      setSubmittingClaim(true);
      await api.post(`/public/pay/${token}/already-paid`, {
        payment_date: new Date().toISOString().split('T')[0],
        amount_paise: data.balance_paise,
        payment_mode: claimPaymentMode,
        reference_no: claimReference.trim() || `UPI-${Math.floor(100000 + Math.random() * 900000)}`,
        notes: claimNotes.trim() || 'Paid via UPI'
      });
      setClaimSubmitted(true);
      setShowClaimModal(false);
    } catch (err) {
      alert('Failed to submit claim: ' + err.message);
    } finally {
      setSubmittingClaim(false);
    }
  };

  const handleDisputeSubmit = async (e) => {
    e.preventDefault();
    if (!disputeReason.trim()) {
      alert('Please specify the issue or reason for dispute.');
      return;
    }
    try {
      setSubmittingDispute(true);
      const amountPaise = disputeAmount ? Math.round(Number(disputeAmount) * 100) : data.balance_paise;
      await api.post(`/public/pay/${token}/dispute`, {
        reason: disputeReason.trim(),
        amount_paise: amountPaise
      });
      setDisputeSubmitted(true);
      setShowDisputeModal(false);
      loadPublicPay();
    } catch (err) {
      alert('Failed to submit dispute: ' + err.message);
    } finally {
      setSubmittingDispute(false);
    }
  };

  if (loading) return <Loading fullPage message="Securing payment gateway..." />;
  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 antialiased">
        <div className="max-w-xl w-full mx-auto my-auto space-y-6">
          <div className="flex justify-end">
            <div className="flex items-center rounded-xl border border-slate-700 p-1 bg-slate-800 text-xs font-semibold shadow-sm">
              <button
                type="button"
                onClick={() => handleLanguageChange('en')}
                className={`min-h-[36px] px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  language === 'en' ? 'bg-indigo-600 text-white font-extrabold shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('hi')}
                className={`min-h-[36px] px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  language === 'hi' ? 'bg-indigo-600 text-white font-extrabold shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                हिन्दी
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('ta')}
                className={`min-h-[36px] px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  language === 'ta' ? 'bg-indigo-600 text-white font-extrabold shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                தமிழ்
              </button>
            </div>
          </div>
          <ErrorState
            title={t('invalid_title', 'Invoice Link Expired or Invalid')}
            message={error || t('invalid_desc', 'This payment link cannot be found.')}
          />
        </div>
      </div>
    );
  }

  const upiId = data.business?.upi_id || 'sharmapackaging@icici';
  const businessName = data.business?.name || 'Sharma Packaging';
  const amountRupees = (data.balance_paise / 100).toFixed(2);
  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(businessName)}&am=${amountRupees}&cu=INR&tn=${encodeURIComponent(`Invoice ${data.invoice_number}`)}`;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 antialiased">
      <div className="max-w-xl w-full mx-auto my-auto space-y-6">
        {/* Language Switcher (localStorage only) */}
        <div className="flex justify-end">
          <div className="flex items-center rounded-xl border border-slate-700 p-1 bg-slate-800 text-xs font-semibold shadow-sm">
            <button
              type="button"
              onClick={() => handleLanguageChange('en')}
              className={`min-h-[36px] px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                language === 'en' ? 'bg-indigo-600 text-white font-extrabold shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange('hi')}
              className={`min-h-[36px] px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                language === 'hi' ? 'bg-indigo-600 text-white font-extrabold shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              हिन्दी
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange('ta')}
              className={`min-h-[36px] px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                language === 'ta' ? 'bg-indigo-600 text-white font-extrabold shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              தமிழ்
            </button>
          </div>
        </div>

        {/* Header Branding */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>{t('pay.title', 'Verified Merchant Direct Pay')}</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{businessName}</h1>
          <p className="text-xs text-slate-400">
            {t('invoices.customer', 'Billed to')}: <strong className="text-slate-200">{data.customer?.name}</strong> {data.customer?.company_name ? `(${data.customer.company_name})` : ''}
          </p>
        </div>

        {/* Bill Summary Card */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 shadow-2xl backdrop-blur-md space-y-6">
          <div className="text-center pb-5 border-b border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
              <span>{t('invoices.invoice_number', 'Invoice #')}{data.invoice_number}</span>
              <span>{t('invoices.date', 'Dated')}: {formatDate(data.invoice_date, language)}</span>
            </div>
            <span className="text-xs text-slate-400 uppercase font-semibold">{t('pay.amount_due', 'Amount Outstanding')}</span>
            <div className="text-4xl font-black font-mono text-emerald-400 mt-1 tracking-tight">
              {formatIndianCurrency(data.balance_paise)}
            </div>
            <div className="mt-3 flex items-center justify-center gap-3">
              <StatusBadge status={data.status} />
              <span className="text-xs text-slate-400 font-mono">{t('invoices.due_date', 'Due')}: {formatDate(data.due_date, language)}</span>
            </div>
          </div>

          {/* Dispute Active Alert */}
          {disputeSubmitted && (
            <div className="p-4 bg-amber-950/60 border border-amber-700/80 rounded-xl text-center space-y-1.5">
              <AlertTriangle className="w-7 h-7 text-amber-400 mx-auto" />
              <div className="text-sm font-bold text-amber-200">{t('statuses.DISPUTED', 'Dispute Under Review')}</div>
              <div className="text-xs text-amber-300/80 leading-relaxed">
                You reported an issue with this invoice. Automatic payment reminders are paused while {businessName} verifies and resolves this with you.
              </div>
            </div>
          )}

          {/* Claim Submitted Alert */}
          {claimSubmitted ? (
            <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-xl text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="text-sm font-bold text-white">Payment Claim Submitted!</div>
              <div className="text-xs text-slate-300">
                Thank you! Our accounting desk has received your payment notification and reference number. It will be verified and marked as settled shortly.
              </div>
            </div>
          ) : (
            <>
              {/* UPI Direct Pay Action */}
              <div className="space-y-3">
                <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-700 text-center space-y-2">
                  <div className="text-xs font-semibold text-slate-400">Official Merchant UPI ID</div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono text-emerald-300 font-bold text-base tracking-wide">
                      {upiId}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyUpi}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 min-h-[36px]"
                      title="Copy UPI ID"
                    >
                      {copiedUpi ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <a
                  href={upiDeepLink}
                  id="pay-by-upi-btn"
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-600/25"
                >
                  <QrCode className="w-5 h-5" />
                  <span>{t('pay.pay_via_upi', 'Pay via UPI')} ({formatIndianCurrency(data.balance_paise)})</span>
                </a>

                {/* Secondary Actions: "I've already paid" & "Something is wrong" */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    id="already-paid-btn"
                    onClick={() => setShowClaimModal(true)}
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-750 text-slate-200 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{t('pay.already_paid_button', "I've Already Paid")}</span>
                  </button>

                  <button
                    type="button"
                    id="dispute-btn"
                    onClick={() => {
                      setDisputeAmount((data.balance_paise / 100).toString());
                      setShowDisputeModal(true);
                    }}
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-950/60 active:bg-rose-900/80 text-rose-300 border border-rose-800/60 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>{t('pay.dispute_button', 'Something is Wrong')}</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Invoice Particulars Breakdown */}
          {data.items && data.items.length > 0 && (
            <div className="pt-4 border-t border-slate-700/60 space-y-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Invoice Breakdown ({data.items.length} items)
              </span>
              <div className="space-y-2 text-xs">
                {data.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1.5 border-b border-slate-800/80">
                    <div>
                      <div className="font-semibold text-slate-200">{it.description}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {it.qty} {it.unit || 'units'} × {it.formatted_rate} (GST {it.gst_rate}%)
                      </div>
                    </div>
                    <div className="font-mono font-bold text-slate-200">
                      {it.formatted_total}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Summary */}
              <div className="pt-2 text-xs font-mono space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Invoice Total</span>
                  <span>{data.formatted_total}</span>
                </div>
                {data.paid_paise > 0 && (
                  <div className="flex justify-between text-emerald-400 font-semibold">
                    <span>Already Paid</span>
                    <span>- {data.formatted_paid}</span>
                  </div>
                )}
                <div className="flex justify-between text-white font-bold pt-1 border-t border-slate-700 text-sm">
                  <span>Balance Due</span>
                  <span>{data.formatted_balance}</span>
                </div>
              </div>
            </div>
          )}

          {/* NEFT / RTGS Bank Details */}
          {data.business?.bank_account_no && (
            <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400 font-semibold">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Bank Transfer Details (NEFT / RTGS)</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyAccount}
                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono text-[11px]"
                >
                  {copiedAccount ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedAccount ? 'Copied' : 'Copy A/C'}</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-300 font-mono text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[10px]">Bank</span>
                  {data.business.bank_name || 'ICICI Bank'}
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Account No</span>
                  {data.business.bank_account_no}
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">IFSC Code</span>
                  {data.business.bank_ifsc || 'ICIC0000104'}
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Branch</span>
                  {data.business.bank_branch || 'Shivajinagar, Pune'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Claim Modal ("I've Already Paid") */}
        {showClaimModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">{t('pay.claim_title', 'Report Payment Already Made')}</h3>
              </div>
              <p className="text-xs text-slate-300">
                {t('pay.claim_desc', 'Please provide your bank UTR or payment reference so our accounting team can verify and credit your account.')}
              </p>
              <form onSubmit={handleAlreadyPaid} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase">Payment Method</label>
                  <select
                    value={claimPaymentMode}
                    onChange={(e) => setClaimPaymentMode(e.target.value)}
                    className="w-full min-h-[48px] px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    <option value="UPI">UPI (Google Pay, PhonePe, Paytm)</option>
                    <option value="NEFT">NEFT / RTGS Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CASH">Cash</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase">{t('pay.claim_ref_label', 'Payment Reference / UTR Number')}</label>
                  <input
                    type="text"
                    required
                    value={claimReference}
                    onChange={(e) => setClaimReference(e.target.value)}
                    placeholder="e.g. UPI/123891024 or UTR number"
                    className="w-full min-h-[48px] px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase">{t('pay.claim_notes_label', 'Additional Notes (Optional)')}</label>
                  <textarea
                    value={claimNotes}
                    onChange={(e) => setClaimNotes(e.target.value)}
                    placeholder="Paid from HDFC Bank account at 4:30 PM..."
                    className="w-full h-20 p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowClaimModal(false)}
                    className="flex-1 min-h-[48px] rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs cursor-pointer"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    id="submit-claim-btn"
                    disabled={submittingClaim}
                    className="flex-1 min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs shadow-md cursor-pointer"
                  >
                    {submittingClaim ? t('common.saving', 'Submitting...') : t('pay.submit_claim', 'Submit Payment Proof')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Dispute Modal ("Something is Wrong") */}
        {showDisputeModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">{t('pay.dispute_title', 'Raise an Invoice Dispute')}</h3>
              </div>
              <p className="text-xs text-slate-300">
                {t('pay.dispute_desc', 'State the issue with this invoice. Reminders will be paused immediately while our team reviews it.')}
              </p>
              <form onSubmit={handleDisputeSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase">{t('pay.dispute_reason_label', 'Dispute Reason / Details')} *</label>
                  <textarea
                    required
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder="e.g. Received damaged boxes in transit, rate mismatch on item 2, or awaiting credit note..."
                    className="w-full h-24 p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase">{t('common.amount', 'Disputed Amount')} (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={disputeAmount}
                    onChange={(e) => setDisputeAmount(e.target.value)}
                    placeholder={amountRupees}
                    className="w-full min-h-[48px] px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-400">Leave as default to dispute full balance</span>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDisputeModal(false)}
                    className="flex-1 min-h-[48px] rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs cursor-pointer"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submittingDispute}
                    className="flex-1 min-h-[48px] rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs shadow-md cursor-pointer"
                  >
                    {submittingDispute ? t('common.saving', 'Submitting...') : t('pay.submit_dispute', 'Submit Dispute & Pause Reminders')}
                  </button>
                </div>
              </form>
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

