import { TimesheetValidationError } from './timesheet';
import { MIN_YEAR, MAX_YEAR } from '../constants';
import type { TimesheetGenerateRequest } from './types';

const MAX_EMPLOYEE_NAME_LENGTH = 500;
const MAX_COMPANY_CODE_LENGTH = 20;
const MAX_EMPLOYEE_ID_LENGTH = 20;
const MAX_VACATION_DATES = 31;

function isValidOutputFormat(value: unknown): value is 'docx' | 'doc' {
  return value === 'docx' || value === 'doc';
}

function requireTrimmedString(value: unknown, fieldName: string, maxLength: number): string {
  if (value === undefined || value === null) {
    throw new TimesheetValidationError(`${fieldName} is required.`, []);
  }
  if (typeof value !== 'string') {
    throw new TimesheetValidationError(`${fieldName} must be a string.`, []);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new TimesheetValidationError(`${fieldName} is required.`, []);
  }
  if (trimmed.length > maxLength) {
    throw new TimesheetValidationError(`${fieldName} cannot exceed ${maxLength} characters.`, []);
  }
  return trimmed;
}

export function parsePayload(payload: unknown): TimesheetGenerateRequest {
  if (!payload || typeof payload !== 'object') {
    throw new TimesheetValidationError('Request payload must be a JSON object.', []);
  }

  const body = payload as Partial<TimesheetGenerateRequest>;

  const employeeName = requireTrimmedString(
    body.employeeName,
    'Employee name',
    MAX_EMPLOYEE_NAME_LENGTH
  );
  const employeeId = requireTrimmedString(body.employeeId, 'Employee id', MAX_EMPLOYEE_ID_LENGTH);
  const companyCode = requireTrimmedString(
    body.companyCode,
    'Company code',
    MAX_COMPANY_CODE_LENGTH
  );

  if (!/^\d{6,12}$/.test(companyCode)) {
    throw new TimesheetValidationError('Company code must be numeric (6\u201312 digits).', []);
  }

  if (!/^\d{11}$/.test(employeeId)) {
    throw new TimesheetValidationError('Employee ID must be exactly 11 digits.', []);
  }

  if (!Array.isArray(body.vacationDates)) {
    throw new TimesheetValidationError('Vacation dates must be an array.', []);
  }

  if (body.vacationDates.length > MAX_VACATION_DATES) {
    throw new TimesheetValidationError(
      `Vacation dates cannot exceed ${MAX_VACATION_DATES} entries.`,
      []
    );
  }

  const invalidEntries = body.vacationDates.filter((entry: unknown) => typeof entry !== 'string');
  if (invalidEntries.length > 0) {
    throw new TimesheetValidationError('All vacation dates must be strings.', []);
  }

  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const malformedDates = body.vacationDates.filter((d: string) => !ISO_DATE_RE.test(d));
  if (malformedDates.length > 0) {
    throw new TimesheetValidationError('Vacation dates must be in YYYY-MM-DD format.', []);
  }

  if (!isValidOutputFormat(body.outputFormat)) {
    throw new TimesheetValidationError('Output format must be either docx or doc.', []);
  }

  const year = Number(body.year);
  const month = Number(body.month);

  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new TimesheetValidationError(
      `Year must be an integer between ${MIN_YEAR} and ${MAX_YEAR}.`,
      []
    );
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new TimesheetValidationError('Month must be an integer between 1 and 12.', []);
  }

  return {
    year,
    month,
    companyCode,
    employeeName,
    employeeId,
    vacationDates: body.vacationDates,
    outputFormat: body.outputFormat
  };
}
