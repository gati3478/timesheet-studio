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

export function buildOutputFilename(
  year: number,
  month: number,
  extension: 'docx' | 'doc'
): string {
  const monthIndex = month - 1;
  if (monthIndex < 0 || monthIndex > 11) {
    throw new Error('Month must be from 1 to 12.');
  }

  return `g.petriashvili-${SHORT_MONTHS[monthIndex]}-${year}-timesheet.${extension}`;
}
