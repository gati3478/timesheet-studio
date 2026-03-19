import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getHolidaysForYear } from '$lib/server/holidays';

export const GET: RequestHandler = async ({ url }) => {
  const now = new Date();
  const yearParam = url.searchParams.get('year');
  const year = yearParam ? Number(yearParam) : now.getFullYear();

  if (!Number.isInteger(year)) {
    return json({ message: 'Query param `year` must be an integer.' }, { status: 400 });
  }

  if (year < 2000 || year > 2100) {
    return json({ message: 'Year must be between 2000 and 2100.' }, { status: 400 });
  }

  try {
    const entries = await getHolidaysForYear(year, { includeStateOnly: false });
    return json({ year, entries });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected holiday parsing error.';
    return json({ message }, { status: 502 });
  }
};
