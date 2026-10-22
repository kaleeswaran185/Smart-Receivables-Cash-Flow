import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../src/db.js';
import {
  rupeesToPaise,
  paiseToRupees,
  formatIndianCurrency,
  formatIndianNumber,
  amountInWords
} from '../src/lib/money.js';
import {
  validateGSTIN,
  stateFromGSTIN,
  calculateInvoice,
  computeGSTINCheckDigit,
  generateValidGSTIN
} from '../src/lib/gst.js';

describe('SPEC Tests 1 to 8: GST & Invoice Calculations', () => {
  // Real valid GSTINs generated using checksum function
  const validMHGSTIN = generateValidGSTIN('27', 'AAPFU0939F', '1'); // 27AAPFU0939F1ZV (Maharashtra)
  const validKAGSTIN = generateValidGSTIN('29', 'ABCDE1234F', '1'); // 29ABCDE1234F1ZW (Karnataka)

  test('SPEC Test 1: ₹10,000 @ 18% same state (Intra-state CGST + SGST)', () => {
    const calculation = calculateInvoice({
      business: {
        gstin: validMHGSTIN,
        regType: 'REGULAR'
      },
      customer: {
        gstin: validMHGSTIN // Same state: 27
      },
      items: [
        {
          description: 'Consulting Services',
          qty: 1,
          ratePaise: rupeesToPaise(10000),
          gstRate: 18
        }
      ]
    });

    assert.equal(calculation.invoiceType, 'Tax Invoice');
    assert.equal(calculation.isSameState, true);

    const { summary } = calculation;
    assert.equal(summary.taxablePaise, 1000000); // ₹10,000
    assert.equal(summary.cgstPaise, 90000);      // 9% = ₹900
    assert.equal(summary.sgstPaise, 90000);      // 9% = ₹900
    assert.equal(summary.igstPaise, 0);          // 0% IGST
    assert.equal(summary.totalTaxPaise, 180000);  // ₹1,800
    assert.equal(summary.roundOffPaise, 0);      // Exact rupee
    assert.equal(summary.totalPaise, 1180000);   // ₹11,800

    assert.equal(summary.formattedTotal, '₹11,800');
    assert.equal(summary.totalInWords, 'Rupees Eleven Thousand Eight Hundred Only');
  });

  test('SPEC Test 2: ₹10,000 @ 18% other state (Inter-state IGST)', () => {
    const calculation = calculateInvoice({
      business: {
        gstin: validMHGSTIN, // 27 (Maharashtra)
        regType: 'REGULAR'
      },
      customer: {
        gstin: validKAGSTIN // 29 (Karnataka)
      },
      items: [
        {
          description: 'Server Setup',
          qty: 1,
          ratePaise: rupeesToPaise(10000),
          gstRate: 18
        }
      ]
    });

    assert.equal(calculation.invoiceType, 'Tax Invoice');
    assert.equal(calculation.isSameState, false);

    const { summary } = calculation;
    assert.equal(summary.taxablePaise, 1000000); // ₹10,000
    assert.equal(summary.cgstPaise, 0);          // 0% CGST
    assert.equal(summary.sgstPaise, 0);          // 0% SGST
    assert.equal(summary.igstPaise, 180000);     // 18% = ₹1,800
    assert.equal(summary.totalTaxPaise, 180000);
    assert.equal(summary.roundOffPaise, 0);
    assert.equal(summary.totalPaise, 1180000);   // ₹11,800
  });

  test('SPEC Test 3: 3 × ₹333 @ 5% with separate Round Off line', () => {
    const calculation = calculateInvoice({
      business: {
        gstin: validMHGSTIN,
        regType: 'REGULAR'
      },
      customer: {
        gstin: validKAGSTIN // Inter-state
      },
      items: [
        {
          description: 'Widget A',
          qty: 3,
          ratePaise: rupeesToPaise(333), // 33300 paise
          gstRate: 5
        }
      ]
    });

    const { summary } = calculation;
    // 3 * 33300 = 99900 paise (₹999)
    assert.equal(summary.taxablePaise, 99900);

    // 5% of 99900 = 4995 paise (₹49.95)
    assert.equal(summary.igstPaise, 4995);
    assert.equal(summary.rawTotalPaise, 104895); // ₹1,048.95

    // Nearest rupee is ₹1,049 (104900 paise), so round off = +5 paise (+₹0.05)
    assert.equal(summary.roundOffPaise, 5);
    assert.equal(summary.totalPaise, 104900); // ₹1,049
    assert.equal(summary.formattedTotal, '₹1,049');
    assert.equal(summary.totalInWords, 'Rupees One Thousand Forty Nine Only');
  });

  test('SPEC Test 4: 10% discount calculation', () => {
    const calculation = calculateInvoice({
      business: {
        gstin: validMHGSTIN,
        regType: 'REGULAR'
      },
      customer: {
        gstin: validMHGSTIN
      },
      items: [
        {
          description: 'Premium Software License',
          qty: 1,
          ratePaise: rupeesToPaise(10000), // ₹10,000 = 1000000 paise
          discountPercent: 10,             // 10% discount = 100000 paise (₹1,000)
          gstRate: 18
        }
      ]
    });

    const { summary, items } = calculation;
    assert.equal(items[0].subtotalPaise, 1000000);
    assert.equal(items[0].discountPaise, 100000);
    assert.equal(items[0].taxablePaise, 900000); // ₹9,000

    assert.equal(summary.taxablePaise, 900000);
    assert.equal(summary.cgstPaise, 81000); // 9% of ₹9,000 = ₹810
    assert.equal(summary.sgstPaise, 81000); // 9% of ₹9,000 = ₹810
    assert.equal(summary.totalTaxPaise, 162000); // ₹1,620
    assert.equal(summary.totalPaise, 1062000);   // ₹10,620
  });

  test('SPEC Test 5: COMPOSITION business gives a Bill of Supply with no GST', () => {
    const calculation = calculateInvoice({
      business: {
        gstin: validMHGSTIN,
        regType: 'COMPOSITION'
      },
      customer: {
        gstin: validMHGSTIN
      },
      items: [
        {
          description: 'Handmade Goods',
          qty: 2,
          ratePaise: rupeesToPaise(500),
          gstRate: 18 // Should be ignored under composition
        }
      ]
    });

    assert.equal(calculation.invoiceType, 'Bill of Supply');
    assert.equal(calculation.summary.taxablePaise, 100000); // ₹1,000
    assert.equal(calculation.summary.cgstPaise, 0);
    assert.equal(calculation.summary.sgstPaise, 0);
    assert.equal(calculation.summary.igstPaise, 0);
    assert.equal(calculation.summary.totalTaxPaise, 0);
    assert.equal(calculation.summary.totalPaise, 100000);   // ₹1,000
  });

  test('SPEC Test 6: 0% GST item', () => {
    const calculation = calculateInvoice({
      business: {
        gstin: validMHGSTIN,
        regType: 'REGULAR'
      },
      customer: {
        gstin: validKAGSTIN
      },
      items: [
        {
          description: 'Exempt Food Grain',
          qty: 10,
          ratePaise: rupeesToPaise(250),
          gstRate: 0
        }
      ]
    });

    assert.equal(calculation.invoiceType, 'Tax Invoice');
    const { summary } = calculation;
    assert.equal(summary.taxablePaise, 250000); // ₹2,500
    assert.equal(summary.totalTaxPaise, 0);
    assert.equal(summary.totalPaise, 250000);
  });

  test('SPEC Test 7: an invalid GSTIN returns false', () => {
    // Bad length / invalid characters
    assert.equal(validateGSTIN('INVALID_GSTIN'), false);
    assert.equal(validateGSTIN(''), false);
    assert.equal(validateGSTIN(null), false);
    assert.equal(validateGSTIN('27AAPFU0939F1Z'), false); // Only 14 chars
    assert.equal(validateGSTIN('999AAPFU0939F1ZV'), false); // 16 chars
    assert.equal(validateGSTIN('00AAPFU0939F1ZV'), false); // Invalid state code 00
  });

  test('SPEC Test 8: one-character change failing the check digit', () => {
    // Generate an authentic valid GSTIN
    const originalValidGSTIN = generateValidGSTIN('27', 'AAPFU0939F', '1'); // "27AAPFU0939F1ZV"
    assert.equal(validateGSTIN(originalValidGSTIN), true, 'Original GSTIN must be valid');

    // Case A: Tamper check digit (15th character)
    const tamperedCheckDigit = originalValidGSTIN.substring(0, 14) + (originalValidGSTIN[14] === 'Z' ? 'A' : 'Z');
    assert.equal(validateGSTIN(tamperedCheckDigit), false, 'Tampered check digit must fail validation');

    // Case B: Tamper one internal character (e.g. 5th char of PAN) while keeping format valid
    const chars = originalValidGSTIN.split('');
    chars[4] = chars[4] === 'A' ? 'B' : 'A';
    const tamperedInternal = chars.join('');
    assert.equal(validateGSTIN(tamperedInternal), false, 'Tampered body character must fail checksum');
  });
});

