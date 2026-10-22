/**
 * Money utilities for Indian Rupee & Paise handling,
 * Indian numbering system formatting, and amount-in-words.
 */

/**
 * Converts Rupees to integer Paise, avoiding floating point precision errors.
 * @param {number|string} rupees - Amount in rupees
 * @returns {number} Amount in integer paise
 */
export function rupeesToPaise(rupees) {
  if (rupees === null || rupees === undefined || isNaN(Number(rupees))) {
    throw new TypeError(`Invalid rupees value: ${rupees}`);
  }
  return Math.round(Number(rupees) * 100);
}

/**
 * Converts integer Paise to Rupees.
 * @param {number|string} paise - Amount in paise
 * @returns {number} Amount in rupees
 */
export function paiseToRupees(paise) {
  if (paise === null || paise === undefined || isNaN(Number(paise))) {
    throw new TypeError(`Invalid paise value: ${paise}`);
  }
  return Number(paise) / 100;
}

/**
 * Formats a number using the Indian numbering system (e.g. 1,00,000.00).
 * @param {number} num - The number in rupees
 * @param {object} options - Formatting options
 * @returns {string} Formatted Indian number string
 */
export function formatIndianNumber(num, options = {}) {
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2
  } = options;

  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits,
    maximumFractionDigits
  }).format(num);
}

/**
 * Formats integer paise into Indian currency representation (e.g. ₹1,00,000).
 * @param {number} paise - Amount in paise
 * @param {object} options
 * @param {boolean} [options.showSymbol=true] - Whether to prepend ₹
 * @param {boolean} [options.showDecimals=false] - Whether to force 2 decimals even when zero
 * @returns {string} Formatted currency string
 */
export function formatIndianCurrency(paise, options = {}) {
  const {
    showSymbol = true,
    showDecimals = false
  } = options;

  const rupees = paiseToRupees(paise);
  const hasFractions = (Math.abs(paise) % 100) !== 0;
  const minDecimals = (showDecimals || hasFractions) ? 2 : 0;
  const maxDecimals = 2;

  const formattedNum = formatIndianNumber(rupees, {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals
  });

  return showSymbol ? `₹${formattedNum}` : formattedNum;
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

/**
 * Converts a non-negative integer rupee amount to Indian words (Lakh, Crore).
 * @param {number} num - Rupee integer
 * @returns {string} Words representation
 */
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
 * e.g., 11800000 -> "Rupees One Lakh Eighteen Thousand Only"
 * @param {number} paise - Amount in integer paise
 * @returns {string} Amount in words
 */
export function amountInWords(paise) {
  if (paise === null || paise === undefined || isNaN(Number(paise))) {
    throw new TypeError(`Invalid paise value: ${paise}`);
  }

  const isNegative = paise < 0;
  const absPaise = Math.abs(Math.round(Number(paise)));
  const rupees = Math.floor(absPaise / 100);
  const remainingPaise = absPaise % 100;

  if (rupees === 0 && remainingPaise === 0) {
    return 'Rupees Zero Only';
  }

  let result = (isNegative ? 'Minus ' : '') + 'Rupees ';

  if (rupees > 0) {
    result += integerRupeesToWords(rupees);
  } else {
    result += 'Zero';
  }

  if (remainingPaise > 0) {
    const paiseWords = convertBelowThousand(remainingPaise);
    result += ` and ${paiseWords} ${remainingPaise === 1 ? 'Paisa' : 'Paise'}`;
  }

  return `${result.trim()} Only`;
}
