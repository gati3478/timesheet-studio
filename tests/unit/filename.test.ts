import { describe, expect, it } from 'vitest';
import { buildOutputFilename } from '../../src/lib/filename';

describe('buildOutputFilename', () => {
  it('builds filename from employee name', () => {
    expect(buildOutputFilename('John Doe', 2026, 1, 'docx')).toBe('john-doe-jan-2026.docx');
    expect(buildOutputFilename('John Doe', 2026, 1, 'doc')).toBe('john-doe-jan-2026.doc');
  });

  it('handles Georgian characters in name', () => {
    expect(buildOutputFilename('ნინო ბერიძე', 2026, 3, 'docx')).toBe('ნინო-ბერიძე-mar-2026.docx');
  });

  it('falls back to "timesheet" slug for empty name', () => {
    expect(buildOutputFilename('', 2026, 6, 'docx')).toBe('timesheet-jun-2026.docx');
  });

  it('strips special characters from name', () => {
    expect(buildOutputFilename('Jane "J" O\'Brien', 2026, 12, 'docx')).toBe(
      'jane-j-obrien-dec-2026.docx'
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

  it('falls back to "timesheet" slug for whitespace-only name', () => {
    expect(buildOutputFilename('   ', 2026, 4, 'docx')).toBe('timesheet-apr-2026.docx');
  });

  it('keeps numeric characters in slug', () => {
    expect(buildOutputFilename('12345', 2026, 5, 'docx')).toBe('12345-may-2026.docx');
  });

  it('falls back to "timesheet" slug when only special characters remain', () => {
    expect(buildOutputFilename('!!!@@@', 2026, 5, 'docx')).toBe('timesheet-may-2026.docx');
  });

  it('collapses multiple consecutive spaces into a single hyphen', () => {
    expect(buildOutputFilename('John   Doe', 2026, 7, 'docx')).toBe('john-doe-jul-2026.docx');
  });

  it('preserves mixed Georgian and ASCII characters', () => {
    expect(buildOutputFilename('ნინო Dev', 2026, 9, 'docx')).toBe('ნინო-dev-sep-2026.docx');
  });

  it('produces correct month abbreviation for all 12 months', () => {
    const expected = [
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
    ];
    for (let month = 1; month <= 12; month += 1) {
      const filename = buildOutputFilename('x', 2026, month, 'docx');
      expect(filename).toBe(`x-${expected[month - 1]}-2026.docx`);
    }
  });

  it('uses doc extension for all slug variants', () => {
    expect(buildOutputFilename('', 2026, 1, 'doc')).toBe('timesheet-jan-2026.doc');
    expect(buildOutputFilename('ნინო', 2026, 6, 'doc')).toBe('ნინო-jun-2026.doc');
  });

  it('preserves very long names without truncation', () => {
    const longName = 'a'.repeat(300);
    const filename = buildOutputFilename(longName, 2026, 2, 'docx');
    expect(filename).toBe(`${'a'.repeat(300)}-feb-2026.docx`);
  });
});
