import React from 'react';
import { Loader2 } from 'lucide-react';

export function Loading({ message = 'Loading financial data...', fullPage = false }) {
  if (fullPage) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="relative flex items-center justify-center mb-4">
          <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
          <div className="absolute font-bold text-indigo-600 text-sm">₹</div>
        </div>
        <p className="text-sm font-medium text-slate-600">{message}</p>
        <p className="text-xs text-slate-400 mt-1">Syncing with ledger & forecast engine</p>
      </div>
    );
  }

  return (
    <div className="py-12 flex flex-col items-center justify-center text-center">
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
      <span className="text-sm text-slate-600 font-medium">{message}</span>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-24 bg-slate-200 rounded" />
        <div className="h-8 w-8 bg-slate-100 rounded-lg" />
      </div>
      <div className="h-7 w-32 bg-slate-200 rounded mb-2" />
      <div className="h-3 w-40 bg-slate-100 rounded" />
    </div>
  );
}

export default Loading;
