import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const axePath = path.resolve(__dirname, 'node_modules/axe-core/axe.min.js');

const routes = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Inbox', path: '/inbox' },
  { name: 'Follow-ups', path: '/followups' },
  { name: 'Invoices', path: '/invoices' },
  { name: 'Customers', path: '/customers' },
  { name: 'Forecast', path: '/forecast' },
  { name: 'Payments', path: '/payments' },
  { name: 'Settings', path: '/settings' }
];

const viewports = [
  { name: '1280px', width: 1280, height: 800 },
  { name: '360px', width: 360, height: 740 }
];

async function runAudit() {
  console.log('Running Axe-core Color Contrast Audit...');
  const axeSource = fs.readFileSync(axePath, 'utf8');

  // Fetch valid auth token from backend
  const authRes = await fetch('http://localhost:5000/api/auth/demo-login', { method: 'POST' }).then(r => r.json());
  const token = authRes?.token;
  if (!token) throw new Error('Failed to obtain demo auth token');

  const browser = await chromium.launch({ headless: true });
  const allViolations = [];

  for (const vp of viewports) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: theme
      });

      // Inject auth token so all routes load authenticated immediately
      await context.addInitScript((tok) => {
        localStorage.setItem('baaki_auth_token', tok);
      }, token);

      const page = await context.newPage();

      for (const route of routes) {
        await page.goto(`http://localhost:3000${route.path}`);
        await page.waitForLoadState('networkidle');

        if (theme === 'dark') {
          await page.evaluate(() => document.documentElement.classList.add('dark'));
        } else {
          await page.evaluate(() => document.documentElement.classList.remove('dark'));
        }
        await page.waitForTimeout(500);

        // Inject axe
        await page.evaluate(axeSource);

        const results = await page.evaluate(async () => {
          return await window.axe.run(document, {
            runOnly: {
              type: 'rule',
              values: ['color-contrast']
            }
          });
        });

        const violations = results.violations.flatMap(v => v.nodes.map(n => ({
          route: route.path,
          viewport: vp.name,
          theme,
          target: n.target.join(' > '),
          html: n.html,
          failureSummary: n.failureSummary
        })));

        if (violations.length > 0) {
          console.log(`[VIOLATION] ${route.name} (${vp.name}, ${theme}): ${violations.length} contrast issue(s)`);
          allViolations.push(...violations);
        } else {
          console.log(`[PASS] ${route.name} (${vp.name}, ${theme}): 0 contrast issues`);
        }
      }

      await context.close();
    }
  }

  await browser.close();

  console.log(`\n========================================`);
  console.log(`TOTAL CONTRAST VIOLATIONS FOUND: ${allViolations.length}`);
  console.log(`========================================\n`);

  fs.writeFileSync('contrast_violations_after.json', JSON.stringify(allViolations, null, 2));

  if (allViolations.length > 0) {
    console.error(`Audit FAILED: ${allViolations.length} color-contrast violation(s) found!`);
    process.exit(1);
  } else {
    console.log(`Audit SUCCESS: 0 color-contrast violations across all routes, viewports, and themes!`);
  }
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
