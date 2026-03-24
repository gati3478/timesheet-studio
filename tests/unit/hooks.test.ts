import { describe, it, expect } from 'vitest';
import { handle } from '../../src/hooks.server';

describe('Security headers hook', () => {
  it('sets all required security headers', async () => {
    const result = await handle({
      event: {} as Parameters<typeof handle>[0]['event'],
      resolve: async () => new Response('ok')
    });

    expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(result.headers.get('X-Frame-Options')).toBe('DENY');
    expect(result.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(result.headers.get('X-XSS-Protection')).toBe('0');
    expect(result.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(result.headers.get('Permissions-Policy')).toContain('camera=()');
    expect(result.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
  });

  it('CSP includes all required directives', async () => {
    const result = await handle({
      event: {} as Parameters<typeof handle>[0]['event'],
      resolve: async () => new Response('ok')
    });
    const csp = result.headers.get('Content-Security-Policy')!;

    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' data:");
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("connect-src 'self' blob:");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('Permissions-Policy blocks all sensitive APIs', async () => {
    const result = await handle({
      event: {} as Parameters<typeof handle>[0]['event'],
      resolve: async () => new Response('ok')
    });
    const pp = result.headers.get('Permissions-Policy')!;

    expect(pp).toContain('camera=()');
    expect(pp).toContain('microphone=()');
    expect(pp).toContain('geolocation=()');
  });

  it('preserves original response body', async () => {
    const result = await handle({
      event: {} as Parameters<typeof handle>[0]['event'],
      resolve: async () => new Response('hello world')
    });
    expect(await result.text()).toBe('hello world');
  });

  it('preserves original response status', async () => {
    const result = await handle({
      event: {} as Parameters<typeof handle>[0]['event'],
      resolve: async () => new Response('not found', { status: 404 })
    });
    expect(result.status).toBe(404);
  });
});
