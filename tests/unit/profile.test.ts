import { describe, it, expect, beforeEach } from 'vitest';
import { isNumeric, looksLikeName } from '../../src/lib/validation';
import {
  normalizeCompanyCode,
  normalizeEmployeeId,
  normalizeEmployeeName,
  repairProfileSnapshot,
  persistProfile,
  loadSavedProfile,
  validateProfile,
  NO_FIELD_ERRORS
} from '../../src/lib/profile';

// Minimal localStorage mock for Node environment
const store = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear()
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

describe('isNumeric', () => {
  it('returns true for digit-only strings', () => {
    expect(isNumeric('12345')).toBe(true);
    expect(isNumeric('0')).toBe(true);
  });

  it('returns false for non-digit strings', () => {
    expect(isNumeric('abc')).toBe(false);
    expect(isNumeric('12a')).toBe(false);
    expect(isNumeric('')).toBe(false);
  });

  it('trims before checking', () => {
    expect(isNumeric('  123  ')).toBe(true);
  });
});

describe('looksLikeName', () => {
  it('returns true if the string contains non-digit non-space characters', () => {
    expect(looksLikeName('John')).toBe(true);
    expect(looksLikeName('ნინო')).toBe(true);
  });

  it('returns false for digit-only or blank strings', () => {
    expect(looksLikeName('12345')).toBe(false);
    expect(looksLikeName('  ')).toBe(false);
    expect(looksLikeName('')).toBe(false);
  });
});

describe('normalizeCompanyCode', () => {
  it('returns a valid numeric code of 6–12 digits as-is', () => {
    expect(normalizeCompanyCode('123456')).toBe('123456');
    expect(normalizeCompanyCode('123456789012')).toBe('123456789012');
  });

  it('trims whitespace', () => {
    expect(normalizeCompanyCode('  123456  ')).toBe('123456');
  });

  it('returns empty for too-short codes', () => {
    expect(normalizeCompanyCode('12345')).toBe('');
  });

  it('returns empty for too-long codes', () => {
    expect(normalizeCompanyCode('1234567890123')).toBe('');
  });

  it('returns empty for non-numeric codes', () => {
    expect(normalizeCompanyCode('abc123')).toBe('');
  });

  it('returns empty for blank input', () => {
    expect(normalizeCompanyCode('')).toBe('');
    expect(normalizeCompanyCode('   ')).toBe('');
  });
});

describe('normalizeEmployeeId', () => {
  it('returns a valid 11-digit ID as-is', () => {
    expect(normalizeEmployeeId('12345678901')).toBe('12345678901');
  });

  it('trims whitespace', () => {
    expect(normalizeEmployeeId('  12345678901  ')).toBe('12345678901');
  });

  it('returns empty for wrong-length IDs', () => {
    expect(normalizeEmployeeId('1234567890')).toBe('');
    expect(normalizeEmployeeId('123456789012')).toBe('');
  });

  it('returns empty for non-numeric IDs', () => {
    expect(normalizeEmployeeId('0100503111a')).toBe('');
  });

  it('returns empty for blank input', () => {
    expect(normalizeEmployeeId('')).toBe('');
  });
});

describe('normalizeEmployeeName', () => {
  it('returns a valid name as-is', () => {
    expect(normalizeEmployeeName('John Doe')).toBe('John Doe');
    expect(normalizeEmployeeName('ნინო')).toBe('ნინო');
  });

  it('trims whitespace', () => {
    expect(normalizeEmployeeName('  John Doe  ')).toBe('John Doe');
  });

  it('returns empty for digit-only strings', () => {
    expect(normalizeEmployeeName('12345')).toBe('');
  });

  it('returns empty for blank input', () => {
    expect(normalizeEmployeeName('')).toBe('');
    expect(normalizeEmployeeName('   ')).toBe('');
  });
});

