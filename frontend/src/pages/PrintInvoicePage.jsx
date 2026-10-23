import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, Download, ArrowLeft, Building2, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import { formatIndianCurrency, formatDate, amountInWords } from '../utils/money';
import { Loading } from '../components/common/Loading';
import { ErrorState } from '../components/common/ErrorState';

export function PrintInvoicePage() {
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

  if (loading) return <Loading fullPage message="Preparing print-ready invoice document..." />;
  if (error || !invoice) return <ErrorState title="Invoice Not Found" message={error} onRetry={() => navigate('/invoices')} />;

  // Determine Title based on Registration Type
  const regType = (invoice.business_reg_type || 'REGULAR').toUpperCase();
  let documentTitle = 'Tax Invoice';
  let documentSubheading = '(Issued under Section 31 of the CGST Act, 2017)';

  if (regType === 'COMPOSITION') {
    documentTitle = 'Bill of Supply';
    documentSubheading = '(Composition taxable person, not eligible to collect tax on supplies)';
  } else if (regType === 'UNREGISTERED') {
    documentTitle = 'Invoice';
    documentSubheading = '(Commercial Invoice for Unregistered Business)';
  }

  // Check turnover > ₹5 Crore (5,00,00,00,000 paise)
  const turnoverPaise = Number(invoice.business_turnover_paise || 6500000000);
  const isTurnoverOver5Cr = turnoverPaise > 5000000000;

  const isIntraState = invoice.cgst_paise > 0 || invoice.sgst_paise > 0;
  const isInterState = invoice.igst_paise > 0;

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 sm:px-6 print:p-0 print:bg-white text-slate-900">
      {/* Interactive Top Toolbar (hidden in print) */}
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
              {documentTitle} — {invoice.invoice_number}
            </h2>
            <p className="text-xs text-slate-500">
              Print-ready formatted document with zero third-party PDF dependencies
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

      {/* Main Print Document Container */}
      <div className="max-w-4xl mx-auto bg-white border border-slate-200/80 shadow-md p-6 sm:p-10 rounded-2xl print-document print:p-0 print:border-none print:shadow-none">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 uppercase">
                {documentTitle}
              </h1>
              <p className="text-xs font-medium text-slate-500 mt-0.5">{documentSubheading}</p>
            </div>
            <div className="sm:text-right">
              <div className="text-lg font-bold font-mono text-slate-900">{invoice.invoice_number}</div>
              <div className="text-xs text-slate-600">
                Invoice Date: <strong className="text-slate-900">{formatDate(invoice.invoice_date)}</strong>
              </div>
              <div className="text-xs text-slate-600">
                Payment Due: <strong className="text-slate-900">{formatDate(invoice.due_date)}</strong>
              </div>
              <div className="text-xs text-slate-600">
                Place of Supply: <strong className="text-slate-900">{invoice.place_of_supply}</strong>
              </div>
            </div>
          </div>

          {regType === 'COMPOSITION' && (
            <div className="mt-3 p-2.5 rounded-lg bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-800">
              Composition taxable person, not eligible to collect tax on supplies
            </div>
          )}

          {/* E-Invoicing Informational Note (Mandated when turnover > ₹5 Crore, no IRN claims) */}
          {isTurnoverOver5Cr && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50/70 border border-amber-200/90 text-xs text-amber-900 font-medium">
              e-invoicing may apply; this app does not generate IRNs.
            </div>
          )}
        </div>

        {/* Parties Two-Column Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-slate-200 text-xs sm:text-sm">
          {/* Supplier / Seller */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Supplier / Billed From
            </span>
            <div className="text-base font-extrabold text-slate-900">{invoice.business_name}</div>
            {invoice.business_trade_name && (
              <div className="text-xs text-slate-600 font-medium">{invoice.business_trade_name}</div>
            )}
            <div className="text-xs text-slate-700">
              {invoice.business_address_line1 || 'PCMC Industrial Area'}
              {invoice.business_address_line2 ? `, ${invoice.business_address_line2}` : ''}
            </div>
            <div className="text-xs text-slate-700">
              {invoice.business_city || 'Pune'}, {invoice.business_state || 'Maharashtra'} - {invoice.business_pincode || '411026'}
            </div>
            <div className="text-xs text-slate-800 font-mono pt-1">
              <strong>GSTIN:</strong> {invoice.business_gstin || '27AAACR1234F1ZV'}
            </div>
            {invoice.business_pan && (
              <div className="text-xs text-slate-700 font-mono">
                <strong>PAN:</strong> {invoice.business_pan}
              </div>
            )}
            {invoice.business_phone && (
              <div className="text-xs text-slate-600">Phone: {invoice.business_phone}</div>
            )}
            {invoice.business_email && (
              <div className="text-xs text-slate-600">Email: {invoice.business_email}</div>
            )}
          </div>

          {/* Customer / Buyer */}
          <div className="space-y-1 sm:text-right">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Recipient / Billed To
            </span>
            <div className="text-base font-extrabold text-slate-900">{invoice.customer_name}</div>
            {invoice.customer_company && (
              <div className="text-xs text-slate-600 font-medium">{invoice.customer_company}</div>
            )}
            <div className="text-xs text-slate-700">
              {invoice.customer_address || 'Customer Commercial Premises'}
            </div>
            <div className="text-xs text-slate-700">
              {invoice.customer_city || ''}, {invoice.customer_state || ''} - {invoice.customer_pincode || ''}
            </div>
            <div className="text-xs text-slate-800 font-mono pt-1 sm:text-right">
              <strong>GSTIN / UIN:</strong> {invoice.customer_gstin || 'Unregistered'}
            </div>
            <div className="text-xs text-slate-700 sm:text-right">
              <strong>State Code:</strong> {invoice.customer_state_code || '27'}
            </div>
            {invoice.customer_phone && (
              <div className="text-xs text-slate-600">Phone: {invoice.customer_phone}</div>
            )}
          </div>
        </div>

        {/* Itemized Table */}
        <div className="py-6 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-700">
                <th className="py-2.5 px-2 font-bold w-10 text-center">#</th>
                <th className="py-2.5 px-3 font-bold">Description of Goods / Services</th>
                <th className="py-2.5 px-2 font-bold text-center">HSN/SAC</th>
                <th className="py-2.5 px-2 font-bold text-right">Qty</th>
                <th className="py-2.5 px-2 font-bold text-right">Rate</th>
                <th className="py-2.5 px-2 font-bold text-right">Disc</th>
                <th className="py-2.5 px-2 font-bold text-right">Taxable</th>
                {regType === 'REGULAR' && (
                  <>
                    <th className="py-2.5 px-2 font-bold text-right">GST %</th>
                    {isIntraState && (
                      <>
                        <th className="py-2.5 px-2 font-bold text-right">CGST</th>
                        <th className="py-2.5 px-2 font-bold text-right">SGST</th>
                      </>
                    )}
                    {isInterState && <th className="py-2.5 px-2 font-bold text-right">IGST</th>}
                  </>
                )}
                <th className="py-2.5 px-3 font-bold text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.items && invoice.items.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-2 text-center text-slate-500 font-mono">{idx + 1}</td>
                  <td className="py-2.5 px-3 text-slate-900 font-medium">{item.description}</td>
                  <td className="py-2.5 px-2 text-center font-mono text-slate-600">{item.hsn_code || '—'}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-800">
                    {item.qty} {item.unit || ''}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-800">
                    {formatIndianCurrency(item.rate_paise)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-500">
                    {item.discount_paise > 0 ? formatIndianCurrency(item.discount_paise) : '—'}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-medium text-slate-900">
                    {formatIndianCurrency(item.taxable_paise)}
                  </td>
                  {regType === 'REGULAR' && (
                    <>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600">{item.gst_rate}%</td>
                      {isIntraState && (
                        <>
                          <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                            {formatIndianCurrency(item.cgst_paise)}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                            {formatIndianCurrency(item.sgst_paise)}
                          </td>
                        </>
                      )}
                      {isInterState && (
                        <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                          {formatIndianCurrency(item.igst_paise)}
                        </td>
                      )}
                    </>
                  )}
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                    {formatIndianCurrency(item.total_paise)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Calculations Summary & Totals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t-2 border-slate-900">
          {/* Amount in words & Part Payments Note */}
          <div className="space-y-4">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Amount (in Words)
              </span>
              <p className="text-xs sm:text-sm font-semibold text-slate-900 mt-1 italic">
                {amountInWords(invoice.total_paise)}
              </p>
            </div>

            {/* Bank Details for Settlement */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Direct Bank &amp; UPI Remittance
              </span>
              <div className="font-mono text-slate-800">
                Bank: <strong>{invoice.bank_name || 'HDFC Bank'}</strong>
              </div>
              <div className="font-mono text-slate-800">
                A/C No: <strong>{invoice.bank_account_no || '50200045892147'}</strong>
              </div>
              <div className="font-mono text-slate-800">
                IFSC: <strong>{invoice.bank_ifsc || 'HDFC0001234'}</strong> ({invoice.bank_branch || 'Bhosari MIDC Branch'})
              </div>
              <div className="font-mono text-indigo-700 font-bold pt-0.5">
                UPI ID: {invoice.upi_id || 'sharmapackaging@hdfcbank'}
              </div>
            </div>

            {invoice.payment_token && (
              <div className="text-[11px] text-slate-500">
                Instant Online Payment Link:{' '}
                <span className="font-mono text-indigo-600 font-medium">
                  {window.location.origin}/pay/{invoice.payment_token}
                </span>
              </div>
            )}
          </div>

          {/* Right Summary Math Table */}
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between py-1 text-slate-600">
              <span>Taxable Value:</span>
              <span className="font-mono font-medium text-slate-900">{formatIndianCurrency(invoice.taxable_paise)}</span>
            </div>

            {regType === 'REGULAR' && (
              <>
                {isIntraState && (
                  <>
                    <div className="flex justify-between py-1 text-slate-600">
                      <span>Central GST (CGST):</span>
                      <span className="font-mono text-slate-900">{formatIndianCurrency(invoice.cgst_paise)}</span>
                    </div>
                    <div className="flex justify-between py-1 text-slate-600">
                      <span>State GST (SGST):</span>
                      <span className="font-mono text-slate-900">{formatIndianCurrency(invoice.sgst_paise)}</span>
                    </div>
                  </>
                )}
                {isInterState && (
                  <div className="flex justify-between py-1 text-slate-600">
                    <span>Integrated GST (IGST):</span>
                    <span className="font-mono text-slate-900">{formatIndianCurrency(invoice.igst_paise)}</span>
                  </div>
                )}
              </>
            )}

            {invoice.round_off_paise !== 0 && (
              <div className="flex justify-between py-1 text-slate-600">
                <span>Round Off:</span>
                <span className="font-mono text-slate-900">
                  {invoice.round_off_paise > 0 ? '+' : ''}
                  {formatIndianCurrency(invoice.round_off_paise)}
                </span>
              </div>
            )}

            <div className="flex justify-between py-2.5 border-t-2 border-slate-900 border-b text-base sm:text-lg font-black text-slate-900">
              <span>Grand Total:</span>
              <span className="font-mono">{formatIndianCurrency(invoice.total_paise)}</span>
            </div>

            {/* Payments / Remaining Balance */}
            {invoice.paid_paise > 0 && (
              <div className="pt-2 space-y-1">
                <div className="flex justify-between text-xs text-emerald-700 font-medium">
                  <span>Amount Paid to Date:</span>
                  <span className="font-mono">{formatIndianCurrency(invoice.paid_paise)}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-rose-700 pt-1 border-t border-slate-100">
                  <span>Remaining Balance Due:</span>
                  <span className="font-mono">{formatIndianCurrency(invoice.balance_paise)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Terms & Signatory */}
        <div className="pt-8 mt-8 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-6 items-end text-xs">
          <div className="text-slate-500 space-y-1">
            <strong className="block text-slate-700 uppercase tracking-wider text-[11px]">Terms &amp; Conditions:</strong>
            <p>1. Goods once sold will not be taken back without prior written confirmation.</p>
            <p>2. Payment strictly due within agreed credit period from date of invoice.</p>
            <p>3. Subject to Pune jurisdiction only.</p>
          </div>

          <div className="text-center sm:text-right space-y-12">
            <div className="text-xs font-bold text-slate-800">
              For {invoice.business_name || 'Sharma Packaging'}
            </div>
            <div className="border-t border-slate-400 pt-1 inline-block sm:min-w-[180px] text-center text-[11px] font-semibold text-slate-600">
              Authorized Signatory
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PrintInvoicePage;
