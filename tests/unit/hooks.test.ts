import { afterEach, describe, it, expect, vi } from 'vitest';

// The module reads process.env.NODE_ENV at import time to set `isProduction`.
// We need to control this for the HSTS test, so we use vi.resetModules() to
// re-import the module after changing the env var.

function makeEvent(
  method = 'GET',
  headers: Record<string, string> = {}
): Parameters<typeof import('../../src/hooks.server').handle>[0]['event'] {
  return {
    request: {
      method,
      headers: {
        get: (name: string) => headers[name.toLowerCase()] ?? null
      }
    }
  } as Parameters<typeof import('../../src/hooks.server').handle>[0]['event'];
}

describe('Security headers hook', () => {
  it('sets all required security headers', async () => {
    const { handle } = await import('../../src/hooks.server');
    const result = await handle({
      event: makeEvent(),
      resolve: async () => new Response('ok')
    });

    expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(result.headers.get('X-Frame-Options')).toBe('DENY');
    expect(result.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(result.headers.get('X-XSS-Protection')).toBe('0');
    expect(result.headers.get('Permissions-Policy')).toContain('camera=()');
    expect(result.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
  });

  it('does not set CSP header (managed by SvelteKit csp config)', async () => {
    const { handle } = await import('../../src/hooks.server');
    const result = await handle({
      event: makeEvent(),
      resolve: async () => new Response('ok')
    });

    expect(result.headers.get('Content-Security-Policy')).toBeNull();
  });

  it('Permissions-Policy blocks all sensitive APIs', async () => {
    const { handle } = await import('../../src/hooks.server');
    const result = await handle({
      event: makeEvent(),
      resolve: async () => new Response('ok')
    });
    const pp = result.headers.get('Permissions-Policy')!;

    expect(pp).toContain('camera=()');
    expect(pp).toContain('microphone=()');
    expect(pp).toContain('geolocation=()');
  });

  it('preserves original response body', async () => {
    const { handle } = await import('../../src/hooks.server');
    const result = await handle({
      event: makeEvent(),
      resolve: async () => new Response('hello world')
    });
    expect(await result.text()).toBe('hello world');
  });

  it('preserves original response status', async () => {
    const { handle } = await import('../../src/hooks.server');
    const result = await handle({
      event: makeEvent(),
      resolve: async () => new Response('not found', { status: 404 })
    });
    expect(result.status).toBe(404);
  });
});

describe('HSTS in production', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.resetModules();
  });

  it('sets Strict-Transport-Security header when NODE_ENV is production', async () => {
    process.env.NODE_ENV = 'production';
    vi.resetModules();

    const { handle } = await import('../../src/hooks.server');
    const result = await handle({
      event: makeEvent(),
      resolve: async () => new Response('ok')
    });

    expect(result.headers.get('Strict-Transport-Security')).toBe(
      'max-age=31536000; includeSubDomains'
    );
  });

  it('does not set Strict-Transport-Security header when not in production', async () => {
    process.env.NODE_ENV = 'test';
    vi.resetModules();

    const { handle } = await import('../../src/hooks.server');
    const result = await handle({
      event: makeEvent(),
      resolve: async () => new Response('ok')
    });

    expect(result.headers.get('Strict-Transport-Security')).toBeNull();
  });
});

describe('CSRF origin validation', () => {
  it('returns 403 for POST with mismatched origin', async () => {
    const { handle } = await import('../../src/hooks.server');
    const result = await handle({
      event: makeEvent('POST', {
        origin: 'https://evil.com',
        host: 'localhost:5173'
      }),
      resolve: async () => new Response('ok')
    });

    expect(result.status).toBe(403);
    const body = await result.json();
    expect(body.message).toBe('Origin mismatch.');
  });

  it('allows POST with matching origin', async () => {
    const { handle } = await import('../../src/hooks.server');
    const result = await handle({
      event: makeEvent('POST', {
        origin: 'http://localhost:5173',
        host: 'localhost:5173'
      }),
      resolve: async () => new Response('ok')
    });

    expect(result.status).toBe(200);
    expect(await result.text()).toBe('ok');
  });

  it('allows GET with any origin', async () => {
    const { handle } = await import('../../src/hooks.server');
    const result = await handle({
      event: makeEvent('GET', {
        origin: 'https://evil.com',
        host: 'localhost:5173'
      }),
      resolve: async () => new Response('ok')
    });

    expect(result.status).toBe(200);
    expect(await result.text()).toBe('ok');
  });
});
