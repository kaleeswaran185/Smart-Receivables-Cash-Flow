import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from '../src/app.js';
import { createDatabase, setDatabase, closeDatabase } from '../src/db.js';
import { seedDatabase } from '../src/seed.js';
import { parseBankCSV, matchBankTransaction } from '../src/lib/bankMatcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('SPEC Section 18: Bank CSV Import, Reconciliation & Matching Engine', () => {
  let server;
  let baseUrl;
  let db;

  const sampleCSVPath = path.resolve(__dirname, '../data/sample_bank_statement.csv');
  let sampleCSVContent;

  before(async () => {
    sampleCSVContent = fs.readFileSync(sampleCSVPath, 'utf8');

    process.env.DATABASE_PATH = ':memory:';
    db = createDatabase(':memory:');
    seedDatabase(db, { force: true });
    setDatabase(db);

    const app = createApp();
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}/api`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    closeDatabase();
  });

  test('18.1: CSV Parser handles quotes, commas in Indian amounts, and filters debits', () => {
    const parsed = parseBankCSV(sampleCSVContent);
    assert.ok(Array.isArray(parsed));
    // Sample CSV has 7 rows total: 6 credits and 1 debit
    assert.equal(parsed.length, 6, 'Should extract exactly the 6 credit transactions, ignoring debit row');

    // First row verification
    const first = parsed[0];
    assert.equal(first.tx_date, '2026-10-23');
    assert.equal(first.amount_paise, 4043600); // ₹40,436.00
    assert.ok(first.narration.includes('APEX LOGISTICS PUNE'));
    assert.equal(first.ref_no, 'HDFCN26296001245');
    assert.ok(first.tx_hash, 'Must generate deterministic SHA-256 hash');
  });

  test('18.2: Matches invoice by invoice number and exact amount with HIGH confidence', () => {
    const tx = {
      tx_date: '2026-10-23',
      narration: 'NEFT-HDFC-INV-2026-1023-APEX LOGISTICS PUNE',
      ref_no: 'HDFCN26296001245',
      amount_paise: 4043600 // ₹40,436.00 matches INV-2026-1023 balance
    };

    const match = matchBankTransaction(tx, db);
    assert.equal(match.confidence, 'HIGH');
    assert.ok(match.matched_invoice);
    assert.equal(match.matched_invoice.invoice_number, 'INV-2026-1023');
    assert.ok(match.match_reason.includes('Matched invoice #INV-2026-1023'));
    assert.equal(match.tds_hint.detected, false);
  });

  test('18.3: Matches by customer name when invoice number is absent in narration', () => {
    const tx = {
      tx_date: '2026-10-23',
      narration: 'UPI/428192837192/BENGALURU FRESH FOODS/INVOICE SETTLEMENT',
      ref_no: 'UPI428192837192',
      amount_paise: 1697900 // Exact balance of INV-2026-1024
    };

    const match = matchBankTransaction(tx, db);
    assert.equal(match.confidence, 'HIGH');
    assert.ok(match.matched_invoice);
    assert.equal(match.matched_invoice.invoice_number, 'INV-2026-1024');
    assert.ok(match.match_reason.includes('Bengaluru Fresh Foods'));
  });

  test('18.4: Detects 2% TDS shortfall with high confidence and calculation hint', () => {
    // Gujarat Pharma Pack invoice INV-2026-1025 balance is ₹1,22,448 (12244800 paise)
    // 2% TDS = ₹2,449 (244900 paise) -> net received = ₹1,19,999 (11999900 paise)
    const tx = {
      tx_date: '2026-10-24',
      narration: 'RTGS/BARB0123/INV-2026-1025/GUJARAT PHARMA 2PCT TDS',
      ref_no: 'BARBR52026102401',
      amount_paise: 11999900
    };

    const match = matchBankTransaction(tx, db);
    assert.equal(match.confidence, 'HIGH');
    assert.ok(match.matched_invoice);
    assert.equal(match.matched_invoice.invoice_number, 'INV-2026-1025');
    assert.equal(match.tds_hint.detected, true);
    assert.equal(match.tds_hint.rate_percent, 2);
    assert.ok(match.match_reason.includes('2% TDS'));
    assert.ok(match.tds_hint.tds_amount_paise > 0);
  });

  test('18.5: Detects 1% TDS shortfall hint', () => {
    // Chennai Textiles invoice INV-2026-1026 balance is ₹1,06,260 (10626000 paise)
    // 1% TDS = ₹1,063 -> net received = ₹1,05,197 (10519700 paise)
    const tx = {
      tx_date: '2026-10-24',
      narration: 'NEFT/UTIB00021/CHENNAI TEXTILES/INV-2026-1026 1PCT TDS',
      ref_no: 'UTIBN26297003412',
      amount_paise: 10519700
    };

    const match = matchBankTransaction(tx, db);
    assert.equal(match.confidence, 'HIGH');
    assert.equal(match.tds_hint.detected, true);
    assert.equal(match.tds_hint.rate_percent, 1);
  });

  test('18.6: Detects 10% TDS shortfall hint on professional/contract invoices', () => {
    // Kolkata Jute invoice INV-2026-1021 balance is ₹5,623.20 (562320 paise)
    // 10% TDS = ₹562 -> net received = ₹5,061 (506100 paise)
    const tx = {
      tx_date: '2026-10-25',
      narration: 'RTGS/KOLKATA JUTE/INV-2026-1021 10PCT TDS CONTRACT',
      ref_no: 'KOLKR52026102509',
      amount_paise: 506100
    };

    const match = matchBankTransaction(tx, db);
    assert.equal(match.confidence, 'HIGH');
    assert.equal(match.tds_hint.detected, true);
    assert.equal(match.tds_hint.rate_percent, 10);
  });

  test('18.7: Rule - "Nothing paid until I confirm": Preview does NOT modify invoice balance or payments', async () => {
    // Check invoice 1023 balance before preview
    const invBefore = db.prepare("SELECT balance_paise, paid_paise, status FROM invoices WHERE invoice_number = 'INV-2026-1023'").get();
    const paymentsCountBefore = db.prepare('SELECT COUNT(*) as count FROM payments').get().count;

    // Call POST /api/bank-import/preview
    const res = await fetch(`${baseUrl}/bank-import/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv_content: sampleCSVContent })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.transactions.length, 6);
    assert.ok(body.summary.high_confidence >= 3);

    // Verify invoice balance and payment counts remain COMPLETELY UNTOUCHED
    const invAfter = db.prepare("SELECT balance_paise, paid_paise, status FROM invoices WHERE invoice_number = 'INV-2026-1023'").get();
    const paymentsCountAfter = db.prepare('SELECT COUNT(*) as count FROM payments').get().count;

    assert.equal(invAfter.balance_paise, invBefore.balance_paise, 'Balance must NOT change on preview');
    assert.equal(invAfter.paid_paise, invBefore.paid_paise, 'Paid amount must NOT change on preview');
    assert.equal(invAfter.status, invBefore.status, 'Status must NOT change on preview');
    assert.equal(paymentsCountAfter, paymentsCountBefore, 'No payments may be created on preview');
  });

  test('18.8: Idempotent re-import: duplicate CSV import identifies duplicate entries and does not duplicate records', async () => {
    // Save first import
    const saveRes1 = await fetch(`${baseUrl}/bank-import/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv_content: sampleCSVContent })
    });
    assert.equal(saveRes1.status, 200);
    const save1 = await saveRes1.json();
    assert.equal(save1.inserted, 6);
    assert.equal(save1.skipped_duplicates, 0);

    // Re-import EXACT SAME CSV
    const saveRes2 = await fetch(`${baseUrl}/bank-import/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv_content: sampleCSVContent })
    });
    assert.equal(saveRes2.status, 200);
    const save2 = await saveRes2.json();
    assert.equal(save2.inserted, 0, 'Zero new records should be inserted on duplicate import');
    assert.equal(save2.skipped_duplicates, 6, 'All 6 duplicate transactions must be skipped');

    // Also preview should flag all as ALREADY_IMPORTED
    const previewRes = await fetch(`${baseUrl}/bank-import/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv_content: sampleCSVContent })
    });
    const previewBody = await previewRes.json();
    assert.equal(previewBody.summary.duplicate_count, 6);
    assert.equal(previewBody.summary.new_count, 0);
  });

  test('18.9: Explicit confirmation step records payment and reconciles invoice', async () => {
    // Fetch target invoice before confirm
    const inv1023 = db.prepare("SELECT id, invoice_number, balance_paise, paid_paise, status FROM invoices WHERE invoice_number = 'INV-2026-1023'").get();
    assert.ok(inv1023.balance_paise > 0);

    // Fetch the bank transaction in database
    const bankTx = db.prepare("SELECT id, tx_hash, amount_paise FROM bank_transactions WHERE narration LIKE '%INV-2026-1023%'").get();
    assert.ok(bankTx);

    // Confirm reconciliation via POST /api/bank-import/confirm
    const confirmRes = await fetch(`${baseUrl}/bank-import/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        confirmations: [
          {
            tx_id: bankTx.id,
            invoice_id: inv1023.id,
            amount_paise: bankTx.amount_paise,
            payment_mode: 'NEFT',
            reference_no: 'HDFCN26296001245'
          }
        ]
      })
    });

    assert.equal(confirmRes.status, 200);
    const confirmData = await confirmRes.json();
    assert.equal(confirmData.success, true);
    assert.equal(confirmData.reconciled_count, 1);

    // Verify invoice is now PAID and balance is 0
    const invAfter = db.prepare("SELECT id, balance_paise, paid_paise, status FROM invoices WHERE id = ?").get(inv1023.id);
    assert.equal(invAfter.balance_paise, 0);
    assert.equal(invAfter.status, 'PAID');

    // Verify bank_transaction is marked RECONCILED
    const txAfter = db.prepare("SELECT status, payment_id FROM bank_transactions WHERE id = ?").get(bankTx.id);
    assert.equal(txAfter.status, 'RECONCILED');
    assert.ok(txAfter.payment_id > 0);
  });
});
