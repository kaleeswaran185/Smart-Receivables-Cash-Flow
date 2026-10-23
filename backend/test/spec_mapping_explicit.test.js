import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import crypto from 'crypto';
import { createApp } from '../src/app.js';
import { createDatabase, setDatabase } from '../src/db.js';
import { seedDatabase } from '../src/seed.js';
import { rupeesToPaise, formatIndianCurrency } from '../src/lib/money.js';
import { calculateInvoice, validateGSTIN, generateValidGSTIN } from '../src/lib/gst.js';
import { getSharedCashModel } from '../src/services/sharedCashService.js';
import { evaluateInvoiceReminder, recordReminderSent } from '../src/services/reminderService.js';
import { createToken } from '../src/middleware/auth.js';

describe('SPEC Section 32 Original Tests 1 to 20 & Explicit Requirements', () => {
  let server;
  let baseUrl;
  let db;
  let authToken;

  before(async () => {
    process.env.DATABASE_PATH = ':memory:';
    process.env.NODE_ENV = 'test';
    process.env.AUTH_SECRET = 'test-secret-spec-mapping-2026';
    process.env.OWNER_EMAIL = 'owner@baaki.app';
    process.env.OWNER_PASSWORD = 'supersecretpass';

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

  after(() => {
    if (server) server.close();
  });

  // --- 1. FULL PAYMENT GIVES PAID ---
  test('EXPLICIT: full payment gives Paid', async () => {
    const biz = db.prepare('SELECT id FROM business LIMIT 1').get();
    const cust = db.prepare('SELECT id FROM customers LIMIT 1').get();

    const inv = db.prepare(`
      INSERT INTO invoices (business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, status, total_paise, balance_paise, place_of_supply)
      VALUES (?, ?, 'INV-EXPLICIT-FULL', 'Tax Invoice', '2026-10-20', '2026-10-25', 'SENT', 100000, 100000, '27')
    `).run(biz.id, cust.id);
    const invId = inv.lastInsertRowid;

    const res = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        invoice_id: invId,
        amount_paise: 100000,
        payment_date: '2026-10-22',
        payment_mode: 'UPI',
        reference_no: 'UTR-FULL-EXPLICIT',
        confirm: true
      })
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.invoice.status, 'PAID', 'Full payment must transition invoice to PAID');
    assert.equal(data.invoice.balance_paise, 0, 'Balance must be 0');
  });

  // --- 2. PARTIAL GIVES PART PAID WITH CORRECT REMAINING AMOUNT ---
  test('EXPLICIT: partial gives Part Paid with the correct remaining amount', async () => {
    const biz = db.prepare('SELECT id FROM business LIMIT 1').get();
    const cust = db.prepare('SELECT id FROM customers LIMIT 1').get();

    const inv = db.prepare(`
      INSERT INTO invoices (business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, status, total_paise, balance_paise, place_of_supply)
      VALUES (?, ?, 'INV-EXPLICIT-PARTIAL', 'Tax Invoice', '2026-10-20', '2026-10-25', 'SENT', 100000, 100000, '27')
    `).run(biz.id, cust.id);
    const invId = inv.lastInsertRowid;

    const res = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        invoice_id: invId,
        amount_paise: 40000,
        payment_date: '2026-10-22',
        payment_mode: 'UPI',
        reference_no: 'UTR-PARTIAL-EXPLICIT',
        confirm: true
      })
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.invoice.status, 'PARTIALLY_PAID', 'Partial payment must give PARTIALLY_PAID');
    assert.equal(data.invoice.paid_paise, 40000, 'Paid paise must equal 40,000');
    assert.equal(data.invoice.balance_paise, 60000, 'Remaining balance must equal 60,000 paise');
  });

  // --- 3. DISPUTE PAUSES LADDER ---
  test('EXPLICIT: dispute pauses ladder', () => {
    const biz = db.prepare('SELECT id FROM business LIMIT 1').get();
    const cust = db.prepare('SELECT id FROM customers LIMIT 1').get();

    const inv = db.prepare(`
      INSERT INTO invoices (business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, status, total_paise, balance_paise, place_of_supply)
      VALUES (?, ?, 'INV-DISPUTE-LADDER', 'Tax Invoice', '2026-09-01', '2026-09-15', 'DISPUTED', 50000, 50000, '27')
    `).run(biz.id, cust.id);
    const invId = inv.lastInsertRowid;

    const evaluation = evaluateInvoiceReminder(db, invId, '2026-10-22');
    assert.equal(evaluation.isActionable, false, 'Reminder must not be actionable for disputed invoice');
    assert.equal(evaluation.isPaused, true, 'Reminder must be paused for disputed invoice');
    assert.equal(evaluation.pauseReason, 'DISPUTE_ACTIVE');
  });

  // --- 4. PROMISE PAUSES UNTIL DATE ---
  test('EXPLICIT: promise pauses until date', () => {
    const biz = db.prepare('SELECT id FROM business LIMIT 1').get();
    const cust = db.prepare('SELECT id FROM customers LIMIT 1').get();

    const inv = db.prepare(`
      INSERT INTO invoices (business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, status, total_paise, balance_paise, place_of_supply)
      VALUES (?, ?, 'INV-PROMISE-LADDER', 'Tax Invoice', '2026-09-01', '2026-09-15', 'OVERDUE', 50000, 50000, '27')
    `).run(biz.id, cust.id);
    const invId = inv.lastInsertRowid;

    db.prepare(`
      INSERT INTO promises (business_id, invoice_id, customer_id, promised_date, promised_amount_paise, status)
      VALUES (?, ?, ?, '2026-10-30', 50000, 'PENDING')
    `).run(biz.id, invId, cust.id);

    const evalBefore = evaluateInvoiceReminder(db, invId, '2026-10-22');
    assert.equal(evalBefore.isActionable, false, 'Must pause reminder before promised date');
    assert.equal(evalBefore.isPaused, true);
    assert.equal(evalBefore.pauseReason, 'PROMISE_ACTIVE');

    const evalAfter = evaluateInvoiceReminder(db, invId, '2026-11-01');
    assert.equal(evalAfter.isActionable, true, 'Must resume reminder once promised date lapses');
    assert.equal(evalAfter.isPaused, false);
  });

  // --- 5. THE SAME STAGE CANNOT BE SENT TWICE ---
  test('EXPLICIT: the same stage cannot be sent twice', () => {
    const biz = db.prepare('SELECT id FROM business LIMIT 1').get();
    const cust = db.prepare('SELECT id FROM customers LIMIT 1').get();

    const inv = db.prepare(`
      INSERT INTO invoices (business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, status, total_paise, balance_paise, place_of_supply)
      VALUES (?, ?, 'INV-SAME-STAGE', 'Tax Invoice', '2026-09-01', '2026-09-15', 'OVERDUE', 50000, 50000, '27')
    `).run(biz.id, cust.id);
    const invId = inv.lastInsertRowid;

    recordReminderSent(db, { invoiceId: invId, stage: 7, channel: 'WHATSAPP' });

    assert.throws(() => {
      db.prepare(`
        INSERT INTO reminders (business_id, invoice_id, customer_id, reminder_type, stage, channel, scheduled_at, sent_at, status)
        VALUES (?, ?, ?, 'OVERDUE_GENTLE', 7, 'WHATSAPP', '2026-10-22', '2026-10-22', 'SENT')
      `).run(biz.id, invId, cust.id);
    }, /UNIQUE constraint failed/, 'DB must reject duplicate stage entry');
  });

  // --- 6. WEEK N CLOSING EQUALS WEEK N+1 OPENING ---
  test('EXPLICIT: week N closing equals week N+1 opening', () => {
    const model = getSharedCashModel(db);
    for (let i = 0; i < model.weeks.length - 1; i++) {
      const currentWeek = model.weeks[i];
      const nextWeek = model.weeks[i + 1];
      assert.equal(
        currentWeek.closingCashPaise,
        nextWeek.openingCashPaise,
        `Week ${currentWeek.weekNumber} closing must strictly equal Week ${nextWeek.weekNumber} opening`
      );
    }
  });

  // --- 7. FIRST WEEK BELOW BUFFER HIGHLIGHTED ---
  test('EXPLICIT: first week below buffer highlighted', () => {
    const model = getSharedCashModel(db);
    assert(model.hasShortage === true, 'Shortage must be flagged');
    assert(model.firstShortageWeek !== null, 'First shortage week must be identified');
    assert.equal(model.firstShortageWeek.weekNumber, 3, 'Week 3 must be the highlighted shortage week');
    assert(model.firstShortageWeek.deficitPaise > 0, 'Deficit must be positive');
  });

  // --- 8. HIGH-VALUE OVERDUE INVOICE AFFECTING SHORTAGE GETS HIGH PRIORITY ---
  test('EXPLICIT: high-value overdue invoice affecting the shortage gets high priority', () => {
    const model = getSharedCashModel(db);
    const topInvoice = model.chaseList[0];
    assert.equal(topInvoice.invoice_number, 'INV-2026-1030', 'Top ranked chase invoice must be INV-2026-1030');
    assert.equal(topInvoice.score, 100, 'Score must be 100');
    assert(topInvoice.can_cover_gap === true, 'can_cover_gap must be true');
    assert(topInvoice.reason.includes('covers the Week 3 cash deficit'), 'Reason must explain deficit coverage');
  });

  // --- 9. RUNTIME INVOICE TOKEN CRYPTO.RANDOMBYTES(16+) VS FIXED SEED TOKEN ---
  test('EXPLICIT: runtime invoice payment token uses crypto.randomBytes(16+) while seeded invoices use fixed constants', async () => {
    const cust = db.prepare('SELECT * FROM customers LIMIT 1').get();
    const tokenRegex = /^[0-9a-f]{32,}$/;

    // 1. Check seeded invoice has fixed constant
    const seeded = db.prepare("SELECT * FROM invoices WHERE invoice_number = 'INV-2026-1001'").get();
    assert.equal(seeded.payment_token, 'ae23efda153caf92bf0c68b6787f1844', 'Seeded invoice token must be fixed constant');

    // 2. Create runtime invoice via API
    const res = await fetch(`${baseUrl}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        customer_id: cust.id,
        items: [{ description: 'Runtime Token Test Item', qty: 1, rate: 500, gst_rate: 18 }]
      })
    });
    assert.equal(res.status, 201);
    const created = await res.json();
    assert(tokenRegex.test(created.payment_token), 'Runtime invoice must generate crypto random 16+ byte hex token');
    assert.notEqual(created.payment_token, seeded.payment_token);
  });

  // --- 10. OVERPAYMENT CONFIRMATION & RETRY IDEMPOTENCY ---
  test('EXPLICIT: overpayment returns success with overpayment=true and created credit, requires confirm step, and retry does not double-record', async () => {
    const biz = db.prepare('SELECT id FROM business LIMIT 1').get();
    const cust = db.prepare('SELECT id FROM customers LIMIT 1').get();

    const inv = db.prepare(`
      INSERT INTO invoices (business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, status, total_paise, balance_paise, place_of_supply)
      VALUES (?, ?, 'INV-OVERPAY-NEW-TEST', 'Tax Invoice', '2026-10-20', '2026-10-25', 'SENT', 5000, 5000, '27')
    `).run(biz.id, cust.id);
    const invId = inv.lastInsertRowid;

    // 1. Without confirmation: returns 200 with requiresConfirmation and warning
    const unconfirmedRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        invoice_id: invId,
        amount_paise: 7500,
        payment_date: '2026-10-22',
        payment_mode: 'UPI',
        reference_no: 'UTR-IDEMPOTENT-001'
      })
    });
    assert.equal(unconfirmedRes.status, 200);
    const unconfirmedData = await unconfirmedRes.json();
    assert.equal(unconfirmedData.requiresConfirmation, true);
    assert.equal(unconfirmedData.overpayment, true);
    assert.equal(unconfirmedData.overpaymentPaise, 2500);

    // 2. With confirmation: returns 201 with overpayment=true and created credit
    const confirmedRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        invoice_id: invId,
        amount_paise: 7500,
        payment_date: '2026-10-22',
        payment_mode: 'UPI',
        reference_no: 'UTR-IDEMPOTENT-001',
        confirm: true,
        recordCredit: true
      })
    });
    assert.equal(confirmedRes.status, 201);
    const confirmedData = await confirmedRes.json();
    assert.equal(confirmedData.payment.overpayment_paise, 2500);
    assert.equal(confirmedData.invoice.status, 'PAID');

    // 3. Retry with same reference number: returns 200 with alreadyRecorded=true (does NOT double-record)
    const initialPaymentsCount = db.prepare('SELECT COUNT(*) as count FROM payments WHERE invoice_id = ?').get(invId).count;
    const retryRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        invoice_id: invId,
        amount_paise: 7500,
        payment_date: '2026-10-22',
        payment_mode: 'UPI',
        reference_no: 'UTR-IDEMPOTENT-001',
        confirm: true
      })
    });
    assert.equal(retryRes.status, 200);
    const retryData = await retryRes.json();
    assert.equal(retryData.alreadyRecorded, true);
    const finalPaymentsCount = db.prepare('SELECT COUNT(*) as count FROM payments WHERE invoice_id = ?').get(invId).count;
    assert.equal(finalPaymentsCount, initialPaymentsCount, 'Duplicate retry must NOT insert additional payment');
  });

  // --- 11. 60-SECOND COOLDOWN ON RESET-DEMO ---
  test('EXPLICIT: 60-second cooldown on reset-demo', async () => {
    // 1. Initial reset-demo call succeeds
    const res1 = await fetch(`${baseUrl}/settings/reset-demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }
    });
    assert.equal(res1.status, 200);

    // 2. Immediate second call in non-test simulated mode without bypass header returns 429
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res2 = await fetch(`${baseUrl}/settings/reset-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }
      });
      assert.equal(res2.status, 429);
      const data2 = await res2.json();
      assert.equal(data2.error, 'COOLDOWN_ACTIVE');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
