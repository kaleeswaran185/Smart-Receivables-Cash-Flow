import crypto from 'crypto';
import { rupeesToPaise, formatIndianCurrency } from './money.js';

/**
 * Parses raw CSV line taking quotes into account.
 */
function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(cur.trim().replace(/^["']|["']$/g, ''));
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim().replace(/^["']|["']$/g, ''));
  return result;
}

/**
 * Normalizes dates like DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD into YYYY-MM-DD.
 */
function normalizeDate(rawDate) {
  if (!rawDate) return new Date().toISOString().slice(0, 10);
  const clean = rawDate.trim().replace(/[/.]/g, '-');
  
  // DD-MM-YYYY
  const dmyMatch = clean.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // YYYY-MM-DD
  const ymdMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return clean;
}

/**
 * Parses numeric Indian amount strings (e.g. "11,800.00", "₹ 9,800") into paise.
 */
function parseAmountPaise(raw) {
  if (typeof raw === 'number') return Math.round(raw * 100);
  if (!raw || typeof raw !== 'string') return 0;
  const cleaned = raw.replace(/[₹, \s]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100);
}

/**
 * Generates a deterministic SHA-256 hash for idempotent statement deduplication.
 */
export function computeTxHash(tx) {
  const normalized = [
    tx.tx_date || '',
    (tx.narration || '').trim().toUpperCase(),
    tx.amount_paise || 0,
    (tx.ref_no || '').trim().toUpperCase()
  ].join('|');

  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Parses a bank statement CSV string into structured transactions.
 */
export function parseBankCSV(csvText) {
  if (!csvText || typeof csvText !== 'string') {
    throw new Error('CSV content must be a non-empty string');
  }

  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    throw new Error('CSV must contain a header row and at least one transaction row');
  }

  // Find header row
  let headerIndex = -1;
  let headers = [];

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cols = parseCSVLine(lines[i]).map(c => c.toLowerCase());
    const hasDate = cols.some(c => c.includes('date'));
    const hasNarration = cols.some(c => c.includes('narr') || c.includes('desc') || c.includes('particular') || c.includes('remark'));
    const hasAmount = cols.some(c => c.includes('credit') || c.includes('deposit') || c.includes('amount') || c.includes('cr'));

    if (hasDate && (hasNarration || hasAmount)) {
      headerIndex = i;
      headers = cols;
      break;
    }
  }

  if (headerIndex === -1) {
    // Fallback: assume first line is header
    headerIndex = 0;
    headers = parseCSVLine(lines[0]).map(c => c.toLowerCase());
  }

  // Map column positions
  const dateCol = headers.findIndex(c => c.includes('date'));
  const narrationCol = headers.findIndex(c => c.includes('narr') || c.includes('desc') || c.includes('particular') || c.includes('remark'));
  const refCol = headers.findIndex(c => c.includes('chq') || c.includes('ref') || c.includes('utr') || c.includes('cheque') || c.includes('txn id'));
  const creditCol = headers.findIndex(c => c.includes('credit') || c.includes('deposit') || c.includes('cr'));
  const debitCol = headers.findIndex(c => c.includes('debit') || c.includes('withdrawal') || c.includes('dr'));
  const amountCol = headers.findIndex(c => c === 'amount' || c.includes('net amount'));

  const transactions = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine || rawLine.startsWith('#')) continue;

    const row = parseCSVLine(rawLine);
    if (row.length === 0 || row.every(val => !val)) continue;

    const rawDate = dateCol !== -1 ? row[dateCol] : '';
    const narration = narrationCol !== -1 ? row[narrationCol] : '';
    const refNo = refCol !== -1 ? row[refCol] : '';

    let creditPaise = 0;
    let debitPaise = 0;

    if (creditCol !== -1 && row[creditCol]) {
      creditPaise = parseAmountPaise(row[creditCol]);
    }
    if (debitCol !== -1 && row[debitCol]) {
      debitPaise = parseAmountPaise(row[debitCol]);
    }

    if (creditPaise === 0 && amountCol !== -1 && row[amountCol]) {
      // If single amount column and no debit specified, consider as credit if positive
      const val = parseAmountPaise(row[amountCol]);
      if (val > 0) creditPaise = val;
    }

    // Skip debit transactions (only process incoming money/credits for receivables reconciliation)
    if (creditPaise <= 0) {
      continue;
    }

    const txDate = normalizeDate(rawDate);
    const tx = {
      tx_date: txDate,
      narration: narration || 'Bank Credit',
      ref_no: refNo || '',
      amount_paise: creditPaise,
      formatted_amount: formatIndianCurrency(creditPaise),
      tx_type: 'CREDIT'
    };

    tx.tx_hash = computeTxHash(tx);
    transactions.push(tx);
  }

  return transactions;
}

/**
 * Checks for TDS shortfalls (1%, 2%, 10%) on an invoice balance.
 */
function checkTDSHint(receivedPaise, invoiceBalancePaise, invoiceTaxablePaise) {
  const rates = [0.1, 1, 2, 10];
  
  // Check TDS on gross invoice balance
  for (const rate of rates) {
    const tdsPaise = Math.round(invoiceBalancePaise * (rate / 100));
    const expectedNet = invoiceBalancePaise - tdsPaise;
    
    // Allow +/- 100 paise (₹1) tolerance for rupee rounding
    if (Math.abs(receivedPaise - expectedNet) <= 100) {
      const sectionNote = rate === 0.1 ? 'Section 194Q' : 'Section 194C/J';
      return {
        detected: true,
        rate_percent: rate,
        tds_amount_paise: tdsPaise,
        expected_full_amount_paise: invoiceBalancePaise,
        formatted_tds: formatIndianCurrency(tdsPaise),
        note: `${rate}% TDS deduction detected (${sectionNote}). Shortfall: ${formatIndianCurrency(tdsPaise)}`
      };
    }
  }

  // Also check TDS on taxable value (some businesses deduct TDS on taxable amount only before GST)
  if (invoiceTaxablePaise && invoiceTaxablePaise !== invoiceBalancePaise) {
    for (const rate of rates) {
      const tdsPaise = Math.round(invoiceTaxablePaise * (rate / 100));
      const expectedNet = invoiceBalancePaise - tdsPaise;
      if (Math.abs(receivedPaise - expectedNet) <= 100) {
        return {
          detected: true,
          rate_percent: rate,
          tds_amount_paise: tdsPaise,
          expected_full_amount_paise: invoiceBalancePaise,
          formatted_tds: formatIndianCurrency(tdsPaise),
          note: `${rate}% TDS on taxable amount detected. Shortfall: ${formatIndianCurrency(tdsPaise)}`
        };
      }
    }
  }

  return { detected: false };
}

/**
 * Matches a bank transaction against open invoices and customers in database.
 * Returns match details, confidence level ('HIGH', 'MEDIUM', 'LOW', 'NONE'),
 * human-readable reason, and TDS hints.
 */
export function matchBankTransaction(tx, db) {
  const upperNarr = (tx.narration || '').toUpperCase();
  const txPaise = tx.amount_paise;

  // Fetch all open/unpaid invoices
  const openInvoices = db.prepare(`
    SELECT
      i.*,
      c.name as customer_name,
      c.company_name as customer_company
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.status NOT IN ('PAID', 'CANCELLED', 'DRAFT')
    ORDER BY i.due_date ASC
  `).all();

  // Fetch all customers
  const customers = db.prepare('SELECT id, name, company_name FROM customers').all();

  // 1. MATCH BY INVOICE NUMBER
  for (const inv of openInvoices) {
    const invNum = inv.invoice_number.toUpperCase();
    const invNumNoHyphen = invNum.replace(/[^A-Z0-9]/g, '');
    const cleanNarr = upperNarr.replace(/[^A-Z0-9]/g, '');

    const hasDirectMatch = upperNarr.includes(invNum) || (invNumNoHyphen.length >= 4 && cleanNarr.includes(invNumNoHyphen));

    // Also match end sequence of invoice (e.g. "1001" from "INV-2026-1001") if prefixed by INV or preceded by space/slash
    const seqMatch = invNum.match(/\d{4}$/);
    const hasSeqMatch = seqMatch && new RegExp(`(?:INV|INVOICE|REF|BILL)?[-/\\s]?${seqMatch[0]}\\b`, 'i').test(upperNarr);

    if (hasDirectMatch || hasSeqMatch) {
      const tdsHint = checkTDSHint(txPaise, inv.balance_paise, inv.taxable_paise);

      if (inv.balance_paise === txPaise || Math.abs(inv.balance_paise - txPaise) <= 100) {
        return {
          confidence: 'HIGH',
          match_reason: `Matched invoice #${inv.invoice_number} and exact outstanding balance of ${formatIndianCurrency(inv.balance_paise)}`,
          matched_invoice: inv,
          matched_invoice_id: inv.id,
          matched_customer_id: inv.customer_id,
          customer_name: inv.customer_name,
          tds_hint: { detected: false }
        };
      }

      if (tdsHint.detected) {
        return {
          confidence: 'HIGH',
          match_reason: `Matched invoice #${inv.invoice_number} with ${tdsHint.rate_percent}% TDS shortfall (${tdsHint.formatted_tds} deducted)`,
          matched_invoice: inv,
          matched_invoice_id: inv.id,
          matched_customer_id: inv.customer_id,
          customer_name: inv.customer_name,
          tds_hint: tdsHint
        };
      }

      if (txPaise < inv.balance_paise) {
        return {
          confidence: 'MEDIUM',
          match_reason: `Matched invoice #${inv.invoice_number} (Partial payment of ${formatIndianCurrency(txPaise)} against balance ${formatIndianCurrency(inv.balance_paise)})`,
          matched_invoice: inv,
          matched_invoice_id: inv.id,
          matched_customer_id: inv.customer_id,
          customer_name: inv.customer_name,
          tds_hint: { detected: false }
        };
      }

      return {
        confidence: 'MEDIUM',
        match_reason: `Matched invoice #${inv.invoice_number} (Amount ${formatIndianCurrency(txPaise)} exceeds balance ${formatIndianCurrency(inv.balance_paise)})`,
        matched_invoice: inv,
        matched_invoice_id: inv.id,
        matched_customer_id: inv.customer_id,
        customer_name: inv.customer_name,
        tds_hint: { detected: false }
      };
    }
  }

  // 2. MATCH BY CUSTOMER NAME
  for (const cust of customers) {
    const custName = (cust.name || '').trim().toUpperCase();
    const custCompany = (cust.company_name || '').trim().toUpperCase();

    // Check if substantial tokens of customer name appear in narration
    const tokens = [custName, custCompany]
      .filter(Boolean)
      .flatMap(name => name.split(/[\s,.-]+/))
      .filter(t => t.length >= 4 && !['PVT', 'LTD', 'INDIA', 'CORP', 'ENTERPRISE'].includes(t));

    const matchedToken = tokens.find(t => upperNarr.includes(t));

    if (matchedToken) {
      // Find open invoices for this customer
      const custInvoices = openInvoices.filter(i => i.customer_id === cust.id);

      if (custInvoices.length > 0) {
        // Try exact balance match
        const exactMatch = custInvoices.find(i => i.balance_paise === txPaise || Math.abs(i.balance_paise - txPaise) <= 100);
        if (exactMatch) {
          return {
            confidence: 'HIGH',
            match_reason: `Matched customer '${cust.name}' and exact balance of invoice #${exactMatch.invoice_number} (${formatIndianCurrency(exactMatch.balance_paise)})`,
            matched_invoice: exactMatch,
            matched_invoice_id: exactMatch.id,
            matched_customer_id: cust.id,
            customer_name: cust.name,
            tds_hint: { detected: false }
          };
        }

        // Try TDS shortfall match
        for (const inv of custInvoices) {
          const tdsHint = checkTDSHint(txPaise, inv.balance_paise, inv.taxable_paise);
          if (tdsHint.detected) {
            return {
              confidence: 'HIGH',
              match_reason: `Matched customer '${cust.name}' with ${tdsHint.rate_percent}% TDS deduction on invoice #${inv.invoice_number}`,
              matched_invoice: inv,
              matched_invoice_id: inv.id,
              matched_customer_id: cust.id,
              customer_name: cust.name,
              tds_hint: tdsHint
            };
          }
        }

        // Return oldest open invoice as partial/candidate
        const oldestInv = custInvoices[0];
        return {
          confidence: 'MEDIUM',
          match_reason: `Matched customer '${cust.name}' (Invoice #${oldestInv.invoice_number} open with balance ${formatIndianCurrency(oldestInv.balance_paise)})`,
          matched_invoice: oldestInv,
          matched_invoice_id: oldestInv.id,
          matched_customer_id: cust.id,
          customer_name: cust.name,
          tds_hint: { detected: false }
        };
      }
    }
  }

  // 3. MATCH BY AMOUNT ONLY ACROSS ALL INVOICES
  const exactAmountInvoices = openInvoices.filter(i => i.balance_paise === txPaise);
  if (exactAmountInvoices.length === 1) {
    const singleInv = exactAmountInvoices[0];
    return {
      confidence: 'MEDIUM',
      match_reason: `Exact amount match with invoice #${singleInv.invoice_number} (${singleInv.customer_name})`,
      matched_invoice: singleInv,
      matched_invoice_id: singleInv.id,
      matched_customer_id: singleInv.customer_id,
      customer_name: singleInv.customer_name,
      tds_hint: { detected: false }
    };
  }

  if (exactAmountInvoices.length > 1) {
    return {
      confidence: 'LOW',
      match_reason: `Amount matches ${exactAmountInvoices.length} open invoices (${exactAmountInvoices.map(i => i.invoice_number).join(', ')})`,
      matched_invoice: exactAmountInvoices[0],
      matched_invoice_id: exactAmountInvoices[0].id,
      matched_customer_id: exactAmountInvoices[0].customer_id,
      customer_name: exactAmountInvoices[0].customer_name,
      tds_hint: { detected: false }
    };
  }

  // Check TDS match across any open invoice
  for (const inv of openInvoices) {
    const tdsHint = checkTDSHint(txPaise, inv.balance_paise, inv.taxable_paise);
    if (tdsHint.detected) {
      return {
        confidence: 'LOW',
        match_reason: `Amount matches invoice #${inv.invoice_number} (${inv.customer_name}) with ${tdsHint.rate_percent}% TDS deduction`,
        matched_invoice: inv,
        matched_invoice_id: inv.id,
        matched_customer_id: inv.customer_id,
        customer_name: inv.customer_name,
        tds_hint: tdsHint
      };
    }
  }

  // 4. NO MATCH
  return {
    confidence: 'NONE',
    match_reason: `No matching invoice or customer found for credit of ${formatIndianCurrency(txPaise)}`,
    matched_invoice: null,
    matched_invoice_id: null,
    matched_customer_id: null,
    customer_name: null,
    tds_hint: { detected: false }
  };
}
