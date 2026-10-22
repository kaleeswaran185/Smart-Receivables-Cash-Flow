import React from 'react';

/**
 * Renders status strictly as text PLUS color indicator.
 * Invariant: Status must NEVER be color-alone or icon-alone.
 */
export function StatusBadge({ status, label, size = 'sm', className = '' }) {
  const normalized = (status || '').toUpperCase().replace(/[\s-]/g, '_');
  const displayLabel = label || status || 'UNKNOWN';

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotColor = 'bg-slate-500';

  switch (normalized) {
    case 'PAID':
    case 'CONFIRMED':
    case 'RESOLVED':
    case 'ACTIVE':
    case 'GRADE_A':
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800';
      dotColor = 'bg-emerald-500';
      break;

    case 'PART_PAID':
    case 'PARTIALLY_PAID':
      colorClasses = 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800';
      dotColor = 'bg-sky-500';
      break;

    case 'OVERDUE':
    case 'CRITICAL':
    case 'HIGH_RISK':
    case 'GRADE_C':
    case 'CHASE_FIRST':
      colorClasses = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800';
      dotColor = 'bg-rose-500';
      break;

    case 'DUE_SOON':
    case 'DUE_TODAY':
    case 'PENDING':
    case 'GRADE_B':
    case 'HIGH_PRIORITY':
      colorClasses = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800';
      dotColor = 'bg-amber-500';
      break;

    case 'DISPUTED':
      colorClasses = 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800';
      dotColor = 'bg-purple-500';
      break;

    case 'SENT':
    case 'SNOOZED':
      colorClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800';
      dotColor = 'bg-indigo-500';
      break;

    case 'DRAFT':
    case 'CANCELLED':
    default:
      colorClasses = 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
      dotColor = 'bg-slate-400';
      break;
  }

  const sizeClasses = size === 'xs'
    ? 'text-[11px] px-2 py-0.5'
    : size === 'md'
    ? 'text-sm px-3 py-1'
    : 'text-xs px-2.5 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border whitespace-nowrap ${colorClasses} ${sizeClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} aria-hidden="true" />
      <span>{displayLabel}</span>
    </span>
  );
}

export default StatusBadge;
