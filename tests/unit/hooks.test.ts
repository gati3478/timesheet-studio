import { describe, expect, it } from 'vitest';
import { handle } from '../../src/hooks.server';

describe('security headers hook', () => {
  it('adds all security headers to the response', async () => {
    const mockResponse = new Response('OK', { status: 200 });

    const result = await handle({
      event: {} as Parameters<typeof handle>[0]['event'],
      resolve: async () => mockResponse
    });

    expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(result.headers.get('X-Frame-Options')).toBe('DENY');
    expect(result.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(result.headers.get('X-XSS-Protection')).toBe('0');
    expect(result.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(result.headers.get('Permissions-Policy')).toContain('camera=()');
  });
});
