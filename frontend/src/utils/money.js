/**
 * Indian Rupee & Financial Formatting Utilities
 * All backend money is strictly stored in integer paise.
 */

/**
 * Converts integer paise to rupees
 * @param {number} paise
 * @returns {number}
 */
export function paiseToRupees(paise) {
  if (paise === null || paise === undefined || isNaN(paise)) return 0;
  return paise / 100;
}

/**
 * Formats paise into Indian Rupee format (e.g., ₹1,00,000 or ₹2,60,281)
 * @param {number} paise - Amount in paise
 * @param {object} [options]
 * @param {boolean} [options.showDecimals=false]
 * @returns {string} Formatted currency string with ₹ symbol
 */
export function formatIndianCurrency(paise, options = {}) {
  const { showDecimals = false } = options;
  if (paise === null || paise === undefined || isNaN(paise)) {
    return '₹0';
  }

  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = absPaise / 100;

  const hasDecimalPart = absPaise % 100 !== 0;
  const fractionDigits = (showDecimals || hasDecimalPart) ? 2 : 0;

  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(rupees);

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Compact Indian currency formatting (e.g., ₹12.5L, ₹1.2Cr)
 * @param {number} paise
 * @returns {string}
 */
export function formatCompactRupees(paise) {
  if (paise === null || paise === undefined || isNaN(paise)) return '₹0';
  const rupees = paise / 100;
  const abs = Math.abs(rupees);
  const sign = rupees < 0 ? '-' : '';

  if (abs >= 10000000) {
    return `${sign}₹${(abs / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`;
  }
  if (abs >= 100000) {
    return `${sign}₹${(abs / 100000).toFixed(2).replace(/\.00$/, '')} L`;
  }
  if (abs >= 1000) {
    return `${sign}₹${(abs / 1000).toFixed(1).replace(/\.0$/, '')} k`;
  }
  return `${sign}₹${abs}`;
}

/**
 * Formats a YYYY-MM-DD date into Indian business standard (e.g., 22 Oct 2026)
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string}
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}
