import { test, expect } from '@playwright/test';

const COMMON_SECURITY_HEADERS = [
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'x-xss-protection',
  'permissions-policy'
] as const;

test.describe('Security headers', () => {
  test('page response includes all security headers including CSP', async ({ page }) => {
    const response = await page.goto('/');
    expect(response).not.toBeNull();

    const headers = response!.headers();
    for (const header of COMMON_SECURITY_HEADERS) {
      expect(headers[header], `Missing header: ${header}`).toBeDefined();
    }

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-xss-protection']).toBe('0');

    // SvelteKit nonce-mode CSP is set on page responses
    const csp = headers['content-security-policy'];
    expect(csp, 'Missing CSP header on page response').toBeDefined();
    expect(csp).toContain('nonce-');
  });

  test('API response includes common security headers', async ({ request }) => {
    const response = await request.get('/api/holidays?year=2026');
    const headers = response.headers();

    // CSP is intentionally absent on API responses — SvelteKit's nonce-mode CSP
    // only applies to page (HTML) responses, which is correct for a JSON API.
    for (const header of COMMON_SECURITY_HEADERS) {
      expect(headers[header], `Missing header: ${header}`).toBeDefined();
    }

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
  });
});
