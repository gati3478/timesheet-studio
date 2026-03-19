import { describe, expect, it } from 'vitest';
import { DocConversionError } from '../../src/lib/server/doc-conversion';

describe('DocConversionError', () => {
  it('has correct name and is an Error instance', () => {
    const error = new DocConversionError('conversion failed');
    expect(error.name).toBe('DocConversionError');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('conversion failed');
  });
});
