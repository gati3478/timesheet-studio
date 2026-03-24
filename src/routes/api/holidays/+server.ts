import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MIN_YEAR, MAX_YEAR } from '$lib/constants';
import { getHolidaysForYear } from '$lib/server/holidays';

export const GET: RequestHandler = async ({ url }) => {
  const now = new Date();
  const yearParam = url.searchParams.get('year');
  const year = yearParam ? Number(yearParam) : now.getFullYear();

  if (!Number.isInteger(year)) {
    return json(
      { message: 'Query param `year` must be an integer.', details: [] },
      { status: 400 }
    );
  }

  if (year < MIN_YEAR || year > MAX_YEAR) {
    return json(
      { message: `Year must be between ${MIN_YEAR} and ${MAX_YEAR}.`, details: [] },
      { status: 400 }
    );
  }

  try {
    const entries = await getHolidaysForYear(year, { includeStateOnly: false });
    return json({ year, entries });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected holiday parsing error.';
    return json({ message, details: [] }, { status: 502 });
  }
};
