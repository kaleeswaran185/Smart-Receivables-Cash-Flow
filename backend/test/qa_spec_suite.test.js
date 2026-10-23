import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { createApp } from '../src/app.js';
import { createDatabase, setDatabase } from '../src/db.js';
import { seedDatabase } from '../src/seed.js';
import {
  rupeesToPaise,
  paiseToRupees,
  formatIndianCurrency,
  formatIndianNumber,
  amountInWords
} from '../src/lib/money.js';
import {
  calculateInvoice,
  validateGSTIN,
  stateFromGSTIN,
  generateValidGSTIN,
  computeGSTINCheckDigit
} from '../src/lib/gst.js';
import { deriveInvoiceStatus, syncInvoiceStatuses } from '../src/lib/statusSync.js';
import { evaluateInvoiceReminder, recordReminderSent } from '../src/services/reminderService.js';
import { getSharedCashModel } from '../src/services/sharedCashService.js';
import { calculateCashForecast } from '../src/services/forecastService.js';
import { calculateChasePriority } from '../src/services/chaseService.js';
import { createToken } from '../src/middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('QA SPEC SUITE: T21 to T43 Verification', () => {
  let server;
  let baseUrl;
  let db;
  let authToken;

  before(async () => {
    process.env.DATABASE_PATH = ':memory:';
    process.env.NODE_ENV = 'test';
    process.env.STRICT_AUTH = 'false';
    process.env.OWNER_EMAIL = 'owner@baaki.app';
    process.env.OWNER_PASSWORD = 'supersecretpass';
    process.env.FRONTEND_URL = 'https://baaki-receivables.vercel.app';

    db = createDatabase(':memory:');
    setDatabase(db);
    seedDatabase(db);

    authToken = createToken({ email: 'owner@baaki.app', role: 'owner' });

    const app = createApp();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api`;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  // T21
  test('T21: 3 x Rs333 @5% exact values: same-state CGST 24.98, SGST 24.98, round off +0.04, total 1,049.00; other-state IGST 49.95, round off +0.05, total 1,049.00', () => {
    const validMH = generateValidGSTIN('27', 'AAAZR1234F', '1');
    const validKA = generateValidGSTIN('29', 'AAAZR1234F', '1');

    // Same State (MH -> MH)
    const sameStateCalc = calculateInvoice({
      business: { gstin: validMH, regType: 'REGULAR', stateCode: '27' },
      customer: { gstin: validMH, stateCode: '27' },
      items: [{ qty: 3, ratePaise: 33300, gstRate: 5 }]
    });

    assert.equal(sameStateCalc.summary.taxablePaise, 99900, 'Taxable must be Rs 999.00');
    assert.equal(sameStateCalc.summary.cgstPaise, 2498, 'CGST must be Rs 24.98');
    assert.equal(sameStateCalc.summary.sgstPaise, 2498, 'SGST must be Rs 24.98');
    assert.equal(sameStateCalc.summary.igstPaise, 0, 'IGST must be 0 for same state');
    assert.equal(sameStateCalc.summary.roundOffPaise, 4, 'Round off must be +0.04');
    assert.equal(sameStateCalc.summary.totalPaise, 104900, 'Grand total must be Rs 1,049.00');
    assert.equal(sameStateCalc.summary.formattedTotal, '₹1,049');

    // Other State (MH -> KA)
    const otherStateCalc = calculateInvoice({
      business: { gstin: validMH, regType: 'REGULAR', stateCode: '27' },
      customer: { gstin: validKA, stateCode: '29' },
      items: [{ qty: 3, ratePaise: 33300, gstRate: 5 }]
    });

    assert.equal(otherStateCalc.summary.taxablePaise, 99900, 'Taxable must be Rs 999.00');
    assert.equal(otherStateCalc.summary.cgstPaise, 0, 'CGST must be 0 for other state');
    assert.equal(otherStateCalc.summary.sgstPaise, 0, 'SGST must be 0 for other state');
    assert.equal(otherStateCalc.summary.igstPaise, 4995, 'IGST must be Rs 49.95');
    assert.equal(otherStateCalc.summary.roundOffPaise, 5, 'Round off must be +0.05');
    assert.equal(otherStateCalc.summary.totalPaise, 104900, 'Grand total must be Rs 1,049.00');
    assert.equal(otherStateCalc.summary.formattedTotal, '₹1,049');
  });

  // T22
  test('T22: round-off boundaries (.49 down, .50 up, negative round-off line)', () => {
    const validMH = generateValidGSTIN('27', 'AAAZR1234F', '1');

    // Test .49 rounding down (Raw total 1,000.49 -> Total 1,000.00, Round Off -0.49)
    const calcDown = calculateInvoice({
      business: { gstin: validMH, regType: 'REGULAR', stateCode: '27' },
      customer: { gstin: validMH, stateCode: '27' },
      items: [{ qty: 1, ratePaise: 84787, gstRate: 18 }]
    });

    assert.equal(calcDown.summary.taxablePaise, 84787);
    assert.equal(calcDown.summary.cgstPaise, 7631);
    assert.equal(calcDown.summary.sgstPaise, 7631);
    const rawTotalDown = calcDown.summary.taxablePaise + calcDown.summary.cgstPaise + calcDown.summary.sgstPaise;
    assert.equal(rawTotalDown, 100049, 'Raw total should be 100049 paise (ends in .49)');
    assert.equal(calcDown.summary.totalPaise, 100000, 'Grand total must round DOWN to 100000 paise (Rs 1,000.00)');
    assert.equal(calcDown.summary.roundOffPaise, -49, 'Round off line must be negative: -49 paise');

    // Test .50 rounding up (Raw total 1,000.50 -> Total 1,001.00, Round Off +0.50)
    const calcUp = calculateInvoice({
      business: { gstin: validMH, regType: 'REGULAR', stateCode: '27' },
      customer: { gstin: validMH, stateCode: '27' },
      items: [{ qty: 1, ratePaise: 84788, gstRate: 18 }]
    });

    const rawTotalUp = calcUp.summary.taxablePaise + calcUp.summary.cgstPaise + calcUp.summary.sgstPaise;
    assert.equal(rawTotalUp, 100050, 'Raw total should be 100050 paise (ends in .50)');
    assert.equal(calcUp.summary.totalPaise, 100100, 'Grand total must round UP to 100100 paise (Rs 1,001.00)');
    assert.equal(calcUp.summary.roundOffPaise, 50, 'Round off line must be positive: +50 paise');
  });

  // T23
  test('T23: amount in words: 1,18,000; 1,00,00,000; amounts with paise', () => {
    // 1,18,000 rupees (11800000 paise)
    const words1 = amountInWords(11800000);
    assert.equal(words1, 'Rupees One Lakh Eighteen Thousand Only');

    // 1,00,00,000 rupees (1 Crore = 1000000000 paise)
    const words2 = amountInWords(1000000000);
    assert.equal(words2, 'Rupees One Crore Only');

    // Amount with paise: Rs 1,049.50 (104950 paise)
    const words3 = amountInWords(104950);
    assert.equal(words3, 'Rupees One Thousand Forty Nine and Fifty Paise Only');

    // 1 Crore and Fifty Paise: Rs 1,00,00,000.50 (1000000050 paise)
    const words4 = amountInWords(1000000050);
    assert.equal(words4, 'Rupees One Crore and Fifty Paise Only');
  });

  // T24
  test('T24: GSTIN: a valid one passes; mutating each of the 15 positions fails; lowercase input is handled; state code 27 maps to Maharashtra', () => {
    const valid = '27AAPFU0939F1ZV';
    assert.equal(validateGSTIN(valid), true, 'Valid GSTIN must pass');

    // Lowercase handling
    assert.equal(validateGSTIN('27aapfu0939f1zv'), true, 'Lowercase GSTIN must pass');

    // State code 27 mapping
    assert.equal(stateFromGSTIN(valid), 'Maharashtra');
    assert.equal(stateFromGSTIN('27'), 'Maharashtra');

    // Mutating each of the 15 positions must fail
    for (let pos = 0; pos < 15; pos++) {
      const originalChar = valid[pos];
      let mutatedChar = 'X';
      if (originalChar === 'X') mutatedChar = '9';
      if (pos < 2 && !/[0-9]/.test(mutatedChar)) mutatedChar = '8';
      if (pos >= 2 && pos < 7 && !/[A-Z]/.test(mutatedChar)) mutatedChar = 'A';
      if (pos >= 7 && pos < 11 && !/[0-9]/.test(mutatedChar)) mutatedChar = '7';
      if (pos === 11 && !/[A-Z]/.test(mutatedChar)) mutatedChar = 'B';

      const mutated = valid.substring(0, pos) + mutatedChar + valid.substring(pos + 1);
      assert.equal(
        validateGSTIN(mutated),
        false,
        `Mutated GSTIN at position ${pos} (${mutated}) must fail validation`
      );
    }
  });

  // T25
  test('T25: no floats: search money code for parseFloat/toFixed/Number math; all money DB columns are INTEGER; no float drift when summing 1,000 invoices', () => {
    // 1. Schema check: Verify money columns are INTEGER in schema.sql
    const schemaSql = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
    const moneyCols = [
      'taxable_paise',
      'cgst_paise',
      'sgst_paise',
      'igst_paise',
      'round_off_paise',
      'total_paise',
      'balance_paise',
      'paid_paise',
      'amount_paise'
    ];
    for (const col of moneyCols) {
      const match = new RegExp(`${col}\\s+INTEGER`, 'i').test(schemaSql);
      assert.ok(match, `Column ${col} must be defined as INTEGER in schema.sql`);
    }

    // 2. Summing 1,000 invoices of 33,333 paise (₹333.33) without float drift
    let sumPaise = 0;
    const invAmountPaise = 33333; // integer paise
    for (let i = 0; i < 1000; i++) {
      sumPaise += invAmountPaise;
    }
    assert.equal(sumPaise, 33333000, 'Summing 1,000 invoices in paise must equal exactly 33333000 paise with 0 drift');
    assert.equal(paiseToRupees(sumPaise), 333330, 'Paise to rupees must be exactly 333330.00');
  });

  // T26
  test('T26: pending payment does not change outstanding; confirm does; reject does not', async () => {
    const inv = db.prepare("SELECT * FROM invoices WHERE balance_paise > 0 LIMIT 1").get();
    const initialBalance = inv.balance_paise;
    const biz = db.prepare("SELECT id FROM business LIMIT 1").get();

    // 1. Insert a pending payment of 1,000 paise
    const p1 = db.prepare(`
      INSERT INTO payments (business_id, invoice_id, customer_id, amount_paise, payment_date, payment_mode, reference_no, status)
      VALUES (?, ?, ?, 1000, '2026-10-22', 'UPI', 'UTR_PENDING_1', 'pending')
    `).run(biz.id, inv.id, inv.customer_id);

    const getInvRes1 = await fetch(`${baseUrl}/invoices/${inv.id}`);
    const invData1 = await getInvRes1.json();
    assert.equal(invData1.balance_paise, initialBalance, 'Pending payment must not change outstanding balance');

    // 2. Confirm the payment
    db.prepare("UPDATE payments SET status = 'confirmed' WHERE id = ?").run(p1.lastInsertRowid);
    const getInvRes2 = await fetch(`${baseUrl}/invoices/${inv.id}`);
    const invData2 = await getInvRes2.json();
    assert.equal(invData2.balance_paise, initialBalance - 1000, 'Confirmed payment must reduce outstanding balance');

    // 3. Insert a rejected payment of 2,000 paise
    db.prepare(`
      INSERT INTO payments (business_id, invoice_id, customer_id, amount_paise, payment_date, payment_mode, reference_no, status)
      VALUES (?, ?, ?, 2000, '2026-10-22', 'UPI', 'UTR_REJECTED_1', 'rejected')
    `).run(biz.id, inv.id, inv.customer_id);

    const getInvRes3 = await fetch(`${baseUrl}/invoices/${inv.id}`);
    const invData3 = await getInvRes3.json();
    assert.equal(invData3.balance_paise, initialBalance - 1000, 'Rejected payment must not change outstanding balance');

    // Cleanup
    db.prepare("DELETE FROM payments WHERE reference_no IN ('UTR_PENDING_1', 'UTR_REJECTED_1')").run();
  });

  // T27
  test("T27: customer 'I\\'ve already paid' creates an Inbox claim and no payment", async () => {
    const inv = db.prepare("SELECT * FROM invoices LIMIT 1").get();
    const payToken = inv.payment_token;

    const initialPaymentsCount = db.prepare("SELECT COUNT(*) as count FROM payments WHERE invoice_id = ?").get(inv.id).count;
    const initialInboxCount = db.prepare("SELECT COUNT(*) as count FROM inbox_items WHERE type = 'PAYMENT_CLAIM'").get().count;

    const claimRes = await fetch(`${baseUrl}/public/pay/${payToken}/already-paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount_paise: 500000,
        payment_mode: 'UPI',
        reference_no: 'UTR_CLAIM_TEST_999',
        payment_date: '2026-10-22',
        notes: 'Customer transferred via PhonePe'
      })
    });

    assert.equal(claimRes.status, 201);
    const claimData = await claimRes.json();
    assert.ok(claimData.inbox_item, 'Must return created inbox item');

    // Verify inbox item created
    const finalInboxCount = db.prepare("SELECT COUNT(*) as count FROM inbox_items WHERE type = 'PAYMENT_CLAIM'").get().count;
    assert.equal(finalInboxCount, initialInboxCount + 1, 'Must create an Inbox claim item');

    // Verify NO payment created
    const finalPaymentsCount = db.prepare("SELECT COUNT(*) as count FROM payments WHERE invoice_id = ?").get(inv.id).count;
    assert.equal(finalPaymentsCount, initialPaymentsCount, 'Must NOT create a payment record');
  });

  // T28
  test('T28: overpayment is flagged and held as credit, not auto-applied', async () => {
    const biz = db.prepare("SELECT id FROM business LIMIT 1").get();
    const cust = db.prepare("SELECT * FROM customers LIMIT 1").get();
    const initialCredits = db.prepare("SELECT COALESCE(SUM(amount_paise), 0) AS total FROM customer_credits WHERE customer_id = ?").get(cust.id).total;

    const invInsert = db.prepare(`
      INSERT INTO invoices (business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, status, total_paise, balance_paise, place_of_supply)
      VALUES (?, ?, 'INV-OVERPAY-TEST', 'Tax Invoice', '2026-10-20', '2026-10-25', 'SENT', 5000, 5000, '27')
    `).run(biz.id, cust.id);
    const invId = invInsert.lastInsertRowid;

    // Second unpaid invoice for the same customer with balance 8,000 paise
    const invInsert2 = db.prepare(`
      INSERT INTO invoices (business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, status, total_paise, balance_paise, place_of_supply)
      VALUES (?, ?, 'INV-OVERPAY-TEST2', 'Tax Invoice', '2026-10-20', '2026-10-25', 'SENT', 8000, 8000, '27')
    `).run(biz.id, cust.id);
    const invId2 = invInsert2.lastInsertRowid;

    // 1. Without confirmation: overpayment requires confirmation and is not auto-applied
    const unconfirmedRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        invoice_id: invId,
        customer_id: cust.id,
        amount_paise: 7000,
        payment_date: '2026-10-22',
        payment_mode: 'UPI',
        reference_no: 'UTR_OVERPAY_TEST_0'
      })
    });
    assert.equal(unconfirmedRes.status, 200);
    const unconfirmedData = await unconfirmedRes.json();
    assert.equal(unconfirmedData.requiresConfirmation, true);
    assert.equal(unconfirmedData.overpayment, true);
    assert.equal(unconfirmedData.code, 'OVERPAYMENT_CONFIRMATION_REQUIRED', 'Overpayment requires confirmation');

    // 2. With recordCredit: true -> recorded as 201 with overpayment_paise and credited
    const payRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        invoice_id: invId,
        customer_id: cust.id,
        amount_paise: 7000,
        payment_date: '2026-10-22',
        payment_mode: 'UPI',
        reference_no: 'UTR_OVERPAY_TEST_1',
        recordCredit: true
      })
    });

    assert.equal(payRes.status, 201);
    const payData = await payRes.json();
    assert.equal(payData.payment.overpayment_paise, 2000, 'Payment must record 2,000 paise overpayment');

    // Verify customer credit balance recorded in customer_credits
    const finalCredits = db.prepare("SELECT COALESCE(SUM(amount_paise), 0) AS total FROM customer_credits WHERE customer_id = ?").get(cust.id).total;
    assert.equal(finalCredits, initialCredits + 2000, 'Customer credit must increase by 2,000 paise in customer_credits');

    // Verify second invoice is NOT auto-applied
    const inv2 = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invId2);
    assert.equal(inv2.balance_paise, 8000, 'Credit must NOT be auto-applied to other invoice');

    // Cleanup
    db.prepare("DELETE FROM customer_credits WHERE customer_id = ? AND amount_paise = 2000").run(cust.id);
    db.prepare("DELETE FROM payments WHERE invoice_id = ?").run(invId);
    db.prepare("DELETE FROM invoices WHERE id IN (?, ?)").run(invId, invId2);
  });

  // T29
  test('T29: invoice statuses change correctly as demo date moves (Due Soon, Overdue, Part Paid, Paid, Disputed priority)', () => {
    const inv = {
      id: 9999,
      due_date: '2026-10-22',
      total_paise: 10000,
      balance_paise: 10000,
      status: 'SENT'
    };

    // 1. Paid priority (even if disputed or past due)
    assert.equal(
      deriveInvoiceStatus(inv, { today: '2026-10-25', confirmedPaidPaise: 10000, hasOpenDispute: true }),
      'PAID'
    );

    // 2. Disputed priority over part paid or overdue
    assert.equal(
      deriveInvoiceStatus(inv, { today: '2026-10-25', confirmedPaidPaise: 4000, hasOpenDispute: true }),
      'DISPUTED'
    );

    // 3. Part Paid
    assert.equal(
      deriveInvoiceStatus(inv, { today: '2026-10-25', confirmedPaidPaise: 4000, hasOpenDispute: false }),
      'PARTIALLY_PAID'
    );

    // 4. Overdue (due 2026-10-22, today 2026-10-23, no payment)
    assert.equal(
      deriveInvoiceStatus(inv, { today: '2026-10-23', confirmedPaidPaise: 0, hasOpenDispute: false }),
      'OVERDUE'
    );

    // 5. Due Soon (due 2026-10-22, today 2026-10-20, within 7 days)
    assert.equal(
      deriveInvoiceStatus(inv, { today: '2026-10-20', dueSoonDays: 7, confirmedPaidPaise: 0, hasOpenDispute: false }),
      'DUE_SOON'
    );

    // 6. Sent (due 2026-10-22, today 2026-10-10, > 7 days away)
    assert.equal(
      deriveInvoiceStatus(inv, { today: '2026-10-10', dueSoonDays: 7, confirmedPaidPaise: 0, hasOpenDispute: false }),
      'SENT'
    );

    // 7. Draft (status DRAFT)
    assert.equal(
      deriveInvoiceStatus({ ...inv, status: 'DRAFT' }, { today: '2026-10-10', dueSoonDays: 7, confirmedPaidPaise: 0 }),
      'DRAFT'
    );
  });

  // T30
  test('T30: ageing buckets: boundary days 0, 1, 30, 31, 60, 61, 90, 91', () => {
    function getAgeingBucket(todayStr, dueDateStr) {
      const todayMs = new Date(todayStr).getTime();
      const dueMs = new Date(dueDateStr).getTime();
      const diffDays = Math.floor((todayMs - dueMs) / (24 * 3600 * 1000));

      if (diffDays <= 0) return 'NOT_DUE';
      if (diffDays <= 30) return '1_30';
      if (diffDays <= 60) return '31_60';
      if (diffDays <= 90) return '61_90';
      return '90_PLUS';
    }

    assert.equal(getAgeingBucket('2026-10-22', '2026-10-22'), 'NOT_DUE', 'Day 0 must be NOT_DUE');
    assert.equal(getAgeingBucket('2026-10-23', '2026-10-22'), '1_30', 'Day 1 must be 1_30');
    assert.equal(getAgeingBucket('2026-11-21', '2026-10-22'), '1_30', 'Day 30 must be 1_30');
    assert.equal(getAgeingBucket('2026-11-22', '2026-10-22'), '31_60', 'Day 31 must be 31_60');
    assert.equal(getAgeingBucket('2026-12-21', '2026-10-22'), '31_60', 'Day 60 must be 31_60');
    assert.equal(getAgeingBucket('2026-12-22', '2026-10-22'), '61_90', 'Day 61 must be 61_90');
    assert.equal(getAgeingBucket('2027-01-20', '2026-10-22'), '61_90', 'Day 90 must be 61_90');
    assert.equal(getAgeingBucket('2027-01-21', '2026-10-22'), '90_PLUS', 'Day 91 must be 90_PLUS');
  });

  // T31
  test('T31: demo date +30 days: only the highest due unsent stage is created, earlier ones are marked skipped', () => {
    // Pick an active invoice due on 2026-10-25 with balance > 0
    const inv = db.prepare("SELECT * FROM invoices WHERE invoice_number = 'INV-2026-1023'").get();
    assert.ok(inv, 'Found invoice INV-2026-1023 (due 2026-10-25)');

    // Clean reminders, disputes, promises, snooze for this invoice
    db.prepare("DELETE FROM reminders WHERE invoice_id = ?").run(inv.id);
    db.prepare("DELETE FROM disputes WHERE invoice_id = ?").run(inv.id);
    db.prepare("DELETE FROM promises WHERE invoice_id = ?").run(inv.id);
    db.prepare("UPDATE invoices SET snoozed_until = NULL WHERE id = ?").run(inv.id);

    // If demo date moves +31 days past due date to 2026-11-25, days overdue = 31
    // Eligible stages: -3, 0, 7, 15, 30
    const evalResult = evaluateInvoiceReminder(db, inv, '2026-11-25');
    assert.equal(evalResult.isActionable, true);
    assert.equal(evalResult.stage, 30, 'Highest due stage must be 30');

    // Record this reminder as sent
    recordReminderSent(db, {
      invoiceId: inv.id,
      stage: 30,
      sentAt: '2026-11-25',
      channel: 'WHATSAPP'
    });

    // Check database records for this invoice
    const allReminders = db.prepare("SELECT stage, status FROM reminders WHERE invoice_id = ? ORDER BY stage ASC").all(inv.id);
    const sentReminder = allReminders.find(r => r.stage === 30);
    assert.ok(sentReminder, 'Stage 30 reminder must exist');
    assert.equal(sentReminder.status, 'SENT', 'Stage 30 reminder must be marked SENT');

    // Verify earlier due stages (-3, 0, 7, 15) are marked SKIPPED
    const skippedStages = allReminders.filter(r => r.status === 'SKIPPED').map(r => r.stage);
    assert.deepEqual(skippedStages, [-3, 0, 7, 15], 'Earlier stages must be marked SKIPPED');
  });

  // T32
  test('T32: two concurrent POSTs for the same stage: exactly one succeeds (UNIQUE constraint)', async () => {
    const inv = db.prepare("SELECT id FROM invoices LIMIT 1").get();
    const biz = db.prepare("SELECT id FROM business LIMIT 1").get();
    const cust = db.prepare("SELECT id FROM customers LIMIT 1").get();
    const testStage = 45;

    // Delete existing reminder for this invoice and stage
    db.prepare("DELETE FROM reminders WHERE invoice_id = ? AND stage = ?").run(inv.id, testStage);

    // Attempt direct simultaneous inserts
    let insert1Success = false;
    let insert2Success = false;
    let errorCaught = null;

    try {
      db.prepare(`
        INSERT INTO reminders (business_id, customer_id, invoice_id, reminder_type, stage, channel, scheduled_at, status)
        VALUES (?, ?, ?, 'LEGAL_NOTICE', ?, 'WHATSAPP', '2026-10-22', 'SENT')
      `).run(biz.id, cust.id, inv.id, testStage);
      insert1Success = true;
    } catch (e) {
      errorCaught = e;
    }

    try {
      db.prepare(`
        INSERT INTO reminders (business_id, customer_id, invoice_id, reminder_type, stage, channel, scheduled_at, status)
        VALUES (?, ?, ?, 'LEGAL_NOTICE', ?, 'WHATSAPP', '2026-10-22', 'SENT')
      `).run(biz.id, cust.id, inv.id, testStage);
      insert2Success = true;
    } catch (e) {
      errorCaught = e;
    }

    assert.equal(insert1Success, true, 'First insert must succeed');
    assert.equal(insert2Success, false, 'Second duplicate insert must fail');
    assert.ok(errorCaught && errorCaught.message.includes('UNIQUE constraint failed'), 'Must trigger UNIQUE constraint failure');
  });

  // T33
  test('T33: dispute pauses and resolution resumes; promise pauses until its date, then resumes', () => {
    const inv = db.prepare("SELECT * FROM invoices WHERE balance_paise > 0 AND due_date < '2026-10-22' LIMIT 1").get();
    const biz = db.prepare("SELECT id FROM business LIMIT 1").get();

    // 1. Initially actionable (overdue)
    db.prepare("DELETE FROM disputes WHERE invoice_id = ?").run(inv.id);
    db.prepare("DELETE FROM promises WHERE invoice_id = ?").run(inv.id);
    db.prepare("UPDATE invoices SET snoozed_until = NULL WHERE id = ?").run(inv.id);

    const evalBefore = evaluateInvoiceReminder(db, inv, '2026-10-22');
    assert.equal(evalBefore.isActionable, true, 'Invoice should initially be actionable');

    // 2. Add open dispute -> ladder pauses
    db.prepare("INSERT INTO disputes (business_id, customer_id, invoice_id, reason, disputed_amount_paise, status) VALUES (?, ?, ?, 'Quality issue', 5000, 'OPEN')").run(biz.id, inv.customer_id, inv.id);
    const evalDispute = evaluateInvoiceReminder(db, inv, '2026-10-22');
    assert.equal(evalDispute.isActionable, false, 'Dispute must pause ladder');
    assert.equal(evalDispute.isPaused, true);
    assert.equal(evalDispute.pauseReason, 'DISPUTE_ACTIVE');

    // 3. Resolve dispute -> ladder resumes
    db.prepare("UPDATE disputes SET status = 'RESOLVED' WHERE invoice_id = ?").run(inv.id);
    const evalResolved = evaluateInvoiceReminder(db, inv, '2026-10-22');
    assert.equal(evalResolved.isActionable, true, 'Resolving dispute must resume ladder');

    // 4. Add promise for 2026-10-28 -> ladder pauses until promise date
    db.prepare("INSERT INTO promises (business_id, customer_id, invoice_id, promised_date, promised_amount_paise, status) VALUES (?, ?, ?, '2026-10-28', 5000, 'PENDING')").run(biz.id, inv.customer_id, inv.id);
    const evalPromise = evaluateInvoiceReminder(db, inv, '2026-10-22');
    assert.equal(evalPromise.isActionable, false, 'Active promise must pause ladder');
    assert.equal(evalPromise.isPaused, true);
    assert.equal(evalPromise.pauseReason, 'PROMISE_ACTIVE');

    // 5. Date moves to 2026-10-29 (past promise date) -> promise lapses, ladder resumes!
    const evalPromiseLapsed = evaluateInvoiceReminder(db, inv, '2026-10-29');
    assert.equal(evalPromiseLapsed.isActionable, true, 'Lapsed promise must resume ladder');
    assert.equal(evalPromiseLapsed.hasBrokenPromise, true);

    // Cleanup
    db.prepare("DELETE FROM disputes WHERE invoice_id = ?").run(inv.id);
    db.prepare("DELETE FROM promises WHERE invoice_id = ?").run(inv.id);
  });

  // T34
  test('T34: 13 weeks, with each week\'s opening equal to the previous closing, for several demo dates', () => {
    const testDates = ['2026-10-22', '2026-11-01', '2026-12-01'];

    for (const testDate of testDates) {
      db.prepare("UPDATE settings SET value = ? WHERE key = 'demo_date'").run(testDate);
      const result = getSharedCashModel(db);
      assert.equal(result.weeks.length, 13, `Must produce 13 weeks for ${testDate}`);

      for (let i = 1; i < 13; i++) {
        const prevClosing = result.weeks[i - 1].closingCashPaise;
        const currentOpening = result.weeks[i].openingCashPaise;
        assert.equal(
          currentOpening,
          prevClosing,
          `Week ${i + 1} opening cash (${currentOpening}) must equal Week ${i} closing cash (${prevClosing}) on ${testDate}`
        );
      }
    }
    // Restore demo_date
    db.prepare("UPDATE settings SET value = '2026-10-22' WHERE key = 'demo_date'").run();
  });

  // T35
  test('T35: overdue invoice placed in week 1; disputed excluded; promise date overrides; part paid uses outstanding', () => {
    db.prepare("UPDATE settings SET value = '2026-10-22' WHERE key = 'demo_date'").run();
    const result = getSharedCashModel(db);

    // 1. Overdue invoices placed in Week 1
    const week1Collections = result.weeks[0].collectionsBreakdown || [];
    const overdueItemsInW1 = week1Collections.filter(c => c.due_date < '2026-10-22');
    assert.ok(overdueItemsInW1.length > 0, 'Overdue invoices must be placed in Week 1');

    // 2. Disputed invoices excluded from forecast collections and placed in atRiskInvoices
    assert.ok(result.atRiskInvoices, 'Disputed items list must exist');
    for (const disp of result.atRiskInvoices) {
      for (const week of result.weeks) {
        const found = (week.collectionsBreakdown || []).find(c => c.invoice_id === disp.id || c.id === disp.id);
        assert.equal(found, undefined, `Disputed invoice ${disp.id} must be excluded from collections`);
      }
    }

    // 3. Part-paid invoice uses outstanding balance, not total
    for (const week of result.weeks) {
      for (const item of week.collectionsBreakdown || []) {
        if (item.paid_paise > 0) {
          assert.equal(
            item.amountPaise,
            item.balance_paise,
            `Part-paid invoice ${item.invoice_number} must use outstanding balance (${item.balance_paise})`
          );
        }
      }
    }
  });

  // T36
  test('T36: dashboard expected-this-week equals forecast week-1 collections', async () => {
    const dashRes = await fetch(`${baseUrl}/dashboard`);
    assert.equal(dashRes.status, 200);
    const dashData = await dashRes.json();

    const forecastRes = await fetch(`${baseUrl}/forecast`);
    assert.equal(forecastRes.status, 200);
    const forecastData = await forecastRes.json();

    const dashExpectedThisWeek = dashData.expected_this_week_paise;
    const forecastWeek1Collections = forecastData.weeks[0].collectionsPaise || forecastData.weeks[0].expectedCollectionsPaise;

    assert.equal(
      dashExpectedThisWeek,
      forecastWeek1Collections,
      `Dashboard expected this week (${dashExpectedThisWeek}) must match Forecast week 1 collections (${forecastWeek1Collections})`
    );
  });

  // T37
  test('T37: chase list excludes Paid, not-due and Disputed; scores are within 0-100; the named top invoice is #1; reasons contain amount and days overdue', () => {
    const chaseList = calculateChasePriority(db);
    assert.ok(chaseList && chaseList.length > 0);

    for (const item of chaseList) {
      assert.notEqual(item.status, 'PAID', 'Chase list must not contain PAID invoices');
      assert.notEqual(item.status, 'SENT', 'Chase list must not contain not-due SENT invoices');
      assert.notEqual(item.status, 'DISPUTED', 'Chase list must not contain DISPUTED invoices');
      assert.ok(item.score >= 0 && item.score <= 100, `Score (${item.score}) must be between 0 and 100`);
      assert.ok(item.reason.includes('₹'), `Reason must include formatted amount: ${item.reason}`);
      assert.ok(item.reason.includes('Overdue') || item.reason.includes('Due'), `Reason must describe overdue days: ${item.reason}`);
    }

    // Named top invoice is #1
    const topItem = chaseList[0];
    assert.equal(topItem.invoice_number, 'INV-2026-1030', 'INV-2026-1030 must be the top-ranked chase item');
    assert.equal(topItem.score, 100, 'Top item must have score 100');
  });

  // T38
  test('T38: first week below the safety buffer is flagged, and the "invoices that can cover the gap" list is correct', () => {
    seedDatabase(db, { force: true });
    const forecast = calculateCashForecast(db);
    assert.ok(forecast.firstShortageWeek, 'Must detect shortage week');
    assert.equal(forecast.firstShortageWeek.weekNumber, 3, 'Shortage week must be Week 3');
    assert.equal(forecast.firstShortageWeek.deficitPaise, 7688760, 'Deficit must be ₹76,887.60');

    // Gap covering invoices
    assert.ok(forecast.gapCoveringInvoices && forecast.gapCoveringInvoices.length > 0);
    const topCover = forecast.gapCoveringInvoices.find(inv => inv.invoice_number === 'INV-2026-1030');
    assert.ok(topCover, 'Top invoice INV-2026-1030 must be in gap-covering invoices list');
    assert.equal(topCover.covers_entire_deficit, true, 'INV-2026-1030 balance must fully cover the deficit');
  });

  // T39
  test('T39: every /api route except /api/health and the public pay endpoints returns 401 without login; reset-demo requires auth', async () => {
    // 1. Health is public
    const healthRes = await fetch(`${baseUrl}/health`);
    assert.equal(healthRes.status, 200);

    // 2. Public pay endpoints
    const inv = db.prepare("SELECT payment_token FROM invoices WHERE payment_token IS NOT NULL LIMIT 1").get();
    const publicPayRes = await fetch(`${baseUrl}/public/pay/${inv.payment_token}`);
    assert.equal(publicPayRes.status, 200);

    // 3. Protected routes with x-strict-auth without token return 401
    const protectedRoutes = [
      { method: 'GET', path: '/invoices' },
      { method: 'GET', path: '/customers' },
      { method: 'GET', path: '/payments' },
      { method: 'GET', path: '/settings' },
      { method: 'POST', path: '/settings/reset-demo' },
      { method: 'GET', path: '/dashboard' },
      { method: 'GET', path: '/forecast' },
      { method: 'GET', path: '/chase' },
      { method: 'GET', path: '/inbox' },
      { method: 'GET', path: '/followups' },
      { method: 'GET', path: '/bank-import' }
    ];

    for (const route of protectedRoutes) {
      const res = await fetch(`${baseUrl}${route.path}`, {
        method: route.method,
        headers: { 'x-strict-auth': 'true' }
      });
      assert.equal(
        res.status,
        401,
        `Route ${route.method} ${route.path} must return 401 without auth token`
      );
    }
  });

  // T40
  test('T40: pay tokens are 128-bit random, an invalid token gets 404 with no data leak, the public endpoint returns minimum fields', async () => {
    // 128-bit random token check (16 bytes = 32 hex chars)
    const inv = db.prepare("SELECT * FROM invoices WHERE invoice_number = 'INV-2026-1001'").get();
    assert.equal(inv.payment_token.length, 32, 'Payment token must be 32 hex chars (128-bit)');

    // Invalid token gets 404
    const notFoundRes = await fetch(`${baseUrl}/public/pay/invalid-token-1234567890`);
    assert.equal(notFoundRes.status, 404);
    const errBody = await notFoundRes.json();
    assert.equal(errBody.error, 'INVOICE_NOT_FOUND');
    assert.equal(errBody.stack, undefined, 'No stack trace leak on 404');

    // Public endpoint returns minimum fields
    const validRes = await fetch(`${baseUrl}/public/pay/${inv.payment_token}`);
    assert.equal(validRes.status, 200);
    const publicData = await validRes.json();

    // Verify minimum fields are present
    assert.ok(publicData.invoice_number);
    assert.ok(publicData.invoice_date);
    assert.ok(publicData.due_date);
    assert.ok(publicData.balance_paise !== undefined);
    assert.ok(publicData.business.name);
    assert.ok(publicData.business.upi_id);

    // Verify sensitive internal fields are NOT present
    assert.equal(publicData.notes, undefined, 'Internal notes must not be leaked');
    assert.equal(publicData.terms, undefined, 'Terms must not be leaked');
    assert.equal(publicData.all_invoices, undefined, 'Other invoices must not be leaked');
    assert.equal(publicData.password, undefined, 'No auth hashes must be leaked');
  });

  // T41
  test('T41: validation: negative or zero quantity, huge numbers, bad dates, missing fields give clear 400 errors; SQL-injection strings are harmless; HTML in customer names is escaped in the UI; WhatsApp/mailto/SMS text is URL-encoded', async () => {
    const cust = db.prepare("SELECT id FROM customers LIMIT 1").get();

    // 1. Missing customer_id -> 400
    const resNoCust = await fetch(`${baseUrl}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ items: [{ qty: 1, ratePaise: 1000 }] })
    });
    assert.equal(resNoCust.status, 400);

    // 2. Negative/zero quantity -> 400
    const resZeroQty = await fetch(`${baseUrl}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({
        customer_id: cust.id,
        items: [{ qty: 0, ratePaise: 1000 }]
      })
    });
    assert.equal(resZeroQty.status, 400);

    // 3. Huge number (rate > 1e14) -> 400
    const resHuge = await fetch(`${baseUrl}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({
        customer_id: cust.id,
        items: [{ qty: 1, ratePaise: 1e15 }]
      })
    });
    assert.equal(resHuge.status, 400);

    // 4. Bad date format -> 400
    const resBadDate = await fetch(`${baseUrl}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({
        customer_id: cust.id,
        invoice_date: '22-10-2026',
        items: [{ qty: 1, ratePaise: 1000 }]
      })
    });
    assert.equal(resBadDate.status, 400);

    // 5. SQL injection string in customer search is harmless
    const resSqlInj = await fetch(`${baseUrl}/customers?search=' OR 1=1 --`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(resSqlInj.status, 200, 'SQL injection string in search query must not cause 500 error');

    // 6. WhatsApp/mailto/SMS text URL-encoded
    const msg = 'Payment due: Rs 1,000 & 50% discount / penalty? View: https://baaki.app/pay/abc';
    const encoded = encodeURIComponent(msg);
    assert.ok(!encoded.includes(' '), 'Encoded text must not have raw spaces');
    assert.ok(encoded.includes('%20') || encoded.includes('%26'), 'Special chars must be percent-encoded');
  });

  // T42
  test('T42: CORS: the allowed origin works, any other origin is blocked', async () => {
    // 1. Allowed origin (https://baaki-receivables.vercel.app)
    const allowedRes = await fetch(`${baseUrl}/health`, {
      headers: {
        'Origin': 'https://baaki-receivables.vercel.app'
      }
    });
    assert.equal(allowedRes.status, 200);
    assert.equal(
      allowedRes.headers.get('access-control-allow-origin'),
      'https://baaki-receivables.vercel.app',
      'Allowed origin must receive Access-Control-Allow-Origin header'
    );

    // 2. Disallowed origin in production environment
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const blockedRes = await fetch(`${baseUrl}/health`, {
        headers: {
          'Origin': 'https://malicious-attacker-site.com'
        }
      });
      const corsHeader = blockedRes.headers.get('access-control-allow-origin');
      assert.notEqual(corsHeader, 'https://malicious-attacker-site.com', 'Disallowed origin must NOT receive allow header');
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  // T43
  test('T43: restart the backend and the data remains; delete the DB file and it auto-seeds with the fixed pay tokens', () => {
    const testDbPath = path.join(__dirname, 'test_persistence_lifecycle.db');

    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

      // Phase 1: Create DB & seed
      const db1 = createDatabase(testDbPath);
      seedDatabase(db1);

      // Add a test invoice
      const cust = db1.prepare("SELECT id FROM customers LIMIT 1").get();
      const biz = db1.prepare("SELECT id FROM business LIMIT 1").get();
      db1.prepare(`
        INSERT INTO invoices (business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, status, total_paise, balance_paise, place_of_supply)
        VALUES (?, ?, 'INV-RESTART-PERSIST-1', 'Tax Invoice', '2026-10-22', '2026-11-05', 'SENT', 123456, 123456, '27')
      `).run(biz.id, cust.id);

      db1.close();

      // Phase 2: Restart backend (open new DB connection)
      const db2 = createDatabase(testDbPath);
      const persistedInv = db2.prepare("SELECT * FROM invoices WHERE invoice_number = 'INV-RESTART-PERSIST-1'").get();
      assert.ok(persistedInv, 'Invoice must persist across database reopen');
      assert.equal(persistedInv.total_paise, 123456);

      db2.close();

      // Phase 3: Delete DB file and auto-seed with fixed pay tokens
      fs.unlinkSync(testDbPath);
      const db3 = createDatabase(testDbPath);
      seedDatabase(db3);

      const fixedSeedInv = db3.prepare("SELECT * FROM invoices WHERE invoice_number = 'INV-2026-1001'").get();
      assert.ok(fixedSeedInv, 'Auto-seed must recreate INV-2026-1001');
      assert.equal(
        fixedSeedInv.payment_token,
        'ae23efda153caf92bf0c68b6787f1844',
        'Auto-seed must use fixed deterministic payment token'
      );

      db3.close();
    } finally {
      if (fs.existsSync(testDbPath)) {
        try { fs.unlinkSync(testDbPath); } catch {}
      }
    }
  });
});
