import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

let hasLibreOffice = false;
try {
  execFileSync('soffice', ['--version'], { stdio: 'ignore' });
  hasLibreOffice = true;
} catch {
  // LibreOffice not available
}

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
    const companyInput = page.locator('input[placeholder="e.g. 405627530"]');
    const nameInput = page.locator('input[placeholder="e.g. First Last"]');
    const idInput = page.locator('input[placeholder="e.g. 01005031116"]');

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

  test('updating a saved profile replaces the old values', async ({ page }) => {
    await waitForHydration(page);

    const companyInput = page.locator('input[placeholder="e.g. 405627530"]');
    const nameInput = page.locator('input[placeholder="e.g. First Last"]');
    const idInput = page.locator('input[placeholder="e.g. 01005031116"]');

    // Save initial profile
    await page.getByRole('button', { name: 'Edit Profile' }).click();
    await companyInput.fill('405627530');
    await nameInput.fill('Original Name');
    await idInput.fill('01005031116');
    await page.getByRole('button', { name: 'Save Profile' }).click();
    await expect(page.getByRole('button', { name: 'Edit Profile' })).toBeVisible();

    // Re-enter edit mode and change the values
    await page.getByRole('button', { name: 'Edit Profile' }).click();
    await companyInput.fill('999888777');
    await nameInput.fill('Updated Name');
    await idInput.fill('99988877766');

    // Save the updated profile
    await page.getByRole('button', { name: 'Save Profile' }).click();
    await expect(page.getByRole('button', { name: 'Edit Profile' })).toBeVisible();

    // Verify updated values are shown
    await expect(companyInput).toHaveValue('999888777');
    await expect(nameInput).toHaveValue('Updated Name');
    await expect(idInput).toHaveValue('99988877766');

    // Verify updated values survive a reload
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(companyInput).toHaveValue('999888777');
    await expect(nameInput).toHaveValue('Updated Name');
    await expect(idInput).toHaveValue('99988877766');
  });

  test('output format select is disabled in view mode and enabled in edit mode', async ({
    page
  }) => {
    await waitForHydration(page);

    const formatSelect = page.locator('select');
    await expect(formatSelect).toBeVisible();
    await expect(formatSelect).toBeDisabled();
    await expect(formatSelect).toHaveValue(hasLibreOffice ? 'doc' : 'docx');

    // Enter edit mode — select should become enabled
    await page.getByRole('button', { name: 'Edit Profile' }).click();
    await expect(formatSelect).toBeEnabled();
  });

  test('profile reset clears fields', async ({ page }) => {
    await waitForHydration(page);

    const companyInput = page.locator('input[placeholder="e.g. 405627530"]');
    const nameInput = page.locator('input[placeholder="e.g. First Last"]');
    const idInput = page.locator('input[placeholder="e.g. 01005031116"]');

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
