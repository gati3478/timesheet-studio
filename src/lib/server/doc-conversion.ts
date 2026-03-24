import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class DocConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocConversionError';
  }
}

export async function convertDocxBufferToDoc(docxBuffer: Buffer): Promise<Buffer> {
  const workDir = await mkdtemp(path.join(tmpdir(), 'timesheet-doc-convert-'));
  const inputFile = path.join(workDir, 'generated-timesheet.docx');
  const outputFile = path.join(workDir, 'generated-timesheet.doc');

  try {
    await writeFile(inputFile, docxBuffer);

    await execFileAsync(
      'soffice',
      ['--headless', '--convert-to', 'doc', '--outdir', workDir, inputFile],
      { timeout: 30_000 }
    );

    return await readFile(outputFile);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown conversion failure';
    throw new DocConversionError(`DOC conversion failed via LibreOffice: ${detail}`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
