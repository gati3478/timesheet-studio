#!/usr/bin/env node

/**
 * capture-ui-docs.mjs — Playwright-based screenshot capture for UI audit
 *
 * Captures all component states across 3 viewports (desktop, tablet, mobile)
 * and writes an INDEX.md manifest. Used by the /ui-audit skill.
 *
 * Usage:
 *   node scripts/capture-ui-docs.mjs [options]
 *
 * Options:
 *   --state <name>     Capture only one state group (default, vacation-selected,
 *                       profile-editing, profile-validation-error, generation-error,
 *                       holiday-loading)
 *   --viewport <name>  Capture only one viewport (desktop, tablet, mobile)
 *   --base-url <url>   Dev server URL (default: http://localhost:5173)
 */

import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// ── CLI parsing ──────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

const filterState = getArg('state');
const filterViewport = getArg('viewport');
const baseUrl = getArg('base-url') ?? 'http://localhost:5173';

// ── Viewport definitions ─────────────────────────────────

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 }
};

// ── Output paths ─────────────────────────────────────────

const OUTPUT_DIR = join(process.cwd(), 'screenshots', 'ui-docs');
const MANIFEST = [];

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

async function capture(page, stateDir, stateName, viewportName) {
  const filename = `${stateName}_${viewportName}.png`;
  const filepath = join(stateDir, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  MANIFEST.push({
    state: stateName,
    viewport: viewportName,
    path: relative(OUTPUT_DIR, filepath)
  });
  console.log(`  ✓ ${filename}`);
}

// ── State capture functions ──────────────────────────────

/**
 * A: Default — fresh page load, no interaction
 */
async function captureDefault(page, stateDir, viewportName) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500); // let animations settle
  await capture(page, stateDir, 'default', viewportName);
}

/**
 * B: Vacation Selected — click several workday cells to toggle vacation
 */
async function captureVacationSelected(page, stateDir, viewportName) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Click up to 5 workday cells (those that are not blocked/disabled)
  const dayCells = page.locator('.calendar-grid button.day-cell:not(.blocked):not(:disabled)');
  const count = await dayCells.count();
  const toClick = Math.min(count, 5);

  if (toClick === 0) {
    console.warn(`  ⚠ No clickable workday cells found for vacation-selected_${viewportName}`);
  }

  for (let i = 0; i < toClick; i++) {
    await dayCells.nth(i).click();
    await page.waitForTimeout(100);
  }

  await page.waitForTimeout(300);
  await capture(page, stateDir, 'vacation-selected', viewportName);
}

/**
 * C: Profile Editing — open the profile editor
 */
async function captureProfileEditing(page, stateDir, viewportName) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Click "Edit Profile" button
  const editBtn = page.locator('button', { hasText: 'Edit Profile' });
  if ((await editBtn.count()) > 0) {
    await editBtn.click();
    await page.waitForTimeout(300);

    // Fill in some draft values so the form looks populated.
    // Inputs are inside <label> elements with <span> text labels.
    // Use placeholder attributes as reliable selectors.
    const companyInput = page.locator('input[placeholder="405627530"]').first();
    const nameInput = page.locator('input[placeholder="Employee full name"]').first();
    const idInput = page.locator('input[placeholder="Personal ID"]').first();

    if ((await companyInput.count()) > 0) await companyInput.fill('123456');
    if ((await nameInput.count()) > 0) await nameInput.fill('Test Employee');
    if ((await idInput.count()) > 0) await idInput.fill('12345678901');

    await page.waitForTimeout(200);
  }

  await capture(page, stateDir, 'profile-editing', viewportName);
}

/**
 * D: Profile Validation Error — save with invalid data
 */
async function captureProfileValidationError(page, stateDir, viewportName) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const editBtn = page.locator('button', { hasText: 'Edit Profile' });
  if ((await editBtn.count()) > 0) {
    await editBtn.click();
    await page.waitForTimeout(200);

    // Clear fields to trigger validation error.
    // The inputs are inside .input-grid within the control panel.
    const inputs = page.locator('.input-grid input:not(:disabled)');
    const inputCount = await inputs.count();
    for (let i = 0; i < inputCount; i++) {
      await inputs.nth(i).fill('');
    }

    // Click "Save Profile" to trigger validation
    const saveBtn = page.locator('button', { hasText: 'Save Profile' });
    if ((await saveBtn.count()) > 0) {
      await saveBtn.click();
      await page.waitForTimeout(300);
    }
  }

  await capture(page, stateDir, 'profile-validation-error', viewportName);
}

/**
 * E: Generation Error — trigger a generation error via network interception
 */
