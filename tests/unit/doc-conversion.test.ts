import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DocConversionError } from '../../src/lib/server/doc-conversion';

const mockExecFile = vi.hoisted(() => vi.fn());
const mockWriteFile = vi.hoisted(() => vi.fn());
const mockReadFile = vi.hoisted(() => vi.fn());
const mockMkdtemp = vi.hoisted(() => vi.fn());
const mockRm = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  execFile: mockExecFile
}));

vi.mock('node:fs/promises', () => ({
  mkdtemp: mockMkdtemp,
  writeFile: mockWriteFile,
  readFile: mockReadFile,
  rm: mockRm
}));

describe('DocConversionError', () => {
  it('is an instance of Error', () => {
    const error = new DocConversionError('conversion failed');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DocConversionError);
  });

  it('has correct name and message', () => {
    const error = new DocConversionError('soffice not found');
    expect(error.name).toBe('DocConversionError');
    expect(error.message).toBe('soffice not found');
  });

  it('has a stack trace', () => {
    const error = new DocConversionError('test');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('DocConversionError');
  });
});

describe('convertDocxBufferToDoc', () => {
  let convertDocxBufferToDoc: typeof import('../../src/lib/server/doc-conversion').convertDocxBufferToDoc;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockMkdtemp.mockResolvedValue('/tmp/timesheet-doc-convert-abc123');
    mockWriteFile.mockResolvedValue(undefined);
    mockRm.mockResolvedValue(undefined);

    const mod = await import('../../src/lib/server/doc-conversion');
    convertDocxBufferToDoc = mod.convertDocxBufferToDoc;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('wraps execFile errors in DocConversionError', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null) => void) => {
        cb(new Error('spawn soffice ENOENT'));
      }
    );

    const fakeBuffer = Buffer.from('PK\x03\x04fake-docx-content');
    await expect(convertDocxBufferToDoc(fakeBuffer)).rejects.toThrow(DocConversionError);
    await expect(convertDocxBufferToDoc(fakeBuffer)).rejects.toThrow(
      'DOC conversion failed via LibreOffice: spawn soffice ENOENT'
    );
  });

  it('returns converted buffer on success', async () => {
    const expectedOutput = Buffer.from('fake-doc-content');

    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null) => void) => {
        cb(null);
      }
    );
    mockReadFile.mockResolvedValue(expectedOutput);

    const fakeBuffer = Buffer.from('PK\x03\x04fake-docx-content');
    const result = await convertDocxBufferToDoc(fakeBuffer);

    expect(result).toEqual(expectedOutput);
    expect(mockWriteFile).toHaveBeenCalledOnce();
    expect(mockExecFile).toHaveBeenCalledOnce();
    expect(mockReadFile).toHaveBeenCalledOnce();
  });

  it('cleans up temp directory on success', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null) => void) => {
        cb(null);
      }
    );
    mockReadFile.mockResolvedValue(Buffer.from('output'));

    await convertDocxBufferToDoc(Buffer.from('PK\x03\x04input'));

    expect(mockRm).toHaveBeenCalledWith('/tmp/timesheet-doc-convert-abc123', {
      recursive: true,
      force: true
    });
  });

  it('cleans up temp directory on failure', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null) => void) => {
        cb(new Error('conversion failed'));
      }
    );

    await expect(convertDocxBufferToDoc(Buffer.from('PK\x03\x04input'))).rejects.toThrow();

    expect(mockRm).toHaveBeenCalledWith('/tmp/timesheet-doc-convert-abc123', {
      recursive: true,
      force: true
    });
  });

  it('wraps non-Error exceptions with "Unknown conversion failure"', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null) => void) => {
        cb(null);
      }
    );
    // writeFile succeeds, execFile succeeds, but readFile throws a non-Error value
    mockWriteFile.mockRejectedValueOnce('disk error string');

    const fakeBuffer = Buffer.from('PK\x03\x04fake-docx-content');
    await expect(convertDocxBufferToDoc(fakeBuffer)).rejects.toThrow(DocConversionError);
    // Reset for second call
    mockWriteFile.mockRejectedValueOnce('disk error string');
    await expect(convertDocxBufferToDoc(fakeBuffer)).rejects.toThrow(
      'DOC conversion failed via LibreOffice: Unknown conversion failure'
    );
  });

  it('calls soffice with correct arguments', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null) => void) => {
        cb(null);
      }
    );
    mockReadFile.mockResolvedValue(Buffer.from('output'));

    await convertDocxBufferToDoc(Buffer.from('PK\x03\x04input'));

    expect(mockExecFile).toHaveBeenCalledWith(
      'soffice',
      [
        '--headless',
        '--convert-to',
        'doc',
        '--outdir',
        '/tmp/timesheet-doc-convert-abc123',
        '/tmp/timesheet-doc-convert-abc123/generated-timesheet.docx'
      ],
      { timeout: 30_000 },
      expect.any(Function)
    );
  });
});
