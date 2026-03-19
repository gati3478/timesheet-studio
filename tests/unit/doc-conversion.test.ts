import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocConversionError } from '../../src/lib/server/doc-conversion';

vi.mock('node:child_process', () => {
  return {
    execFile: (
      _cmd: string,
      _args: string[],
      cb: (err: Error | null, stdout?: string, stderr?: string) => void
    ) => {
      cb(new Error('spawn soffice ENOENT'));
    }
  };
});

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wraps execFile errors in DocConversionError', async () => {
    const { convertDocxBufferToDoc } = await import('../../src/lib/server/doc-conversion');
    const fakeBuffer = Buffer.from('PK\x03\x04fake-docx-content');

    await expect(convertDocxBufferToDoc(fakeBuffer)).rejects.toThrow(DocConversionError);
    await expect(convertDocxBufferToDoc(fakeBuffer)).rejects.toThrow(
      'DOC conversion failed via LibreOffice: spawn soffice ENOENT'
    );
  });

  it('includes the underlying error message in DocConversionError', async () => {
    const { convertDocxBufferToDoc } = await import('../../src/lib/server/doc-conversion');
    const fakeBuffer = Buffer.from('PK\x03\x04fake-docx-content');

    try {
      await convertDocxBufferToDoc(fakeBuffer);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DocConversionError);
      expect((error as DocConversionError).name).toBe('DocConversionError');
      expect((error as DocConversionError).message).toContain('spawn soffice ENOENT');
    }
  });
});
