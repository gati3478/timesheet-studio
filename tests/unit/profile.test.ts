import { describe, it, expect, beforeEach } from 'vitest';
import {
  isNumeric,
  looksLikeName,
  normalizeCompanyCode,
  normalizeEmployeeId,
  normalizeEmployeeName,
  repairProfileSnapshot,
  persistProfile,
  loadSavedProfile,
  validateProfileFields,
  identifyInvalidFields,
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
    expect(normalizeEmployeeId('01005031116')).toBe('01005031116');
  });

  it('trims whitespace', () => {
    expect(normalizeEmployeeId('  01005031116  ')).toBe('01005031116');
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
      companyCode: '405627530',
      employeeName: 'John Doe',
      employeeId: '01005031116'
    });
    expect(result.companyCode).toBe('405627530');
    expect(result.employeeName).toBe('John Doe');
    expect(result.employeeId).toBe('01005031116');
  });

  it('swaps company code and employee name when misplaced', () => {
    const result = repairProfileSnapshot({
      companyCode: 'John Doe',
      employeeName: '405627530',
      employeeId: '01005031116'
    });
    expect(result.companyCode).toBe('');
    expect(result.employeeName).toBe('John Doe');
    expect(result.employeeId).toBe('01005031116');
  });

  it('trims all values', () => {
    const result = repairProfileSnapshot({
      companyCode: '  405627530  ',
      employeeName: '  John Doe  ',
      employeeId: '  01005031116  '
    });
    expect(result.companyCode).toBe('405627530');
    expect(result.employeeName).toBe('John Doe');
    expect(result.employeeId).toBe('01005031116');
  });

  it('normalizes invalid values to empty strings', () => {
    const result = repairProfileSnapshot({
      companyCode: 'abc',
      employeeName: '12345',
      employeeId: 'short'
    });
    expect(result.companyCode).toBe('');
    expect(result.employeeName).toBe('');
    expect(result.employeeId).toBe('');
  });
});

describe('validateProfileFields', () => {
  const valid = {
    companyCode: '405627530',
    employeeName: 'John Doe',
    employeeId: '01005031116'
  };

  it('returns no errors for a valid snapshot', () => {
    expect(validateProfileFields(valid)).toEqual([]);
  });

  it('returns error for empty company code', () => {
    const errors = validateProfileFields({ ...valid, companyCode: '' });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/company code/i);
  });

  it('returns error for non-numeric company code', () => {
    const errors = validateProfileFields({ ...valid, companyCode: 'abc123' });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/numeric/i);
  });

  it('returns error for too-short company code', () => {
    const errors = validateProfileFields({ ...valid, companyCode: '12345' });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/numeric.*6/i);
  });

  it('returns error for empty employee name', () => {
    const errors = validateProfileFields({ ...valid, employeeName: '' });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/employee name/i);
  });

  it('returns error for digit-only employee name', () => {
    const errors = validateProfileFields({ ...valid, employeeName: '12345' });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/text/i);
  });

  it('returns error for empty employee ID', () => {
    const errors = validateProfileFields({ ...valid, employeeId: '' });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/employee id/i);
  });

  it('returns error for wrong-length employee ID', () => {
    const errors = validateProfileFields({ ...valid, employeeId: '12345' });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/11 digits/i);
  });

  it('returns multiple errors when all fields are empty', () => {
    const errors = validateProfileFields({
      companyCode: '',
      employeeName: '',
      employeeId: ''
    });
    expect(errors).toHaveLength(3);
  });
});

