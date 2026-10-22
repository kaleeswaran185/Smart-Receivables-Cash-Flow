import React, { useState, useEffect } from 'react';
import { Settings, Building2, Calendar, ShieldCheck } from 'lucide-react';
import api from '../services/api';

export function SettingsPage() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await api.get('/settings');
        setSettings(data);
      } catch (e) {
        // Fallback default
      }
    }
    loadSettings();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">System & Business Settings</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Global demo date, safety buffer threshold, business GSTIN, and bank UPI details
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <span>Business Entity</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-400 block text-[11px] uppercase font-semibold">Entity Name</span>
              <strong className="text-slate-900 text-sm">Sharma Packaging</strong>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-400 block text-[11px] uppercase font-semibold">Jurisdiction / GSTIN</span>
              <strong className="text-slate-900 font-mono text-sm">27AAACS1234A1Z5 (Maharashtra)</strong>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-400 block text-[11px] uppercase font-semibold">Default Credit Period</span>
              <strong className="text-slate-900 font-mono text-sm">30 Days</strong>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-400 block text-[11px] uppercase font-semibold">Safety Cash Buffer</span>
              <strong className="text-slate-900 font-mono text-sm">₹5,00,000</strong>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 space-y-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <span>Simulated System Clock</span>
          </h2>
          <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs sm:text-sm text-slate-700">
            Current system demo date is locked to <strong className="font-mono text-indigo-900">2026-10-22</strong> across all forecast calculations, reminder escalations, and overdue ageing.
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
