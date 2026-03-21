import { describe, it, expect, vi, afterEach } from 'vitest';
import path from 'node:path';

vi.mock('$app/environment', () => ({
  dev: false
}));

vi.mock('node:fs/promises', () => ({
  access: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from('fake'))
}));

describe('template TEMPLATE_DIR env var', () => {
  const originalEnv = process.env.TEMPLATE_DIR;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.TEMPLATE_DIR;
    } else {
      process.env.TEMPLATE_DIR = originalEnv;
    }
    vi.resetModules();
  });

  it('resolves template path from TEMPLATE_DIR when set', async () => {
    process.env.TEMPLATE_DIR = '/custom/sidecar/templates';
    const { DOCX_TEMPLATE_PATH } = await import('../../src/lib/server/template');
    expect(DOCX_TEMPLATE_PATH).toBe(
      path.resolve('/custom/sidecar/templates', 'timesheet_template.docx')
    );
  });

  it('resolves to build/client/templates in production when TEMPLATE_DIR is unset', async () => {
    delete process.env.TEMPLATE_DIR;
    const { DOCX_TEMPLATE_PATH } = await import('../../src/lib/server/template');
    expect(DOCX_TEMPLATE_PATH).toContain(path.join('build', 'client', 'templates'));
    expect(DOCX_TEMPLATE_PATH).toContain('timesheet_template.docx');
  });
});
