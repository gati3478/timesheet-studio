import { slugify } from './slugify';
import { MONTHS } from './constants';

export function buildOutputFilename(
  employeeName: string,
  year: number,
  month: number,
  extension: 'docx' | 'doc'
): string {
  const monthIndex = month - 1;
  if (monthIndex < 0 || monthIndex > 11) {
    throw new Error('Month must be from 1 to 12.');
  }

  const slug = slugify(employeeName) || 'timesheet';
  return `${slug}-${MONTHS[monthIndex].short.toLowerCase()}-${year}.${extension}`;
}
