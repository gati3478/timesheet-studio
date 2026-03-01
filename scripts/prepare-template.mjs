import { execFile } from 'node:child_process';
import { access, copyFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const rootDir = process.cwd();
const sourceDoc = path.resolve(rootDir, 'timesheet_template.doc');
const outputDir = path.resolve(rootDir, 'static', 'templates');
const outputDocx = path.resolve(outputDir, 'timesheet_template.docx');

async function main() {
  try {
    await access(sourceDoc, fsConstants.R_OK);
  } catch {
    throw new Error(`Source template not found: ${sourceDoc}`);
  }

  await mkdir(outputDir, { recursive: true });
  const workDir = await mkdtemp(path.join(tmpdir(), 'timesheet-template-'));

  try {
    await execFileAsync('soffice', [
      '--headless',
      '--convert-to',
      'docx',
      '--outdir',
      workDir,
      sourceDoc
    ]);

    const convertedDocx = path.join(workDir, 'timesheet_template.docx');

    await access(convertedDocx, fsConstants.R_OK);
    await copyFile(convertedDocx, outputDocx);
    console.log(`Prepared template: ${outputDocx}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Template conversion failed. Ensure LibreOffice (soffice) is installed. ${detail}`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
