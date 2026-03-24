import type { Handle } from '@sveltejs/kit';

const isProduction = process.env.NODE_ENV === 'production';

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '0');
  // unsafe-inline is required: SvelteKit injects inline <script> tags for hydration
  // data, and scoped component styles use inline <style>. Removing it requires enabling
  // SvelteKit's csp nonce mode in svelte.config.js, which is a non-trivial migration.
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' blob:; frame-ancestors 'none'"
  );
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  if (isProduction) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return response;
};
