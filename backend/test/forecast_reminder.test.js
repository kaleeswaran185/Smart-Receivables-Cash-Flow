import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../src/app.js';
import { createDatabase, setDatabase } from '../src/db.js';
import { seedDatabase } from '../src/seed.js';
import { calculateCashForecast } from '../src/services/forecastService.js';
import { calculateChasePriority } from '../src/services/chaseService.js';
import {
  evaluateInvoiceReminder,
  getActionableFollowups,
  generateMessageText,
  STAGES
} from '../src/services/reminderService.js';
import { rupeesToPaise } from '../src/lib/money.js';

describe('SPEC Tests 12 to 17: Cash Forecast, Chase Priority, Reminders & Public Pay', () => {
  let server;
  let baseUrl;
  let db;

  before(async () => {
    process.env.DATABASE_PATH = ':memory:';
    db = createDatabase(':memory:');

    // Seed database with Sharma Packaging, 12 customers, 40 invoices, expenses, etc.
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
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('SPEC Test 12: 13-week cash forecast (Week N closing must equal Week N+1 opening)', async () => {
    const forecast = calculateCashForecast(db);

    // Must generate 13 weeks
    assert.equal(forecast.weeks.length, 13);
    assert.equal(forecast.today, '2026-10-22');
    assert.equal(forecast.weeks[0].startDate, '2026-10-22');

    // Enforce the critical invariant: Week N closing === Week N+1 opening
    for (let i = 0; i < forecast.weeks.length - 1; i++) {
      const currentWeek = forecast.weeks[i];
      const nextWeek = forecast.weeks[i + 1];

      // Closing cash formula check
      const expectedClosing = currentWeek.openingCashPaise + currentWeek.expectedCollectionsPaise - currentWeek.expensesPaise;
      assert.equal(currentWeek.closingCashPaise, expectedClosing, `Week ${currentWeek.weekNumber} closing cash math must match`);

      // Invariant: Week N closing strictly equals Week N+1 opening
      assert.equal(
        nextWeek.openingCashPaise,
        currentWeek.closingCashPaise,
        `Week ${nextWeek.weekNumber} opening cash must equal Week ${currentWeek.weekNumber} closing cash`
      );
    }

    // Expected collections incorporate customer delay
    const weekWithCollections = forecast.weeks.find(w => w.expectedCollectionsPaise > 0);
    assert.ok(weekWithCollections, 'Forecast must have expected collections in future weeks');
    assert.ok(weekWithCollections.collectionsBreakdown.length > 0);
  });

  test('SPEC Test 13: Detect first week below safety buffer and list gap-covering invoices', async () => {
    const forecast = calculateCashForecast(db);

    // Seed data was designed with a heavy expense week in Week 3 (Century Paperboard + Rent + GST)
    assert.equal(forecast.hasShortage, true, 'Forecast must detect a cash shortage below safety buffer');
    assert.ok(forecast.firstShortageWeek, 'Must provide details of the first shortage week');

    const shortage = forecast.firstShortageWeek;
    assert.equal(shortage.weekNumber, 3, 'First cash shortage occurs in Week 3');
    assert.ok(shortage.deficitPaise > 0, 'Deficit paise must be positive');
    assert.ok(shortage.closingCashPaise < forecast.safetyBufferPaise, 'Closing cash must breach the safety buffer');

    // List invoices that can cover the gap
    assert.ok(forecast.gapCoveringInvoices.length > 0, 'Must list candidate invoices that can cover the deficit');
    const topGapCoverer = forecast.gapCoveringInvoices[0];
    assert.ok(topGapCoverer.balance_paise >= shortage.deficitPaise, 'Gap covering invoice balance must cover the deficit');
    assert.equal(topGapCoverer.covers_entire_deficit, true);
  });

  test('SPEC Test 14: Simple what-if scenarios (customer 30d late, supplier delayed, big customer early)', async () => {
    // Base forecast
    const baseForecast = calculateCashForecast(db);
    const baseWeek3Closing = baseForecast.weeks[2].closingCashPaise;

    // Scenario 1: Customer pays 30 days late
    const lateForecast = calculateCashForecast(db, { scenario: 'late_customer' });
    const lateWeek1Collections = lateForecast.weeks[0].expectedCollectionsPaise;
    const baseWeek1Collections = baseForecast.weeks[0].expectedCollectionsPaise;
    assert.ok(lateWeek1Collections <= baseWeek1Collections, 'Late customer scenario must delay collections from early weeks');

    // Scenario 2: Supplier delayed
    const delayedSupplierForecast = calculateCashForecast(db, { scenario: 'supplier_delayed' });
    const delayedWeek3Expenses = delayedSupplierForecast.weeks[2].expensesPaise;
    const baseWeek3Expenses = baseForecast.weeks[2].expensesPaise;
    assert.ok(delayedWeek3Expenses < baseWeek3Expenses, 'Delayed supplier must reduce Week 3 expenses');
    assert.ok(
      delayedSupplierForecast.weeks[2].closingCashPaise > baseWeek3Closing,
      'Delayed supplier must improve Week 3 closing cash'
    );

    // Scenario 3: Big customer pays early
    const earlyCustomerForecast = calculateCashForecast(db, { scenario: 'early_customer' });
    assert.ok(
      earlyCustomerForecast.weeks[0].expectedCollectionsPaise >= baseForecast.weeks[0].expectedCollectionsPaise,
      'Early customer scenario must boost Week 1 collections'
    );
  });

  test('SPEC Test 15: Chase-First 0-100 score, reasons, labels, and not amount-only sorting', async () => {
    const chaseList = calculateChasePriority(db);
    assert.ok(chaseList.length > 0, 'Chase list must return active invoices');

    // 1. Verify Top Priority Invoice from seed data
    const topInvoice = chaseList[0];
    assert.ok(topInvoice.score >= 85, 'Top invoice priority score must be >= 85');
    assert.equal(topInvoice.label, '🔥 Chase First');
    assert.ok(topInvoice.reason.includes('Overdue') || topInvoice.reason.includes('Grade C'), 'Reason must explain overdue or customer risk');
    assert.ok(topInvoice.reason.includes('cash deficit') || topInvoice.reason.includes('Week 3'), 'Reason must explain shortage impact');

    // 2. Invariant: NOT amount-only sorting!
    // A smaller overdue invoice with high shortage impact and Grade C risk can rank higher
    // than a non-overdue or lower-risk invoice with a higher total amount.
    let foundNonAmountRanking = false;
    for (let i = 0; i < chaseList.length - 1; i++) {
      if (chaseList[i].balance_paise < chaseList[i + 1].balance_paise && chaseList[i].score > chaseList[i + 1].score) {
        foundNonAmountRanking = true;
        break;
      }
    }
    assert.ok(foundNonAmountRanking, 'Chase list ranking must combine factors, not strictly sort by balance_paise');

    // 3. Every result returns valid reason and label
    chaseList.forEach(item => {
      assert.ok(item.score >= 0 && item.score <= 100);
      assert.ok(['🔥 Chase First', '⚡ High Priority', '⚠️ Medium Priority', 'ℹ️ On Track'].includes(item.label));
      assert.ok(typeof item.reason === 'string' && item.reason.length > 10);
    });
  });

  test('SPEC Test 16: Reminder engine escalation ladder, dispute pause, promise pause, snooze', async () => {
    // 1. Escalation ladder stages check: -3, 0, 7, 15, 30, 45
    assert.deepEqual(STAGES, [-3, 0, 7, 15, 30, 45]);

    // 2. Message generation per stage
    const sampleInv = {
      invoice_number: 'INV-TEST-001',
      balance_paise: 2500000,
      due_date: '2026-10-22',
      payment_token: 'pay_sample_test'
    };
    const sampleCustomer = { name: 'Acme Enterprises' };
    const sampleBiz = { name: 'Sharma Packaging' };

    const msgUpcoming = generateMessageText({ stage: -3, invoice: sampleInv, customer: sampleCustomer, business: sampleBiz });
    assert.ok(msgUpcoming.includes('gentle reminder') && msgUpcoming.includes('due on'));

    const msgLegal = generateMessageText({ stage: 45, invoice: sampleInv, customer: sampleCustomer, business: sampleBiz });
    assert.ok(msgLegal.includes('FINAL DEMAND') || msgLegal.includes('MSME Samadhaan'));

    // 3. Check GET /api/followups endpoint
    const followupsRes = await fetch(`${baseUrl}/followups`);
    assert.equal(followupsRes.status, 200);
    const followups = await followupsRes.json();
    assert.ok(Array.isArray(followups));
    assert.ok(followups.length > 0, 'Must have actionable followups for today');

    const targetFollowup = followups[0];
    const testInvoiceId = targetFollowup.invoice_id;
    const testStage = targetFollowup.stage;

    // 4. Record reminder sent: POST /api/reminders/:id/sent
    const sentRes = await fetch(`${baseUrl}/reminders/${testInvoiceId}/sent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: testStage,
        channel: 'WHATSAPP',
        message_body: 'Test dispatch message'
      })
    });
    assert.ok([200, 201].includes(sentRes.status));

    // Verify each stage can be sent only once: this invoice with this stage is no longer in actionable followups
    const followupsAfterSent = await (await fetch(`${baseUrl}/followups`)).json();
    const stillPresent = followupsAfterSent.some(f => f.invoice_id === testInvoiceId && f.stage === testStage);
    assert.equal(stillPresent, false, 'Sent stage must not appear again in actionable followups');

    // 5. Test Snooze: POST /api/invoices/:id/snooze
    const snoozeTarget = followupsAfterSent[0];
    if (snoozeTarget) {
      const snoozeRes = await fetch(`${baseUrl}/invoices/${snoozeTarget.invoice_id}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7 })
      });
      assert.equal(snoozeRes.status, 200);
      const snoozeData = await snoozeRes.json();
      assert.ok(snoozeData.snoozed_until >= '2026-10-22');

      // Verify invoice is paused from followups
      const followupsAfterSnooze = await (await fetch(`${baseUrl}/followups`)).json();
      const isSnoozedPresent = followupsAfterSnooze.some(f => f.invoice_id === snoozeTarget.invoice_id);
      assert.equal(isSnoozedPresent, false, 'Snoozed invoice must be paused from followups');
    }

    // 6. Test Dispute pause: POST /api/invoices/:id/dispute
    const disputeTarget = (await (await fetch(`${baseUrl}/followups`)).json())[0];
    if (disputeTarget) {
      const disputeRes = await fetch(`${baseUrl}/invoices/${disputeTarget.invoice_id}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Damaged cartons reported in consignment',
          amount_paise: 50000
        })
      });
      assert.equal(disputeRes.status, 201);

      // Verify invoice status updated to DISPUTED and ladder paused
      const checkInv = await (await fetch(`${baseUrl}/invoices/${disputeTarget.invoice_id}`)).json();
      assert.equal(checkInv.status, 'DISPUTED');

      const followupsAfterDispute = await (await fetch(`${baseUrl}/followups`)).json();
      const isDisputedPresent = followupsAfterDispute.some(f => f.invoice_id === disputeTarget.invoice_id);
      assert.equal(isDisputedPresent, false, 'Disputed invoice must be paused from reminder ladder');
    }

    // 7. Test Promise to pay pause: POST /api/invoices/:id/promise
    const promiseTarget = (await (await fetch(`${baseUrl}/followups`)).json())[0];
    if (promiseTarget) {
      const promiseRes = await fetch(`${baseUrl}/invoices/${promiseTarget.invoice_id}/promise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promised_date: '2026-11-25', // Promised in late November
          amount_paise: promiseTarget.balance_paise,
          notes: 'Customer CFO confirmed payment settlement'
        })
      });
      assert.equal(promiseRes.status, 201);

      // Verify ladder is paused while promise is active
      const followupsAfterPromise = await (await fetch(`${baseUrl}/followups`)).json();
      const isPromisedPresent = followupsAfterPromise.some(f => f.invoice_id === promiseTarget.invoice_id);
      assert.equal(isPromisedPresent, false, 'Invoice with active promise must be paused from reminder ladder');
    }
  });

  test('SPEC Test 17: Public pay endpoints, already-paid inbox items, and dashboard metrics', async () => {
    // 1. Fetch an invoice to get its payment_token
    const invRes = await fetch(`${baseUrl}/invoices`);
    const invoices = await invRes.json();
    const unpaidInvoice = invoices.find(i => i.balance_paise > 0 && i.status !== 'DISPUTED');
    assert.ok(unpaidInvoice, 'Must find unpaid invoice');
    const token = unpaidInvoice.payment_token;
    assert.ok(token, 'Invoice must have a payment_token');

    // 2. GET /api/public/pay/:token
    const publicPayRes = await fetch(`${baseUrl}/public/pay/${token}`);
    assert.equal(publicPayRes.status, 200);
    const payPage = await publicPayRes.json();
    assert.equal(payPage.invoice_number, unpaidInvoice.invoice_number);
    assert.equal(payPage.balance_paise, unpaidInvoice.balance_paise);
    assert.ok(payPage.business.name.includes('Sharma Packaging'));
    assert.ok(payPage.business.upi_id, 'Must provide UPI ID for payment');

    // 3. POST /api/public/pay/:token/already-paid (creates inbox item)
    const claimRes = await fetch(`${baseUrl}/public/pay/${token}/already-paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_date: '2026-10-22',
        amount_paise: unpaidInvoice.balance_paise,
        payment_mode: 'UPI',
        reference_no: 'UPI-REF-998877',
        notes: 'Paid via PhonePe QR code at plant gate'
      })
    });
    assert.equal(claimRes.status, 201);
    const claimData = await claimRes.json();
    assert.equal(claimData.inbox_item.type, 'PAYMENT_CLAIM');
    assert.equal(claimData.inbox_item.status, 'PENDING');
    assert.equal(claimData.inbox_item.reference_no, 'UPI-REF-998877');

    // 4. Public dispute: POST /api/public/pay/:token/dispute
    // Create another invoice to test public dispute
    const custRes = await fetch(`${baseUrl}/customers`);
    const customers = await custRes.json();
    const newInvRes = await fetch(`${baseUrl}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customers[0].id,
        items: [{ description: 'Paper Bags', qty: 10, ratePaise: rupeesToPaise(100), gstRate: 18 }]
      })
    });
    const newInv = await newInvRes.json();
    assert.ok(newInv.payment_token);

    const disputeRes = await fetch(`${baseUrl}/public/pay/${newInv.payment_token}/dispute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: 'Quantity received was 8 boxes instead of 10'
      })
    });
    assert.equal(disputeRes.status, 201);
    const disputeData = await disputeRes.json();
    assert.equal(disputeData.status, 'DISPUTED');

    // Verify invoice status in DB is now DISPUTED
    const verifiedInv = await (await fetch(`${baseUrl}/invoices/${newInv.id}`)).json();
    assert.equal(verifiedInv.status, 'DISPUTED');

    // 5. Test Dashboard Endpoint: GET /api/dashboard
    const dashRes = await fetch(`${baseUrl}/dashboard`);
    assert.equal(dashRes.status, 200);
    const dash = await dashRes.json();

    // Verify totals
    assert.ok(dash.totals.total_receivables_paise > 0, 'Receivables total must be positive');
    assert.ok(dash.totals.total_collected_paise > 0, 'Collected total must be positive');
    assert.ok(dash.totals.total_overdue_paise > 0, 'Overdue total must be positive');
    assert.ok(dash.totals.total_disputed_paise > 0, 'Disputed total must be positive');

    // Verify ageing buckets
    assert.ok(dash.ageing_buckets['0_30']);
    assert.ok(dash.ageing_buckets['31_60']);
    assert.ok(dash.ageing_buckets['61_90']);
    assert.ok(dash.ageing_buckets['90_plus']);
    assert.ok(typeof dash.ageing_buckets['0_30'].formatted_amount === 'string');

    // Verify expected cash
    assert.ok(dash.expected_this_week_paise >= 0);
    assert.ok(dash.expected_this_month_paise >= 0);

    // Verify lowest forecast
    assert.ok(dash.lowest_forecast);
    assert.equal(dash.lowest_forecast.is_deficit, true);
    assert.ok(dash.lowest_forecast.deficit_paise > 0);

    // Verify top 5 chase list
    assert.equal(dash.top_chase_list.length, 5);
    assert.ok(dash.top_chase_list[0].score >= dash.top_chase_list[1].score);
    assert.equal(dash.top_chase_list[0].label, '🔥 Chase First');
  });
});
