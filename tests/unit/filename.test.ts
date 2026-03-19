import { describe, expect, it } from 'vitest';
import { buildOutputFilename } from '../../src/lib/server/filename';

describe('buildOutputFilename', () => {
  it('builds filename from employee name', () => {
    expect(buildOutputFilename('John Doe', 2026, 1, 'docx')).toBe(
      'john-doe-jan-2026-timesheet.docx'
    );
    expect(buildOutputFilename('John Doe', 2026, 1, 'doc')).toBe('john-doe-jan-2026-timesheet.doc');
  });

  it('handles Georgian characters in name', () => {
    expect(buildOutputFilename('გიორგი პეტრიაშვილი', 2026, 3, 'docx')).toBe(
      'გიორგი-პეტრიაშვილი-mar-2026-timesheet.docx'
    );
  });

  it('falls back to "timesheet" slug for empty name', () => {
    expect(buildOutputFilename('', 2026, 6, 'docx')).toBe('timesheet-jun-2026-timesheet.docx');
  });

  it('strips special characters from name', () => {
    expect(buildOutputFilename('Jane "J" O\'Brien', 2026, 12, 'docx')).toBe(
      'jane-j-obrien-dec-2026-timesheet.docx'
    );
  });

  it('throws for invalid month', () => {
    expect(() => buildOutputFilename('Test', 2026, 0, 'docx')).toThrow(
      'Month must be from 1 to 12.'
    );
    expect(() => buildOutputFilename('Test', 2026, 13, 'docx')).toThrow(
      'Month must be from 1 to 12.'
    );
  });
});
