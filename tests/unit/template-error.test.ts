import { describe, it, expect, vi } from 'vitest';

vi.mock('$app/environment', () => ({
  dev: true
}));

const mockAccess = vi.hoisted(() => vi.fn());

vi.mock('node:fs/promises', () => ({
  access: mockAccess,
  readFile: vi.fn()
}));

describe('assertTemplateExists error path', () => {
  it('throws helpful message when template file is missing', async () => {
    mockAccess.mockRejectedValueOnce(
      Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })
    );

    const { assertTemplateExists } = await import('../../src/lib/server/template');

    await expect(assertTemplateExists()).rejects.toThrow(
      'Template DOCX is missing. Run `npm run prepare:template` to convert timesheet_template.doc.'
    );
  });
});
