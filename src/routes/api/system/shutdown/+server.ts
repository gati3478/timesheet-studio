import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
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
