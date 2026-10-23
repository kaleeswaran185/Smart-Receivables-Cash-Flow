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
 * Converts rupees to integer paise
 * @param {number|string} rupees
 * @returns {number}
 */
export function rupeesToPaise(rupees) {
  if (rupees === null || rupees === undefined || isNaN(Number(rupees))) return 0;
  return Math.round(Number(rupees) * 100);
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

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

function convertBelowThousand(n) {
  let str = '';
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + ' Hundred';
    n %= 100;
    if (n > 0) str += ' ';
  }
  if (n > 0) {
    if (n < 20) {
      str += ONES[n];
    } else {
      const ten = Math.floor(n / 10);
      const unit = n % 10;
      str += TENS[ten] + (unit ? ' ' + ONES[unit] : '');
    }
  }
  return str;
}

function integerRupeesToWords(num) {
  if (num === 0) return 'Zero';
  let words = '';
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;

  if (crore > 0) {
    words += (crore >= 100 ? integerRupeesToWords(crore) : convertBelowThousand(crore)) + ' Crore ';
  }
  if (lakh > 0) {
    words += convertBelowThousand(lakh) + ' Lakh ';
  }
  if (thousand > 0) {
    words += convertBelowThousand(thousand) + ' Thousand ';
  }
  if (num > 0) {
    words += convertBelowThousand(num);
  }
  return words.trim();
}

/**
 * Converts amount in paise to Indian words with "Rupees ... Only".
 * @param {number} paise - Amount in integer paise
 * @returns {string} Amount in words
 */
export function amountInWords(paise) {
  if (paise === null || paise === undefined || isNaN(Number(paise))) {
    return 'Rupees Zero Only';
  }

  const isNegative = paise < 0;
  const absPaise = Math.abs(Math.round(Number(paise)));
  const rupees = Math.floor(absPaise / 100);
  const remainingPaise = absPaise % 100;

  if (rupees === 0 && remainingPaise === 0) {
    return 'Rupees Zero Only';
  }

  if (rupees === 0 && remainingPaise > 0) {
    const paiseWords = convertBelowThousand(remainingPaise);
    return `${isNegative ? 'Minus ' : ''}${paiseWords} ${remainingPaise === 1 ? 'Paisa' : 'Paise'} Only`;
  }

  let result = (isNegative ? 'Minus ' : '') + 'Rupees ';
  result += integerRupeesToWords(rupees);

  if (remainingPaise > 0) {
    const paiseWords = convertBelowThousand(remainingPaise);
    result += ` and ${paiseWords} ${remainingPaise === 1 ? 'Paisa' : 'Paise'}`;
  }

  return `${result.trim()} Only`;
}

/**
 * Formats a YYYY-MM-DD date into Indian business standard (e.g., 22 Oct 2026 / 22 अक्टू 2026)
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} [lang='en'] - 'en', 'hi', or 'ta'
 * @returns {string}
 */
export function formatDate(dateStr, lang) {
  if (!dateStr) return '—';
  try {
    const currentLang = lang || (typeof document !== 'undefined' ? (document.documentElement.lang || 'en') : 'en');
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const localeMap = {
      en: 'en-IN',
      hi: 'hi-IN',
      ta: 'ta-IN'
    };
    const localeTag = localeMap[currentLang] || 'en-IN';
    return new Intl.DateTimeFormat(localeTag, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(date);
  } catch (e) {
    return dateStr;
  }
}
