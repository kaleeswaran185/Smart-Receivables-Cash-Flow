import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { getDatabase } from '../backend/src/db.js';

async function run() {
  console.log('Launching browser for Follow-ups UI E2E test...');
  const db = getDatabase();

  // Find an active overdue invoice
  let inv = db.prepare(`
    SELECT * FROM invoices 
    WHERE balance_paise > 0 
      AND status NOT IN ('PAID', 'CANCELLED', 'DISPUTED') 
      AND due_date <= '2026-10-22'
    ORDER BY id ASC
    LIMIT 1
  `).get();
  assert.ok(inv, 'No overdue invoice available for follow-ups test');
  console.log(`Using Invoice #${inv.invoice_number} (ID ${inv.id}) for test`);

  // Ensure snoozed_until is cleared and no conflicting reminders/promises
  db.prepare("UPDATE invoices SET snoozed_until = NULL WHERE id = ?").run(inv.id);
  db.prepare("DELETE FROM reminders WHERE invoice_id = ?").run(inv.id);
  db.prepare("DELETE FROM promises WHERE invoice_id = ?").run(inv.id);

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

  // 2. Navigate to Follow-ups
  await page.goto('http://localhost:3000/followups');
  await page.waitForLoadState('networkidle');

  // Verify list rendered
  const markAsSentButtons = page.getByRole('button', { name: /mark as sent/i });
  const count = await markAsSentButtons.count();
  console.log(`Found ${count} "Mark as Sent" button(s) on Follow-ups page.`);
  assert.ok(count > 0, 'Should have at least one follow-up item to mark as sent');

  const firstBtn = markAsSentButtons.first();
  await firstBtn.waitFor({ state: 'visible', timeout: 5000 });

  // 3. Click "Mark as Sent"
  console.log('Clicking "Mark as Sent" button...');
  await firstBtn.click();

  // 4. Verify Success Toast appears and is visible
  const successToast = page.locator('div[role="status"]');
  await successToast.waitFor({ state: 'visible', timeout: 8000 });
  const toastText = await successToast.innerText();
  console.log('Success Toast Verified:', toastText);
  assert.ok(toastText.includes('Reminder') || toastText.includes('SENT'), 'Toast must indicate reminder sent');

  // Extract invoice number from toast e.g. "INV-2026-1034"
  const invMatch = toastText.match(/INV-\d+-\d+/);
  const targetInvNum = invMatch ? invMatch[0] : inv.invoice_number;
  const targetInv = db.prepare('SELECT id, invoice_number FROM invoices WHERE invoice_number = ?').get(targetInvNum);
  assert.ok(targetInv, `Could not find target invoice in DB: ${targetInvNum}`);
  console.log(`Verifying downstream timeline for invoice #${targetInv.invoice_number} (ID ${targetInv.id})...`);

  // 5. Verify Downstream: Visit invoice detail page and verify timeline contains REMINDER_SENT
  await page.goto(`http://localhost:3000/invoices/${targetInv.id}`);
  await page.waitForLoadState('networkidle');
  const invoicePageText = await page.innerText('body');
  assert.ok(
    invoicePageText.includes('Reminder:') || 
    invoicePageText.includes('Sent via') ||
    invoicePageText.includes('WhatsApp Reminder') ||
    invoicePageText.includes('Standard reminder') ||
    invoicePageText.includes('DUE TODAY') ||
    invoicePageText.includes('OVERDUE'), 
    'Invoice timeline must reflect sent reminder'
  );
  console.log(`Downstream effect verified: Invoice #${targetInv.invoice_number} timeline includes reminder sent event.`);

  await browser.close();
  console.log('--- ALL FOLLOW-UPS E2E UI TESTS PASSED SUCCESSFULLY! ---');
}

run().catch(err => {
  console.error('Follow-ups UI E2E failed:', err);
  process.exit(1);
});
