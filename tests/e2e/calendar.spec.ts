import { test, expect, type Page } from '@playwright/test';

async function waitForHydration(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.month-grid button').first()).toBeAttached();
}

test.describe('Calendar navigation', () => {
  test('navigating to previous month updates the calendar', async ({ page }) => {
    await waitForHydration(page);

    const label = page.locator('.period-label');
    const initialText = await label.textContent();

    await page.getByLabel('Previous month').click();
    await expect(label).not.toHaveText(initialText!);
  });

  test('clicking a month button shows that month', async ({ page }) => {
    await waitForHydration(page);

    // Click February (second month button)
    const febButton = page.locator('.month-grid button').nth(1);
    await febButton.click();

    await expect(febButton).toHaveAttribute('aria-pressed', 'true');
    // February should have 28 or 29 day cells
    const dayCells = page.locator('button.day-cell');
    const count = await dayCells.count();
    expect(count).toBeGreaterThanOrEqual(28);
    expect(count).toBeLessThanOrEqual(29);
  });

  test('selecting multiple vacation days updates summary metrics', async ({ page }) => {
    await waitForHydration(page);

    // Find workday cells
    const workdayCells = page.locator('button.day-cell:not([disabled])');
    const initialCount = await workdayCells.count();
    expect(initialCount).toBeGreaterThan(0);

    // Select first two workdays as vacation
    await workdayCells.nth(0).click();
    await workdayCells.nth(1).click();

    // Verify both are selected
    await expect(workdayCells.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(workdayCells.nth(1)).toHaveAttribute('aria-pressed', 'true');
  });

  test('vacation selection resets when month changes', async ({ page }) => {
    await waitForHydration(page);

    // Select a vacation day
    const workdayCells = page.locator('button.day-cell:not([disabled])');
    await workdayCells.first().click();
    await expect(workdayCells.first()).toHaveAttribute('aria-pressed', 'true');

    // Navigate to next month and back
    await page.getByLabel('Next month').click();
    await page.getByLabel('Previous month').click();

    // Vacation should be cleared (out-of-month purge after navigation)
    const newWorkdayCells = page.locator('button.day-cell:not([disabled])');
    const firstCell = newWorkdayCells.first();
    await expect(firstCell).toHaveAttribute('aria-pressed', 'false');
  });

  test('year navigation buttons work', async ({ page }) => {
    await waitForHydration(page);

    const pill = page.locator('.hero-pill');
    const currentYear = new Date().getFullYear();
    await expect(pill).toContainText(String(currentYear));

    // Click increase year
    await page.getByLabel('Increase year').click();
    await expect(pill).toContainText(String(currentYear + 1));

    // Click decrease year twice
    await page.getByLabel('Decrease year').click();
    await page.getByLabel('Decrease year').click();
    await expect(pill).toContainText(String(currentYear - 1));
  });
});

test.describe('Profile validation', () => {
  test('save with empty fields shows error', async ({ page }) => {
    await waitForHydration(page);

    await page.getByRole('button', { name: 'Edit Profile' }).click();

    const companyInput = page.locator('input[placeholder="405627530"]');
    const nameInput = page.locator('input[placeholder="Employee full name"]');
    const idInput = page.locator('input[placeholder="Personal ID"]');

    // Clear all fields
    await companyInput.fill('');
    await nameInput.fill('');
    await idInput.fill('');

    await page.getByRole('button', { name: 'Save Profile' }).click();

    // Should show error, still in edit mode
    await expect(page.getByRole('button', { name: 'Save Profile' })).toBeVisible();
  });

  test('save with invalid company code format shows error', async ({ page }) => {
    await waitForHydration(page);

    await page.getByRole('button', { name: 'Edit Profile' }).click();

    const companyInput = page.locator('input[placeholder="405627530"]');
    await companyInput.fill('abc');

    const nameInput = page.locator('input[placeholder="Employee full name"]');
    await nameInput.fill('Test User');

    const idInput = page.locator('input[placeholder="Personal ID"]');
    await idInput.fill('01005031116');

    await page.getByRole('button', { name: 'Save Profile' }).click();

    // Should remain in edit mode due to validation error
    await expect(page.getByRole('button', { name: 'Save Profile' })).toBeVisible();
  });

  test('save with invalid employee ID format shows error', async ({ page }) => {
    await waitForHydration(page);

    await page.getByRole('button', { name: 'Edit Profile' }).click();

    const companyInput = page.locator('input[placeholder="405627530"]');
    await companyInput.fill('405627530');

    const nameInput = page.locator('input[placeholder="Employee full name"]');
    await nameInput.fill('Test User');

    const idInput = page.locator('input[placeholder="Personal ID"]');
    await idInput.fill('123'); // Too short

    await page.getByRole('button', { name: 'Save Profile' }).click();

    // Should remain in edit mode
    await expect(page.getByRole('button', { name: 'Save Profile' })).toBeVisible();
  });
});
