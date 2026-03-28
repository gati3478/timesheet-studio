import { dev } from '$app/environment';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const TEMPLATE_FILENAME = 'timesheet_template.docx';

function resolveTemplatePath(): string {
  const envDir = process.env.TEMPLATE_DIR;
  if (envDir) {
    const resolved = path.resolve(envDir, TEMPLATE_FILENAME);
    if (!resolved.endsWith(path.sep + TEMPLATE_FILENAME) && !resolved.endsWith(TEMPLATE_FILENAME)) {
      throw new Error('TEMPLATE_DIR resolved to an unexpected path.');
    }
    return resolved;
  }
  if (dev) {
    return path.resolve('static', 'templates', TEMPLATE_FILENAME);
  }
  return path.resolve('build', 'client', 'templates', TEMPLATE_FILENAME);
}

export const DOCX_TEMPLATE_PATH = resolveTemplatePath();

let cachedTemplate: Buffer | null = null;

export async function loadTemplateBuffer(): Promise<Buffer> {
  if (cachedTemplate) {
    return cachedTemplate;
  }

  try {
    cachedTemplate = await readFile(DOCX_TEMPLATE_PATH);
    return cachedTemplate;
  } catch {
    throw new Error(
      'Template DOCX is missing. Run `npm run prepare:template` to convert timesheet_template.doc.'
    );
  }
}
