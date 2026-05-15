import { chromium } from '@playwright/test';
import { setTimeout as wait } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'docs', 'screenshot.png');

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 1200 },
  deviceScaleFactor: 2
});
const page = await ctx.newPage();
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

// Seed a saved profile and pre-select a few vacation days so the hero
// screenshot mirrors the original (form filled + calendar showing selections
// + metrics populated).
await page.evaluate(() => {
  localStorage.setItem(
    'timesheet.profile.v1',
    JSON.stringify({
      employeeName: 'ნინო ბერიძე',
      companyCode: '123456789',
      employeeId: '12345678901'
    })
  );
});
await page.reload({ waitUntil: 'networkidle' });

// Select a future work-week (May 18–22, 2026 = Mon–Fri) for visual richness.
for (const day of [18, 19, 20, 21, 22]) {
  const cell = page.locator(`[data-day="${day}"]`).first();
  if ((await cell.count()) && (await cell.isEnabled())) {
    await cell.click().catch(() => {});
  }
}

// Hide dev-only "Quit local app" affordance; it ships in `npm run dev` mode
// only and would be misleading in a marketing screenshot.
await page.evaluate(() => {
  document.querySelectorAll('.utility-row').forEach((el) => el.remove());
});

await wait(500);
await page.screenshot({ path: OUTPUT, fullPage: false });
console.log('saved', OUTPUT);

await browser.close();
