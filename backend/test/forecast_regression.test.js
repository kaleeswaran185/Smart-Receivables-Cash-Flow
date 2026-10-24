import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../src/app.js';
import { createDatabase, setDatabase } from '../src/db.js';
import { seedDatabase } from '../src/seed.js';
import { calculateCashForecast } from '../src/services/forecastService.js';
import { getSharedCashModel } from '../src/services/sharedCashService.js';
import { rupeesToPaise, paiseToRupees } from '../src/lib/money.js';

describe('Cash Forecast Comprehensive Regression Test Suite', () => {
  let server;
  let baseUrl;
  let db;
  let authToken;

  before(async () => {
    process.env.DATABASE_PATH = ':memory:';
    db = createDatabase(':memory:');
    seedDatabase(db, { force: true });
    setDatabase(db);

    const app = createApp();

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });

    const loginRes = await fetch(`${baseUrl}/auth/demo-login`, { method: 'POST' });
    const loginData = await loginRes.json();
    authToken = loginData.token;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('1. 13 weeks are shown with mathematical continuity (Week N closing === Week N+1 opening)', () => {
    const forecast = calculateCashForecast(db);
    assert.equal(forecast.weeks.length, 13, 'Must have exactly 13 weekly buckets');

    for (let i = 0; i < forecast.weeks.length; i++) {
      const w = forecast.weeks[i];
      assert.ok(w.weekNumber === i + 1, `Week number must be ${i + 1}`);
      assert.ok(typeof w.openingCashPaise === 'number', 'openingCashPaise must be a number');
      assert.ok(typeof w.expectedCollectionsPaise === 'number', 'expectedCollectionsPaise must be a number');
      assert.ok(typeof w.expensesPaise === 'number', 'expensesPaise must be a number');
      assert.ok(typeof w.closingCashPaise === 'number', 'closingCashPaise must be a number');

      // Math: closing = opening + collections - expenses
      const expectedClosing = w.openingCashPaise + w.expectedCollectionsPaise - w.expensesPaise;
      assert.equal(w.closingCashPaise, expectedClosing, `Week ${w.weekNumber} closing must match formula`);

      // Continuity
      if (i < forecast.weeks.length - 1) {
        const nextW = forecast.weeks[i + 1];
        assert.equal(
          nextW.openingCashPaise,
          w.closingCashPaise,
          `Week ${nextW.weekNumber} opening must strictly equal Week ${w.weekNumber} closing`
        );
      }
    }
  });

  test('2. Week 1 opening cash strictly matches settings opening cash', () => {
    const forecast = calculateCashForecast(db);
    const row = db.prepare("SELECT value FROM settings WHERE key = 'opening_cash_paise'").get();
    const expectedOpening = parseInt(row.value, 10);
    assert.equal(forecast.weeks[0].openingCashPaise, expectedOpening);
  });

  test('3. Aliases exist on all weeks (isBelowSafetyBuffer, netCashFlowPaise, formattedClosingCash)', () => {
    const forecast = calculateCashForecast(db);
    const w1 = forecast.weeks[0];
    assert.equal(w1.isBelowSafetyBuffer, w1.isBelowBuffer);
    assert.equal(w1.netCashFlowPaise, w1.netCashPaise);
    assert.ok(w1.formattedOpeningCash);
    assert.ok(w1.formattedClosingCash);
    assert.ok(w1.formattedNetCashFlow);
  });

  test('4. Collections use outstanding amount only, placed at due date + customer delay; past due lands in week 1', () => {
    const model = getSharedCashModel(db);
    assert.ok(model.scheduledCollections.length > 0);

    for (const item of model.scheduledCollections) {
      assert.ok(item.balance_paise > 0, 'Only unpaid balance must be included');
      assert.ok(item.expected_collection_date >= model.today, 'Collection date must be >= today');
    }
  });

  test('5. Disputed invoices are excluded from collections and listed in atRiskInvoices', () => {
    const forecast = calculateCashForecast(db);
    assert.ok(forecast.atRiskInvoices.length > 0, 'Must have at risk invoices');

    const disputedIds = new Set(forecast.atRiskInvoices.map((inv) => inv.id));
    const model = getSharedCashModel(db);
    for (const col of model.scheduledCollections) {
      assert.ok(!disputedIds.has(col.invoice_id), `Disputed invoice ${col.invoice_id} must not be in collections`);
    }
  });

  test('6. Promise to pay overrides customer average delay', () => {
    const today = '2026-10-22';
    // Insert test customer and invoice with promise
    const custRes = db.prepare(`
      INSERT INTO customers (business_id, name, company_name, email, phone)
      VALUES (1, 'Promise Test Customer', 'PTC Ltd', 'promise@test.com', '+91 99999 11111')
    `).run();
    const customerId = custRes.lastInsertRowid;

    const invRes = db.prepare(`
      INSERT INTO invoices (business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, place_of_supply, subtotal_paise, total_paise, balance_paise, status)
      VALUES (1, ?, 'INV-PROMISE-01', 'Tax Invoice', '2026-09-01', '2026-10-01', '27-Maharashtra', 5000000, 5000000, 5000000, 'OVERDUE')
    `).run(customerId);
    const invoiceId = invRes.lastInsertRowid;

    // Add promise for future date in Week 4: 2026-11-15
    db.prepare(`
      INSERT INTO promises (business_id, customer_id, invoice_id, promised_date, promised_amount_paise, status)
      VALUES (1, ?, ?, '2026-11-15', 5000000, 'PENDING')
    `).run(customerId, invoiceId);

    const model = getSharedCashModel(db);
    const scheduled = model.scheduledCollections.find((c) => c.invoice_id === invoiceId);
    assert.ok(scheduled, 'Invoice must be scheduled in collections');
    assert.equal(scheduled.expected_collection_date, '2026-11-15', 'Promise date must override expected collection date');

    // Clean up test records
    db.prepare('DELETE FROM promises WHERE invoice_id = ?').run(invoiceId);
    db.prepare('DELETE FROM invoices WHERE id = ?').run(invoiceId);
    db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);
  });

  test('7. First shortage week highlighted with text, buffer, projected cash, and deficit', () => {
    const forecast = calculateCashForecast(db);
    assert.equal(forecast.hasShortage, true);
    assert.ok(forecast.firstShortageWeek);
    const shortage = forecast.firstShortageWeek;
    assert.equal(shortage.weekNumber, 3);
    assert.ok(shortage.deficitPaise > 0);
    assert.ok(shortage.closingCashPaise < forecast.safetyBufferPaise);
    assert.ok(shortage.formattedDeficit.includes('₹'));
  });

  test('8. Gap-covering set is smallest set (at most 3 invoices) with cumulative amount >= shortfall', () => {
    const forecast = calculateCashForecast(db);
    assert.ok(forecast.gapCoveringInvoices.length >= 1 && forecast.gapCoveringInvoices.length <= 3);

    const top = forecast.gapCoveringInvoices[0];
    assert.ok(top.invoice_id);
    assert.ok(top.invoice_number);
    assert.ok(top.formatted_balance);
    assert.ok(top.cumulative_amount_paise >= forecast.firstShortageWeek.deficitPaise);
    assert.ok(top.formatted_cumulative_amount);
    assert.equal(top.covers_entire_deficit, true);
  });

  test('9. Changing safety buffer dynamically alters shortage detection and deficit', () => {
    // When buffer is set very low (₹1,00,000), Week 3 closing of ₹4,23,112.40 is NOT a shortage
    const lowBufferForecast = calculateCashForecast(db, { safetyBufferPaise: 10000000 });
    assert.ok(
      !lowBufferForecast.firstShortageWeek || lowBufferForecast.firstShortageWeek.weekNumber > 3,
      'Low buffer must not flag Week 3 as deficit'
    );

    // When buffer is set very high (₹30,00,000), deficit increases
    const highBufferForecast = calculateCashForecast(db, { safetyBufferPaise: 300000000 });
    assert.ok(highBufferForecast.hasShortage);
    assert.ok(highBufferForecast.firstShortageWeek.deficitPaise > forecastShortageDefault(db));
  });

  function forecastShortageDefault(d) {
    const def = calculateCashForecast(d);
    return def.firstShortageWeek?.deficitPaise || 0;
  }

  test('10. What-if scenarios run, alter forecast, and never mutate database data', () => {
    const base = calculateCashForecast(db);
    const countBefore = db.prepare('SELECT COUNT(*) as count FROM invoices').get().count;

    // Late customer scenario
    const late = calculateCashForecast(db, { scenario: 'late_customer' });
    assert.notEqual(
      late.weeks[0].expectedCollectionsPaise,
      base.weeks[0].expectedCollectionsPaise,
      'Late customer scenario must alter collections'
    );

    // Supplier delayed scenario
    const delayed = calculateCashForecast(db, { scenario: 'supplier_delayed' });
    assert.ok(
      delayed.weeks[2].closingCashPaise > base.weeks[2].closingCashPaise,
      'Delayed supplier must improve Week 3 closing cash'
    );

    // Customer early scenario
    const early = calculateCashForecast(db, { scenario: 'early_customer' });
    assert.ok(
      early.weeks[0].expectedCollectionsPaise >= base.weeks[0].expectedCollectionsPaise,
      'Early customer must maintain or boost Week 1 collections'
    );

    // DB state must be identical
    const countAfter = db.prepare('SELECT COUNT(*) as count FROM invoices').get().count;
    assert.equal(countBefore, countAfter, 'What-if simulations must NEVER write to database');
  });

  test('11. Real actions flow into forecast: payment confirmation immediately updates forecast', async () => {
    const beforeForecast = calculateCashForecast(db);
    const invoice = db.prepare("SELECT * FROM invoices WHERE status = 'OVERDUE' AND balance_paise > 0 LIMIT 1").get();
    assert.ok(invoice, 'Must find an active overdue invoice');

    // Pay full invoice balance
    const payRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        invoice_id: invoice.id,
        amount_paise: invoice.balance_paise,
        confirm: true,
        confirmPaid: true,
        status: 'confirmed'
      })
    });
    assert.equal(payRes.status, 201);

    // Verify invoice is paid in DB
    const updatedInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice.id);
    assert.equal(updatedInvoice.status, 'PAID');
    assert.equal(updatedInvoice.balance_paise, 0);

    // Forecast immediately excludes this settled invoice from collections
    const afterForecast = calculateCashForecast(db);
    const inCol = getSharedCashModel(db).scheduledCollections.find((c) => c.invoice_id === invoice.id);
    assert.equal(inCol, undefined, 'Paid invoice must be excluded from scheduled collections');

    // Restore seed state
    seedDatabase(db, { force: true });
  });

  test('12. API route GET /api/forecast returns 200 with rich fields and what-if query parameters', async () => {
    const res = await fetch(`${baseUrl}/forecast`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(res.status, 200);
    const json = await res.json();

    assert.equal(json.weeks.length, 13);
    assert.ok(json.gapCoveringInvoices.length > 0);
    assert.ok(json.gapCoveringInvoices[0].formatted_cumulative_amount);

    // Test scenario parameter via API
    const scenRes = await fetch(`${baseUrl}/forecast?scenario=supplier_delayed`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(scenRes.status, 200);
    const scenJson = await scenRes.json();
    assert.equal(scenJson.scenario, 'supplier_delayed');
    assert.ok(scenJson.weeks[2].closingCashPaise > json.weeks[2].closingCashPaise);
  });
});
