import React, { useState } from 'react';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileText,
  X,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Percent,
  Check,
  Building2
} from 'lucide-react';
import api from '../../services/api';
import { formatIndianCurrency, formatDate } from '../../utils/money';
import { useTranslation } from '../../utils/i18n';

const SAMPLE_CSV = `"Date","Narration","Chq/Ref No","Withdrawal","Deposit","Balance"
"2026-10-23","NEFT-HDFC-INV-2026-1023-APEX LOGISTICS PUNE","HDFCN26296001245","","40,436.00","5,40,436.00"
"2026-10-23","UPI/428192837192/BENGALURU FRESH FOODS/INVOICE SETTLEMENT","UPI428192837192","","16,979.00","5,57,415.00"
"2026-10-24","RTGS/BARB0123/INV-2026-1025/GUJARAT PHARMA 2PCT TDS","BARBR52026102401","","1,19,999.00","6,77,414.00"
"2026-10-24","NEFT/UTIB00021/CHENNAI TEXTILES/INV-2026-1026 1PCT TDS","UTIBN26297003412","","1,05,197.00","7,82,611.00"
"2026-10-25","RTGS/KOLKATA JUTE/INV-2026-1021 10PCT TDS CONTRACT","KOLKR52026102509","","5,061.00","7,87,672.00"
"2026-10-25","INTEREST CREDIT FY26 Q2 HDFC BANK PUNE","INTCR20261025","","4,520.00","7,92,192.00"
"2026-10-25","CHQ 004123 TO MAHARASHTRA STATE ELECTRICITY BOARD","CHQ004123","38,500.00","","7,53,692.00"`;