describe('Database Foundation & Schema Integrity', () => {
  test('creates all 11 required tables with foreign keys enabled', () => {
    const db = createDatabase(':memory:');

    const expectedTables = [
      'business',
      'customers',
      'invoices',
      'invoice_items',
      'payments',
      'expenses',
      'reminders',
      'disputes',
      'promises',
      'documents',
      'settings'
    ];

    const actualTables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all().map(r => r.name);

    for (const table of expectedTables) {
      assert.ok(actualTables.includes(table), `Table '${table}' should exist in database`);
    }

    // Verify foreign key pragma is enabled
    const fkPragma = db.pragma('foreign_keys', { simple: true });
    assert.equal(fkPragma, 1, 'Foreign keys pragma must be enabled');
  });

  test('stores all money amounts as INTEGER paise in business transactions', () => {
    const db = createDatabase(':memory:');

    // Insert business
    const insertBiz = db.prepare(`
      INSERT INTO business (name, gstin, reg_type, state_code, state)
      VALUES (?, ?, ?, ?, ?)
    `).run('Acme Corp', '27AAPFU0939F1ZV', 'REGULAR', '27', 'Maharashtra');

    const businessId = insertBiz.lastInsertRowid;

    // Insert customer
    const insertCust = db.prepare(`
      INSERT INTO customers (business_id, name, gstin, state_code, state, credit_limit_paise)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(businessId, 'Beta Retailers', '29ABCDE1234F1ZW', '29', 'Karnataka', 5000000); // ₹50,000 credit limit

    const customerId = insertCust.lastInsertRowid;

    // Insert invoice
    const insertInv = db.prepare(`
      INSERT INTO invoices (
        business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, place_of_supply,
        subtotal_paise, taxable_paise, igst_paise, round_off_paise, total_paise, balance_paise
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      businessId, customerId, 'INV-2026-001', 'Tax Invoice', '2026-10-22', '2026-11-21', 'Karnataka',
      1000000, 1000000, 180000, 0, 1180000, 1180000
    );

    const invoiceId = insertInv.lastInsertRowid;

    // Verify inserted invoice values are integers
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
    assert.equal(Number.isInteger(invoice.subtotal_paise), true);
    assert.equal(Number.isInteger(invoice.taxable_paise), true);
    assert.equal(Number.isInteger(invoice.igst_paise), true);
    assert.equal(Number.isInteger(invoice.total_paise), true);
    assert.equal(invoice.total_paise, 1180000);
  });
});

describe('Money Helpers: Formatting & Amount in Words', () => {
  test('rupees <-> paise conversions', () => {
    assert.equal(rupeesToPaise(100), 10000);
    assert.equal(rupeesToPaise(100.50), 10050);
    assert.equal(rupeesToPaise('100.25'), 10025);
    assert.equal(paiseToRupees(10000), 100);
    assert.equal(paiseToRupees(10050), 100.5);
  });

  test('Indian currency formatting with Lakhs and Crores', () => {
    assert.equal(formatIndianCurrency(1000000), '₹10,000');
    assert.equal(formatIndianCurrency(10000000), '₹1,00,000');
    assert.equal(formatIndianCurrency(11800000), '₹1,18,000');
    assert.equal(formatIndianCurrency(1000000000), '₹1,00,00,000');
    assert.equal(formatIndianCurrency(104895), '₹1,048.95');
  });

  test('Amount in words (Lakh/Crore format)', () => {
    assert.equal(amountInWords(11800000), 'Rupees One Lakh Eighteen Thousand Only');
    assert.equal(amountInWords(10000000), 'Rupees One Lakh Only');
    assert.equal(amountInWords(1000000), 'Rupees Ten Thousand Only');
    assert.equal(amountInWords(1000000000), 'Rupees One Crore Only');
    assert.equal(amountInWords(104895), 'Rupees One Thousand Forty Eight and Ninety Five Paise Only');
    assert.equal(amountInWords(0), 'Rupees Zero Only');
  });
});

describe('GST State Code Mapping', () => {
  test('extracts state name from GSTIN or 2-digit state code', () => {
    assert.equal(stateFromGSTIN('27AAPFU0939F1ZV'), 'Maharashtra');
    assert.equal(stateFromGSTIN('29ABCDE1234F1ZW'), 'Karnataka');
    assert.equal(stateFromGSTIN('33AAACL1968M1ZA'), 'Tamil Nadu');
    assert.equal(stateFromGSTIN('07AAAAA0000A1Z5'), 'Delhi');
    assert.equal(stateFromGSTIN('27'), 'Maharashtra');
    assert.equal(stateFromGSTIN('99'), 'Centre Jurisdiction');
    assert.equal(stateFromGSTIN('98'), null);
  });
});
