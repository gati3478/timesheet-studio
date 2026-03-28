import { test, expect } from '@playwright/test';
import { waitForHydration, detectLibreOffice } from './helpers';

const hasLibreOffice = detectLibreOffice();

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
      await expect(options.nth(0)).toHaveText('DOC');
      await expect(options.nth(1)).toHaveText('DOCX');
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