describe('repairProfileSnapshot', () => {
  it('returns normalized values for a correct snapshot', () => {
    const result = repairProfileSnapshot({
      companyCode: '123456789',
      employeeName: 'John Doe',
      employeeId: '12345678901'
    });
    expect(result.companyCode).toBe('123456789');
    expect(result.employeeName).toBe('John Doe');
    expect(result.employeeId).toBe('12345678901');
  });

  it('swaps company code and employee name when misplaced', () => {
    const result = repairProfileSnapshot({
      companyCode: 'John Doe',
      employeeName: '123456789',
      employeeId: '12345678901'
    });
    expect(result.companyCode).toBe('123456789');
    expect(result.employeeName).toBe('John Doe');
    expect(result.employeeId).toBe('12345678901');
  });

  it('trims all values', () => {
    const result = repairProfileSnapshot({
      companyCode: '  123456789  ',
      employeeName: '  John Doe  ',
      employeeId: '  12345678901  '
    });
    expect(result.companyCode).toBe('123456789');
    expect(result.employeeName).toBe('John Doe');
    expect(result.employeeId).toBe('12345678901');
  });

  it('preserves invalid values without blanking them', () => {
    const result = repairProfileSnapshot({
      companyCode: 'abc',
      employeeName: '12345',
      employeeId: 'short'
    });
    expect(result.companyCode).toBe('abc');
    expect(result.employeeName).toBe('12345');
    expect(result.employeeId).toBe('short');
  });
});

describe('validateProfile', () => {
  const valid = {
    companyCode: '123456789',
    employeeName: 'John Doe',
    employeeId: '12345678901'
  };

  it('returns empty messages and no field errors for valid snapshot', () => {
    const result = validateProfile(valid);
    expect(result.messages).toHaveLength(0);
    expect(result.fieldErrors).toEqual(NO_FIELD_ERRORS);
  });

  it('returns both messages and field errors together', () => {
    const result = validateProfile({
      companyCode: '',
      employeeName: '',
      employeeId: ''
    });
    expect(result.messages).toHaveLength(3);
    expect(result.fieldErrors).toEqual({
      companyCode: true,
      employeeName: true,
      employeeId: true
    });
  });
});

describe('persistProfile', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves the profile to localStorage', () => {
    persistProfile({
      companyCode: '123456789',
      employeeName: 'Test',
      employeeId: '12345678901'
    });
    const saved = localStorage.getItem('timesheet.profile.v1');
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(parsed.companyCode).toBe('123456789');
    expect(parsed.employeeName).toBe('Test');
    expect(parsed.employeeId).toBe('12345678901');
  });
});

describe('loadSavedProfile', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no profile is saved', () => {
    expect(loadSavedProfile()).toBeNull();
  });

  it('returns a repaired profile from valid localStorage data', () => {
    localStorage.setItem(
      'timesheet.profile.v1',
      JSON.stringify({
        companyCode: '123456789',
        employeeName: 'John Doe',
        employeeId: '12345678901'
      })
    );
    const result = loadSavedProfile();
    expect(result).toEqual({
      companyCode: '123456789',
      employeeName: 'John Doe',
      employeeId: '12345678901'
    });
  });

  it('removes corrupted data and returns null', () => {
    localStorage.setItem('timesheet.profile.v1', '{invalid json');
    const result = loadSavedProfile();
    expect(result).toBeNull();
    expect(localStorage.getItem('timesheet.profile.v1')).toBeNull();
  });

  it('handles missing fields with empty-string defaults', () => {
    localStorage.setItem('timesheet.profile.v1', JSON.stringify({ companyCode: '123456789' }));
    const result = loadSavedProfile();
    expect(result).not.toBeNull();
    expect(result!.companyCode).toBe('123456789');
    expect(result!.employeeName).toBe('');
    expect(result!.employeeId).toBe('');
  });

  it('does not overwrite localStorage on load', () => {
    const original = JSON.stringify({
      companyCode: '  123456789  ',
      employeeName: '  John  ',
      employeeId: '12345678901'
    });
    localStorage.setItem('timesheet.profile.v1', original);
    loadSavedProfile();
    expect(localStorage.getItem('timesheet.profile.v1')).toBe(original);
  });
});
