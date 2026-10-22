/**
 * GST validation, state mapping, and invoice calculation utilities.
 */

import { amountInWords, formatIndianCurrency } from './money.js';

export const GST_BASE36_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const ALLOWED_GST_RATES = [0, 3, 5, 12, 18, 28, 40];

export const STATE_CODES = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction'
};

/**
 * Computes the 15th check digit for a 14-character GSTIN prefix using Mod-36 algorithm.
 * @param {string} first14 - First 14 characters of GSTIN
 * @returns {string} 15th check character
 */
export function computeGSTINCheckDigit(first14) {
  if (!first14 || typeof first14 !== 'string' || first14.length !== 14) {
    throw new Error('Prefix must be exactly 14 characters');
  }

  const clean = first14.trim().toUpperCase();
  let sum = 0;

  for (let i = 0; i < 14; i++) {
    const char = clean[i];
    const digitValue = GST_BASE36_CHARS.indexOf(char);
    if (digitValue === -1) {
      throw new Error(`Invalid character '${char}' in GSTIN prefix at position ${i}`);
    }

    // Alternating weights: index 0 is 1, index 1 is 2, index 2 is 1, etc.
    const multiplier = (i % 2 === 0) ? 1 : 2;
    let product = digitValue * multiplier;

    // Base-36 digit sum reduction
    product = Math.floor(product / 36) + (product % 36);
    sum += product;
  }

  const remainder = sum % 36;
  const checkCodeIndex = (36 - remainder) % 36;
  return GST_BASE36_CHARS[checkCodeIndex];
}

/**
 * Generates a valid 15-character GSTIN.
 * @param {string} [stateCode='27'] - 2-digit state code
 * @param {string} [pan='AAPFU0939F'] - 10-char PAN
 * @param {string} [entityNumber='1'] - 1-char entity number
 * @returns {string} Full valid 15-char GSTIN
 */
export function generateValidGSTIN(stateCode = '27', pan = 'AAPFU0939F', entityNumber = '1') {
  const prefix = `${stateCode}${pan}${entityNumber}Z`;
  const checkDigit = computeGSTINCheckDigit(prefix);
  return `${prefix}${checkDigit}`;
}

/**
 * Validates a 15-character GSTIN structure and its base-36 mod 36 check digit.
 * @param {string} gstin - GSTIN string to validate
 * @returns {boolean} True if format and checksum are valid
 */
export function validateGSTIN(gstin) {
  if (!gstin || typeof gstin !== 'string') {
    return false;
  }

  const cleanGstin = gstin.trim().toUpperCase();

  // 1. Structural Regex Check
  // 2 digits (state) + 5 letters (PAN) + 4 digits + 1 letter + 1 entity char (1-9 or A-Z) + 'Z' + 1 check char
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstinRegex.test(cleanGstin)) {
    return false;
  }

  // 2. Validate state code
  const stateCode = cleanGstin.substring(0, 2);
  if (!STATE_CODES[stateCode]) {
    return false;
  }

  // 3. Mod-36 Checksum Validation
  const first14 = cleanGstin.substring(0, 14);
  const actualCheckChar = cleanGstin[14];
  const expectedCheckChar = computeGSTINCheckDigit(first14);

  return expectedCheckChar === actualCheckChar;
}

/**
 * Returns the state name from a GSTIN or 2-digit state code.
 * @param {string} gstinOrCode - GSTIN (e.g. "27AAPFU0939F1ZV") or state code (e.g. "27")
 * @returns {string|null} State name, or null if invalid
 */
export function stateFromGSTIN(gstinOrCode) {
  if (!gstinOrCode || typeof gstinOrCode !== 'string') {
    return null;
  }

  const clean = gstinOrCode.trim().toUpperCase();
  const stateCode = clean.length >= 2 ? clean.substring(0, 2) : clean;
  return STATE_CODES[stateCode] || null;
}

/**
 * Normalizes a state code or name into a canonical 2-digit state code.
 * @param {string} codeOrName
 * @returns {string|null} 2-digit code or null
 */
export function normalizeStateCode(codeOrName) {
  if (!codeOrName || typeof codeOrName !== 'string') return null;
  const clean = codeOrName.trim().toUpperCase();
  if (STATE_CODES[clean]) return clean;
  // If starts with 2 digits that are valid state code
  if (/^[0-9]{2}/.test(clean) && STATE_CODES[clean.substring(0, 2)]) {
    return clean.substring(0, 2);
  }
  // Check matching state name
  for (const [code, name] of Object.entries(STATE_CODES)) {
    if (name.toUpperCase() === clean) return code;
  }
  return null;
}

/**
 * Calculates line items, GST breakdown (CGST+SGST vs IGST), round off, and totals for an invoice.
 *
 * Rules:
 * - per-line taxable = qty * rate - discount
 * - CGST+SGST if same state, IGST otherwise
 * - Rates: 0, 3, 5, 12, 18, 28, 40
 * - Separate Round Off line (nearest rupee)
 * - REGULAR gives a "Tax Invoice"
 * - COMPOSITION gives a "Bill of Supply" with no GST
 * - UNREGISTERED gives an "Invoice" (plain invoice)
 *
 * @param {object} params
 * @param {object} params.business - Business info { gstin, stateCode, state, regType }
 * @param {object} params.customer - Customer info { gstin, stateCode, state }
 * @param {Array<object>} params.items - Items [{ qty, ratePaise, discountPaise, discountPercent, gstRate, description, hsnCode }]
 * @param {string} [params.placeOfSupply] - Optional place of supply state code/name
 * @returns {object} Calculated invoice object with line items, tax breakdown, round off, and totals
 */
