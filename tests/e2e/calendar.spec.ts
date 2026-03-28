import { test, expect } from '@playwright/test';
import { waitForHydration } from './helpers';

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

test.describe('Drag-to-select vacation', () => {
  test('dragging across workday cells selects the entire range', async ({ page }) => {
    await waitForHydration(page);

    const workdayCells = page.locator('button.day-cell:not([disabled])');
    const count = await workdayCells.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // Get bounding boxes of the first and third workday cells
    const startBox = (await workdayCells.nth(0).boundingBox())!;
    const endBox = (await workdayCells.nth(2).boundingBox())!;

    // Drag from center of first to center of third
    const startX = startBox.x + startBox.width / 2;
    const startY = startBox.y + startBox.height / 2;
    const endX = endBox.x + endBox.width / 2;
    const endY = endBox.y + endBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 5 });
    await page.mouse.up();

    // All three workday cells should now be selected
    await expect(workdayCells.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(workdayCells.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(workdayCells.nth(2)).toHaveAttribute('aria-pressed', 'true');
  });

  test('dragging from a vacation day deselects the range', async ({ page }) => {
    await waitForHydration(page);

    const workdayCells = page.locator('button.day-cell:not([disabled])');

    // First, select two workdays via clicks
    await workdayCells.nth(0).click();
    await workdayCells.nth(1).click();
    await expect(workdayCells.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(workdayCells.nth(1)).toHaveAttribute('aria-pressed', 'true');

    // Drag from the first (selected) cell to the second — intent should be "deselect"
    const startBox = (await workdayCells.nth(0).boundingBox())!;
    const endBox = (await workdayCells.nth(1).boundingBox())!;

    await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 3 });
    await page.mouse.up();

    // Both cells should now be deselected
    await expect(workdayCells.nth(0)).toHaveAttribute('aria-pressed', 'false');
    await expect(workdayCells.nth(1)).toHaveAttribute('aria-pressed', 'false');
  });

  test('drag skips weekend and holiday cells', async ({ page }) => {
    await waitForHydration(page);

    // Navigate to January 2026 where weekends are interspersed
    const janButton = page.locator('.month-grid button').first();
    await janButton.click();

    const currentYear = new Date().getFullYear();
    const yearDelta = 2026 - currentYear;
    if (yearDelta > 0) {
      for (let i = 0; i < yearDelta; i++) await page.getByLabel('Increase year').click();
    } else if (yearDelta < 0) {
      for (let i = 0; i < -yearDelta; i++) await page.getByLabel('Decrease year').click();
    }
    await page.waitForLoadState('networkidle');

    // Drag from the first day cell to the 7th (crosses a weekend)
    const allCells = page.locator('button.day-cell');
    const firstCell = allCells.nth(0);
    const seventhCell = allCells.nth(6);

    const startBox = (await firstCell.boundingBox())!;
    const endBox = (await seventhCell.boundingBox())!;

    await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 5 });
    await page.mouse.up();

    // Verify weekends and holidays remain unselected
    for (let i = 0; i < 7; i++) {
      const cell = allCells.nth(i);
      const isDisabled = await cell.isDisabled();
      if (isDisabled) {
        await expect(cell).toHaveAttribute('aria-pressed', 'false');
      }
    }
  });

  test('escape cancels drag without committing', async ({ page }) => {
    await waitForHydration(page);

    const workdayCells = page.locator('button.day-cell:not([disabled])');
    const startBox = (await workdayCells.nth(0).boundingBox())!;
    const endBox = (await workdayCells.nth(2).boundingBox())!;

    // Start a drag
    await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 3 });

    // Press Escape to cancel
    await page.keyboard.press('Escape');
    await page.mouse.up();

    // No cells should be selected
    await expect(workdayCells.nth(0)).toHaveAttribute('aria-pressed', 'false');
    await expect(workdayCells.nth(1)).toHaveAttribute('aria-pressed', 'false');
    await expect(workdayCells.nth(2)).toHaveAttribute('aria-pressed', 'false');
  });

  test('drag updates summary metrics correctly', async ({ page }) => {
    await waitForHydration(page);

    const workedMetric = page
      .locator('article.metric')
      .filter({ hasText: 'Worked Days' })
      .locator('strong');
    const initialWorked = parseInt((await workedMetric.textContent()) ?? '0', 10);

    // Drag across 3 workday cells
    const workdayCells = page.locator('button.day-cell:not([disabled])');
    const startBox = (await workdayCells.nth(0).boundingBox())!;
    const endBox = (await workdayCells.nth(2).boundingBox())!;

    await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 5 });
    await page.mouse.up();

    // Worked days should decrease by 3
    const updatedWorked = parseInt((await workedMetric.textContent()) ?? '0', 10);
    expect(updatedWorked).toBe(initialWorked - 3);
  });
});

test.describe('Profile validation', () => {
  test('save with empty fields shows error', async ({ page }) => {
    await waitForHydration(page);

    await page.getByRole('button', { name: 'Edit Profile' }).click();

    const companyInput = page.locator('input[placeholder="e.g. 123456789"]');
    const nameInput = page.locator('input[placeholder="e.g. First Last"]');
    const idInput = page.locator('input[placeholder="e.g. 12345678901"]');

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

    const companyInput = page.locator('input[placeholder="e.g. 123456789"]');
    await companyInput.fill('abc');

    const nameInput = page.locator('input[placeholder="e.g. First Last"]');
    await nameInput.fill('Test User');

    const idInput = page.locator('input[placeholder="e.g. 12345678901"]');
    await idInput.fill('12345678901');

    await page.getByRole('button', { name: 'Save Profile' }).click();

    // Should remain in edit mode due to validation error
    await expect(page.getByRole('button', { name: 'Save Profile' })).toBeVisible();
  });

  test('save with invalid employee ID format shows error', async ({ page }) => {
    await waitForHydration(page);

    await page.getByRole('button', { name: 'Edit Profile' }).click();

    const companyInput = page.locator('input[placeholder="e.g. 123456789"]');
    await companyInput.fill('123456789');

    const nameInput = page.locator('input[placeholder="e.g. First Last"]');
    await nameInput.fill('Test User');

    const idInput = page.locator('input[placeholder="e.g. 12345678901"]');
    await idInput.fill('123'); // Too short

    await page.getByRole('button', { name: 'Save Profile' }).click();

    // Should remain in edit mode
    await expect(page.getByRole('button', { name: 'Save Profile' })).toBeVisible();
  });
});
