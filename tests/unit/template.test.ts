import { describe, expect, it } from 'vitest';
import {
  assertTemplateExists,
  loadTemplateBuffer,
  DOCX_TEMPLATE_PATH
} from '../../src/lib/server/template';

describe('template', () => {
  it('assertTemplateExists resolves for real template', async () => {
    await expect(assertTemplateExists()).resolves.toBeUndefined();
  });

  it('loadTemplateBuffer returns a non-empty Buffer', async () => {
    const buffer = await loadTemplateBuffer();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('assertTemplateExists references the correct template path', () => {
    // Verify the template path points to the expected location
    expect(DOCX_TEMPLATE_PATH).toContain('timesheet_template.docx');
    expect(DOCX_TEMPLATE_PATH).toContain('static');
    expect(DOCX_TEMPLATE_PATH).toContain('templates');
  });
});
