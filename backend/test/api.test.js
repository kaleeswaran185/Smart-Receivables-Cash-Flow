import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../src/app.js';
import { createDatabase, setDatabase } from '../src/db.js';
import { seedDatabase } from '../src/seed.js';
import { rupeesToPaise } from '../src/lib/money.js';

describe('SPEC Tests 9 to 11: REST APIs, Payments & Reliability Stats', () => {
  let server;
  let baseUrl;
  let db;

  before(async () => {
    // Set up database in a dedicated test file
    process.env.DATABASE_PATH = ':memory:';
    db = createDatabase(':memory:');

    // Run seed to populate Sharma Packaging, 12 customers, 40 invoices, etc.
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

  test('SPEC Test 9: Server recalculates all totals, ignores tampered frontend numbers', async () => {
    // Fetch a customer in Maharashtra (same state as Sharma Packaging)
    const custRes = await fetch(`${baseUrl}/customers`);
    const customers = await custRes.json();
    const mhCustomer = customers.find(c => c.state_code === '27');
    assert.ok(mhCustomer, 'Must find Maharashtra customer');

    // Payload with deliberately corrupted/tampered frontend numbers
    const tamperedPayload = {
      customer_id: mhCustomer.id,
      invoice_number: `TEST-INV-${Date.now()}`,
      invoice_date: '2026-10-22',
      // FAKE TOTALS SENT BY FRONTEND:
      total_paise: 99999999,
      taxable_paise: 1111,
      cgst_paise: 0,
      sgst_paise: 0,
      subtotal_paise: 5555,
      items: [
        {
          description: 'Custom Corrugated Cartons',
          hsnCode: '481910',
          qty: 2,
          ratePaise: rupeesToPaise(1000), // 2 * 1000 = ₹2,000 = 200000 paise
          discountPercent: 10,           // 10% discount = ₹200 = 20000 paise
          gstRate: 18                    // 18% GST on ₹1,800 = ₹324 (CGST 162 + SGST 162)
        }
      ]
    };

    const res = await fetch(`${baseUrl}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tamperedPayload)
    });

    assert.equal(res.status, 201);
    const invoice = await res.json();

    // Verify backend calculated the true numbers and IGNORED the tampered values
    assert.notEqual(invoice.total_paise, 99999999, 'Backend must NOT accept frontend total_paise');
    assert.equal(invoice.subtotal_paise, 200000, 'Subtotal must be 200000 paise (₹2,000)');
    assert.equal(invoice.discount_paise, 20000, 'Discount must be 20000 paise (₹200)');
    assert.equal(invoice.taxable_paise, 180000, 'Taxable must be 180000 paise (₹1,800)');
    assert.equal(invoice.cgst_paise, 16200, 'CGST must be 16200 paise (9% = ₹162)');
    assert.equal(invoice.sgst_paise, 16200, 'SGST must be 16200 paise (9% = ₹162)');
    assert.equal(invoice.igst_paise, 0, 'IGST must be 0 for intra-state');
    assert.equal(invoice.round_off_paise, 0, 'Round off must be 0');
    assert.equal(invoice.total_paise, 212400, 'Total must be 212400 paise (₹2,124)');
    assert.equal(invoice.balance_paise, 212400, 'Initial balance must match total');
    assert.equal(invoice.invoice_type, 'Tax Invoice');

    // Also verify GET :id retrieves the items and timeline
    const getRes = await fetch(`${baseUrl}/invoices/${invoice.id}`);
    assert.equal(getRes.status, 200);
    const detail = await getRes.json();
    assert.equal(detail.items.length, 1);
    assert.equal(detail.items[0].taxable_paise, 180000);
    assert.ok(detail.timeline.length >= 1, 'Timeline must contain invoice creation event');
  });

  test('SPEC Test 10: Payment logic (partial payment, overpayment flag, confirm step)', async () => {
    // 1. Create a fresh invoice of ₹10,000 + 18% IGST = ₹11,800 (1180000 paise)
    const custRes = await fetch(`${baseUrl}/customers`);
    const customers = await custRes.json();
    const kaCustomer = customers.find(c => c.state_code === '29'); // Karnataka (inter-state)

    const invRes = await fetch(`${baseUrl}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: kaCustomer.id,
        invoice_number: `PAY-TEST-${Date.now()}`,
        items: [
          {
            description: 'Test Box',
            qty: 1,
            ratePaise: rupeesToPaise(10000),
            gstRate: 18
          }
        ]
      })
    });

    const invoice = await invRes.json();
    const initialBalance = invoice.total_paise; // 1180000 paise (₹11,800)
    assert.equal(initialBalance, 1180000);

    // 2. Sub-test: Partial payment (₹4,000 = 400000 paise)
    const partialRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_id: invoice.id,
        amount_paise: 400000,
        payment_mode: 'NEFT',
        reference_no: 'NEFT123456'
      })
    });

    assert.equal(partialRes.status, 201);
    const partialData = await partialRes.json();
    assert.equal(partialData.invoice.status, 'PARTIALLY_PAID');
    assert.equal(partialData.invoice.paid_paise, 400000);
    assert.equal(partialData.invoice.balance_paise, 780000); // 1180000 - 400000

    // 3. Sub-test: Overpayment is flagged & rejected
    // Remaining balance is ₹7,800 (780000 paise). Attempting to pay ₹8,000 (800000 paise).
    const overpayRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_id: invoice.id,
        amount_paise: 800000
      })
    });

    assert.equal(overpayRes.status, 400);
    const overpayData = await overpayRes.json();
    assert.equal(overpayData.error, 'OVERPAYMENT_FLAGGED');
    assert.equal(overpayData.invoiceBalancePaise, 780000);

    // 4. Sub-test: Full payment WITHOUT explicit confirmation must NOT auto-mark paid
    const fullNoConfirmRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_id: invoice.id,
        amount_paise: 780000 // exact remaining balance
        // confirm flag omitted!
      })
    });

    assert.equal(fullNoConfirmRes.status, 400);
    const fullNoConfirmData = await fullNoConfirmRes.json();
    assert.equal(fullNoConfirmData.requiresConfirmation, true);
    assert.equal(fullNoConfirmData.code, 'CONFIRM_PAID_REQUIRED');

    // Verify invoice status in DB is still PARTIALLY_PAID and balance is still 780000
    const checkInv1 = await (await fetch(`${baseUrl}/invoices/${invoice.id}`)).json();
    assert.equal(checkInv1.status, 'PARTIALLY_PAID');
    assert.equal(checkInv1.balance_paise, 780000);

    // 5. Sub-test: Full payment WITH explicit confirmation marks as PAID
    const fullConfirmedRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_id: invoice.id,
        amount_paise: 780000,
        confirm: true
      })
    });

    assert.equal(fullConfirmedRes.status, 201);
    const fullConfirmedData = await fullConfirmedRes.json();
    assert.equal(fullConfirmedData.invoice.status, 'PAID');
    assert.equal(fullConfirmedData.invoice.balance_paise, 0);
    assert.equal(fullConfirmedData.invoice.paid_paise, 1180000);

    // Verify timeline on GET /invoices/:id includes both payments
    const finalDetail = await (await fetch(`${baseUrl}/invoices/${invoice.id}`)).json();
    assert.equal(finalDetail.payments.length, 2);
    const paymentEvents = finalDetail.timeline.filter(t => t.type === 'PAYMENT_RECEIVED');
    assert.equal(paymentEvents.length, 2);
  });

  test('SPEC Test 11: Customer stats & reliability grading (A/B/C with explanation)', async () => {
    const res = await fetch(`${baseUrl}/customers`);
    assert.equal(res.status, 200);
    const customers = await res.json();
    assert.equal(customers.length, 12, 'Must return 12 seeded customers');

    // Find customers from each behavior tier
    const gradeACustomer = customers.find(c => c.name === 'Apex Logistics Pune');
    const gradeBCustomer = customers.find(c => c.name === 'Hyderabad Bio Labs');
    const gradeCCustomer = customers.find(c => c.name === 'Kolkata Jute & Packaging');

    assert.ok(gradeACustomer, 'Grade A customer exists');
    assert.ok(gradeBCustomer, 'Grade B customer exists');
    assert.ok(gradeCCustomer, 'Grade C customer exists');

    // 1. Grade A verification
    assert.equal(gradeACustomer.stats.reliabilityGrade, 'A');
    assert.ok(gradeACustomer.stats.onTimePercentage >= 80, 'Grade A on-time % must be >= 80');
    assert.ok(gradeACustomer.stats.averagePaymentDelayDays <= 5, 'Grade A average delay must be <= 5 days');
    assert.ok(gradeACustomer.stats.reliabilityExplanation.length > 10, 'Must have text explanation');

    // 2. Grade B verification
    assert.equal(gradeBCustomer.stats.reliabilityGrade, 'B');
    assert.ok(gradeBCustomer.stats.reliabilityExplanation.includes('Moderate') || gradeBCustomer.stats.reliabilityExplanation.includes('buffer'));

    // 3. Grade C verification
    assert.equal(gradeCCustomer.stats.reliabilityGrade, 'C');
    assert.ok(gradeCCustomer.stats.reliabilityExplanation.includes('High credit risk') || gradeCCustomer.stats.reliabilityExplanation.includes('delay'));
  });

  test('Invoices filtering & search functionality', async () => {
    // 1. Filter by customer_id
    const cust = (await (await fetch(`${baseUrl}/customers`)).json())[0];
    const custInvoices = await (await fetch(`${baseUrl}/invoices?customer_id=${cust.id}`)).json();
    assert.ok(custInvoices.length > 0);
    custInvoices.forEach(inv => assert.equal(inv.customer_id, cust.id));

    // 2. Filter by status=PAID
    const paidInvoices = await (await fetch(`${baseUrl}/invoices?status=PAID`)).json();
    assert.ok(paidInvoices.length >= 16);
    paidInvoices.forEach(inv => assert.equal(inv.status, 'PAID'));

    // 3. Filter by status=due_soon
    const dueSoonInvoices = await (await fetch(`${baseUrl}/invoices?status=due_soon`)).json();
    assert.ok(dueSoonInvoices.length > 0);

    // 4. Search query
    const searchRes = await (await fetch(`${baseUrl}/invoices?search=Apex`)).json();
    assert.ok(searchRes.length > 0);
    searchRes.forEach(inv => {
      const match = inv.invoice_number.includes('Apex') || inv.customer_name.includes('Apex') || (inv.customer_company && inv.customer_company.includes('Apex'));
      assert.ok(match);
    });
  });
});
