import React, { useState, useEffect } from 'react';
import {
  Building2,
  Calendar,
  ShieldCheck,
  TrendingDown,
  Languages,
  Type,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Save,
  Clock,
  Layers,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { useDemo } from '../context/DemoContext';
import { formatIndianCurrency, rupeesToPaise, paiseToRupees } from '../utils/money';
import api from '../services/api';
import { Loading } from '../components/common/Loading';
import { useTranslation } from '../utils/i18n';

const LADDER_STAGES = [
  {
    stage: -3,
    title: 'Upcoming Due Reminder',
    days: '-3 Days',
    channel: 'WhatsApp / SMS',
    severity: 'Gentle',
    color: 'badge-sky',
    description: 'Courteous heads-up before the invoice falls due.'
  },
  {
    stage: 0,
    title: 'Due Today Notice',
    days: '0 Days (Due Date)',
    channel: 'WhatsApp / SMS',
    severity: 'Gentle',
    color: 'badge-emerald',
    description: 'Friendly notification on the actual due date with direct UPI pay link.'
  },
  {
    stage: 7,
    title: 'First Overdue Reminder',
    days: '7 Days Overdue',
    channel: 'WhatsApp / SMS',
    severity: 'Moderate',
    color: 'badge-amber',
    description: 'Gentle nudge inquiring if invoice was received or has payment in transit.'
  },
  {
    stage: 15,
    title: 'Firm Follow-up',
    days: '15 Days Overdue',
    channel: 'WhatsApp / Email',
    severity: 'Firm',
    color: 'badge-amber',
    description: 'Firm notice cautioning that delayed settlement may impact order dispatches.'
  },
  {
    stage: 30,
    title: 'Supply Hold Warning',
    days: '30 Days Overdue',
    channel: 'WhatsApp / Email',
    severity: 'Urgent',
    color: 'badge-rose',
    description: 'Urgent notice informing that further credit is frozen pending settlement.'
  },
  {
    stage: 45,
    title: 'Formal Demand Letter',
    days: '45+ Days Overdue',
    channel: 'Print Letter / Legal Escalation',
    severity: 'Critical',
    color: 'badge-purple',
    description: 'Final commercial demand letter generated with full part payment history and settlement deadline.'
  }
];

const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' }
];

const TEXT_SIZES = [
  { code: 'normal', label: 'Normal (16px)', desc: 'Standard readable typography for daily use' },
  { code: 'large', label: 'Large (18px)', desc: 'Enhanced visibility for easy reading on tablets and monitors' },
  { code: 'xlarge', label: 'Extra Large (20px)', desc: 'High accessibility sizing for rapid scanning' }
];

