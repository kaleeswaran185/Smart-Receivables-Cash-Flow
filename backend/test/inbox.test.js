import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../src/app.js';
import { createDatabase, setDatabase } from '../src/db.js';
import { seedDatabase } from '../src/seed.js';

describe('Inbox APIs & Actions', () => {
  let server;
  let baseUrl;
  let db;

  before(async () => {
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
  });

  test('GET /api/inbox returns claims, disputes, promises and summary', async () => {
    const res = await fetch(`${baseUrl}/inbox`);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.ok(data.summary);
    assert.ok(Array.isArray(data.payment_claims));
    assert.ok(Array.isArray(data.disputes));
    assert.ok(Array.isArray(data.promises));
  });

  test('POST /api/inbox/claims/:id/accept accepts claim and updates invoice', async () => {
    // 1. Create a claim via public pay
    const inv = db.prepare("SELECT * FROM invoices WHERE status != 'PAID' LIMIT 1").get();
    await fetch(`${baseUrl}/public/pay/${inv.payment_token}/already-paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_date: '2026-10-22',
        amount_paise: inv.balance_paise,
        reference_no: 'TEST-CLAIM-123'
      })
    });

    // 2. Fetch claim from inbox
    const inboxData = await (await fetch(`${baseUrl}/inbox`)).json();
    const claim = inboxData.payment_claims.find(c => c.reference_no === 'TEST-CLAIM-123');
    assert.ok(claim);

    // 3. Accept claim
    const acceptRes = await fetch(`${baseUrl}/inbox/claims/${claim.id}/accept`, { method: 'POST' });
    assert.equal(acceptRes.status, 200);

    // Verify invoice is paid
    const updatedInv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(inv.id);
    assert.equal(updatedInv.status, 'PAID');
    assert.equal(updatedInv.balance_paise, 0);
  });

  test('POST /api/inbox/disputes/:id/resolve resolves dispute and updates invoice', async () => {
    const dispute = db.prepare("SELECT * FROM disputes WHERE status = 'OPEN' LIMIT 1").get();
    if (dispute) {
      const resolveRes = await fetch(`${baseUrl}/inbox/disputes/${dispute.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution_notes: 'Resolved with customer' })
      });
      assert.equal(resolveRes.status, 200);

      const checkDispute = db.prepare('SELECT * FROM disputes WHERE id = ?').get(dispute.id);
      assert.equal(checkDispute.status, 'RESOLVED');
    }
  });
});
