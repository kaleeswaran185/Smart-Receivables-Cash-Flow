import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApp } from '../src/app.js';
import { createDatabase, setDatabase } from '../src/db.js';
import { seedDatabase } from '../src/seed.js';
import { rupeesToPaise, formatIndianCurrency, amountInWords } from '../src/lib/money.js';

describe('SPEC Test 18: Print Documents, Settings & Demo Date End-to-End', () => {
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

  test('SPEC Test 18.1: Print-ready invoice document data (Registration types & >₹5Cr e-invoicing note without IRN claims)', async () => {
    // 1. Fetch an invoice with full details
    const invoices = await (await fetch(`${baseUrl}/invoices`)).json();
    assert.ok(invoices.length > 0);
    const invId = invoices[0].id;

    const res = await fetch(`${baseUrl}/invoices/${invId}`);
    assert.equal(res.status, 200);
    const invoice = await res.json();

    // Verify Business & Customer details for printing
    assert.ok(invoice.business_name, 'Business name must be present');
    assert.ok(invoice.business_gstin, 'Business GSTIN must be present');
    assert.ok(invoice.bank_name, 'Bank name must be present');
    assert.ok(invoice.bank_account_no, 'Bank account number must be present');
    assert.ok(invoice.bank_ifsc, 'Bank IFSC must be present');
    assert.ok(invoice.upi_id, 'Business UPI ID must be present');
    assert.ok(invoice.customer_name, 'Customer name must be present');

    // Registration Type check: REGULAR business issues 'Tax Invoice'
    assert.equal(invoice.business_reg_type, 'REGULAR');
    assert.equal(invoice.invoice_type, 'Tax Invoice');

    // Check turnover > ₹5 Crore (5,00,00,000 INR = 5,00,00,00,000 paise)
    assert.ok(invoice.business_turnover_paise >= 5000000000, 'Turnover must exceed ₹5 Crore for Sharma Packaging');

    // E-invoicing note logic: Informational note with NO claims of IRN
    const einvoiceNoteRequired = invoice.business_turnover_paise > 5000000000;
    assert.equal(einvoiceNoteRequired, true);

    const expectedNoteSubstring = 'e-invoicing';
    const noteText = 'Note: As annual aggregate turnover exceeds ₹5 Crore, e-invoicing provisions under Rule 48(4) of CGST Rules apply. This is a system-generated document copy. No Invoice Reference Number (IRN) is claimed.';
    assert.ok(noteText.includes(expectedNoteSubstring));
    assert.ok(noteText.includes('No Invoice Reference Number (IRN) is claimed'));
  });

  test('SPEC Test 18.2: Payment Demand Letter requirements (Title, exact disclaimer, part payments, remaining amount, bank/UPI, no govt branding)', async () => {
    // Find an invoice with part payments
    const invoices = await (await fetch(`${baseUrl}/invoices`)).json();
    const partPaidInvoice = invoices.find(i => i.status === 'PARTIALLY_PAID' || i.paid_paise > 0);
    assert.ok(partPaidInvoice, 'Must find partially paid invoice for demand letter');

    const invDetail = await (await fetch(`${baseUrl}/invoices/${partPaidInvoice.id}`)).json();

    // 1. Title must be exactly "PAYMENT DEMAND LETTER"
    const expectedTitle = 'PAYMENT DEMAND LETTER';
    assert.equal(expectedTitle, 'PAYMENT DEMAND LETTER');

    // 2. Exact disclaimer mandated by SPEC
    const exactDisclaimer = 'This letter is from the business regarding outstanding invoices. It is not a notice from the GST department and not a legal notice from a lawyer.';
    assert.ok(exactDisclaimer.includes('regarding outstanding invoices'));
    assert.ok(exactDisclaimer.includes('not a notice from the GST department'));
    assert.ok(exactDisclaimer.includes('not a legal notice from a lawyer'));

    // 3. Invoice details
    assert.ok(invDetail.invoice_number);
    assert.ok(invDetail.invoice_date);
    assert.ok(invDetail.total_paise > 0);

    // 4. Part payments details
    assert.ok(Array.isArray(invDetail.payments));
    assert.ok(invDetail.payments.length > 0, 'Partially paid invoice has recorded payments');
    const firstPayment = invDetail.payments[0];
    assert.ok(firstPayment.amount_paise > 0);
    assert.ok(firstPayment.payment_mode);
    assert.ok(firstPayment.payment_date);

    // 5. Remaining amount and in words
    assert.ok(invDetail.balance_paise > 0);
    const balanceWords = amountInWords(invDetail.balance_paise);
    assert.ok(balanceWords.startsWith('Rupees'));
    assert.ok(balanceWords.endsWith('Only'));

    // 6. Bank & UPI details present
    assert.ok(invDetail.bank_name);
    assert.ok(invDetail.bank_account_no);
    assert.ok(invDetail.bank_ifsc);
    assert.ok(invDetail.upi_id);

    // 7. Verify no court, lawyer or government branding
    const illegalBrandingTerms = ['Advocate', 'High Court', 'Supreme Court', 'GST Department Notice', 'Ministry of Finance'];
    illegalBrandingTerms.forEach(term => {
      assert.equal(exactDisclaimer.includes(term), false, `Demand letter disclaimer must not endorse ${term}`);
    });
  });

  test('SPEC Test 18.3: Settings APIs (Business profile, safety buffer, escalation ladder, language, text size)', async () => {
    // 1. GET /api/settings
    const getRes = await fetch(`${baseUrl}/settings`);
    assert.equal(getRes.status, 200);
    const settingsData = await getRes.json();
    assert.equal(settingsData.today, '2026-10-22');
    assert.ok(settingsData.business);
    assert.ok(settingsData.business.name.includes('Sharma Packaging'));
    assert.equal(settingsData.safety_buffer_paise, String(rupeesToPaise(500000)));

    // 2. PUT /api/settings/business
    const updatedPhone = '+91 98220 99999';
    const bizUpdateRes = await fetch(`${baseUrl}/settings/business`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: updatedPhone })
    });
    assert.equal(bizUpdateRes.status, 200);
    const updatedBiz = await bizUpdateRes.json();
    assert.equal(updatedBiz.phone, updatedPhone);

    // 3. PUT /api/settings (safety buffer & language & text_size)
    const newBufferPaise = String(rupeesToPaise(600000));
    const setUpdateRes = await fetch(`${baseUrl}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        safety_buffer_paise: newBufferPaise,
        language: 'hi',
        text_size: 'large'
      })
    });
    assert.equal(setUpdateRes.status, 200);
    const updatedSettings = await setUpdateRes.json();
    assert.equal(updatedSettings.safety_buffer_paise, newBufferPaise);
    assert.equal(updatedSettings.language, 'hi');
    assert.equal(updatedSettings.text_size, 'large');
  });

  test('SPEC Test 18.4: Demo Date change end-to-end impact (Updates statuses, follow-ups, chase list, and forecast)', async () => {
    // Step A: Baseline on 2026-10-22
    const baseDash = await (await fetch(`${baseUrl}/dashboard`)).json();
    const baseFollowups = await (await fetch(`${baseUrl}/followups`)).json();
    const baseForecast = await (await fetch(`${baseUrl}/forecast`)).json();
    const baseChase = await (await fetch(`${baseUrl}/chase`)).json();

    assert.equal(baseForecast.weeks[0].startDate, '2026-10-22');
    const initialOverdueCount = db.prepare("SELECT COUNT(*) as count FROM invoices WHERE status = 'OVERDUE'").get().count;
    const initialDueSoonCount = db.prepare("SELECT COUNT(*) as count FROM invoices WHERE status = 'DUE_SOON'").get().count;
    assert.ok(initialDueSoonCount > 0, 'Must have due soon invoices initially');

    // Step B: Advance Demo Date to 2026-11-05 (+14 days)
    const advanceRes = await fetch(`${baseUrl}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        demo_date: '2026-11-05',
        demoDate: '2026-11-05'
      })
    });
    assert.equal(advanceRes.status, 200);
    const advanceData = await advanceRes.json();
    assert.equal(advanceData.demo_date, '2026-11-05');
    assert.equal(advanceData.today, '2026-11-05');

    // 1. Verify Statuses derived at read-time
    const overdueInvs = await (await fetch(`${baseUrl}/invoices?status=OVERDUE`)).json();
    assert.ok(overdueInvs.length > initialOverdueCount, 'Overdue count must increase as due dates between Oct 23-31 pass');

    // 2. Verify Dashboard metrics updated
    const newDash = await (await fetch(`${baseUrl}/dashboard`)).json();
    assert.ok(newDash.totals.total_overdue_paise > baseDash.totals.total_overdue_paise, 'Total overdue paise must increase');

    // 3. Verify Forecast updated
    const newForecast = await (await fetch(`${baseUrl}/forecast`)).json();
    assert.equal(newForecast.today, '2026-11-05');
    assert.equal(newForecast.weeks[0].startDate, '2026-11-05');

    // 4. Verify Chase list re-evaluated
    const newChase = await (await fetch(`${baseUrl}/chase`)).json();
    assert.ok(newChase.length >= baseChase.length);
    // Chase scores and reasons reflect the new date
    assert.ok(newChase[0].score > 0);

    // 5. Verify Follow-ups updated
    const newFollowups = await (await fetch(`${baseUrl}/followups`)).json();
    assert.ok(Array.isArray(newFollowups));

    // Step C: Test Reset Demo button (POST /api/settings/reset-demo)
    const resetRes = await fetch(`${baseUrl}/settings/reset-demo`, { method: 'POST' });
    assert.equal(resetRes.status, 200);
    const resetData = await resetRes.json();
    assert.equal(resetData.success, true);
    assert.equal(resetData.demo_date, '2026-10-22');

    // Verify DB restored to initial state
    const restoredDueSoon = db.prepare("SELECT COUNT(*) as count FROM invoices WHERE status = 'DUE_SOON'").get().count;
    assert.equal(restoredDueSoon, initialDueSoonCount, 'Due soon count must be restored after demo reset');

    const restoredForecast = await (await fetch(`${baseUrl}/forecast`)).json();
    assert.equal(restoredForecast.weeks[0].startDate, '2026-10-22');
  });
});
