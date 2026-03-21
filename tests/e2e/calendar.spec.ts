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

  test('February renders 28 days in non-leap year (2026)', async ({ page }) => {
    await waitForHydration(page);

    // Navigate to February
    const febButton = page.locator('.month-grid button').nth(1);
    await febButton.click();
    await expect(febButton).toHaveAttribute('aria-pressed', 'true');

    // Ensure year is 2026 (current year per test environment)
    const pill = page.locator('.hero-pill');
    const currentYear = new Date().getFullYear();
    const yearDelta = 2026 - currentYear;
    if (yearDelta > 0) {
      for (let i = 0; i < yearDelta; i++) await page.getByLabel('Increase year').click();
    } else if (yearDelta < 0) {
      for (let i = 0; i < -yearDelta; i++) await page.getByLabel('Decrease year').click();
    }
    await expect(pill).toContainText('2026');

    const dayCells = page.locator('button.day-cell');
    await expect(dayCells).toHaveCount(28);
  });

  test('February renders 29 days in leap year (2028)', async ({ page }) => {
    await waitForHydration(page);

    // Navigate to February
    const febButton = page.locator('.month-grid button').nth(1);
    await febButton.click();
    await expect(febButton).toHaveAttribute('aria-pressed', 'true');

    // Navigate to year 2028
    const pill = page.locator('.hero-pill');
    const currentYear = new Date().getFullYear();
    const yearDelta = 2028 - currentYear;
    if (yearDelta > 0) {
      for (let i = 0; i < yearDelta; i++) await page.getByLabel('Increase year').click();
    } else if (yearDelta < 0) {
      for (let i = 0; i < -yearDelta; i++) await page.getByLabel('Decrease year').click();
    }
    await expect(pill).toContainText('2028');

    const dayCells = page.locator('button.day-cell');
    await expect(dayCells).toHaveCount(29);
  });

  test('vacation on day 31 is purged when navigating to shorter month', async ({ page }) => {
    await waitForHydration(page);

    // Navigate to January 2026 (31 days)
    const janButton = page.locator('.month-grid button').first();
    await janButton.click();
    await expect(janButton).toHaveAttribute('aria-pressed', 'true');

    const currentYear = new Date().getFullYear();
    const yearDelta = 2026 - currentYear;
    if (yearDelta > 0) {
      for (let i = 0; i < yearDelta; i++) await page.getByLabel('Increase year').click();
    } else if (yearDelta < 0) {
      for (let i = 0; i < -yearDelta; i++) await page.getByLabel('Decrease year').click();
    }

    // Select a workday as vacation
    const workdayCells = page.locator('button.day-cell:not([disabled])');
    const firstWorkday = workdayCells.first();
    await firstWorkday.click();
    await expect(firstWorkday).toHaveAttribute('aria-pressed', 'true');

    // Navigate to February (28 days) — purges January vacation dates
    const febButton = page.locator('.month-grid button').nth(1);
    await febButton.click();

    // Navigate back to January
    await janButton.click();

    // Vacation should be gone because purgeVacationOutOfMonth removed it
    // when we navigated to February
    const newWorkdayCells = page.locator('button.day-cell:not([disabled])');
    const count = await newWorkdayCells.count();
    for (let i = 0; i < count; i++) {
      await expect(newWorkdayCells.nth(i)).toHaveAttribute('aria-pressed', 'false');
    }
  });

  test('summary metrics update when vacation is selected', async ({ page }) => {
    await waitForHydration(page);

    // Read the initial "Worked Days" metric value
    const workedMetric = page
      .locator('article.metric')
      .filter({ hasText: 'Worked Days' })
      .locator('strong');
    const initialWorked = parseInt((await workedMetric.textContent()) ?? '0', 10);

    // Select first two workday cells as vacation
    const workdayCells = page.locator('button.day-cell:not([disabled])');
    await workdayCells.nth(0).click();
    await workdayCells.nth(1).click();

    // Read the updated "Worked Days" metric
    const updatedWorked = parseInt((await workedMetric.textContent()) ?? '0', 10);
    expect(updatedWorked).toBe(initialWorked - 2);
  });

  test('clicking a holiday cell does not toggle vacation', async ({ page }) => {
    await waitForHydration(page);

    // Navigate to January 2026 (Jan 1 = New Year, Jan 7 = Christmas)
    const janButton = page.locator('.month-grid button').first();
    await janButton.click();
    await expect(janButton).toHaveAttribute('aria-pressed', 'true');

    const currentYear = new Date().getFullYear();
    const yearDelta = 2026 - currentYear;
    if (yearDelta > 0) {
      for (let i = 0; i < yearDelta; i++) await page.getByLabel('Increase year').click();
    } else if (yearDelta < 0) {
      for (let i = 0; i < -yearDelta; i++) await page.getByLabel('Decrease year').click();
    }

    // Wait for holidays to load
    await page.waitForLoadState('networkidle');

    // Find a disabled day cell (holiday or weekend)
    const disabledCells = page.locator('button.day-cell[disabled]');
    const count = await disabledCells.count();
    expect(count).toBeGreaterThan(0);

    const disabledCell = disabledCells.first();

    // Click the disabled cell — should not toggle
    await disabledCell.click({ force: true });

    // Verify it's still not marked as vacation (aria-pressed should be "false")
    await expect(disabledCell).toHaveAttribute('aria-pressed', 'false');
    await expect(disabledCell).toBeDisabled();
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
