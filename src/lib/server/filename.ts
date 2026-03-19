const SHORT_MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec'
] as const;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u10D0-\u10FF\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

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
  return `${slug}-${SHORT_MONTHS[monthIndex]}-${year}-timesheet.${extension}`;
}