describe('identifyInvalidFields', () => {
  const valid = {
    companyCode: '405627530',
    employeeName: 'John Doe',
    employeeId: '01005031116'
  };

  it('returns all false for a valid snapshot', () => {
    expect(identifyInvalidFields(valid)).toEqual(NO_FIELD_ERRORS);
  });

  it('marks companyCode true when empty', () => {
    const result = identifyInvalidFields({ ...valid, companyCode: '' });
    expect(result.companyCode).toBe(true);
    expect(result.employeeName).toBe(false);
    expect(result.employeeId).toBe(false);
  });

  it('marks companyCode true when non-numeric', () => {
    expect(identifyInvalidFields({ ...valid, companyCode: 'abc' }).companyCode).toBe(true);
  });

  it('marks employeeName true when empty', () => {
    const result = identifyInvalidFields({ ...valid, employeeName: '' });
    expect(result.employeeName).toBe(true);
    expect(result.companyCode).toBe(false);
  });

  it('marks employeeName true when digit-only', () => {
    expect(identifyInvalidFields({ ...valid, employeeName: '12345' }).employeeName).toBe(true);
  });

  it('marks employeeId true when empty', () => {
    const result = identifyInvalidFields({ ...valid, employeeId: '' });
    expect(result.employeeId).toBe(true);
    expect(result.companyCode).toBe(false);
  });

  it('marks employeeId true when wrong length', () => {
    expect(identifyInvalidFields({ ...valid, employeeId: '12345' }).employeeId).toBe(true);
  });

  it('marks all fields true when all are empty', () => {
    const result = identifyInvalidFields({
      companyCode: '',
      employeeName: '',
      employeeId: ''
    });
    expect(result).toEqual({ companyCode: true, employeeName: true, employeeId: true });
  });

  it('agrees with validateProfileFields on which fields are invalid', () => {
    const snapshots = [
      { companyCode: '', employeeName: 'Name', employeeId: '01005031116' },
      { companyCode: '405627530', employeeName: '', employeeId: '01005031116' },
      { companyCode: '405627530', employeeName: 'Name', employeeId: '' },
      { companyCode: 'bad', employeeName: '12345', employeeId: 'short' },
      { companyCode: '405627530', employeeName: 'Name', employeeId: '01005031116' }
    ];

    for (const snapshot of snapshots) {
      const errors = validateProfileFields(snapshot);
      const fields = identifyInvalidFields(snapshot);

      const hasCompanyError = errors.some((e) => /company/i.test(e));
      const hasNameError = errors.some((e) => /employee name/i.test(e));
      const hasIdError = errors.some((e) => /employee id/i.test(e));

      expect(fields.companyCode).toBe(hasCompanyError);
      expect(fields.employeeName).toBe(hasNameError);
      expect(fields.employeeId).toBe(hasIdError);
    }
  });
});

describe('persistProfile', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves the profile to localStorage', () => {
    persistProfile({
      companyCode: '405627530',
      employeeName: 'Test',
      employeeId: '01005031116'
    });
    const saved = localStorage.getItem('timesheet.profile.v1');
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(parsed.companyCode).toBe('405627530');
    expect(parsed.employeeName).toBe('Test');
    expect(parsed.employeeId).toBe('01005031116');
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
        companyCode: '405627530',
        employeeName: 'John Doe',
        employeeId: '01005031116'
      })
    );
    const result = loadSavedProfile();
    expect(result).toEqual({
      companyCode: '405627530',
      employeeName: 'John Doe',
      employeeId: '01005031116'
    });
  });

  it('removes corrupted data and returns null', () => {
    localStorage.setItem('timesheet.profile.v1', '{invalid json');
    const result = loadSavedProfile();
    expect(result).toBeNull();
    expect(localStorage.getItem('timesheet.profile.v1')).toBeNull();
  });

  it('handles missing fields with empty-string defaults', () => {
    localStorage.setItem('timesheet.profile.v1', JSON.stringify({ companyCode: '405627530' }));
    const result = loadSavedProfile();
    expect(result).not.toBeNull();
    expect(result!.companyCode).toBe('405627530');
    expect(result!.employeeName).toBe('');
    expect(result!.employeeId).toBe('');
  });

  it('persists the repaired profile back to localStorage', () => {
    localStorage.setItem(
      'timesheet.profile.v1',
      JSON.stringify({
        companyCode: '  405627530  ',
        employeeName: '  John  ',
        employeeId: '01005031116'
      })
    );
    loadSavedProfile();
    const repersisted = JSON.parse(localStorage.getItem('timesheet.profile.v1')!);
    expect(repersisted.companyCode).toBe('405627530');
    expect(repersisted.employeeName).toBe('John');
  });
});
