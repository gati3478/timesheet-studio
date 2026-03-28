import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/capabilities', () => ({
  isDocExportAvailable: vi.fn()
}));

import '../helpers/mock-kit-json';

describe('GET /api/capabilities', () => {
  let GET: () => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../src/routes/api/capabilities/+server');
    GET = mod.GET as unknown as typeof GET;
  });

  it('returns docExportAvailable: true when soffice is available', async () => {
    const { isDocExportAvailable } = await import('$lib/server/capabilities');
    vi.mocked(isDocExportAvailable).mockResolvedValueOnce(true);

    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.docExportAvailable).toBe(true);
  });

  it('returns docExportAvailable: false when soffice is unavailable', async () => {
    const { isDocExportAvailable } = await import('$lib/server/capabilities');
    vi.mocked(isDocExportAvailable).mockResolvedValueOnce(false);

    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.docExportAvailable).toBe(false);
  });
});
