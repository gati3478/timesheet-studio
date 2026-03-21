import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';

export const DOCX_TEMPLATE_PATH = path.resolve(
  process.cwd(),
  'static',
  'templates',
  'timesheet_template.docx'
);

export async function assertTemplateExists(): Promise<void> {
  try {
    await access(DOCX_TEMPLATE_PATH, fsConstants.R_OK);
  } catch {
    throw new Error(
      'Template DOCX is missing. Run `npm run prepare:template` to convert timesheet_template.doc.'
    );
  }
}

export async function loadTemplateBuffer(): Promise<Buffer> {
  await assertTemplateExists();
  return readFile(DOCX_TEMPLATE_PATH);
}
