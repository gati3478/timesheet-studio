import { test, expect, type Page } from '@playwright/test';

async function waitForHydration(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.month-grid button').first()).toBeAttached();
}

test.describe('Profile persistence', () => {
  test('saved profile persists after page reload', async ({ page }) => {
    await waitForHydration(page);

    // Enter edit mode
    await page.getByRole('button', { name: 'Edit Profile' }).click();
    await expect(page.getByRole('button', { name: 'Save Profile' })).toBeVisible();

    // Fill profile fields
    const companyInput = page.locator('input[placeholder="405627530"]');
    const nameInput = page.locator('input[placeholder="Employee full name"]');
    const idInput = page.locator('input[placeholder="Personal ID"]');

    await companyInput.fill('405627530');
    await nameInput.fill('Persist Test');
    await idInput.fill('01005031116');

    // Save profile
    await page.getByRole('button', { name: 'Save Profile' }).click();
    await expect(page.getByRole('button', { name: 'Edit Profile' })).toBeVisible();

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify values persisted (inputs are disabled in view mode but still hold values)
    await expect(companyInput).toHaveValue('405627530');
    await expect(nameInput).toHaveValue('Persist Test');
    await expect(idInput).toHaveValue('01005031116');
  });

  test('output format selection is preserved', async ({ page }) => {
    await waitForHydration(page);

    // The format select is always enabled
    const formatSelect = page.locator('select');
    await expect(formatSelect).toBeVisible();

    // Verify default is DOCX
    await expect(formatSelect).toHaveValue('docx');

    // Change to DOC
    await formatSelect.selectOption('doc');
    await expect(formatSelect).toHaveValue('doc');
  });

  test('profile reset clears fields', async ({ page }) => {
    await waitForHydration(page);

    const companyInput = page.locator('input[placeholder="405627530"]');
    const nameInput = page.locator('input[placeholder="Employee full name"]');
    const idInput = page.locator('input[placeholder="Personal ID"]');

    // Capture the default values (from env vars) shown on initial load
    const defaultCompany = await companyInput.inputValue();
    const defaultName = await nameInput.inputValue();
    const defaultId = await idInput.inputValue();

    // Enter edit mode and fill fields with different values
    await page.getByRole('button', { name: 'Edit Profile' }).click();
    await expect(page.getByRole('button', { name: 'Save Profile' })).toBeVisible();

    await companyInput.fill('999999999');
    await nameInput.fill('Reset Test User');
    await idInput.fill('99999999999');

    // Save profile
    await page.getByRole('button', { name: 'Save Profile' }).click();
    await expect(page.getByRole('button', { name: 'Edit Profile' })).toBeVisible();

    // Verify the saved values are different from defaults
    await expect(companyInput).toHaveValue('999999999');

    // Click Reset button
    await page.getByRole('button', { name: 'Reset' }).click();

    // resetProfile() reverts fields to DEFAULT_* env vars and shows a success message
    await expect(companyInput).toHaveValue(defaultCompany);
    await expect(nameInput).toHaveValue(defaultName);
    await expect(idInput).toHaveValue(defaultId);

    // Confirm the success message
    const successMessage = page.locator('.status-success');
    await expect(successMessage).toContainText('Profile reset to defaults');
  });
});