export function calculateInvoice({ business = {}, customer = {}, items = [], placeOfSupply = null }) {
  const regType = (business.regType || business.reg_type || 'REGULAR').toUpperCase();

  let invoiceType = 'Tax Invoice';
  let isGSTApplicable = true;

  if (regType === 'COMPOSITION') {
    invoiceType = 'Bill of Supply';
    isGSTApplicable = false;
  } else if (regType === 'UNREGISTERED') {
    invoiceType = 'Invoice';
    isGSTApplicable = false;
  } else {
    invoiceType = 'Tax Invoice';
    isGSTApplicable = true;
  }

  // Determine normalized state codes
  const businessStateCode = normalizeStateCode(business.stateCode || (business.gstin ? business.gstin.substring(0, 2) : business.state));
  const customerStateCode = normalizeStateCode(customer.stateCode || (customer.gstin ? customer.gstin.substring(0, 2) : customer.state));
  const posCode = normalizeStateCode(placeOfSupply) || customerStateCode;

  // Same state (Intra-state) check
  const isSameState = Boolean(businessStateCode && posCode && businessStateCode === posCode);

  let subtotalPaise = 0;
  let discountPaise = 0;
  let taxablePaise = 0;
  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;

  const calculatedItems = items.map((item, index) => {
    const qty = Number(item.qty !== undefined ? item.qty : 1);
    const ratePaise = Math.round(Number(item.ratePaise !== undefined ? item.ratePaise : (item.rate ? item.rate * 100 : 0)));
    const lineSubtotalPaise = Math.round(qty * ratePaise);

    let lineDiscountPaise = 0;
    if (item.discountPaise !== undefined) {
      lineDiscountPaise = Math.round(Number(item.discountPaise));
    } else if (item.discountPercent !== undefined) {
      lineDiscountPaise = Math.round((lineSubtotalPaise * Number(item.discountPercent)) / 100);
    } else if (item.discount !== undefined) {
      lineDiscountPaise = Math.round(Number(item.discount));
    }

    const lineTaxablePaise = Math.max(0, lineSubtotalPaise - lineDiscountPaise);
    const gstRate = Number(item.gstRate !== undefined ? item.gstRate : (item.taxRate || 0));

    let lineCgstPaise = 0;
    let lineSgstPaise = 0;
    let lineIgstPaise = 0;

    if (isGSTApplicable && gstRate > 0) {
      if (isSameState) {
        // CGST + SGST (split evenly)
        const halfRate = gstRate / 2;
        lineCgstPaise = Math.round(lineTaxablePaise * (halfRate / 100));
        lineSgstPaise = Math.round(lineTaxablePaise * (halfRate / 100));
      } else {
        // IGST
        lineIgstPaise = Math.round(lineTaxablePaise * (gstRate / 100));
      }
    }

    const lineTotalTaxPaise = lineCgstPaise + lineSgstPaise + lineIgstPaise;
    const lineTotalPaise = lineTaxablePaise + lineTotalTaxPaise;

    subtotalPaise += lineSubtotalPaise;
    discountPaise += lineDiscountPaise;
    taxablePaise += lineTaxablePaise;
    cgstPaise += lineCgstPaise;
    sgstPaise += lineSgstPaise;
    igstPaise += lineIgstPaise;

    return {
      itemIndex: index + 1,
      description: item.description || '',
      hsnCode: item.hsnCode || item.hsn || '',
      qty,
      unit: item.unit || 'NOS',
      ratePaise,
      subtotalPaise: lineSubtotalPaise,
      discountPaise: lineDiscountPaise,
      taxablePaise: lineTaxablePaise,
      gstRate,
      cgstPaise: lineCgstPaise,
      sgstPaise: lineSgstPaise,
      igstPaise: lineIgstPaise,
      totalTaxPaise: lineTotalTaxPaise,
      totalPaise: lineTotalPaise,
      formattedRate: formatIndianCurrency(ratePaise),
      formattedTaxable: formatIndianCurrency(lineTaxablePaise),
      formattedTotal: formatIndianCurrency(lineTotalPaise)
    };
  });

  const totalTaxPaise = cgstPaise + sgstPaise + igstPaise;
  const rawTotalPaise = taxablePaise + totalTaxPaise;

  // Round off to the nearest Rupee (100 paise)
  const roundedTotalPaise = Math.round(rawTotalPaise / 100) * 100;
  const roundOffPaise = roundedTotalPaise - rawTotalPaise;
  const totalPaise = roundedTotalPaise;

  return {
    invoiceType,
    businessRegType: regType,
    isSameState,
    businessState: stateFromGSTIN(businessStateCode) || business.state || null,
    customerState: stateFromGSTIN(customerStateCode) || customer.state || null,
    placeOfSupply: stateFromGSTIN(posCode) || placeOfSupply || null,
    items: calculatedItems,
    summary: {
      subtotalPaise,
      discountPaise,
      taxablePaise,
      cgstPaise,
      sgstPaise,
      igstPaise,
      totalTaxPaise,
      rawTotalPaise,
      roundOffPaise,
      totalPaise,
      formattedSubtotal: formatIndianCurrency(subtotalPaise),
      formattedDiscount: formatIndianCurrency(discountPaise),
      formattedTaxable: formatIndianCurrency(taxablePaise),
      formattedCGST: formatIndianCurrency(cgstPaise),
      formattedSGST: formatIndianCurrency(sgstPaise),
      formattedIGST: formatIndianCurrency(igstPaise),
      formattedTotalTax: formatIndianCurrency(totalTaxPaise),
      formattedRoundOff: formatIndianCurrency(roundOffPaise, { showSymbol: false, showDecimals: true }),
      formattedTotal: formatIndianCurrency(totalPaise),
      totalInWords: amountInWords(totalPaise)
    }
  };
}
