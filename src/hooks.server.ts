import type { Handle } from '@sveltejs/kit';

const isProduction = process.env.NODE_ENV === 'production';

export const handle: Handle = async ({ event, resolve }) => {
  if (['POST', 'PUT', 'DELETE'].includes(event.request.method)) {
    const origin = event.request.headers.get('origin');
    const host = event.request.headers.get('host');
    if (origin && host && new URL(origin).host !== host) {
      return new Response(JSON.stringify({ message: 'Origin mismatch.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  const response = await resolve(event);

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '0');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  if (isProduction) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return response;
};
