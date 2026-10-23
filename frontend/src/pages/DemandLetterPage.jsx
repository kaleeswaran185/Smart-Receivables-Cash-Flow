import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, Download, ArrowLeft, Building2, AlertTriangle, ShieldAlert } from 'lucide-react';
import api from '../services/api';
import { formatIndianCurrency, formatDate, amountInWords } from '../utils/money';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';

export function DemandLetterPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.get(`/invoices/${id}`);
        setInvoice(data);
      } catch (err) {
        setError(err.message || 'Invoice not found');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <Loading fullPage message="Drafting payment demand letter..." />;
  if (error || !invoice) return <ErrorState title="Invoice Not Found" message={error} onRetry={() => navigate('/invoices')} />;

  const today = invoice.demo_date || invoice.today || '2026-10-22';
  
  // Calculate a 7-day settlement deadline from today
  const deadlineDate = (() => {
    const [y, m, d] = today.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d + 7, 12, 0, 0));
    const resY = dateObj.getUTCFullYear();
    const resM = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const resD = String(dateObj.getUTCDate()).padStart(2, '0');
    return `${resY}-${resM}-${resD}`;
  })();

  const payments = invoice.payments || [];
  const totalPaid = invoice.paid_paise || 0;

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 sm:px-6 print:p-0 print:bg-white text-slate-900">
      {/* Top Action Toolbar (hidden in print) */}
      <div className="max-w-4xl mx-auto mb-6 print-toolbar no-print flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-50 transition-colors"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Payment Demand Letter — {invoice.invoice_number}
            </h2>
            <p className="text-xs text-slate-500">
              Formal business demand letter for outstanding receivables
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors"
            title="In the print window, choose 'Save as PDF' as destination"
          >
            <Download className="w-4 h-4" />
            <span>Save as PDF</span>
          </button>
        </div>
      </div>

      {/* Main Printable Letter Container */}
      <div className="max-w-4xl mx-auto bg-white border border-slate-200/80 shadow-md p-8 sm:p-12 rounded-2xl print-document print:p-0 print:border-none print:shadow-none space-y-6">
        {/* Business Header (Sender) - Strictly Commercial Business, NO Govt/Court Branding */}
        <div className="border-b-2 border-slate-900 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {invoice.business_name || 'Sharma Packaging'}
              </div>
              {invoice.business_trade_name && (
                <div className="text-xs text-slate-600 font-medium">{invoice.business_trade_name}</div>
              )}
              <div className="text-xs text-slate-600 mt-1">
                {invoice.business_address_line1 || 'Plot No. 42, Sector 10, PCMC Industrial Area'}, {invoice.business_address_line2 || 'Bhosari MIDC'}
              </div>
              <div className="text-xs text-slate-600">
                {invoice.business_city || 'Pune'}, {invoice.business_state || 'Maharashtra'} - {invoice.business_pincode || '411026'}
              </div>
              <div className="text-xs text-slate-800 font-mono mt-0.5">
                GSTIN: {invoice.business_gstin || '27AAACR1234F1ZV'} • Phone: {invoice.business_phone || '+91 98220 12345'}
              </div>
            </div>

            <div className="sm:text-right space-y-1 text-xs">
              <div>
                <span className="text-slate-500 uppercase tracking-wider text-[11px] font-semibold block">Notice Date</span>
                <strong className="text-slate-900 font-mono text-sm">{formatDate(today)}</strong>
              </div>
              <div className="text-slate-600">
                Ref: <span className="font-mono font-medium">PDL/{invoice.invoice_number}/{today.replace(/-/g, '')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Document Title: MUST BE EXACT */}
        <div className="text-center pt-2">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-wider underline underline-offset-4">
            PAYMENT DEMAND LETTER
          </h1>
        </div>

        {/* MANDATORY DISCLAIMER - EXACT REQUIRED WORDING */}
        <div className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-xl text-xs text-amber-950 font-medium leading-relaxed">
          <strong>Notice:</strong> This letter is from the business regarding outstanding invoices. It is not a notice from the GST department and not a legal notice from a lawyer.
        </div>

        {/* Recipient Details */}
        <div className="text-xs sm:text-sm space-y-1 pt-2">
          <div className="text-slate-500 font-semibold uppercase text-[11px] tracking-wider">To:</div>
          <div className="font-extrabold text-slate-900 text-sm sm:text-base">{invoice.customer_name}</div>
          {invoice.customer_company && (
            <div className="font-medium text-slate-700">{invoice.customer_company}</div>
          )}
          <div className="text-slate-600">{invoice.customer_address || 'Premises / Industrial Area'}</div>
          <div className="text-slate-600 font-mono">
            {invoice.customer_city || ''}, {invoice.customer_state || ''} {invoice.customer_pincode ? `- ${invoice.customer_pincode}` : ''}
          </div>
          {invoice.customer_gstin && (
            <div className="text-slate-700 font-mono text-xs">
              <strong>GSTIN:</strong> {invoice.customer_gstin}
            </div>
          )}
        </div>

        {/* Formal Demand Body */}
        <div className="space-y-3 text-xs sm:text-sm text-slate-800 leading-relaxed pt-2">
          <div className="font-bold text-slate-900">
            Subject: Formal demand for immediate settlement of overdue Invoice #{invoice.invoice_number}
          </div>
          <p>
            Dear {invoice.customer_name},
          </p>
          <p>
            We are writing to draw your urgent attention towards invoice <strong>{invoice.invoice_number}</strong> issued on <strong>{formatDate(invoice.invoice_date)}</strong>, which matured for payment on <strong>{formatDate(invoice.due_date)}</strong> in accordance with our mutually agreed credit terms.
          </p>
          <p>
            As of today, <strong>{formatDate(today)}</strong>, our accounting records indicate that the invoice remains outstanding with a balance due as summarized below.
          </p>
        </div>

        {/* Invoice Summary Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
          <div className="bg-slate-100 px-4 py-2 font-bold text-slate-800 border-b border-slate-200">
            1. Invoice Particulars
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 text-slate-700">
            <div>
              <span className="text-slate-400 block text-[11px]">Invoice Number</span>
              <strong className="text-slate-900 font-mono">{invoice.invoice_number}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Invoice Date</span>
              <span className="text-slate-900 font-medium">{formatDate(invoice.invoice_date)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Agreed Due Date</span>
              <span className="text-rose-700 font-medium">{formatDate(invoice.due_date)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Total Invoiced Amount</span>
              <strong className="text-slate-900 font-mono">{formatIndianCurrency(invoice.total_paise)}</strong>
            </div>
          </div>
        </div>

        {/* Part Payments Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
          <div className="bg-slate-100 px-4 py-2 font-bold text-slate-800 border-b border-slate-200 flex justify-between items-center">
            <span>2. Part Payments Received</span>
            <span className="text-[11px] font-normal text-slate-600">
              Total Credited: <strong>{formatIndianCurrency(totalPaid)}</strong>
            </span>
          </div>

          {payments.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] text-slate-600 uppercase">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Mode</th>
                  <th className="py-2 px-3">Reference / UTR No</th>
                  <th className="py-2 px-3 text-right">Amount Credited</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p, idx) => (
                  <tr key={p.id || idx}>
                    <td className="py-2 px-3 font-mono text-slate-700">{formatDate(p.payment_date)}</td>
                    <td className="py-2 px-3 font-medium text-slate-800">{p.payment_mode}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{p.reference_no || 'Direct Transfer'}</td>
                    <td className="py-2 px-3 font-mono font-semibold text-emerald-700 text-right">
                      {formatIndianCurrency(p.amount_paise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-4 text-slate-500 italic text-center">
              No part payments have been received towards this invoice to date. The full invoiced sum remains unsettled.
            </div>
          )}
        </div>

        {/* Remaining Amount Highlight Callout */}
        <div className="p-5 rounded-2xl bg-rose-50/80 border-2 border-rose-300 text-center space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
            Current Outstanding Balance Payable
          </span>
          <div className="text-2xl sm:text-3xl font-black font-mono text-rose-900">
            {formatIndianCurrency(invoice.balance_paise)}
          </div>
          <div className="text-xs font-medium text-rose-800 italic">
            ({amountInWords(invoice.balance_paise)})
          </div>
        </div>

        {/* Settlement Deadline Clause */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 space-y-2">
          <div className="font-bold text-slate-900 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Settlement Deadline</span>
          </div>
          <p className="leading-relaxed">
            Please arrange to remit the outstanding amount of <strong>{formatIndianCurrency(invoice.balance_paise)}</strong> on or before{' '}
            <strong className="text-rose-700 underline underline-offset-2">{formatDate(deadlineDate)}</strong>.
            Failing timely settlement, we will have no alternative but to suspend further supplies and dispatches to your account and initiate formal commercial debt recovery procedures.
          </p>
        </div>

        {/* Bank & UPI Settlement Details */}
        <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
          <div className="bg-slate-100 px-4 py-2 font-bold text-slate-800 border-b border-slate-200">
            Remittance &amp; Payment Options
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-800">
            <div className="space-y-1">
              <strong className="block text-slate-900 font-semibold text-[11px] uppercase tracking-wider">
                Bank Transfer (NEFT / RTGS / IMPS)
              </strong>
              <div className="font-mono">Beneficiary: <strong>{invoice.business_name || 'Sharma Packaging'}</strong></div>
              <div className="font-mono">Bank: <strong>{invoice.bank_name || 'HDFC Bank'}</strong></div>
              <div className="font-mono">A/C Number: <strong>{invoice.bank_account_no || '50200045892147'}</strong></div>
              <div className="font-mono">IFSC Code: <strong>{invoice.bank_ifsc || 'HDFC0001234'}</strong></div>
              <div className="text-slate-600 font-mono text-[11px]">Branch: {invoice.bank_branch || 'Bhosari MIDC Branch'}</div>
            </div>

            <div className="space-y-1">
              <strong className="block text-slate-900 font-semibold text-[11px] uppercase tracking-wider">
                Instant UPI Payment
              </strong>
              <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 font-mono text-indigo-900 font-bold text-sm">
                UPI ID: {invoice.upi_id || 'sharmapackaging@hdfcbank'}
              </div>
              {invoice.payment_token && (
                <div className="text-[11px] text-slate-600 pt-1">
                  Pay securely via Web:{' '}
                  <span className="font-mono text-indigo-600 font-semibold">
                    {window.location.origin}/pay/{invoice.payment_token}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Signatory Box */}
        <div className="pt-6 border-t border-slate-200 flex justify-between items-end text-xs">
          <div className="text-slate-500 max-w-sm">
            <p>If you have already processed payment in the last 24 hours, kindly provide your transaction UTR reference so we can promptly credit your account.</p>
          </div>

          <div className="text-right space-y-12">
            <div className="text-xs font-bold text-slate-900">
              For {invoice.business_name || 'Sharma Packaging'}
            </div>
            <div className="border-t border-slate-400 pt-1 inline-block min-w-[180px] text-center text-[11px] font-semibold text-slate-700">
              Authorized Signatory / Accounts
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DemandLetterPage;