export function SettingsPage() {
  const { t } = useTranslation('settings');
  const {
    demoDate,
    business,
    safetyBufferPaise,
    language,
    textSize,
    updateDemoDate,
    updateSafetyBuffer,
    updateBusiness,
    resetDemo,
    setTextSize,
    setLanguage,
    refreshSettings
  } = useDemo();

  // Business Profile Form State
  const [bizForm, setBizForm] = useState({
    name: '',
    trade_name: '',
    gstin: '',
    reg_type: 'REGULAR',
    state: '',
    state_code: '27',
    address_line1: '',
    address_line2: '',
    city: '',
    pincode: '',
    phone: '',
    email: '',
    pan: '',
    bank_name: '',
    bank_account_no: '',
    bank_ifsc: '',
    bank_branch: '',
    upi_id: '',
    turnoverRupees: '65000000'
  });

  // Safety Buffer Input State
  const [bufferRupees, setBufferRupees] = useState('500000');

  // Demo Date Simulator State
  const [targetDate, setTargetDate] = useState('2026-10-22');

  // UI status feedback
  const [savingBiz, setSavingBiz] = useState(false);
  const [bizSuccess, setBizSuccess] = useState(false);
  const [savingBuffer, setSavingBuffer] = useState(false);
  const [bufferSuccess, setBufferSuccess] = useState(false);
  const [savingDate, setSavingDate] = useState(false);
  const [dateSuccess, setDateSuccess] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Sync state with Context when loaded
  useEffect(() => {
    if (business) {
      setBizForm({
        name: business.name || '',
        trade_name: business.trade_name || '',
        gstin: business.gstin || '',
        reg_type: business.reg_type || 'REGULAR',
        state: business.state || 'Maharashtra',
        state_code: business.state_code || '27',
        address_line1: business.address_line1 || '',
        address_line2: business.address_line2 || '',
        city: business.city || '',
        pincode: business.pincode || '',
        phone: business.phone || '',
        email: business.email || '',
        pan: business.pan || '',
        bank_name: business.bank_name || '',
        bank_account_no: business.bank_account_no || '',
        bank_ifsc: business.bank_ifsc || '',
        bank_branch: business.bank_branch || '',
        upi_id: business.upi_id || '',
        turnoverRupees: business.turnover_paise ? String(paiseToRupees(business.turnover_paise)) : '65000000'
      });
    }
    if (safetyBufferPaise) {
      setBufferRupees(String(paiseToRupees(safetyBufferPaise)));
    }
    if (demoDate) {
      setTargetDate(demoDate);
    }
  }, [business, safetyBufferPaise, demoDate]);

  const handleSaveBusiness = async (e) => {
    e.preventDefault();
    try {
      setSavingBiz(true);
      setErrorMessage(null);
      await updateBusiness({
        name: bizForm.name,
        trade_name: bizForm.trade_name,
        gstin: bizForm.gstin,
        reg_type: bizForm.reg_type,
        state: bizForm.state,
        state_code: bizForm.state_code,
        address_line1: bizForm.address_line1,
        address_line2: bizForm.address_line2,
        city: bizForm.city,
        pincode: bizForm.pincode,
        phone: bizForm.phone,
        email: bizForm.email,
        pan: bizForm.pan,
        bank_name: bizForm.bank_name,
        bank_account_no: bizForm.bank_account_no,
        bank_ifsc: bizForm.bank_ifsc,
        bank_branch: bizForm.bank_branch,
        upi_id: bizForm.upi_id,
        turnover_paise: rupeesToPaise(Number(bizForm.turnoverRupees || 65000000))
      });
      setBizSuccess(true);
      setTimeout(() => setBizSuccess(false), 3000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update business profile');
    } finally {
      setSavingBiz(false);
    }
  };

  const handleSaveBuffer = async (e) => {
    e.preventDefault();
    try {
      setSavingBuffer(true);
      const paise = rupeesToPaise(Number(bufferRupees || 500000));
      await updateSafetyBuffer(paise);
      setBufferSuccess(true);
      setTimeout(() => setBufferSuccess(false), 3000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update safety buffer');
    } finally {
      setSavingBuffer(false);
    }
  };

  const handleApplyDate = async (newDate) => {
    try {
      setSavingDate(true);
      setErrorMessage(null);
      const applied = newDate || targetDate;
      await updateDemoDate(applied);
      setTargetDate(applied);
      setDateSuccess(true);
      setTimeout(() => setDateSuccess(false), 3000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update demo date');
    } finally {
      setSavingDate(false);
    }
  };

  const handleResetDemo = async () => {
    try {
      setResetting(true);
      setShowResetModal(false);
      setErrorMessage(null);
      await resetDemo();
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 4000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to reset demo data');
    } finally {
      setResetting(false);
    }
  };

  const turnoverIsOver5Cr = Number(bizForm.turnoverRupees || 0) >= 50000000;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">System &amp; Business Settings</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Configure business details, safety cash threshold, reminder escalation ladder, simulated clock, and accessibility options
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {resetSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>Demo database restored to default seed state! Clock reset to 2026-10-22.</span>
        </div>
      )}

      {/* 1. Business Profile Section */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Business Profile &amp; GST Entity</h2>
              <p className="text-xs text-slate-500">Legal entity information printed on tax documents</p>
            </div>
          </div>
          {bizSuccess && (
            <span className="text-xs font-bold badge-emerald px-3 py-1 rounded-full border flex items-center gap-1 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved Successfully
            </span>
          )}
        </div>

        <form onSubmit={handleSaveBusiness} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Business Legal Name *</label>
              <input
                type="text"
                value={bizForm.name}
                onChange={(e) => setBizForm({ ...bizForm, name: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Trade / Brand Name</label>
              <input
                type="text"
                value={bizForm.trade_name}
                onChange={(e) => setBizForm({ ...bizForm, trade_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">GST Registration Type *</label>
              <select
                value={bizForm.reg_type}
                onChange={(e) => setBizForm({ ...bizForm, reg_type: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="REGULAR">REGULAR (Issues Tax Invoice)</option>
                <option value="COMPOSITION">COMPOSITION (Issues Bill of Supply)</option>
                <option value="UNREGISTERED">UNREGISTERED (Issues Plain Invoice)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">GSTIN *</label>
              <input
                type="text"
                value={bizForm.gstin}
                onChange={(e) => setBizForm({ ...bizForm, gstin: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Permanent Account Number (PAN)</label>
              <input
                type="text"
                value={bizForm.pan}
                onChange={(e) => setBizForm({ ...bizForm, pan: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">State &amp; State Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={bizForm.state}
                  onChange={(e) => setBizForm({ ...bizForm, state: e.target.value })}
                  placeholder="State"
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  value={bizForm.state_code}
                  onChange={(e) => setBizForm({ ...bizForm, state_code: e.target.value })}
                  placeholder="Code"
                  className="w-16 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-medium text-center focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">Address (Premises &amp; Street)</label>
              <input
                type="text"
                value={bizForm.address_line1}
                onChange={(e) => setBizForm({ ...bizForm, address_line1: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Area / Locality</label>
              <input
                type="text"
                value={bizForm.address_line2}
                onChange={(e) => setBizForm({ ...bizForm, address_line2: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">City</label>
              <input
                type="text"
                value={bizForm.city}
                onChange={(e) => setBizForm({ ...bizForm, city: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Pincode</label>
              <input
                type="text"
                value={bizForm.pincode}
                onChange={(e) => setBizForm({ ...bizForm, pincode: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Billing Phone</label>
              <input
                type="text"
                value={bizForm.phone}
                onChange={(e) => setBizForm({ ...bizForm, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Bank Name</label>
              <input
                type="text"
                value={bizForm.bank_name}
                onChange={(e) => setBizForm({ ...bizForm, bank_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Bank Account Number</label>
              <input
                type="text"
                value={bizForm.bank_account_no}
                onChange={(e) => setBizForm({ ...bizForm, bank_account_no: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">IFSC Code &amp; Branch</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={bizForm.bank_ifsc}
                  onChange={(e) => setBizForm({ ...bizForm, bank_ifsc: e.target.value })}
                  placeholder="IFSC"
                  className="w-1/2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  value={bizForm.bank_branch}
                  onChange={(e) => setBizForm({ ...bizForm, bank_branch: e.target.value })}
                  placeholder="Branch"
                  className="w-1/2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Business UPI ID *</label>
              <input
                type="text"
                value={bizForm.upi_id}
                onChange={(e) => setBizForm({ ...bizForm, upi_id: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-indigo-700 font-mono font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">
                Highest aggregate turnover in any financial year since 2017-18 (PAN level)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={bizForm.turnoverRupees}
                  onChange={(e) => setBizForm({ ...bizForm, turnoverRupees: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  = {formatIndianCurrency(rupeesToPaise(Number(bizForm.turnoverRupees || 0)))}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                {turnoverIsOver5Cr ? (
                  <span className="text-amber-800 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    e-invoicing may apply; this app does not generate IRNs.
                  </span>
                ) : (
                  <span className="text-slate-500">Turnover under ₹5 Crore: Standard invoice format without e-invoicing note.</span>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={savingBiz}
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{savingBiz ? 'Saving...' : 'Save Business Profile'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* 2. Safety Buffer & Cash Flow Threshold */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Safety Cash Buffer</h2>
              <p className="text-xs text-slate-500">Minimum operating bank balance threshold to trigger cash deficit alerts</p>
            </div>
          </div>
          {bufferSuccess && (
            <span className="text-xs font-bold badge-emerald px-3 py-1 rounded-full border flex items-center gap-1 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" /> Buffer Updated
            </span>
          )}
        </div>

        <form onSubmit={handleSaveBuffer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
            <div>
              <label className="block text-slate-700 font-semibold text-xs sm:text-sm mb-1">
                Threshold Amount (in ₹)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={bufferRupees}
                  onChange={(e) => setBufferRupees(e.target.value)}
                  step="10000"
                  min="0"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-sm font-bold font-mono text-emerald-700 whitespace-nowrap">
                  = {formatIndianCurrency(rupeesToPaise(Number(bufferRupees || 0)))}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                If the 13-week cash flow projection shows projected closing cash dropping below this buffer in any week, Baaki flags an alert and highlights top invoices that can cover the gap.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
              <div className="font-bold text-slate-900">Safety Buffer Policy:</div>
              <p>• Current active buffer: <strong>{formatIndianCurrency(safetyBufferPaise)}</strong></p>
              <p>• Used by Forecast Service to detect first deficit week</p>
              <p>• Directly influences Chase Priority score (Factor 4: gap-covering invoices)</p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={savingBuffer}
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{savingBuffer ? 'Updating...' : 'Save Safety Buffer'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* 3. Escalation Ladder Configuration */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Reminder Escalation Ladder</h2>
              <p className="text-xs text-slate-500">6-stage automated escalation policy for overdue receivables</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {LADDER_STAGES.map((s) => (
            <div key={s.stage} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${s.color}`}>
                    {s.days}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">{s.channel}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{s.title}</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{s.description}</p>
              </div>

              <div className="text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                <span>Stage: {s.stage}</span>
                <span className="font-semibold text-slate-700">{s.severity}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Language Preferences */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('settings.language_preferences', 'Application Language')}</h2>
              <p className="text-xs text-slate-500">{t('settings.language_desc', 'Select language for interface labels, messages, and notifications')}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {LANGUAGES.map((lang) => {
            const isSelected = language === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang.code)}
                className={`min-h-[56px] p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-indigo-700 dark:bg-indigo-600 border-indigo-800 dark:border-indigo-400 text-white font-bold shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="text-sm font-bold">{lang.native}</div>
                <div className={`text-xs ${isSelected ? 'text-indigo-100' : 'text-slate-600 dark:text-slate-400'}`}>{lang.name}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 5. Text Size Preferences */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Type className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Text Size &amp; Display Scaling</h2>
              <p className="text-xs text-slate-500">Accessible text scaling across screens and high-DPI displays</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TEXT_SIZES.map((t) => {
            const isSelected = textSize === t.code;
            return (
              <button
                key={t.code}
                type="button"
                onClick={() => setTextSize(t.code)}
                className={`min-h-[64px] p-4 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-teal-800 dark:bg-teal-900 border-teal-900 dark:border-teal-500 text-white font-bold shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-900'}`}>{t.label}</div>
                <div className={`text-xs mt-1 leading-normal ${isSelected ? 'text-teal-200' : 'text-slate-600 dark:text-slate-400'}`}>{t.desc}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 6. Demo Date Clock Simulator */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Simulated System Clock (Demo Date)</h2>
              <p className="text-xs text-slate-500">
                Moving this date simulates time passing, instantly recalculating overdue ageing, follow-ups, chase priorities, and cash forecast
              </p>
            </div>
          </div>
          {dateSuccess && (
            <span className="text-xs font-bold badge-emerald px-3 py-1 rounded-full border flex items-center gap-1 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" /> Date Applied App-Wide
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="flex-1">
              <label className="block text-slate-700 font-semibold text-xs mb-1">Set Active Demo Date (YYYY-MM-DD):</label>
              <input
                type="text"
                pattern="\d{4}-\d{2}-\d{2}"
                placeholder="YYYY-MM-DD"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <button
              type="button"
              onClick={() => handleApplyDate(targetDate)}
              disabled={savingDate}
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 active:bg-amber-950 text-white font-bold text-xs sm:text-sm self-end flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              <span>{savingDate ? 'Applying...' : 'Apply Demo Date'}</span>
            </button>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-2">Quick Date Simulation Presets:</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setTargetDate('2026-10-22');
                  handleApplyDate('2026-10-22');
                }}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium border border-slate-200"
              >
                Initial (2026-10-22)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetDate('2026-10-29');
                  handleApplyDate('2026-10-29');
                }}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium border border-slate-200"
              >
                +7 Days (2026-10-29)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetDate('2026-11-05');
                  handleApplyDate('2026-11-05');
                }}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium border border-slate-200"
              >
                +14 Days (2026-11-05)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetDate('2026-11-21');
                  handleApplyDate('2026-11-21');
                }}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium border border-slate-200"
              >
                +30 Days (2026-11-21)
              </button>
            </div>
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/80 rounded-xl border border-amber-300 dark:border-amber-700 text-xs text-amber-950 dark:text-amber-100 font-medium">
            <strong className="font-bold">Current active simulated clock:</strong> <span className="font-mono font-bold text-amber-950 dark:text-amber-100">{demoDate}</span>.
            All forecast projections start from this date, and unpaid invoices with earlier due dates become overdue automatically.
          </div>
        </div>
      </section>

      {/* 7. Reset Demo Data */}
      <section className="bg-white rounded-2xl border border-rose-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Reset Demo Data</h2>
            <p className="text-xs text-slate-500">Restore clean demonstration dataset and reset system clock</p>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Resetting will restore the database to its pristine demo state: Sharma Packaging, 12 customers, 40 invoices, initial payments, standard expense projections, and clock set to 2026-10-22.
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            disabled={resetting}
            className="min-h-[48px] px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors"
          >
            <RotateCcw className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} />
            <span>{resetting ? 'Resetting Database...' : 'Reset Demo Data'}</span>
          </button>
        </div>
      </section>

      {/* Confirmation Modal for Reset Demo */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirm Demo Reset</h3>
                <p className="text-xs text-slate-500">This action restores all sample data</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to re-seed the demonstration database? Any custom invoices, payments, or claims created during the session will be replaced by the original 40 sample invoices.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="flex-1 min-h-[48px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetDemo}
                className="flex-1 min-h-[48px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
              >
                Yes, Reset Demo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
