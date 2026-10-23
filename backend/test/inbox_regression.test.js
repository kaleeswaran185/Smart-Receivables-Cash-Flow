import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../src/app.js';
import { createDatabase, setDatabase } from '../src/db.js';
import { seedDatabase } from '../src/seed.js';
import { createToken } from '../src/middleware/auth.js';

describe('BUG 1 REGRESSION: Inbox Mark as Paid & Claim Confirmation Model', () => {
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

  // 1. Success - Full Payment
  test('Success: Accept claim for full payment marks invoice PAID and records confirmed payment', async () => {
    const inv = db.prepare("SELECT * FROM invoices WHERE balance_paise > 0 AND status != 'PAID' LIMIT 1").get();
    assert.ok(inv, 'Invoice found');

    const claimInsert = db.prepare(`
      INSERT INTO inbox_items (business_id, invoice_id, customer_id, type, payment_date, amount_paise, payment_mode, reference_no, notes, status)
      VALUES (?, ?, ?, 'PAYMENT_CLAIM', '2026-10-22', ?, 'UPI', 'UTR-FULL-PAY', 'Full settlement claim', 'PENDING')
    `).run(inv.business_id, inv.id, inv.customer_id, inv.balance_paise);

    const claimId = claimInsert.lastInsertRowid;

    const res = await fetch(`${baseUrl}/inbox/claims/${claimId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.newStatus, 'PAID');
    assert.equal(body.newBalancePaise, 0);

    // Verify inbox item is ACCEPTED
    const updatedClaim = db.prepare('SELECT * FROM inbox_items WHERE id = ?').get(claimId);
    assert.equal(updatedClaim.status, 'ACCEPTED');

    // Verify invoice is PAID
    const updatedInv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(inv.id);
    assert.equal(updatedInv.status, 'PAID');
    assert.equal(updatedInv.balance_paise, 0);

    // Verify confirmed payment recorded
    const pay = db.prepare('SELECT * FROM payments WHERE id = ?').get(body.paymentId);
    assert.ok(pay);
    assert.equal(pay.status, 'confirmed');
    assert.equal(pay.amount_paise, inv.balance_paise);
  });

  // 2. Success - Partial Payment
  test('Success: Accept partial payment claim updates balance to PARTIALLY_PAID', async () => {
    const biz = db.prepare('SELECT id FROM business LIMIT 1').get();
    const cust = db.prepare('SELECT id FROM customers LIMIT 1').get();

    const invInsert = db.prepare(`
      INSERT INTO invoices (business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, status, total_paise, balance_paise, place_of_supply)
      VALUES (?, ?, 'INV-PARTIAL-TEST', 'Tax Invoice', '2026-10-01', '2026-10-20', 'OVERDUE', 100000, 100000, '27')
    `).run(biz.id, cust.id);
    const invId = invInsert.lastInsertRowid;

    const claimInsert = db.prepare(`
      INSERT INTO inbox_items (business_id, invoice_id, customer_id, type, payment_date, amount_paise, payment_mode, reference_no, notes, status)
      VALUES (?, ?, ?, 'PAYMENT_CLAIM', '2026-10-22', 40000, 'NEFT', 'UTR-PARTIAL-1', 'Part payment', 'PENDING')
    `).run(biz.id, invId, cust.id);
    const claimId = claimInsert.lastInsertRowid;

    const res = await fetch(`${baseUrl}/inbox/claims/${claimId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.newStatus, 'PARTIALLY_PAID');
    assert.equal(body.newBalancePaise, 60000);
    assert.equal(body.newPaidPaise, 40000);

    const updatedInv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId);
    assert.equal(updatedInv.status, 'PARTIALLY_PAID');
    assert.equal(updatedInv.balance_paise, 60000);
  });

  // 3. Success - Overpayment held as credit with warning
  test('Success: Overpayment claim marks invoice PAID and holds excess as customer credit with warning', async () => {
    const biz = db.prepare('SELECT id FROM business LIMIT 1').get();
    const cust = db.prepare('SELECT id FROM customers LIMIT 1').get();

    const invInsert = db.prepare(`
      INSERT INTO invoices (business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, status, total_paise, balance_paise, place_of_supply)
      VALUES (?, ?, 'INV-OVERPAY-INBOX', 'Tax Invoice', '2026-10-01', '2026-10-20', 'OVERDUE', 50000, 50000, '27')
    `).run(biz.id, cust.id);
    const invId = invInsert.lastInsertRowid;

    // Claim 70,000 paise on 50,000 balance -> 20,000 excess
    const claimInsert = db.prepare(`
      INSERT INTO inbox_items (business_id, invoice_id, customer_id, type, payment_date, amount_paise, payment_mode, reference_no, notes, status)
      VALUES (?, ?, ?, 'PAYMENT_CLAIM', '2026-10-22', 70000, 'UPI', 'UTR-OVERPAY-1', 'Overpayment claim', 'PENDING')
    `).run(biz.id, invId, cust.id);
    const claimId = claimInsert.lastInsertRowid;

    const res = await fetch(`${baseUrl}/inbox/claims/${claimId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.newStatus, 'PAID');
    assert.equal(body.newBalancePaise, 0);
    assert.equal(body.overpayment, true);
    assert.ok(body.warning, 'Warning message present for overpayment');

    // Verify customer credit was created
    const credit = db.prepare('SELECT * FROM customer_credits WHERE payment_id = ?').get(body.paymentId);
    assert.ok(credit, 'Customer credit record created');
    assert.equal(credit.amount_paise, 20000);
    assert.equal(credit.customer_id, cust.id);
  });

  // 4. Success - Promise fulfilled (Mark as Paid)
  test('Success: Promise fulfilled marks promise KEPT, records confirmed payment and marks invoice PAID', async () => {
    const biz = db.prepare('SELECT id FROM business LIMIT 1').get();
    const cust = db.prepare('SELECT id FROM customers LIMIT 1').get();

    const invInsert = db.prepare(`
      INSERT INTO invoices (business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, status, total_paise, balance_paise, place_of_supply)
      VALUES (?, ?, 'INV-PROMISE-TEST', 'Tax Invoice', '2026-10-01', '2026-10-15', 'OVERDUE', 80000, 80000, '27')
    `).run(biz.id, cust.id);
    const invId = invInsert.lastInsertRowid;

    const promInsert = db.prepare(`
      INSERT INTO promises (business_id, customer_id, invoice_id, promised_date, promised_amount_paise, status, notes)
      VALUES (?, ?, ?, '2026-10-25', 80000, 'PENDING', 'Promised on call')
    `).run(biz.id, cust.id, invId);
    const promiseId = promInsert.lastInsertRowid;

    const res = await fetch(`${baseUrl}/inbox/promises/${promiseId}/fulfill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.newStatus, 'PAID');
    assert.equal(body.newBalancePaise, 0);

    // Verify promise status is KEPT (NOT FULFILLED, satisfying check constraint)
    const updatedPromise = db.prepare('SELECT * FROM promises WHERE id = ?').get(promiseId);
    assert.equal(updatedPromise.status, 'KEPT');
  });

  // 5. Duplicate - Cannot accept claim twice
  test('Duplicate: Accepting the same claim a second time returns 400 CLAIM_ALREADY_RESOLVED', async () => {
    const biz = db.prepare('SELECT id FROM business LIMIT 1').get();
    const cust = db.prepare('SELECT id FROM customers LIMIT 1').get();

    const invInsert = db.prepare(`
      INSERT INTO invoices (business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, status, total_paise, balance_paise, place_of_supply)
      VALUES (?, ?, 'INV-DUP-CLAIM', 'Tax Invoice', '2026-10-01', '2026-10-15', 'OVERDUE', 25000, 25000, '27')
    `).run(biz.id, cust.id);
    const invId = invInsert.lastInsertRowid;

    const claimInsert = db.prepare(`
      INSERT INTO inbox_items (business_id, invoice_id, customer_id, type, payment_date, amount_paise, payment_mode, reference_no, notes, status)
      VALUES (?, ?, ?, 'PAYMENT_CLAIM', '2026-10-22', 25000, 'UPI', 'UTR-DUP-1', 'Duplicate check claim', 'PENDING')
    `).run(biz.id, invId, cust.id);
    const claimId = claimInsert.lastInsertRowid;

    // First attempt -> 200
    const res1 = await fetch(`${baseUrl}/inbox/claims/${claimId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(res1.status, 200);

    // Second attempt -> 400 rejected
    const res2 = await fetch(`${baseUrl}/inbox/claims/${claimId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(res2.status, 400);
    const body2 = await res2.json();
    assert.equal(body2.error, 'CLAIM_ALREADY_RESOLVED');
  });

  // 6. Duplicate - Cannot fulfill promise twice
  test('Duplicate: Fulfilling the same promise a second time returns 400 PROMISE_ALREADY_RESOLVED', async () => {
    const biz = db.prepare('SELECT id FROM business LIMIT 1').get();
    const cust = db.prepare('SELECT id FROM customers LIMIT 1').get();

    const invInsert = db.prepare(`
      INSERT INTO invoices (business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, status, total_paise, balance_paise, place_of_supply)
      VALUES (?, ?, 'INV-DUP-PROM', 'Tax Invoice', '2026-10-01', '2026-10-15', 'OVERDUE', 35000, 35000, '27')
    `).run(biz.id, cust.id);
    const invId = invInsert.lastInsertRowid;

    const promInsert = db.prepare(`
      INSERT INTO promises (business_id, customer_id, invoice_id, promised_date, promised_amount_paise, status, notes)
      VALUES (?, ?, ?, '2026-10-25', 35000, 'PENDING', 'Duplicate test promise')
    `).run(biz.id, cust.id, invId);
    const promiseId = promInsert.lastInsertRowid;

    // First attempt -> 200
    const res1 = await fetch(`${baseUrl}/inbox/promises/${promiseId}/fulfill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(res1.status, 200);

    // Second attempt -> 400 rejected
    const res2 = await fetch(`${baseUrl}/inbox/promises/${promiseId}/fulfill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(res2.status, 400);
    const body2 = await res2.json();
    assert.equal(body2.error, 'PROMISE_ALREADY_RESOLVED');
  });

  // 7. Wrong state - Invoice already settled
  test('Wrong State: Claim on already settled invoice returns 400 INVOICE_ALREADY_PAID', async () => {
    const biz = db.prepare('SELECT id FROM business LIMIT 1').get();
    const cust = db.prepare('SELECT id FROM customers LIMIT 1').get();

    const invInsert = db.prepare(`
      INSERT INTO invoices (business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, status, total_paise, balance_paise, paid_paise, place_of_supply)
      VALUES (?, ?, 'INV-SETTLED-CLAIM', 'Tax Invoice', '2026-10-01', '2026-10-15', 'PAID', 50000, 0, 50000, '27')
    `).run(biz.id, cust.id);
    const invId = invInsert.lastInsertRowid;

    const claimInsert = db.prepare(`
      INSERT INTO inbox_items (business_id, invoice_id, customer_id, type, payment_date, amount_paise, payment_mode, reference_no, notes, status)
      VALUES (?, ?, ?, 'PAYMENT_CLAIM', '2026-10-22', 50000, 'UPI', 'UTR-SETTLED-1', 'Settled claim test', 'PENDING')
    `).run(biz.id, invId, cust.id);
    const claimId = claimInsert.lastInsertRowid;

    const res = await fetch(`${baseUrl}/inbox/claims/${claimId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'INVOICE_ALREADY_PAID');
  });

  // 8. Wrong state - Non-existent ID returns 404
  test('Wrong State: Non-existent claim ID returns 404 CLAIM_NOT_FOUND', async () => {
    const res = await fetch(`${baseUrl}/inbox/claims/999999/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, 'CLAIM_NOT_FOUND');
  });

  // 9. No auth
  test('No Auth: Unauthenticated requests to /inbox/claims/:id/accept return 401', async () => {
    const res = await fetch(`${baseUrl}/inbox/claims/1/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-strict-auth': 'true'
      }
    });
    assert.equal(res.status, 401);
  });

  test('No Auth: Unauthenticated requests to /inbox/promises/:id/fulfill return 401', async () => {
    const res = await fetch(`${baseUrl}/inbox/promises/1/fulfill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-strict-auth': 'true'
      }
    });
    assert.equal(res.status, 401);
  });
});
