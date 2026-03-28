import { dev } from '$app/environment';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
  if (!dev) {
    return json({ message: 'Not available.' }, { status: 404 });
  }

  const pid = process.pid;

  setTimeout(() => {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      process.exit(0);
    }
  }, 150);

  return json({ message: 'Server shutdown initiated.' });
};
