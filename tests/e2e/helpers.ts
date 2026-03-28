import { expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

export async function waitForHydration(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.month-grid button').first()).toBeAttached();
}

export function detectLibreOffice(): boolean {
  try {
    execFileSync('soffice', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export const GENERATE_PAYLOAD = {
  year: 2026,
  month: 3,
  companyCode: '123456789',
  employeeName: 'Test User',
  employeeId: '12345678901',
  vacationDates: [] as string[],
  outputFormat: 'docx' as const
};
