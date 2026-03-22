import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/capabilities', () => ({
  isDocExportAvailable: vi.fn()
}));

describe('+page.server.ts load', () => {
  let load: (event: unknown) => Promise<{ docExportAvailable: boolean }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../src/routes/+page.server');
    load = mod.load as unknown as typeof load;
  });

  it('returns docExportAvailable: true when soffice is available', async () => {
    const { isDocExportAvailable } = await import('$lib/server/capabilities');
    vi.mocked(isDocExportAvailable).mockResolvedValueOnce(true);

    const result = await load({});
    expect(result).toEqual({ docExportAvailable: true });
  });

  it('returns docExportAvailable: false when soffice is unavailable', async () => {
    const { isDocExportAvailable } = await import('$lib/server/capabilities');
    vi.mocked(isDocExportAvailable).mockResolvedValueOnce(false);

    const result = await load({});
    expect(result).toEqual({ docExportAvailable: false });
  });

  it('calls isDocExportAvailable exactly once per load', async () => {
    const { isDocExportAvailable } = await import('$lib/server/capabilities');
    vi.mocked(isDocExportAvailable).mockResolvedValueOnce(true);

    await load({});
    expect(isDocExportAvailable).toHaveBeenCalledTimes(1);
  });
});
