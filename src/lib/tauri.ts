import type { OutputFormat } from './constants';
import { getStorage } from './storage';

/** Detect whether the app is running inside a Tauri webview. */
export function isTauriApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

const LAST_SAVE_DIR_KEY = 'timesheet.lastSaveDir';

/**
 * Show a native Save As dialog and write the file to the chosen path.
 * Remembers the last-used directory for subsequent saves.
 * Resolves silently if the user cancels the dialog.
 */
export async function saveFileWithDialog(
  blob: Blob,
  suggestedFilename: string,
  extension: OutputFormat
): Promise<void> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeFile } = await import('@tauri-apps/plugin-fs');

  const lastDir = await getStorage().getItem(LAST_SAVE_DIR_KEY);
  const defaultPath = lastDir ? `${lastDir}/${suggestedFilename}` : suggestedFilename;

  const filters = [
    extension === 'docx'
      ? { name: 'Word Document (.docx)', extensions: ['docx'] }
      : { name: 'Word 97-2003 Document (.doc)', extensions: ['doc'] }
  ];

  const chosenPath = await save({
    title: 'Save Timesheet',
    defaultPath,
    filters
  });

  if (!chosenPath) return;

  const data = new Uint8Array(await blob.arrayBuffer());
  await writeFile(chosenPath, data);

  const lastSlash = Math.max(chosenPath.lastIndexOf('/'), chosenPath.lastIndexOf('\\'));
  if (lastSlash > 0) {
    await getStorage().setItem(LAST_SAVE_DIR_KEY, chosenPath.substring(0, lastSlash));
  }
}
