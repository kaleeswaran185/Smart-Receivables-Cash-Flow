import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { getDatabase } from '../backend/src/db.js';

async function run() {
  console.log('Launching browser for Inbox UI E2E test...');
  const db = getDatabase();

  // Find an active unpaid invoice
  const inv = db.prepare("SELECT * FROM invoices WHERE balance_paise > 0 AND status NOT IN ('PAID', 'CANCELLED', 'DISPUTED') LIMIT 1").get();
  assert.ok(inv, 'No unpaid invoice available in database');
  console.log(`Using Invoice #${inv.invoice_number} (ID ${inv.id}, Balance: ${inv.balance_paise}) for test`);

  // Clear any old pending claims for this invoice to have a clean test
  db.prepare("DELETE FROM inbox_items WHERE invoice_id = ?").run(inv.id);

  // Insert a fresh pending claim for this invoice
  const insertClaim = db.prepare(`
    INSERT INTO inbox_items (business_id, invoice_id, customer_id, type, payment_date, amount_paise, payment_mode, reference_no, notes, status)
    VALUES (?, ?, ?, 'PAYMENT_CLAIM', '2026-10-22', ?, 'UPI', ?, 'Playwright E2E Claim', 'PENDING')
  `).run(inv.business_id, inv.id, inv.customer_id, inv.balance_paise, `E2E-REF-${Date.now()}`);

  const claimId = insertClaim.lastInsertRowid;
  console.log(`Created pending claim #${claimId} for invoice #${inv.invoice_number}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('E2E CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('E2E PAGE ERROR:', err.message));

  // 1. Login to UI
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');
  const demoBtn = page.getByRole('button', { name: /enter demo/i });
  if (await demoBtn.count() > 0) {
    await demoBtn.click();
  } else {
    await page.fill('input[type="email"]', 'owner@baaki.app');
    await page.fill('input[type="password"]', 'baaki123');
    await page.click('button[type="submit"]');
  }
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  console.log('Logged into dashboard successfully.');

  // 2. Navigate to Inbox
  await page.goto('http://localhost:3000/inbox');
  await page.waitForLoadState('networkidle');

  // Find the button with "Mark as Paid" or "Accept & Mark Paid"
  const markAsPaidBtn = page.getByRole('button', { name: /mark as paid/i }).first();
  await markAsPaidBtn.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Found Mark as Paid button on Inbox. Clicking it now...');

  // Click the button
  await markAsPaidBtn.click();

  // 3. Verify Success Toast appears and is visible
  const successToast = page.locator('div[role="status"]');
  await successToast.waitFor({ state: 'visible', timeout: 5000 });
  const toastText = await successToast.innerText();
  console.log('Success Toast Verified:', toastText);
  assert.ok(toastText.includes('accepted') || toastText.includes('PAID') || toastText.includes('verified'), 'Toast must indicate success');

  // 4. Verify downstream effect: Invoice detail reflects PAID status and balance 0
  await page.goto(`http://localhost:3000/invoices/${inv.id}`);
  await page.waitForLoadState('networkidle');
  const invoicePageText = await page.innerText('body');
  assert.ok(invoicePageText.includes('PAID') || invoicePageText.includes('Paid'), 'Invoice detail must show Paid');
  console.log(`Downstream effect verified: Invoice #${inv.invoice_number} is PAID.`);

  // 5. Verify timeline on invoice detail includes the recorded payment
  assert.ok(invoicePageText.includes('Payment Received') || invoicePageText.includes('Full settlement') || invoicePageText.includes('Verified customer online claim') || invoicePageText.includes('Playwright E2E Claim'), 'Timeline must show payment event');
  console.log('Timeline verified with payment event.');

  await browser.close();
  console.log('--- ALL INBOX E2E UI TESTS PASSED SUCCESSFULLY! ---');
}

run().catch(err => {
  console.error('Inbox UI E2E failed:', err);
  process.exit(1);
});
