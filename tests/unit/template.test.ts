import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({
  dev: true
}));

import { loadTemplateBuffer, DOCX_TEMPLATE_PATH } from '../../src/lib/server/template';

describe('template', () => {
  it('loadTemplateBuffer returns a non-empty Buffer', async () => {
    const buffer = await loadTemplateBuffer();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('DOCX_TEMPLATE_PATH references the correct template path', () => {
    expect(DOCX_TEMPLATE_PATH).toContain('timesheet_template.docx');
    expect(DOCX_TEMPLATE_PATH).toContain('static');
    expect(DOCX_TEMPLATE_PATH).toContain('templates');
  });
});
