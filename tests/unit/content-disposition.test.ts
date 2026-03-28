import { describe, expect, it } from 'vitest';
import { parseFilename } from '../../src/lib/content-disposition';

describe('parseFilename', () => {
  it('returns null for null input', () => {
    expect(parseFilename(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseFilename('')).toBeNull();
  });

  it('returns null when filename is missing from header', () => {
    expect(parseFilename('attachment')).toBeNull();
    expect(parseFilename('inline; size=1234')).toBeNull();
  });

  it('decodes RFC 5987 filename* with encoded characters', () => {
    expect(parseFilename("attachment; filename*=UTF-8''hello%20world.docx")).toBe(
      'hello world.docx'
    );
  });

  it('falls through to basic filename when filename* has invalid encoding', () => {
    expect(parseFilename('attachment; filename*=UTF-8\'\'%E0%A4%A; filename="fallback.docx"')).toBe(
      'fallback.docx'
    );
  });

  it('parses quoted filename', () => {
    expect(parseFilename('attachment; filename="some file.docx"')).toBe('some file.docx');
  });

  it('parses unquoted filename', () => {
    expect(parseFilename('attachment; filename=test-file.docx')).toBe('test-file.docx');
  });

  it('handles Georgian filename in quotes', () => {
    expect(parseFilename('attachment; filename="ტაბელი.docx"')).toBe('ტაბელი.docx');
  });

  it('prefers filename* over filename when both are present', () => {
    expect(
      parseFilename(
        'attachment; filename="ascii.docx"; filename*=UTF-8\'\'%E1%83%A2%E1%83%90%E1%83%91%E1%83%94%E1%83%9A%E1%83%98.docx'
      )
    ).toBe('ტაბელი.docx');
  });
});
