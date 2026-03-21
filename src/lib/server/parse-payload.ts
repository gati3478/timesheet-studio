import { TimesheetValidationError } from './timesheet';
import type { TimesheetGenerateRequest } from './types';

const MAX_EMPLOYEE_NAME_LENGTH = 500;
const MAX_COMPANY_CODE_LENGTH = 20;
const MAX_EMPLOYEE_ID_LENGTH = 20;
const MAX_VACATION_DATES = 31;

export function isValidOutputFormat(value: unknown): value is 'docx' | 'doc' {
  return value === 'docx' || value === 'doc';
}

export function parsePayload(payload: unknown): TimesheetGenerateRequest {
  if (!payload || typeof payload !== 'object') {
    throw new TimesheetValidationError('Request payload must be a JSON object.', []);
  }

  const body = payload as Partial<TimesheetGenerateRequest>;

  if (!body.employeeName || typeof body.employeeName !== 'string') {
    throw new TimesheetValidationError('Employee name is required.', []);
  }

  if (!body.employeeId || typeof body.employeeId !== 'string') {
    throw new TimesheetValidationError('Employee id is required.', []);
  }

  if (!body.companyCode || typeof body.companyCode !== 'string') {
    throw new TimesheetValidationError('Company code is required.', []);
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

  if (!isValidOutputFormat(body.outputFormat)) {
    throw new TimesheetValidationError('Output format must be either docx or doc.', []);
  }

  const companyCode = body.companyCode.trim();
  const employeeName = body.employeeName.trim();
  const employeeId = body.employeeId.trim();

  if (companyCode.length === 0) {
    throw new TimesheetValidationError('Company code is required.', []);
  }

  if (employeeName.length === 0) {
    throw new TimesheetValidationError('Employee name is required.', []);
  }

  if (employeeName.length > MAX_EMPLOYEE_NAME_LENGTH) {
    throw new TimesheetValidationError(
      `Employee name cannot exceed ${MAX_EMPLOYEE_NAME_LENGTH} characters.`,
      []
    );
  }

  if (companyCode.length > MAX_COMPANY_CODE_LENGTH) {
    throw new TimesheetValidationError(
      `Company code cannot exceed ${MAX_COMPANY_CODE_LENGTH} characters.`,
      []
    );
  }

  if (employeeId.length === 0) {
    throw new TimesheetValidationError('Employee id is required.', []);
  }

  if (employeeId.length > MAX_EMPLOYEE_ID_LENGTH) {
    throw new TimesheetValidationError(
      `Employee id cannot exceed ${MAX_EMPLOYEE_ID_LENGTH} characters.`,
      []
    );
  }

  const year = Number(body.year);
  const month = Number(body.month);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new TimesheetValidationError('Year must be an integer between 2000 and 2100.', []);
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
