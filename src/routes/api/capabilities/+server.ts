import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isDocExportAvailable } from '$lib/server/capabilities';

export const GET: RequestHandler = async () => {
  const docExportAvailable = await isDocExportAvailable();
  return json({ docExportAvailable });
};
