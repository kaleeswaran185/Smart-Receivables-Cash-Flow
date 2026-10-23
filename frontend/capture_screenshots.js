import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const routes = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'inbox', path: '/inbox' },
  { name: 'followups', path: '/followups' },
  { name: 'invoices', path: '/invoices' }
];

const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 360, height: 740 }
];

async function capture(phase = 'before') {
  const outDir = path.resolve(`../screenshots/${phase}`);
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  for (const vp of viewports) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: theme
      });
      const page = await context.newPage();

      // Login
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

      // If theme is dark, set dark class on document element
      if (theme === 'dark') {
        await page.evaluate(() => {
          document.documentElement.classList.add('dark');
        });
      } else {
        await page.evaluate(() => {
          document.documentElement.classList.remove('dark');
        });
      }

      for (const route of routes) {
        await page.goto(`http://localhost:3000${route.path}`);
        await page.waitForLoadState('networkidle');
        if (theme === 'dark') {
          await page.evaluate(() => document.documentElement.classList.add('dark'));
        }
        await page.waitForTimeout(600); // allow charts/animations to settle

        const filename = `${route.name}_${vp.name}_${theme}.png`;
        const filepath = path.join(outDir, filename);
        await page.screenshot({ path: filepath, fullPage: false });
        console.log(`Saved screenshot: ${filepath}`);
      }

      await context.close();
    }
  }

  await browser.close();
  console.log(`--- Finished capturing ${phase} screenshots! ---`);
}

const phase = process.argv[2] || 'before';
capture(phase).catch(err => {
  console.error('Failed to capture screenshots:', err);
  process.exit(1);
});
