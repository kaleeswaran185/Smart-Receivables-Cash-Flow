import { useTranslation } from '../../utils/i18n';

/**
 * Renders status strictly as text PLUS solid high-contrast color indicator.
 * Invariants:
 * 1. Status must NEVER be color-alone or icon-alone (text label always preserved).
 * 2. Text contrast >= 4.5:1 against badge background in light and dark mode.
 * 3. Badge background/border contrast >= 3.0:1 against surrounding card/page.
 */
export function StatusBadge({ status, label, size = 'sm', className = '' }) {
  const { t } = useTranslation('statuses');
  const normalized = (status || '').toUpperCase().replace(/[\s-]/g, '_');
  
  let translatedText = label;
  if (!label) {
    translatedText = t(normalized, status || 'UNKNOWN');
  } else {
    const labelKey = String(label).toUpperCase().replace(/[\s-]/g, '_');
    translatedText = t(labelKey, label);
  }
  const displayLabel = translatedText;

  let colorClasses = 'badge-slate';
  let dotColor = 'bg-white dark:bg-slate-900';

  switch (normalized) {
    case 'PAID':
    case 'CONFIRMED':
    case 'RESOLVED':
    case 'ACTIVE':
    case 'GRADE_A':
    case 'SETTLED':
      colorClasses = 'badge-emerald';
      dotColor = 'bg-white dark:bg-[#022c22]';
      break;

    case 'PART_PAID':
    case 'PARTIALLY_PAID':
      colorClasses = 'badge-sky';
      dotColor = 'bg-white dark:bg-[#082f49]';
      break;

    case 'OVERDUE':
    case 'CRITICAL':
    case 'HIGH_RISK':
    case 'GRADE_C':
    case 'CHASE_FIRST':
    case 'LEGAL_RISK':
      colorClasses = 'badge-rose';
      dotColor = 'bg-white dark:bg-[#4c0519]';
      break;

    case 'DUE_SOON':
    case 'DUE_TODAY':
    case 'PENDING':
    case 'GRADE_B':
    case 'HIGH_PRIORITY':
    case 'MODERATE_RISK':
      colorClasses = 'badge-amber';
      dotColor = 'bg-white dark:bg-black';
      break;

    case 'DISPUTED':
    case 'UNDER_REVIEW':
      colorClasses = 'badge-purple';
      dotColor = 'bg-white dark:bg-[#3b0764]';
      break;

    case 'SENT':
    case 'SNOOZED':
    case 'VELOCITY':
      colorClasses = 'badge-indigo';
      dotColor = 'bg-white dark:bg-[#1e1b4b]';
      break;

    case 'DRAFT':
    case 'CANCELLED':
    case 'OPEN':
    default:
      colorClasses = 'badge-slate';
      dotColor = 'bg-white dark:bg-slate-900';
      break;
  }

  const sizeClasses = size === 'xs'
    ? 'text-[11px] px-2.5 py-0.5'
    : size === 'md'
    ? 'text-sm px-3.5 py-1'
    : 'text-xs px-3 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold rounded-full border shadow-sm whitespace-nowrap ${colorClasses} ${sizeClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} aria-hidden="true" />
      <span>{displayLabel}</span>
    </span>
  );
}

export default StatusBadge;
