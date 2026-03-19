import { describe, it, expect } from 'vitest';
import { parsePayload, isValidOutputFormat } from '../../src/lib/server/parse-payload';
import { TimesheetValidationError } from '../../src/lib/server/timesheet';

const VALID_PAYLOAD = {
  year: 2026,
  month: 3,
  companyCode: '405627530',
  employeeName: 'Test User',
  employeeId: '01005031116',
  vacationDates: [],
  outputFormat: 'docx' as const
};

describe('isValidOutputFormat', () => {
  it('accepts docx', () => {
    expect(isValidOutputFormat('docx')).toBe(true);
  });

  it('accepts doc', () => {
    expect(isValidOutputFormat('doc')).toBe(true);
  });

  it('rejects pdf', () => {
    expect(isValidOutputFormat('pdf')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidOutputFormat('')).toBe(false);
  });

  it('rejects null', () => {
    expect(isValidOutputFormat(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isValidOutputFormat(undefined)).toBe(false);
  });

  it('rejects number', () => {
    expect(isValidOutputFormat(42)).toBe(false);
  });

  it('rejects uppercase DOCX', () => {
    expect(isValidOutputFormat('DOCX')).toBe(false);
  });
});

describe('parsePayload', () => {
  it('accepts a valid payload', () => {
    const result = parsePayload(VALID_PAYLOAD);
    expect(result.year).toBe(2026);
    expect(result.month).toBe(3);
    expect(result.companyCode).toBe('405627530');
    expect(result.employeeName).toBe('Test User');
    expect(result.employeeId).toBe('01005031116');
    expect(result.outputFormat).toBe('docx');
  });

  it('accepts doc output format', () => {
    const result = parsePayload({ ...VALID_PAYLOAD, outputFormat: 'doc' });
    expect(result.outputFormat).toBe('doc');
  });

  it('rejects null payload', () => {
    expect(() => parsePayload(null)).toThrow(TimesheetValidationError);
    expect(() => parsePayload(null)).toThrow('Request payload must be a JSON object.');
  });

  it('rejects non-object payload', () => {
    expect(() => parsePayload('string')).toThrow('Request payload must be a JSON object.');
    expect(() => parsePayload(42)).toThrow('Request payload must be a JSON object.');
  });

  it('rejects missing employeeName', () => {
    const payload = { ...VALID_PAYLOAD, employeeName: undefined };
    expect(() => parsePayload(payload)).toThrow('Employee name is required.');
  });

  it('rejects numeric employeeName', () => {
    const payload = { ...VALID_PAYLOAD, employeeName: 123 };
    expect(() => parsePayload(payload as unknown)).toThrow('Employee name is required.');
  });

  it('rejects missing employeeId', () => {
    const payload = { ...VALID_PAYLOAD, employeeId: undefined };
    expect(() => parsePayload(payload)).toThrow('Employee id is required.');
  });

  it('rejects missing companyCode', () => {
    const payload = { ...VALID_PAYLOAD, companyCode: undefined };
    expect(() => parsePayload(payload)).toThrow('Company code is required.');
  });

  it('rejects non-array vacationDates', () => {
    const payload = { ...VALID_PAYLOAD, vacationDates: 'not-an-array' };
    expect(() => parsePayload(payload as unknown)).toThrow('Vacation dates must be an array.');
  });

  it('rejects invalid outputFormat', () => {
    const payload = { ...VALID_PAYLOAD, outputFormat: 'pdf' };
    expect(() => parsePayload(payload as unknown)).toThrow(
      'Output format must be either docx or doc.'
    );
  });

  it('rejects whitespace-only companyCode', () => {
    const payload = { ...VALID_PAYLOAD, companyCode: '   ' };
    expect(() => parsePayload(payload)).toThrow('Company code is required.');
  });

  it('rejects whitespace-only employeeName', () => {
    const payload = { ...VALID_PAYLOAD, employeeName: '   ' };
    expect(() => parsePayload(payload)).toThrow('Employee name is required.');
  });

  it('rejects whitespace-only employeeId', () => {
    const payload = { ...VALID_PAYLOAD, employeeId: '   ' };
    expect(() => parsePayload(payload)).toThrow('Employee id is required.');
  });

  it('rejects year below 2000', () => {
    const payload = { ...VALID_PAYLOAD, year: 1999 };
    expect(() => parsePayload(payload)).toThrow('Year must be an integer between 2000 and 2100.');
  });

  it('rejects year above 2100', () => {
    const payload = { ...VALID_PAYLOAD, year: 2101 };
    expect(() => parsePayload(payload)).toThrow('Year must be an integer between 2000 and 2100.');
  });

  it('rejects non-integer year', () => {
    const payload = { ...VALID_PAYLOAD, year: 2026.5 };
    expect(() => parsePayload(payload)).toThrow('Year must be an integer between 2000 and 2100.');
  });

  it('rejects month below 1', () => {
    const payload = { ...VALID_PAYLOAD, month: 0 };
    expect(() => parsePayload(payload)).toThrow('Month must be an integer between 1 and 12.');
  });

  it('rejects month above 12', () => {
    const payload = { ...VALID_PAYLOAD, month: 13 };
    expect(() => parsePayload(payload)).toThrow('Month must be an integer between 1 and 12.');
  });

  it('trims whitespace from string fields', () => {
    const payload = {
      ...VALID_PAYLOAD,
      companyCode: '  405627530  ',
      employeeName: '  Test User  ',
      employeeId: '  01005031116  '
    };
    const result = parsePayload(payload);
    expect(result.companyCode).toBe('405627530');
    expect(result.employeeName).toBe('Test User');
    expect(result.employeeId).toBe('01005031116');
  });

  it('passes through vacationDates array', () => {
    const payload = { ...VALID_PAYLOAD, vacationDates: ['2026-03-15', '2026-03-16'] };
    const result = parsePayload(payload);
    expect(result.vacationDates).toEqual(['2026-03-15', '2026-03-16']);
  });

  it('accepts boundary year 2000', () => {
    const result = parsePayload({ ...VALID_PAYLOAD, year: 2000 });
    expect(result.year).toBe(2000);
  });

  it('accepts boundary year 2100', () => {
    const result = parsePayload({ ...VALID_PAYLOAD, year: 2100 });
    expect(result.year).toBe(2100);
  });

  it('accepts boundary month 1 and 12', () => {
    expect(parsePayload({ ...VALID_PAYLOAD, month: 1 }).month).toBe(1);
    expect(parsePayload({ ...VALID_PAYLOAD, month: 12 }).month).toBe(12);
  });

  it('rejects employeeName exceeding 500 characters', () => {
    const payload = { ...VALID_PAYLOAD, employeeName: 'ა'.repeat(501) };
    expect(() => parsePayload(payload)).toThrow('Employee name cannot exceed 500 characters.');
  });

  it('accepts employeeName at exactly 500 characters', () => {
    const payload = { ...VALID_PAYLOAD, employeeName: 'ა'.repeat(500) };
    const result = parsePayload(payload);
    expect(result.employeeName.length).toBe(500);
  });

  it('rejects companyCode exceeding 20 characters', () => {
    const payload = { ...VALID_PAYLOAD, companyCode: '1'.repeat(21) };
    expect(() => parsePayload(payload)).toThrow('Company code cannot exceed 20 characters.');
  });

  it('accepts companyCode at exactly 20 characters', () => {
    const payload = { ...VALID_PAYLOAD, companyCode: '1'.repeat(20) };
    const result = parsePayload(payload);
    expect(result.companyCode.length).toBe(20);
  });

  it('rejects employeeId exceeding 20 characters', () => {
    const payload = { ...VALID_PAYLOAD, employeeId: '0'.repeat(21) };
    expect(() => parsePayload(payload)).toThrow('Employee id cannot exceed 20 characters.');
  });

  it('accepts employeeId at exactly 20 characters', () => {
    const payload = { ...VALID_PAYLOAD, employeeId: '0'.repeat(20) };
    const result = parsePayload(payload);
    expect(result.employeeId.length).toBe(20);
  });

  it('rejects vacationDates array exceeding 31 entries', () => {
    const dates = Array.from({ length: 32 }, (_, i) => `2026-03-${String(i + 1).padStart(2, '0')}`);
    const payload = { ...VALID_PAYLOAD, vacationDates: dates };
    expect(() => parsePayload(payload)).toThrow('Vacation dates cannot exceed 31 entries.');
  });

  it('accepts vacationDates array at exactly 31 entries', () => {
    const dates = Array.from({ length: 31 }, (_, i) => `2026-03-${String(i + 1).padStart(2, '0')}`);
    const payload = { ...VALID_PAYLOAD, vacationDates: dates };
    const result = parsePayload(payload);
    expect(result.vacationDates).toHaveLength(31);
  });
});
