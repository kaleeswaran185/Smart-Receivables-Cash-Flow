import React from 'react';
import { Inbox, CheckCircle, Clock } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';

export function InboxPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Customer Claims & Action Inbox</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Payment confirmations claimed via public pay link and dispute requests pending verification
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-center py-12">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-4">
          <Inbox className="w-7 h-7" />
        </div>
        <h2 className="text-base font-bold text-slate-800 mb-1">Inbox Zero</h2>
        <p className="text-sm text-slate-500 max-w-sm mx-auto">
          All customer payment claims and reported queries have been audited and settled.
        </p>
      </div>
    </div>
  );
}

export default InboxPage;
