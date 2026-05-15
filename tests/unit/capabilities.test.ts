import { afterEach, describe, expect, it, vi } from 'vitest';

const mockExecFile = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  execFile: mockExecFile
}));

vi.mock('node:util', () => ({
  promisify: () => mockExecFile
}));

describe('isDocExportAvailable', () => {
  afterEach(async () => {
    mockExecFile.mockReset();
    vi.restoreAllMocks();
    const { __resetDocExportCacheForTests } = await import('../../src/lib/server/capabilities');
    __resetDocExportCacheForTests();
  });

  it('returns true when soffice succeeds', async () => {
    mockExecFile.mockResolvedValueOnce({ stdout: 'LibreOffice 7.6', stderr: '' });

    const { isDocExportAvailable } = await import('../../src/lib/server/capabilities');
    const result = await isDocExportAvailable();
    expect(result).toBe(true);
    expect(mockExecFile).toHaveBeenCalledWith('soffice', ['--version'], { timeout: 5000 });
  });

  it('returns false when soffice is not found (ENOENT)', async () => {
    const error = new Error('spawn soffice ENOENT');
    (error as NodeJS.ErrnoException).code = 'ENOENT';
    mockExecFile.mockRejectedValueOnce(error);

    const { isDocExportAvailable } = await import('../../src/lib/server/capabilities');
    const result = await isDocExportAvailable();
    expect(result).toBe(false);
  });

  it('returns false when soffice times out', async () => {
    mockExecFile.mockRejectedValueOnce(new Error('Command timed out'));

    const { isDocExportAvailable } = await import('../../src/lib/server/capabilities');
    const result = await isDocExportAvailable();
    expect(result).toBe(false);
  });

  it('caches the result after first call', async () => {
    mockExecFile.mockResolvedValue({ stdout: 'LibreOffice 7.6', stderr: '' });

    const { isDocExportAvailable } = await import('../../src/lib/server/capabilities');
    await isDocExportAvailable();
    await isDocExportAvailable();
    expect(mockExecFile).toHaveBeenCalledTimes(1);
  });

  it('resets cache with __resetDocExportCacheForTests', async () => {
    mockExecFile.mockResolvedValue({ stdout: 'LibreOffice 7.6', stderr: '' });

    const { isDocExportAvailable, __resetDocExportCacheForTests } =
      await import('../../src/lib/server/capabilities');
    await isDocExportAvailable();
    __resetDocExportCacheForTests();
    await isDocExportAvailable();
    expect(mockExecFile).toHaveBeenCalledTimes(2);
  });
});
