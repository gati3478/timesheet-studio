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

test.describe('DOC export UI visibility', () => {
  test('capabilities endpoint returns correct value', async ({ request }) => {
    const response = await request.get('/api/capabilities');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.docExportAvailable).toBe(hasLibreOffice);
  });

  const testOrSkip = hasLibreOffice ? test : test.skip;

  testOrSkip(
    'DOC option is visible in format dropdown when LibreOffice is available',
    async ({ page }) => {
      await waitForHydration(page);

      // The select should have both options from SSR — no edit mode needed
      const formatSelect = page.locator('select');
      await expect(formatSelect).toBeAttached();

      const options = formatSelect.locator('option');
      await expect(options).toHaveCount(2);
      await expect(options.nth(0)).toHaveText('DOCX');
      await expect(options.nth(1)).toHaveText('DOC');
    }
  );

  testOrSkip(
    'format select is disabled in view mode and enabled in edit mode',
    async ({ page }) => {
      await waitForHydration(page);

      const formatSelect = page.locator('select');
      await expect(formatSelect).toBeDisabled();

      // Enter edit mode — select should become enabled and allow DOC selection
      await page.getByRole('button', { name: 'Edit Profile' }).click();
      await expect(formatSelect).toBeEnabled();
      await formatSelect.selectOption('doc');
      await expect(formatSelect).toHaveValue('doc');
    }
  );
});
