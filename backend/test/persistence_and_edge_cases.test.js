import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDatabase, setDatabase, closeDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import { seedDatabase } from '../src/seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_PERSIST_DB = path.resolve(__dirname, 'test_persistence.db');

describe('SPEC Test 19 & 20: Server Restart Persistence and Edge Cases', () => {
  let server;
  let baseUrl;

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    closeDatabase();
    if (fs.existsSync(TEMP_PERSIST_DB)) {
      try {
        fs.unlinkSync(TEMP_PERSIST_DB);
      } catch (e) {
        // file might be locked briefly on Windows
      }
    }
  });

  test('SPEC Test 19: restart the backend and confirm data persists across process lifecycle', async () => {
    // 1. Initial server startup with disk-based SQLite DB
    if (fs.existsSync(TEMP_PERSIST_DB)) {
      try { fs.unlinkSync(TEMP_PERSIST_DB); } catch (e) {}
    }

    let db = createDatabase(TEMP_PERSIST_DB);
    seedDatabase(db, { force: true });
    setDatabase(db);

    let app = createApp();
    let port;
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });

    // Verify initial settings
    const settingsGet = await (await fetch(`${baseUrl}/settings`)).json();
    assert.ok(settingsGet.business.name.includes('Sharma Packaging'));

    // Mutate state: Create a new customer and update demo date
    const custRes = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Persistent Industries Private Limited',
        phone: '9876543210',
        email: 'persist@example.com',
        state: 'Maharashtra',
        gstin: '27AAPFU0939F1ZV'
      })
    });
    assert.equal(custRes.status, 201);
    const createdCustomer = await custRes.json();
    const createdCustomerId = createdCustomer.customer?.id || createdCustomer.id;
    assert.ok(createdCustomerId);

    // Update settings (demo_date & safety_buffer_paise)
    const updateSettingsRes = await fetch(`${baseUrl}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        demo_date: '2026-11-20',
        safety_buffer_paise: 35000000
      })
    });
    assert.equal(updateSettingsRes.status, 200);

    // Create an invoice for this customer
    const invoiceRes = await fetch(`${baseUrl}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: createdCustomerId,
        invoice_number: 'INV-PERSIST-001',
        issue_date: '2026-11-20',
        due_date: '2026-12-05',
        items: [
          {
            description: 'Custom Corrugated Cartons',
            hsn: '4819',
            qty: 500,
            unit: 'PCS',
            ratePaise: 2000, // ₹20.00 each
            discountPercent: 0,
            gstRate: 18
          }
        ]
      })
    });
    assert.equal(invoiceRes.status, 201);
    const createdInvoice = await invoiceRes.json();
    const createdInvoiceId = createdInvoice.invoice?.id || createdInvoice.id;
    assert.ok(createdInvoiceId);

    // 2. SIMULATE SERVER RESTART:
    // Close the HTTP server, close DB connection, clear memory references
    await new Promise((resolve) => server.close(resolve));
    closeDatabase();
    app = null;
    db = null;

    // Confirm DB file physically exists on disk and has data
    assert.ok(fs.existsSync(TEMP_PERSIST_DB), 'SQLite database file must exist on disk');
    const fileStats = fs.statSync(TEMP_PERSIST_DB);
    assert.ok(fileStats.size > 0, 'Database file on disk must have non-zero size');

    // 3. RESTART SERVER: Reopen database from same file path
    const reopenedDb = createDatabase(TEMP_PERSIST_DB);
    setDatabase(reopenedDb);
    const restartedApp = createApp();

    await new Promise((resolve) => {
      server = http.createServer(restartedApp);
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });

    // Verify settings persisted across restart
    const restartSettings = await (await fetch(`${baseUrl}/settings`)).json();
    assert.equal(restartSettings.demo_date, '2026-11-20');
    assert.equal(Number(restartSettings.safety_buffer_paise), 35000000);

    // Verify customer persisted across restart
    const restartCustomer = await (await fetch(`${baseUrl}/customers/${createdCustomerId}`)).json();
    assert.equal(restartCustomer.name, 'Persistent Industries Private Limited');
    assert.equal(restartCustomer.gstin, '27AAPFU0939F1ZV');

    // Verify invoice persisted with all calculated totals across restart
    const restartInvoice = await (await fetch(`${baseUrl}/invoices/${createdInvoiceId}`)).json();
    assert.equal(restartInvoice.invoice_number, 'INV-PERSIST-001');
    assert.equal(restartInvoice.customer_id, createdCustomerId);
    assert.equal(restartInvoice.items.length, 1);
    assert.equal(restartInvoice.total_paise, 1180000); // ₹11,800.00
  });

  test('SPEC Test 20: Edge Cases, API Error Handling & Validation', async () => {
    // 20.1: Non-existent invoice returns 404
    const res404 = await fetch(`${baseUrl}/invoices/999999`);
    assert.equal(res404.status, 404);

    // 20.2: Invalid public pay token returns 404
    const resToken404 = await fetch(`${baseUrl}/public/pay/INVALID-TOKEN-999`);
    assert.equal(resToken404.status, 404);

    // 20.3: Creating invoice without items returns 400
    const resNoItems = await fetch(`${baseUrl}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: 1,
        invoice_number: 'INV-NO-ITEMS',
        items: []
      })
    });
    assert.equal(resNoItems.status, 400);

    // 20.4: Creating invoice with non-existent customer returns 400 or 404
    const resBadCust = await fetch(`${baseUrl}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: 999999,
        invoice_number: 'INV-BAD-CUST',
        items: [
          {
            description: 'Item',
            quantity: 1,
            rate_paise: 1000,
            gst_rate: 18
          }
        ]
      })
    });
    assert.ok(resBadCust.status === 400 || resBadCust.status === 404);

    // 20.5: Recording payment with negative amount returns 400
    const resBadPayment = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_id: 1,
        amount_paise: -5000,
        payment_date: '2026-11-01',
        payment_mode: 'UPI'
      })
    });
    assert.equal(resBadPayment.status, 400);

    // 20.6: Empty customer filter returns empty array gracefully (not 500)
    const resEmptyFilter = await fetch(`${baseUrl}/invoices?search=NONEXISTENT_QUERY_12345`);
    assert.equal(resEmptyFilter.status, 200);
    const filterJson = await resEmptyFilter.json();
    assert.ok(Array.isArray(filterJson));
    assert.equal(filterJson.length, 0);
  });
});
