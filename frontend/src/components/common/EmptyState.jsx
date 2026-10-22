import React from 'react';
import { Inbox, Plus } from 'lucide-react';

export function EmptyState({
  icon: Icon = Inbox,
  title = 'No records found',
  description = 'There are currently no items to display in this view.',
  actionLabel,
  onAction,
  actionHref
}) {
  return (
    <div className="py-12 px-4 flex flex-col items-center justify-center text-center bg-white border border-slate-200/80 rounded-2xl p-8 shadow-sm">
      <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
        <Icon className="w-7 h-7" />
      </div>
      
      <h3 className="text-base font-semibold text-slate-800 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mb-6">{description}</p>
      
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="min-h-[48px] px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>{actionLabel}</span>
        </button>
      )}

      {actionLabel && actionHref && !onAction && (
        <a
          href={actionHref}
          className="min-h-[48px] px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>{actionLabel}</span>
        </a>
      )}
    </div>
  );
}

export default EmptyState;
