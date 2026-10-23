import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../src/app.js';
import { createDatabase, setDatabase } from '../src/db.js';
import { seedDatabase } from '../src/seed.js';

describe('Security & Owner Authentication Tests (Spec Item 13 & 14)', () => {
  let server;
  let baseUrl;
  let db;

  before(async () => {
    process.env.DATABASE_PATH = ':memory:';
    process.env.NODE_ENV = 'test';
    process.env.OWNER_EMAIL = 'owner@baaki.app';
    process.env.OWNER_PASSWORD = 'supersecretpass';
    db = createDatabase(':memory:');
    setDatabase(db);
    seedDatabase(db);

    const app = createApp();
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api`;
  });

  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
  });

  test('Public routes: /api/health and /api/public/pay do not require authentication', async () => {
    const healthRes = await fetch(`${baseUrl}/health`);
    assert.equal(healthRes.status, 200);
    const healthData = await healthRes.json();
    assert.equal(healthData.status, 'ok');

    // Public pay route with seeded token
    const inv = db.prepare('SELECT payment_token FROM invoices LIMIT 1').get();
    const payRes = await fetch(`${baseUrl}/public/pay/${inv.payment_token}`);
    assert.equal(payRes.status, 200);
  });

  test('Auth protection: protected routes return 401 without valid token when strictly verified', async () => {
    // Attempting reset-demo without auth header
    const unauthReset = await fetch(`${baseUrl}/settings/reset-demo`, {
      method: 'POST',
      headers: {
        'x-strict-auth': 'true'
      }
    });
    assert.equal(unauthReset.status, 401);
    const err = await unauthReset.json();
    assert.equal(err.error, 'UNAUTHORIZED');

    // Attempting /api/invoices without auth header
    const unauthInvoices = await fetch(`${baseUrl}/invoices`, {
      headers: {
        'x-strict-auth': 'true'
      }
    });
    assert.equal(unauthInvoices.status, 401);
  });

  test('Owner login: rejects bad credentials and issues signed token for valid owner credentials', async () => {
    // 1. Bad password
    const badLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@baaki.app',
        password: 'wrongpassword'
      })
    });
    assert.equal(badLogin.status, 401);

    // 2. Good password
    const goodLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@baaki.app',
        password: 'supersecretpass'
      })
    });
    assert.equal(goodLogin.status, 200);
    const loginData = await goodLogin.json();
    assert.equal(loginData.success, true);
    assert.ok(loginData.token);
    assert.equal(loginData.user.email, 'owner@baaki.app');

    // 3. Use returned token to access protected route
    const authInvoices = await fetch(`${baseUrl}/invoices`, {
      headers: {
        'Authorization': `Bearer ${loginData.token}`,
        'x-strict-auth': 'true'
      }
    });
    assert.equal(authInvoices.status, 200);

    // 4. Use returned token to execute reset-demo
    const authReset = await fetch(`${baseUrl}/settings/reset-demo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${loginData.token}`,
        'x-strict-auth': 'true'
      }
    });
    assert.equal(authReset.status, 200);
  });

  test('One-click demo login: /api/auth/demo-login issues token when demo mode enabled', async () => {
    const demoLoginRes = await fetch(`${baseUrl}/auth/demo-login`, {
      method: 'POST'
    });
    assert.equal(demoLoginRes.status, 200);
    const demoData = await demoLoginRes.json();
    assert.equal(demoData.success, true);
    assert.ok(demoData.token);

    // Check /api/auth/me with demo token
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${demoData.token}`
      }
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.authenticated, true);
    assert.equal(meData.user.email, 'owner@baaki.app');
  });
});
