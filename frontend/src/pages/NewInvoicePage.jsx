import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Calendar,
  Building2,
  FileCheck2,
  AlertCircle,
  HelpCircle,
  Calculator,
  ShieldCheck
} from 'lucide-react';
import api from '../services/api';
import { formatIndianCurrency, amountInWords, paiseToRupees, rupeesToPaise } from '../utils/money';
import { StatusBadge } from '../components/common/StatusBadge';
import { Loading } from '../components/common/Loading';

export function NewInvoicePage() {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [customerId, setCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('2026-10-22');
  const [dueDate, setDueDate] = useState('2026-11-21');
  const [placeOfSupply, setPlaceOfSupply] = useState('Maharashtra');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('Payment due within credit period. Interest applicable on delayed settlement.');

  // Line Items State
  const [items, setItems] = useState([
    {
      description: 'Corrugated 5-Ply Shipping Cartons (500x350x250mm)',
      hsn_code: '481910',
      qty: 500,
      unit: 'BOX',
      rate: 120, // in rupees
      discount: 0,
      gst_rate: 18
    }
  ]);

  // Live calculation returned from backend preview
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    async function fetchCustomers() {
      try {
        setLoadingCustomers(true);
        const data = await api.get('/customers');
        setCustomers(data || []);
        if (data && data.length > 0) {
          selectCustomer(data[0].id, data);
        }
      } catch (err) {
        setError('Failed to load customers');
      } finally {
        setLoadingCustomers(false);
      }
    }
    fetchCustomers();
  }, []);

  const selectCustomer = (id, custList = customers) => {
    setCustomerId(id);
    const selected = custList.find(c => String(c.id) === String(id));
    if (selected) {
      if (selected.state) {
        setPlaceOfSupply(selected.state);
      }
      // Auto calculate due date: invoiceDate + credit_period_days
      const creditDays = selected.credit_period_days || 30;
      const [y, m, d] = invoiceDate.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d + creditDays));
      const resY = dt.getUTCFullYear();
      const resM = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const resD = String(dt.getUTCDate()).padStart(2, '0');
      setDueDate(`${resY}-${resM}-${resD}`);
    }
  };

  // Live Backend Preview
  useEffect(() => {
    let cancel = false;

    async function computePreview() {
      if (!customerId || items.length === 0) return;
      try {
        setPreviewLoading(true);
        const formattedItems = items.map(item => ({
          description: item.description,
          hsnCode: item.hsn_code,
          qty: Number(item.qty) || 1,
          unit: item.unit,
          ratePaise: rupeesToPaise(item.rate || 0),
          discountPaise: rupeesToPaise(item.discount || 0),
          gstRate: Number(item.gst_rate) || 0
        }));

        const res = await api.post('/invoices/preview', {
          customer_id: customerId,
          place_of_supply: placeOfSupply,
          items: formattedItems
        });

        if (!cancel) {
          setPreview(res);
        }
      } catch (err) {
        console.error('Preview error:', err);
      } finally {
        if (!cancel) setPreviewLoading(false);
      }
    }

    const timer = setTimeout(computePreview, 250);
    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [customerId, placeOfSupply, items, invoiceDate]);

  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        description: '',
        hsn_code: '481910',
        qty: 100,
        unit: 'NOS',
        rate: 50,
        discount: 0,
        gst_rate: 18
      }
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!customerId) {
      setError('Please select a customer for this invoice.');
      return;
    }

    if (items.some(i => !i.description?.trim())) {
      setError('Every line item must have a valid description.');
      return;
    }

    if (items.some(i => Number(i.qty) <= 0 || Number(i.rate) <= 0)) {
      setError('Quantity and Unit Rate must be greater than zero for all items.');
      return;
    }

    for (const item of items) {
      if (item.hsn_code && item.hsn_code.trim()) {
        if (!/^[0-9]{4,8}$/.test(item.hsn_code.trim())) {
          setError('HSN/SAC code must be 4 to 8 digits.');
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        customer_id: Number(customerId),
        invoice_date: invoiceDate,
        due_date: dueDate,
        place_of_supply: placeOfSupply,
        notes,
        terms,
        items: items.map(item => ({
          description: item.description.trim(),
          hsnCode: item.hsn_code?.trim() || null,
          qty: Number(item.qty),
          unit: item.unit || 'NOS',
          ratePaise: rupeesToPaise(item.rate),
          discountPaise: rupeesToPaise(item.discount || 0),
          gstRate: Number(item.gst_rate)
        }))
      };

      const res = await api.post('/invoices', payload);
      navigate(`/invoices/${res.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create invoice. Please check parameters.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCust = customers.find(c => String(c.id) === String(customerId));
  const isInterState = preview?.summary?.igstPaise > 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/invoices')}
          className="min-h-[48px] min-w-[48px] rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm"
          aria-label="Back to Invoices"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Create New Tax Invoice</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            GST-compliant invoicing with live backend calculation and automatic credit period scheduling
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold">Cannot Create Invoice:</strong> {error}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer & Dates Section */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm space-y-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>Customer & Terms Particulars</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Customer Picker */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-700">Select Customer *</label>
              {loadingCustomers ? (
                <div className="min-h-[48px] flex items-center px-3 bg-slate-50 rounded-xl text-xs text-slate-400">
                  Loading customers directory...
                </div>
              ) : (
                <select
                  value={customerId}
                  onChange={(e) => selectCustomer(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 text-sm font-semibold bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company_name ? `• ${c.company_name}` : ''} ({c.city}, {c.state})
                    </option>
                  ))}
                </select>
              )}
              {selectedCust && (
                <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2 pt-1">
                  <span>GSTIN: <strong className="font-mono text-slate-700">{selectedCust.gstin || 'Unregistered'}</strong></span>
                  <span>•</span>
                  <span>Credit: <strong className="font-mono text-slate-700">{selectedCust.credit_period_days || 30} Days</strong></span>
                  {selectedCust.stats && (
                    <>
                      <span>•</span>
                      <StatusBadge
                        status={selectedCust.stats.reliabilityGrade === 'A' ? 'GRADE_A' : selectedCust.stats.reliabilityGrade === 'B' ? 'GRADE_B' : 'GRADE_C'}
                        label={`Reliability: Grade ${selectedCust.stats.reliabilityGrade}`}
                        size="xs"
                      />
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Place of Supply */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Place of Supply (State) *</label>
              <input
                type="text"
                value={placeOfSupply}
                onChange={(e) => setPlaceOfSupply(e.target.value)}
                placeholder="e.g. Maharashtra or Gujarat"
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <span className="text-[10px] text-slate-400 block">
                {placeOfSupply.toLowerCase() === 'maharashtra' || placeOfSupply === '27'
                  ? 'Intra-state: CGST (9%) + SGST (9%)'
                  : 'Inter-state: IGST (18%)'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Invoice Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Invoice Date *</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            {/* Due Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Due Date (Payment Deadline) *</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
          </div>
        </div>

        {/* Line Items Section */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-indigo-600" />
              <span>Line Items & GST Tiers</span>
            </h2>
            <button
              type="button"
              onClick={handleAddItem}
              className="min-h-[48px] px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Item</span>
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Item #{idx + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="min-h-[36px] px-2.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Item Description *</label>
                    <input
                      type="text"
                      placeholder="e.g. 5-Ply Corrugated Master Box"
                      value={item.description}
                      onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-lg border border-slate-200 text-sm font-medium bg-white"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">HSN/SAC Code</label>
                    <input
                      type="text"
                      placeholder="481910"
                      value={item.hsn_code}
                      onChange={(e) => handleItemChange(idx, 'hsn_code', e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-lg border border-slate-200 text-sm font-mono bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-lg border border-slate-200 text-sm font-mono font-bold bg-white"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Unit</label>
                    <select
                      value={item.unit}
                      onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                      className="w-full min-h-[44px] px-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                    >
                      <option value="BOX">BOX</option>
                      <option value="PCS">PCS</option>
                      <option value="NOS">NOS</option>
                      <option value="KG">KG</option>
                      <option value="MTR">MTR</option>
                      <option value="SET">SET</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Unit Rate (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={item.rate}
                      onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-lg border border-slate-200 text-sm font-mono font-bold bg-white"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">Discount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={item.discount}
                      onChange={(e) => handleItemChange(idx, 'discount', e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-lg border border-slate-200 text-sm font-mono bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">GST Rate</label>
                    <select
                      value={item.gst_rate}
                      onChange={(e) => handleItemChange(idx, 'gst_rate', e.target.value)}
                      className="w-full min-h-[44px] px-2 rounded-lg border border-slate-200 text-xs font-bold bg-white text-indigo-700"
                    >
                      <option value="0">0% GST</option>
                      <option value="3">3% GST</option>
                      <option value="5">5% GST</option>
                      <option value="12">12% GST</option>
                      <option value="18">18% GST (Standard)</option>
                      <option value="28">28% GST</option>
                      <option value="40">40% GST</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Calculation Preview Card (Backend as Source of Truth) */}
        {preview && preview.summary && (
          <div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-sm">
                  Live Tax & Financial Calculation
                </h3>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full">
                Backend Source of Truth
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Words */}
              <div className="space-y-2">
                <span className="text-xs text-slate-400 uppercase font-bold tracking-wider block">
                  Amount In Words
                </span>
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-sm italic font-medium text-emerald-300">
                  "{preview.summary.totalInWords}"
                </div>
                <div className="text-xs text-slate-400 pt-1">
                  Tax Type: <strong className="text-white">{preview.invoiceType || 'Tax Invoice'}</strong> • Place of Supply:{' '}
                  <strong className="text-white">{preview.placeOfSupply}</strong>
                </div>
              </div>

              {/* Numbers */}
              <div className="space-y-1.5 text-xs sm:text-sm font-mono">
                <div className="flex justify-between text-slate-300">
                  <span className="font-sans">Taxable Value:</span>
                  <span className="font-bold">{preview.summary.formattedTaxable}</span>
                </div>

                {preview.summary.cgstPaise > 0 && (
                  <>
                    <div className="flex justify-between text-slate-400 text-xs">
                      <span className="font-sans">CGST:</span>
                      <span>+{preview.summary.formattedCGST}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-xs">
                      <span className="font-sans">SGST:</span>
                      <span>+{preview.summary.formattedSGST}</span>
                    </div>
                  </>
                )}

                {preview.summary.igstPaise > 0 && (
                  <div className="flex justify-between text-slate-400 text-xs">
                    <span className="font-sans">IGST:</span>
                    <span>+{preview.summary.formattedIGST}</span>
                  </div>
                )}

                {preview.summary.roundOffPaise !== 0 && (
                  <div className="flex justify-between text-slate-400 text-xs">
                    <span className="font-sans">Round Off:</span>
                    <span>{preview.summary.formattedRoundOff}</span>
                  </div>
                )}

                <div className="flex justify-between text-white text-lg font-black pt-2 border-t border-slate-700">
                  <span className="font-sans">Grand Total:</span>
                  <span className="text-emerald-400 font-mono">{preview.summary.formattedTotal}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit 48px Action Button */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="min-h-[48px] px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm transition-colors"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="min-h-[48px] px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
          >
            <FileCheck2 className="w-5 h-5" />
            <span>{submitting ? 'Creating Invoice...' : 'Generate Tax Invoice'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default NewInvoicePage;
