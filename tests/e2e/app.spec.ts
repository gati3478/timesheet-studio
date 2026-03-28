import { test, expect } from '@playwright/test';
import { waitForHydration } from './helpers';

test.describe('Page load', () => {
  test('has correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Timesheet Studio');
  });

  test('hero heading contains Timesheet Studio', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Timesheet Studio');
  });

  test('hero pill shows current month and year', async ({ page }) => {
    await page.goto('/');
    const pill = page.locator('.hero-pill');
    const now = new Date();
    const year = now.getFullYear().toString();
    await expect(pill).toContainText(year);
  });

  test('shows 12 month buttons in picker', async ({ page }) => {
    await page.goto('/');
    const monthButtons = page.locator('.month-grid button');
    await expect(monthButtons).toHaveCount(12);
  });
});

test.describe('Navigation', () => {
  test('clicking next month advances the period label', async ({ page }) => {
    await waitForHydration(page);
    const label = page.locator('.period-label');
    const initialText = await label.textContent();

    await page.getByLabel('Next month').click();

    // Wait for label to change from its initial value
    await expect(label).not.toHaveText(initialText!);
  });

  test('clicking a month button updates aria-pressed', async ({ page }) => {
    await waitForHydration(page);
    // Click "Jan" (first month button)
    const janButton = page.locator('.month-grid button').first();
    await janButton.click();
    await expect(janButton).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('Calendar', () => {
  test('renders correct number of day cells for the current month', async ({ page }) => {
    await page.goto('/');
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const dayCells = page.locator('button.day-cell');
    await expect(dayCells).toHaveCount(daysInMonth);
  });

  test('weekend cells are disabled', async ({ page }) => {
    await page.goto('/');
    const weekendCells = page.locator('button.day-cell[disabled]');
    const count = await weekendCells.count();
    expect(count).toBeGreaterThan(0);

    const first = weekendCells.first();
    await expect(first).toBeDisabled();
  });

  test('clicking a weekday cell toggles vacation selection', async ({ page }) => {
    await waitForHydration(page);
    // Find a workday cell (not disabled)
    const workdayCells = page.locator('button.day-cell:not([disabled])');
    const count = await workdayCells.count();
    expect(count).toBeGreaterThan(0);

    const cell = workdayCells.first();
    await expect(cell).toHaveAttribute('aria-pressed', 'false');

    // Click to select
    await cell.click();
    await expect(cell).toHaveAttribute('aria-pressed', 'true');

    // Click again to deselect
    await cell.click();
    await expect(cell).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('Profile editing', () => {
  test('edit and cancel profile', async ({ page }) => {
    await waitForHydration(page);

    const companyInput = page.locator('input[placeholder="e.g. 123456789"]');
    await expect(companyInput).toBeDisabled();

    // Click Edit Profile and wait for Save to appear
    await page.getByRole('button', { name: 'Edit Profile' }).click();
    await expect(page.getByRole('button', { name: 'Save Profile' })).toBeVisible();
    await expect(companyInput).toBeEnabled();

    // Click Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: 'Edit Profile' })).toBeVisible();
    await expect(companyInput).toBeDisabled();
  });
});

test.describe('Generation', () => {
  test('generates and downloads a timesheet file', async ({ page }) => {
    await waitForHydration(page);

    // Enter edit mode
    await page.getByRole('button', { name: 'Edit Profile' }).click();
    await expect(page.getByRole('button', { name: 'Save Profile' })).toBeVisible();

    const companyInput = page.locator('input[placeholder="e.g. 123456789"]');
    const nameInput = page.locator('input[placeholder="e.g. First Last"]');
    const idInput = page.locator('input[placeholder="e.g. 12345678901"]');

    await expect(companyInput).toBeEnabled();

    await companyInput.fill('123456789');
    await nameInput.fill('Test User');
    await idInput.fill('12345678901');
    await page.getByLabel('Output Format').selectOption('docx');

    await page.getByRole('button', { name: 'Save Profile' }).click();
    await expect(page.getByRole('button', { name: 'Edit Profile' })).toBeVisible();

    // Generate and download
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Generate Timesheet' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.docx?$/);
  });
});
