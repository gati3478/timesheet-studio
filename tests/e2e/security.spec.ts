import { test, expect } from '@playwright/test';

const EXPECTED_HEADERS = [
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'x-xss-protection',
  'content-security-policy',
  'permissions-policy'
] as const;

test.describe('Security headers', () => {
  test('page response includes all security headers', async ({ page }) => {
    const response = await page.goto('/');
    expect(response).not.toBeNull();

    const headers = response!.headers();
    for (const header of EXPECTED_HEADERS) {
      expect(headers[header], `Missing header: ${header}`).toBeDefined();
    }

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-xss-protection']).toBe('0');
  });

  test('API response includes all security headers', async ({ request }) => {
    const response = await request.get('/api/holidays?year=2026');
    const headers = response.headers();

    for (const header of EXPECTED_HEADERS) {
      expect(headers[header], `Missing header: ${header}`).toBeDefined();
    }

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
  });
});
