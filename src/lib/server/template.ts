import { dev } from '$app/environment';
import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';

const TEMPLATE_FILENAME = 'timesheet_template.docx';

function resolveTemplatePath(): string {
  if (dev) {
    return path.resolve('static', 'templates', TEMPLATE_FILENAME);
  }
  return path.resolve('build', 'client', 'templates', TEMPLATE_FILENAME);
}

export const DOCX_TEMPLATE_PATH = resolveTemplatePath();

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
