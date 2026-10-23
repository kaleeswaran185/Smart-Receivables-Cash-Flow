import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../src/app.js';
import { createDatabase, setDatabase } from '../src/db.js';
import { seedDatabase } from '../src/seed.js';
import { createToken } from '../src/middleware/auth.js';

describe('BUG 2 REGRESSION: Follow-ups Mark as Sent & Once-per-Stage Enforcement', () => {
  let server;
  let baseUrl;
  let db;
  let authToken;

  before(async () => {
    process.env.DATABASE_PATH = ':memory:';
    db = createDatabase(':memory:');
    seedDatabase(db, { force: true });
    setDatabase(db);

    authToken = createToken({ email: 'owner@baaki.app', role: 'owner' });

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
  });

  // 1. Success - Record reminder sent for overdue invoice
  test('Success: Mark as Sent records reminder with timestamp and marks earlier stages SKIPPED', async () => {
    const biz = db.prepare('SELECT id FROM business LIMIT 1').get();
    const cust = db.prepare('SELECT id FROM customers LIMIT 1').get();

    // Create an invoice 31 days overdue (due 2026-09-21 when demo date is 2026-10-22)
    const invInsert = db.prepare(`
      INSERT INTO invoices (business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, status, total_paise, balance_paise, place_of_supply)
      VALUES (?, ?, 'INV-FOLLOWUP-TEST-1', 'Tax Invoice', '2026-08-20', '2026-09-21', 'OVERDUE', 150000, 150000, '27')
    `).run(biz.id, cust.id);
    const invId = invInsert.lastInsertRowid;

    // Send Stage 30 reminder
    const res = await fetch(`${baseUrl}/reminders/${invId}/sent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        stage: 30,
        channel: 'WHATSAPP',
        message_body: 'Legal demand warning stage 30'
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.reminder);
    assert.equal(body.reminder.stage, 30);
    assert.ok(body.reminder.sent_at);

    // Verify reminder row in DB
    const sentReminder = db.prepare('SELECT * FROM reminders WHERE invoice_id = ? AND stage = 30').get(invId);
    assert.ok(sentReminder);
    assert.equal(sentReminder.status, 'SENT');
    assert.ok(sentReminder.sent_at);

    // Verify earlier due stages (-3, 0, 7, 15) are marked SKIPPED in reminders table
    const skippedRecords = db.prepare("SELECT stage FROM reminders WHERE invoice_id = ? AND status = 'SKIPPED' ORDER BY stage ASC").all(invId);
    const skippedStages = skippedRecords.map(r => r.stage);
    assert.deepEqual(skippedStages, [-3, 0, 7, 15], 'Earlier stages must be marked SKIPPED');

    // Verify invoice timeline contains the REMINDER_SENT event
    const invRes = await fetch(`${baseUrl}/invoices/${invId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const invData = await invRes.json();
    const reminderEvents = invData.timeline.filter(e => e.type === 'REMINDER_SENT');
    assert.ok(reminderEvents.length > 0, 'Timeline must include REMINDER_SENT event');
  });

  // 2. Duplicate - Enforce once-per-stage
  test('Duplicate: A second click/request for the same stage returns 400 REMINDER_ALREADY_SENT', async () => {
    const biz = db.prepare('SELECT id FROM business LIMIT 1').get();
    const cust = db.prepare('SELECT id FROM customers LIMIT 1').get();

    const invInsert = db.prepare(`
      INSERT INTO invoices (business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, status, total_paise, balance_paise, place_of_supply)
      VALUES (?, ?, 'INV-DUP-REMINDER', 'Tax Invoice', '2026-09-01', '2026-10-15', 'OVERDUE', 90000, 90000, '27')
    `).run(biz.id, cust.id);
    const invId = invInsert.lastInsertRowid;

    // First request -> 201
    const res1 = await fetch(`${baseUrl}/reminders/${invId}/sent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ stage: 7, channel: 'WHATSAPP', message_body: 'Gentle reminder' })
    });
    assert.equal(res1.status, 201);

    // Second request for same stage -> 400 rejected
    const res2 = await fetch(`${baseUrl}/reminders/${invId}/sent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ stage: 7, channel: 'WHATSAPP', message_body: 'Gentle reminder duplicate' })
    });
    assert.equal(res2.status, 400);
    const body2 = await res2.json();
    assert.equal(body2.error, 'REMINDER_ALREADY_SENT');

    // Confirm DB only has exactly ONE record for (invId, stage 7)
    const count = db.prepare('SELECT COUNT(*) as c FROM reminders WHERE invoice_id = ? AND stage = 7').get(invId).c;
    assert.equal(count, 1, 'Exactly one reminder record must exist in DB');
  });

  // 3. Wrong State - Paid Invoice
  test('Wrong State: Cannot send reminder on a settled/paid invoice (returns 400 INVOICE_ALREADY_PAID)', async () => {
    const biz = db.prepare('SELECT id FROM business LIMIT 1').get();
    const cust = db.prepare('SELECT id FROM customers LIMIT 1').get();

    const invInsert = db.prepare(`
      INSERT INTO invoices (business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, status, total_paise, balance_paise, paid_paise, place_of_supply)
      VALUES (?, ?, 'INV-PAID-REMINDER', 'Tax Invoice', '2026-09-01', '2026-10-01', 'PAID', 50000, 0, 50000, '27')
    `).run(biz.id, cust.id);
    const invId = invInsert.lastInsertRowid;

    const res = await fetch(`${baseUrl}/reminders/${invId}/sent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ stage: 15, channel: 'WHATSAPP' })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'INVOICE_ALREADY_PAID');
  });

  // 4. Wrong State - Disputed Invoice
  test('Wrong State: Reminders are paused on disputed invoice (returns 400 INVOICE_DISPUTED)', async () => {
    const biz = db.prepare('SELECT id FROM business LIMIT 1').get();
    const cust = db.prepare('SELECT id FROM customers LIMIT 1').get();

    const invInsert = db.prepare(`
      INSERT INTO invoices (business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, status, total_paise, balance_paise, place_of_supply)
      VALUES (?, ?, 'INV-DISPUTED-REM', 'Tax Invoice', '2026-09-01', '2026-10-01', 'DISPUTED', 75000, 75000, '27')
    `).run(biz.id, cust.id);
    const invId = invInsert.lastInsertRowid;

    const res = await fetch(`${baseUrl}/reminders/${invId}/sent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ stage: 7, channel: 'WHATSAPP' })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'INVOICE_DISPUTED');
  });

  // 5. Wrong State - Non-existent ID returns 404
  test('Wrong State: Non-existent invoice/reminder ID returns 404 REMINDER_NOT_FOUND', async () => {
    const res = await fetch(`${baseUrl}/reminders/999999/sent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ stage: 0, channel: 'WHATSAPP' })
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, 'REMINDER_NOT_FOUND');
  });

  // 6. No Auth
  test('No Auth: Unauthenticated requests to /reminders/:id/sent return 401', async () => {
    const res = await fetch(`${baseUrl}/reminders/1/sent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-strict-auth': 'true'
      },
      body: JSON.stringify({ stage: 0, channel: 'WHATSAPP' })
    });
    assert.equal(res.status, 401);
  });
});