async function captureGenerationError(page, stateDir, viewportName) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Intercept the generate API call and return an error response
  await page.route('**/api/timesheet/generate', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Validation failed: missing required fields.',
        details: [
          'Company code is required.',
          'Employee name is required.',
          'Employee ID must be exactly 11 digits.'
        ]
      })
    })
  );

  // Click the generate button and wait for the error to render
  const generateBtn = page.locator('button', { hasText: 'Generate Timesheet' });
  if ((await generateBtn.count()) > 0 && (await generateBtn.isEnabled())) {
    await generateBtn.click();
    try {
      await page.waitForSelector('.status-error', { timeout: 5000 });
    } catch {
      await page.waitForTimeout(500);
    }
  }

  await capture(page, stateDir, 'generation-error', viewportName);
}

/**
 * F: Holiday Loading — intercept holiday API to simulate slow loading.
 *
 * The route handler intentionally never calls fulfill/abort/continue.
 * This keeps the fetch pending → loadingHolidays stays true → the
 * "Refreshing holiday calendar…" status message remains visible.
 * When the browser context is closed, Playwright cleans up pending
 * requests without leaking timers.
 */
async function captureHolidayLoading(page, stateDir, viewportName) {
  // Intercept the holiday API — never respond, keeping loadingHolidays=true
  await page.route('**/api/holidays**', () => {
    // Intentionally never resolve. The pending fetch keeps the loading state.
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

  // Wait for the loading status message to appear in the DOM
  try {
    await page.waitForSelector('.status-info', { timeout: 5000 });
  } catch {
    // Fallback if selector not found within timeout
    await page.waitForTimeout(500);
  }

  await capture(page, stateDir, 'holiday-loading', viewportName);
}

// ── State registry ───────────────────────────────────────

const STATES = [
  { name: 'default', dir: 'A-default', fn: captureDefault },
  { name: 'vacation-selected', dir: 'B-vacation-selected', fn: captureVacationSelected },
  { name: 'profile-editing', dir: 'C-profile-editing', fn: captureProfileEditing },
  {
    name: 'profile-validation-error',
    dir: 'D-profile-validation-error',
    fn: captureProfileValidationError
  },
  { name: 'generation-error', dir: 'E-generation-error', fn: captureGenerationError },
  { name: 'holiday-loading', dir: 'F-holiday-loading', fn: captureHolidayLoading }
];

// ── Main ─────────────────────────────────────────────────

async function main() {
  const states = filterState ? STATES.filter((s) => s.name === filterState) : STATES;

  if (states.length === 0) {
    console.error(
      `Unknown state: "${filterState}". Valid states: ${STATES.map((s) => s.name).join(', ')}`
    );
    process.exit(1);
  }

  const viewportEntries = filterViewport
    ? [[filterViewport, VIEWPORTS[filterViewport]]]
    : Object.entries(VIEWPORTS);

  if (filterViewport && !VIEWPORTS[filterViewport]) {
    console.error(
      `Unknown viewport: "${filterViewport}". Valid viewports: ${Object.keys(VIEWPORTS).join(', ')}`
    );
    process.exit(1);
  }

  console.log(`\n🔍 Timesheet Studio — UI Audit Capture`);
  console.log(`   States:    ${states.map((s) => s.name).join(', ')}`);
  console.log(`   Viewports: ${viewportEntries.map(([n]) => n).join(', ')}`);
  console.log(`   Output:    ${OUTPUT_DIR}\n`);

  ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch({ headless: true });

  for (const state of states) {
    const stateDir = join(OUTPUT_DIR, state.dir);
    ensureDir(stateDir);
    console.log(`── ${state.dir} ──`);

    for (const [vpName, vpSize] of viewportEntries) {
      const context = await browser.newContext({
        viewport: vpSize,
        deviceScaleFactor: vpName === 'mobile' ? 2 : 1
      });
      const page = await context.newPage();

      try {
        await state.fn(page, stateDir, vpName);
      } catch (err) {
        console.error(`  ✗ ${state.name}_${vpName}: ${err.message}`);
      } finally {
        await context.close();
      }
    }
  }

  await browser.close();

  // ── Write INDEX.md ───────────────────────────────────

  const lines = [
    '# UI Audit Screenshots — Timesheet Studio',
    '',
    `Captured: ${new Date().toISOString()}`,
    '',
    '| State | Viewport | Path |',
    '|-------|----------|------|'
  ];

  for (const entry of MANIFEST) {
    lines.push(`| ${entry.state} | ${entry.viewport} | \`${entry.path}\` |`);
  }

  lines.push('');
  const indexPath = join(OUTPUT_DIR, 'INDEX.md');
  writeFileSync(indexPath, lines.join('\n'), 'utf-8');

  console.log(`\n✅ Captured ${MANIFEST.length} screenshots`);
  console.log(`📋 Index written to ${relative(process.cwd(), indexPath)}\n`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
