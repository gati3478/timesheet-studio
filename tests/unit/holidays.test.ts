import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __clearHolidayCacheForTests, getHolidaysForYear } from '../../src/lib/server/holidays';

const EMPTY_YELL_HTML = '<html><body><table></table></body></html>';

function makeNagerEntry(overrides: Record<string, unknown> = {}) {
  return {
    date: '2026-01-01',
    localName: 'ახალი წელი',
    name: "New Year's Day",
    countryCode: 'GE',
    counties: null,
    types: ['Public'],
    ...overrides
  };
}

type NagerSpec = unknown[] | { status: number } | { throw: string } | { oversized: true };
type YellSpec = string | { status: number } | { throw: string };

function stubHolidayFetch(
  nager: NagerSpec = [],
  yell: YellSpec = EMPTY_YELL_HTML,
  yellCharset = 'utf-8'
) {
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('date.nager.at')) {
      if (typeof nager === 'object' && !Array.isArray(nager) && 'throw' in nager) {
        throw new Error(nager.throw);
      }
      if (typeof nager === 'object' && !Array.isArray(nager) && 'status' in nager) {
        return new Response('nager error', { status: nager.status });
      }
      if (typeof nager === 'object' && !Array.isArray(nager) && 'oversized' in nager) {
        // Return a response body larger than 1MB (MAX_JSON_RESPONSE_BYTES)
        const oversizedBody = 'x'.repeat(1024 * 1024 + 1);
        return new Response(oversizedBody, {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      return new Response(JSON.stringify(nager), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
    if (typeof yell === 'object' && 'status' in yell) {
      return new Response('yell error', { status: yell.status });
    }
    if (typeof yell === 'object' && 'throw' in yell) {
      throw new Error(yell.throw);
    }
    return new Response(Buffer.from(yell, 'utf8'), {
      status: 200,
      headers: { 'content-type': `text/html; charset=${yellCharset}` }
    });
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => {
  vi.restoreAllMocks();
  __clearHolidayCacheForTests();
});

describe('getHolidaysForYear', () => {
  it('uses machine-readable Georgia holidays and ignores non-public/non-national entries', async () => {
    stubHolidayFetch([
      makeNagerEntry({ date: '2026-03-03', localName: 'დედის დღე', name: "Mother's Day" }),
      makeNagerEntry({
        date: '2026-03-08',
        localName: 'ქალთა საერთაშორისო დღე',
        name: "International Women's Day"
      }),
      makeNagerEntry({
        date: '2026-03-12',
        localName: 'Regional only',
        name: 'Regional only',
        counties: ['GE-AB']
      }),
      makeNagerEntry({
        date: '2026-03-13',
        localName: 'Observance',
        name: 'Observance',
        types: ['Observance']
      })
    ]);

    const entries = await getHolidaysForYear(2026, { includeStateOnly: false });
    expect(entries.map((item) => item.date)).toEqual(['2026-03-03', '2026-03-08']);
  });

  it('falls back to yell.ge parsing and excludes state-only holidays', async () => {
    stubHolidayFetch(
      { status: 502 },
      `<html><body><table>
        <tr><td>1 იანვარი - ახალი წელი</td></tr>
        <tr><td>5-6 იანვარი - დასვენება მხოლოდ სახელმწიფო ორგანიზაციისთვის</td></tr>
        <tr><td>7 იანვარი - შობა</td></tr>
      </table></body></html>`
    );

    const all = await getHolidaysForYear(2026, { includeStateOnly: true });
    expect(all.map((item) => item.date)).toEqual([
      '2026-01-01',
      '2026-01-05',
      '2026-01-06',
      '2026-01-07'
    ]);

    const filtered = await getHolidaysForYear(2026, { includeStateOnly: false });
    expect(filtered.map((item) => item.date)).toEqual(['2026-01-01', '2026-01-07']);
    expect(filtered.every((entry) => entry.isStateOnly === false)).toBe(true);
  });

  it('parses month header with day-only rows (e.g. March 3 and 8) in fallback source', async () => {
    stubHolidayFetch(
      { status: 500 },
      `<html><body><table>
        <tr><td>მარტი, 2026</td></tr>
        <tr><td>3 - დედის დღე; (ოფიციალურად უქმე დღე)</td></tr>
        <tr><td>8 - ქალთა საერთაშორისო დღე; (ოფიციალურად უქმე დღე)</td></tr>
      </table></body></html>`
    );

    const entries = await getHolidaysForYear(2026, { includeStateOnly: false });
    expect(entries.map((item) => item.date)).toEqual(['2026-03-03', '2026-03-08']);
  });

  it('rejects year below 2000', async () => {
    await expect(getHolidaysForYear(1999)).rejects.toThrowError(
      'Year must be between 2000 and 2100.'
    );
  });

  it('rejects year above 2100', async () => {
    await expect(getHolidaysForYear(2101)).rejects.toThrowError(
      'Year must be between 2000 and 2100.'
    );
  });

  it('falls back to static holidays when both providers fail', async () => {
    stubHolidayFetch({ status: 500 }, { status: 500 });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const entries = await getHolidaysForYear(2026);
    expect(entries.length).toBe(13);
    expect(entries[0].date).toBe('2026-01-01');
    expect(entries[entries.length - 1].date).toBe('2026-11-23');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('static fallback'));
    warnSpy.mockRestore();
  });

  it('falls back to static holidays when one provider fails and the other returns empty', async () => {
    stubHolidayFetch({ throw: 'Network timeout' });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const entries = await getHolidaysForYear(2026);
    expect(entries.length).toBe(13);
    expect(entries.every((e) => e.date.startsWith('2026-'))).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Holiday providers returned no entries')
    );
    warnSpy.mockRestore();
  });

  it('falls back to static holidays when both providers return empty results', async () => {
    stubHolidayFetch([]);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const entries = await getHolidaysForYear(2026);
    expect(entries.length).toBe(13);
    expect(entries.every((e) => e.date.startsWith('2026-'))).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('static fallback'));
    warnSpy.mockRestore();
  });

  it('caches results and only fetches once for the same year', async () => {
    const fetchMock = stubHolidayFetch([makeNagerEntry()]);

    const first = await getHolidaysForYear(2026);
    const second = await getHolidaysForYear(2026);

    expect(first).toEqual(second);
    // fetch is called once per provider (nager + yell) on first call only
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('merges overlapping dates from both sources with isStateOnly resolved correctly', async () => {
    stubHolidayFetch(
      [makeNagerEntry()],
      `<html><body><table>
        <tr><td>1 იანვარი - ახალი წელი მხოლოდ სახელმწიფო ორგანიზაციისთვის</td></tr>
      </table></body></html>`
    );

    const entries = await getHolidaysForYear(2026, { includeStateOnly: true });
    const jan1 = entries.find((e) => e.date === '2026-01-01');
    expect(jan1).toBeDefined();
    // nager says isStateOnly=false, yell says true → merged result should be false (AND logic)
    expect(jan1!.isStateOnly).toBe(false);
  });

  it('cache TTL expiry triggers re-fetch', async () => {
    vi.useFakeTimers();

    const fetchMock = stubHolidayFetch([makeNagerEntry()]);

    // First call: should fetch from both providers
    await getHolidaysForYear(2026);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Second call within 6h: should use cache (no additional fetches)
    await getHolidaysForYear(2026);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Advance past 6h TTL (6 * 60 * 60 * 1000 = 21_600_000 ms) plus 1ms
    vi.advanceTimersByTime(21_600_001);

    // Third call after TTL expiry: should re-fetch
    await getHolidaysForYear(2026);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    vi.useRealTimers();
  });

  it('yell.ge fallback to body text when no <tr> rows', async () => {
    stubHolidayFetch(
      { status: 500 },
      '<html><body>1 იანვარი 2026  ახალი წელი  7.01 - შობა</body></html>'
    );

    const entries = await getHolidaysForYear(2026);
    const dates = entries.map((e) => e.date);
    expect(dates).toContain('2026-01-01');
    expect(dates).toContain('2026-01-07');
  });

  it('Nager entry with non-object element in array is skipped', async () => {
    stubHolidayFetch([
      null,
      42,
      'string',
      makeNagerEntry({
        date: '2026-05-26',
        localName: 'დამოუკიდებლობის დღე',
        name: 'Independence Day'
      })
    ]);

    const entries = await getHolidaysForYear(2026);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe('2026-05-26');
  });

  it('Nager entry with missing date field is skipped', async () => {
    stubHolidayFetch([
      { localName: 'test' },
      makeNagerEntry({
        date: '2026-05-26',
        localName: 'დამოუკიდებლობის დღე',
        name: 'Independence Day'
      })
    ]);

    const entries = await getHolidaysForYear(2026);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe('2026-05-26');
  });

  it('Nager entry with non-GE countryCode is filtered', async () => {
    stubHolidayFetch([
      makeNagerEntry({
        date: '2026-07-04',
        localName: 'Independence Day',
        name: 'Independence Day',
        countryCode: 'US'
      }),
      makeNagerEntry({
        date: '2026-05-26',
        localName: 'დამოუკიდებლობის დღე',
        name: 'Independence Day'
      })
    ]);

    const entries = await getHolidaysForYear(2026);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe('2026-05-26');
  });

  it('Nager entry with counties array is filtered (regional)', async () => {
    stubHolidayFetch([
      makeNagerEntry({
        date: '2026-06-15',
        localName: 'Regional Holiday',
        name: 'Regional Holiday',
        counties: ['Tbilisi']
      }),
      makeNagerEntry({
        date: '2026-05-26',
        localName: 'დამოუკიდებლობის დღე',
        name: 'Independence Day'
      })
    ]);

    const entries = await getHolidaysForYear(2026);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe('2026-05-26');
  });

  it('Nager duplicate dates within single response are merged', async () => {
    stubHolidayFetch([
      makeNagerEntry(),
      makeNagerEntry({ localName: 'სხვა სახელი', name: 'Other Name' })
    ]);

    const entries = await getHolidaysForYear(2026);
    const jan1Entries = entries.filter((e) => e.date === '2026-01-01');
    expect(jan1Entries).toHaveLength(1);
    expect(jan1Entries[0].title).toBe('ახალი წელი');
  });

  it('getHolidaysForYear with includeStateOnly=true returns all including state-only', async () => {
    stubHolidayFetch(
      { status: 500 },
      `<html><body><table>
        <tr><td>1 იანვარი - ახალი წელი</td></tr>
        <tr><td>2 იანვარი - მხოლოდ სახელმწიფო ორგანიზაციისთვის</td></tr>
      </table></body></html>`
    );

    const withStateOnly = await getHolidaysForYear(2026, { includeStateOnly: true });
    expect(withStateOnly.map((e) => e.date)).toEqual(['2026-01-01', '2026-01-02']);

    __clearHolidayCacheForTests();

    const withoutStateOnly = await getHolidaysForYear(2026, { includeStateOnly: false });
    expect(withoutStateOnly.map((e) => e.date)).toEqual(['2026-01-01']);
  });

  it('charset detection from Content-Type header does not throw', async () => {
    // yell.ge response with windows-1252 charset header but utf-8 content
    stubHolidayFetch([makeNagerEntry()], EMPTY_YELL_HTML, 'windows-1252');

    const entries = await getHolidaysForYear(2026);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe('2026-01-01');
  });

  it('non-standard charset falls back to utf-8', async () => {
    // yell.ge response with a completely unknown charset
    stubHolidayFetch([makeNagerEntry()], EMPTY_YELL_HTML, 'fake-encoding-xyz');

    // Should not throw even with unknown charset
    const entries = await getHolidaysForYear(2026);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe('2026-01-01');
  });

  it('falls back when provider returns oversized response body', async () => {
    // Nager returns oversized response (>1MB), yell also fails
    stubHolidayFetch({ oversized: true }, { status: 500 });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const entries = await getHolidaysForYear(2026);
    // Both providers fail so static fallback is used
    expect(entries.length).toBe(13);
    expect(entries[0].date).toBe('2026-01-01');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('static fallback'));
    warnSpy.mockRestore();
  });

  it('deduplicates concurrent requests for the same year', async () => {
    __clearHolidayCacheForTests();
    const fetchMock = stubHolidayFetch([makeNagerEntry()]);

    // Call twice without awaiting the first — should deduplicate via inFlightFetches
    const [first, second] = await Promise.all([getHolidaysForYear(2026), getHolidaysForYear(2026)]);

    expect(first).toEqual(second);
    // Only 2 fetch calls total (1 nager + 1 yell), not 4
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('getHolidaysForYear fallback cache TTL', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __clearHolidayCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    __clearHolidayCacheForTests();
  });

  it('uses shorter 5-minute TTL when static fallback is cached', async () => {
    // Both providers fail, forcing static fallback with fromFallback=true
    const fetchMock = stubHolidayFetch({ status: 500 }, { status: 500 });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // First call: fetches and caches with fromFallback=true
    const first = await getHolidaysForYear(2026);
    expect(first.length).toBe(13);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Within 5 minutes: should use cache (no additional fetches)
    await getHolidaysForYear(2026);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Advance past 5-minute fallback TTL (5 * 60 * 1000 = 300_000) plus 1ms
    vi.advanceTimersByTime(6 * 60 * 1000);

    // Should re-fetch because fallback cache TTL (5 min) has expired
    await getHolidaysForYear(2026);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    warnSpy.mockRestore();
  });
});