export function BankImportModal({ isOpen, onClose, onReconciled, openInvoices = [] }) {
  const { t } = useTranslation();
  const [csvContent, setCsvContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [selectedTxHashes, setSelectedTxHashes] = useState({});
  const [userMatchedInvoices, setUserMatchedInvoices] = useState({});
  const [applyTdsMap, setApplyTdsMap] = useState({});
  const [reconciledResult, setReconciledResult] = useState(null);

  if (!isOpen) return null;

  const handleLoadSample = () => {
    setCsvContent(SAMPLE_CSV);
    setError(null);
    setPreviewData(null);
    setReconciledResult(null);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent(event.target.result || '');
      setError(null);
      setPreviewData(null);
      setReconciledResult(null);
    };
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    if (!csvContent.trim()) {
      setError('Please paste CSV text or load sample CSV');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setReconciledResult(null);

      const res = await api.post('/bank-import/preview', { csv_content: csvContent });
      setPreviewData(res);

      // Preselect all high & medium confidence matches that are NOT already reconciled
      const initialSelected = {};
      const initialInvoices = {};
      const initialTds = {};

      res.transactions.forEach((tx) => {
        if (tx.import_status !== 'ALREADY_RECONCILED' && tx.matched_invoice && (tx.confidence === 'HIGH' || tx.confidence === 'MEDIUM')) {
          initialSelected[tx.tx_hash] = true;
          initialInvoices[tx.tx_hash] = tx.matched_invoice.id;
          if (tx.tds_hint?.detected) {
            initialTds[tx.tx_hash] = true;
          }
        }
      });

      setSelectedTxHashes(initialSelected);
      setUserMatchedInvoices(initialInvoices);
      setApplyTdsMap(initialTds);
    } catch (err) {
      setError(err.message || 'Failed to parse bank statement CSV');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReconciliations = async () => {
    const selectedHashes = Object.keys(selectedTxHashes).filter(h => selectedTxHashes[h]);
    if (selectedHashes.length === 0) {
      setError('Please select at least one transaction to reconcile');
      return;
    }

    const confirmations = [];
    for (const hash of selectedHashes) {
      const tx = previewData.transactions.find(t => t.tx_hash === hash);
      const invoiceId = userMatchedInvoices[hash] || tx.matched_invoice?.id;

      if (!invoiceId) {
        setError(`Please select an invoice for transaction: ${tx.narration}`);
        return;
      }

      confirmations.push({
        tx_hash: hash,
        invoice_id: Number(invoiceId),
        amount_paise: tx.amount_paise,
        payment_date: tx.tx_date,
        reference_no: tx.ref_no || `BANK-${tx.tx_date}`,
        apply_tds: Boolean(applyTdsMap[hash]),
        tds_paise: applyTdsMap[hash] ? (tx.tds_hint?.tds_amount_paise || 0) : 0
      });
    }

    try {
      setConfirming(true);
      setError(null);

      // Save transactions first for idempotency
      await api.post('/bank-import/save', { csv_content: csvContent }).catch(() => {});

      // Confirm reconciliation
      const res = await api.post('/bank-import/confirm', { confirmations });
      setReconciledResult(res);

      if (onReconciled) {
        onReconciled(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to confirm reconciliation');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-fade-in my-auto">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                {t('import_bank_csv', 'Bank Statement Import (CSV)')}
              </h2>
              <p className="text-xs text-slate-300">
                SPEC Section 18: Auto-match by Invoice #, Customer Name, Amount & TDS (1%, 2%, 10%)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Error: </strong>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Success Reconciled View */}
          {reconciledResult && (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-white mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold">Reconciliation Complete!</h3>
              <p className="text-sm text-emerald-800">
                Successfully reconciled <strong>{reconciledResult.reconciled_count}</strong> bank credit(s). Payment records created and invoice balances deducted.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[48px] px-8 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors shadow-sm"
                >
                  Done & Refresh Payments
                </button>
              </div>
            </div>
          )}

          {/* CSV Input Controls */}
          {!previewData && !reconciledResult && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Paste CSV Statement or Upload File:</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLoadSample}
                    className="min-h-[40px] px-4 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Load Sample HDFC CSV</span>
                  </button>

                  <label className="min-h-[40px] px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choose File</span>
                    <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <textarea
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder="Paste CSV rows here with columns: Date, Narration, Chq/Ref No, Withdrawal, Deposit, Balance..."
                className="w-full h-48 p-3.5 font-mono text-xs rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-800"
              />

              <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>
                  <strong>Idempotent & Safe:</strong> Re-importing overlapping or duplicate statements is always safe. Duplicate entries are automatically skipped.
                </span>
              </div>

              <button
                type="button"
                onClick={handlePreview}
                disabled={loading || !csvContent.trim()}
                className="w-full min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                <span>{t('preview_matches', 'Preview & Auto-Match Statement')}</span>
              </button>
            </div>
          )}

          {/* Preview Results Table */}
          {previewData && !reconciledResult && (
            <div className="space-y-5 animate-fade-in">
              {/* Summary Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Credits Found</div>
                  <div className="text-xl font-extrabold text-slate-900 mt-0.5">{previewData.summary.total_rows}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-[11px] font-semibold text-emerald-700 uppercase">High Confidence</div>
                  <div className="text-xl font-extrabold text-emerald-800 mt-0.5">{previewData.summary.high_confidence}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="text-[11px] font-semibold text-amber-700 uppercase">Medium / TDS</div>
                  <div className="text-xl font-extrabold text-amber-800 mt-0.5">{previewData.summary.medium_confidence}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200">
                  <div className="text-[11px] font-semibold text-purple-700 uppercase">Duplicates Skipped</div>
                  <div className="text-xl font-extrabold text-purple-800 mt-0.5">{previewData.summary.duplicate_count}</div>
                </div>
              </div>

              {/* SPEC Section 18 Crucial Rule Banner */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">SPEC Rule (Nothing paid until confirm): </strong>
                  <span>No invoices are marked as paid and no accounts are credited until you click Confirm Reconciliation below.</span>
                </div>
              </div>

              {/* Transactions Reconciliation Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="p-3 w-10 text-center">Reconcile</th>
                        <th className="p-3">Date & Narration</th>
                        <th className="p-3 text-right">Credit Amount</th>
                        <th className="p-3">Match Confidence</th>
                        <th className="p-3">Target Invoice & TDS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewData.transactions.map((tx) => {
                        const isSelected = Boolean(selectedTxHashes[tx.tx_hash]);
                        const isReconciled = tx.import_status === 'ALREADY_RECONCILED';
                        const isDuplicate = tx.import_status === 'ALREADY_IMPORTED';
                        const confidence = tx.confidence;
                        const tdsHint = tx.tds_hint;
                        const applyTds = Boolean(applyTdsMap[tx.tx_hash]);

                        let confBadge = 'badge-slate';
                        if (confidence === 'HIGH') confBadge = 'badge-emerald';
                        if (confidence === 'MEDIUM') confBadge = 'badge-amber';
                        if (confidence === 'LOW') confBadge = 'badge-rose';

                        return (
                          <tr key={tx.tx_hash} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-indigo-50/40' : ''}`}>
                            <td className="p-3 text-center align-top pt-4">
                              <input
                                type="checkbox"
                                disabled={isReconciled}
                                checked={isSelected}
                                onChange={(e) => {
                                  setSelectedTxHashes({
                                    ...selectedTxHashes,
                                    [tx.tx_hash]: e.target.checked
                                  });
                                }}
                                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer disabled:opacity-40"
                              />
                            </td>

                            <td className="p-3 align-top max-w-xs">
                              <div className="font-mono text-slate-500 text-[11px]">{formatDate(tx.tx_date)}</div>
                              <div className="font-medium text-slate-900 break-words">{tx.narration}</div>
                              {tx.ref_no && (
                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">Ref: {tx.ref_no}</div>
                              )}
                              {isDuplicate && (
                                <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">
                                  Already Staged
                                </span>
                              )}
                              {isReconciled && (
                                <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Already Reconciled
                                </span>
                              )}
                            </td>

                            <td className="p-3 align-top text-right whitespace-nowrap">
                              <div className="font-mono font-extrabold text-slate-900 text-sm">
                                {tx.formatted_amount}
                              </div>
                            </td>

                            <td className="p-3 align-top max-w-xs">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${confBadge}`}>
                                {confidence}
                              </span>
                              <div className="text-[11px] text-slate-600 mt-1 leading-snug">
                                {tx.match_reason}
                              </div>
                            </td>

                            <td className="p-3 align-top space-y-2">
                              {/* Invoice Selector */}
                              <select
                                value={userMatchedInvoices[tx.tx_hash] || tx.matched_invoice?.id || ''}
                                onChange={(e) => {
                                  setUserMatchedInvoices({
                                    ...userMatchedInvoices,
                                    [tx.tx_hash]: e.target.value
                                  });
                                  if (e.target.value && !selectedTxHashes[tx.tx_hash]) {
                                    setSelectedTxHashes({ ...selectedTxHashes, [tx.tx_hash]: true });
                                  }
                                }}
                                className="w-full p-2 text-xs rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:ring-indigo-500"
                              >
                                <option value="">-- Select Target Invoice --</option>
                                {tx.matched_invoice && (
                                  <option value={tx.matched_invoice.id}>
                                    ⭐ Best Match: #{tx.matched_invoice.invoice_number} ({tx.matched_invoice.customer_name} • Bal: {tx.matched_invoice.formatted_balance})
                                  </option>
                                )}
                                {openInvoices.map((inv) => (
                                  <option key={inv.id} value={inv.id}>
                                    #{inv.invoice_number} ({inv.customer_name} • Bal: {formatIndianCurrency(inv.balance_paise)})
                                  </option>
                                ))}
                              </select>

                              {/* TDS Shortfall Pill */}
                              {tdsHint?.detected && (
                                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1">
                                  <div className="flex items-center gap-1 font-bold text-amber-800">
                                    <Percent className="w-3.5 h-3.5" />
                                    <span>{tdsHint.rate_percent}% TDS Shortfall ({tdsHint.formatted_tds})</span>
                                  </div>
                                  <div className="text-[10px] text-amber-700 leading-tight">
                                    {tdsHint.note}
                                  </div>
                                  <label className="flex items-center gap-1.5 pt-1 cursor-pointer font-semibold text-indigo-700">
                                    <input
                                      type="checkbox"
                                      checked={applyTds}
                                      onChange={(e) => {
                                        setApplyTdsMap({
                                          ...applyTdsMap,
                                          [tx.tx_hash]: e.target.checked
                                        });
                                      }}
                                      className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                                    />
                                    <span>Apply full credit with TDS offset</span>
                                  </label>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setPreviewData(null)}
                  className="min-h-[48px] px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
                >
                  ← Upload Different CSV
                </button>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[48px] px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex-1 sm:flex-initial"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmReconciliations}
                    disabled={confirming || Object.values(selectedTxHashes).filter(Boolean).length === 0}
                    className="min-h-[48px] px-8 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all flex-1 sm:flex-initial disabled:opacity-50"
                  >
                    {confirming ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                    <span>Confirm {Object.values(selectedTxHashes).filter(Boolean).length} Reconciliation(s)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BankImportModal;
