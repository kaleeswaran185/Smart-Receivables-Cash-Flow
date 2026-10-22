import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FilePlus } from 'lucide-react';

export function NewInvoicePage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="min-h-[48px] min-w-[48px] rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-50 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Create Tax Invoice</h1>
          <p className="text-xs sm:text-sm text-slate-500">GST-compliant invoice generation with automated line calculations</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-4">
          <FilePlus className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Invoice Generator Shell Ready</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
          The full invoice builder will be connected with customer selector, GST rate tiers (0%, 3%, 5%, 18%, 40%), and auto round-off calculations.
        </p>
        <button
          type="button"
          onClick={() => navigate('/invoices')}
          className="min-h-[48px] px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors"
        >
          Back to Invoices Ledger
        </button>
      </div>
    </div>
  );
}

export default NewInvoicePage;
