import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/holidays', () => ({
  getHolidaysForYear: vi
    .fn()
    .mockResolvedValue([{ date: '2026-01-01', title: "New Year's Day", isStateOnly: false }])
}));

vi.mock('@sveltejs/kit', () => ({
  json: (data: unknown, init?: ResponseInit) => {
    return new Response(JSON.stringify(data), {
      status: init?.status ?? 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}));

describe('GET /api/holidays', () => {
  let GET: (args: { url: URL }) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../src/routes/api/holidays/+server');
    GET = mod.GET as unknown as typeof GET;
  });

  it('returns 200 with year and entries for valid year', async () => {
    const url = new URL('http://localhost/api/holidays?year=2026');
    const response = await GET({ url });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.year).toBe(2026);
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].date).toBe('2026-01-01');
  });

  it('returns 400 for non-integer year param', async () => {
    const url = new URL('http://localhost/api/holidays?year=abc');
    const response = await GET({ url });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toBe('Query param `year` must be an integer.');
  });

  it('returns 400 for year below 2000', async () => {
    const url = new URL('http://localhost/api/holidays?year=1999');
    const response = await GET({ url });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toBe('Year must be between 2000 and 2100.');
  });

  it('returns 400 for year above 2100', async () => {
    const url = new URL('http://localhost/api/holidays?year=2101');
    const response = await GET({ url });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toBe('Year must be between 2000 and 2100.');
  });

  it('defaults to current year when no year param', async () => {
    const url = new URL('http://localhost/api/holidays');
    const response = await GET({ url });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.year).toBe(new Date().getFullYear());
  });

  it('returns 502 when getHolidaysForYear throws Error', async () => {
    const { getHolidaysForYear } = await import('$lib/server/holidays');
    vi.mocked(getHolidaysForYear).mockRejectedValueOnce(new Error('Network timeout'));

    const url = new URL('http://localhost/api/holidays?year=2026');
    const response = await GET({ url });

    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data.message).toBe('Failed to load holiday data.');
  });

  it('returns 502 with generic message for non-Error throws', async () => {
    const { getHolidaysForYear } = await import('$lib/server/holidays');
    vi.mocked(getHolidaysForYear).mockRejectedValueOnce('some string error');

    const url = new URL('http://localhost/api/holidays?year=2026');
    const response = await GET({ url });

    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data.message).toBe('Failed to load holiday data.');
  });
});
