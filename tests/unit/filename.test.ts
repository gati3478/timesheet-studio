import { describe, expect, it } from 'vitest';
import { buildOutputFilename } from '../../src/lib/server/filename';

describe('buildOutputFilename', () => {
  it('builds short lowercase month filename', () => {
    expect(buildOutputFilename(2026, 1, 'docx')).toBe('g.petriashvili-jan-2026-timesheet.docx');
    expect(buildOutputFilename(2026, 1, 'doc')).toBe('g.petriashvili-jan-2026-timesheet.doc');
  });
});
