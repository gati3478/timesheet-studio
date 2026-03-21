import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

let cachedDocExport: boolean | null = null;

export async function isDocExportAvailable(): Promise<boolean> {
  if (cachedDocExport !== null) {
    return cachedDocExport;
  }

  try {
    await execFileAsync('soffice', ['--version'], {
      timeout: 5000
    });
    cachedDocExport = true;
  } catch {
    cachedDocExport = false;
  }

  return cachedDocExport;
}

export function __resetDocExportCacheForTests(): void {
  cachedDocExport = null;
}
