import { afterEach, describe, expect, it, vi } from 'vitest';
import { __clearHolidayCacheForTests, getHolidaysForYear } from '../../src/lib/server/holidays';

afterEach(() => {
  vi.restoreAllMocks();
  __clearHolidayCacheForTests();
});

describe('getHolidaysForYear', () => {
  it('uses machine-readable Georgia holidays and ignores non-public/non-national entries', async () => {
    const nagerPayload = [
      {
        date: '2026-03-03',
        localName: 'დედის დღე',
        name: "Mother's Day",
        countryCode: 'GE',
        counties: null,
        types: ['Public']
      },
      {
        date: '2026-03-08',
        localName: 'ქალთა საერთაშორისო დღე',
        name: "International Women's Day",
        countryCode: 'GE',
        counties: null,
        types: ['Public']
      },
      {
        date: '2026-03-12',
        localName: 'Regional only',
        name: 'Regional only',
        countryCode: 'GE',
        counties: ['GE-AB'],
        types: ['Public']
      },
      {
        date: '2026-03-13',
        localName: 'Observance',
        name: 'Observance',
        countryCode: 'GE',
        counties: null,
        types: ['Observance']
      }
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('date.nager.at')) {
          return new Response(JSON.stringify(nagerPayload), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          });
        }

        return new Response('<html><body><table></table></body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' }
        });
      })
    );

    const entries = await getHolidaysForYear(2026, { includeStateOnly: false });
    expect(entries.map((item) => item.date)).toEqual(['2026-03-03', '2026-03-08']);
  });

  it('falls back to yell.ge parsing and excludes state-only holidays', async () => {
    const html = `
      <html>
        <body>
          <table>
            <tr><td>1 იანვარი - ახალი წელი</td></tr>
            <tr><td>5-6 იანვარი - დასვენება მხოლოდ სახელმწიფო ორგანიზაციისთვის</td></tr>
            <tr><td>7 იანვარი - შობა</td></tr>
          </table>
        </body>
      </html>
    `;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('date.nager.at')) {
          return new Response('upstream-failure', { status: 502 });
        }

        return new Response(Buffer.from(html, 'utf8'), {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' }
        });
      })
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
    const html = `
      <html>
        <body>
          <table>
            <tr><td>მარტი, 2026</td></tr>
            <tr><td>3 - დედის დღე; (ოფიციალურად უქმე დღე)</td></tr>
            <tr><td>8 - ქალთა საერთაშორისო დღე; (ოფიციალურად უქმე დღე)</td></tr>
          </table>
        </body>
      </html>
    `;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('date.nager.at')) {
          return new Response('upstream-failure', { status: 500 });
        }

        return new Response(Buffer.from(html, 'utf8'), {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' }
        });
      })
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

  it('throws when both providers fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('date.nager.at')) {
          return new Response('nager down', { status: 500 });
        }
        return new Response('yell down', { status: 500 });
      })
    );

    await expect(getHolidaysForYear(2026)).rejects.toThrowError(
      /date\.nager\.at.*yell\.ge|yell\.ge.*date\.nager\.at/
    );
  });

  it('throws when both providers return empty results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('date.nager.at')) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          });
        }
        return new Response('<html><body><table></table></body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' }
        });
      })
    );

    await expect(getHolidaysForYear(2026)).rejects.toThrowError(/no entries/i);
  });

  it('caches results and only fetches once for the same year', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('date.nager.at')) {
        return new Response(
          JSON.stringify([
            {
              date: '2026-01-01',
              localName: 'ახალი წელი',
              name: "New Year's Day",
              countryCode: 'GE',
              counties: null,
              types: ['Public']
            }
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response('<html><body><table></table></body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const first = await getHolidaysForYear(2026);
    const second = await getHolidaysForYear(2026);

    expect(first).toEqual(second);
    // fetch is called once per provider (nager + yell) on first call only
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('merges overlapping dates from both sources with isStateOnly resolved correctly', async () => {
    const nagerPayload = [
      {
        date: '2026-01-01',
        localName: 'ახალი წელი',
        name: "New Year's Day",
        countryCode: 'GE',
        counties: null,
        types: ['Public']
      }
    ];

    const html = `
      <html>
        <body>
          <table>
            <tr><td>1 იანვარი - ახალი წელი მხოლოდ სახელმწიფო ორგანიზაციისთვის</td></tr>
          </table>
        </body>
      </html>
    `;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('date.nager.at')) {
          return new Response(JSON.stringify(nagerPayload), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          });
        }
        return new Response(Buffer.from(html, 'utf8'), {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' }
        });
      })
    );

    const entries = await getHolidaysForYear(2026, { includeStateOnly: true });
    const jan1 = entries.find((e) => e.date === '2026-01-01');
    expect(jan1).toBeDefined();
    // nager says isStateOnly=false, yell says true → merged result should be false (AND logic)
    expect(jan1!.isStateOnly).toBe(false);
  });

  it('cache TTL expiry triggers re-fetch', async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('date.nager.at')) {
        return new Response(
          JSON.stringify([
            {
              date: '2026-01-01',
              localName: 'ახალი წელი',
              name: "New Year's Day",
              countryCode: 'GE',
              counties: null,
              types: ['Public']
            }
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response('<html><body><table></table></body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      });
    });

    vi.stubGlobal('fetch', fetchMock);

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
    const html = '<html><body>1 იანვარი 2026  ახალი წელი  7.01 - შობა</body></html>';

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('date.nager.at')) {
          return new Response('nager down', { status: 500 });
        }
        return new Response(Buffer.from(html, 'utf8'), {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' }
        });
      })
    );

    const entries = await getHolidaysForYear(2026);
    const dates = entries.map((e) => e.date);
    expect(dates).toContain('2026-01-01');
    expect(dates).toContain('2026-01-07');
  });

  it('Nager entry with non-object element in array is skipped', async () => {
    const nagerPayload = [
      null,
      42,
      'string',
      {
        date: '2026-05-26',
        localName: 'დამოუკიდებლობის დღე',
        name: 'Independence Day',
        countryCode: 'GE',
        counties: null,
        types: ['Public']
      }
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('date.nager.at')) {
          return new Response(JSON.stringify(nagerPayload), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          });
        }
        return new Response('<html><body><table></table></body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' }
        });
      })
    );

    const entries = await getHolidaysForYear(2026);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe('2026-05-26');
  });

  it('Nager entry with missing date field is skipped', async () => {
    const nagerPayload = [
      { localName: 'test' },
      {
        date: '2026-05-26',
        localName: 'დამოუკიდებლობის დღე',
        name: 'Independence Day',
        countryCode: 'GE',
        counties: null,
        types: ['Public']
      }
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('date.nager.at')) {
          return new Response(JSON.stringify(nagerPayload), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          });
        }
        return new Response('<html><body><table></table></body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' }
        });
      })
    );

    const entries = await getHolidaysForYear(2026);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe('2026-05-26');
  });

  it('Nager entry with non-GE countryCode is filtered', async () => {
    const nagerPayload = [
      {
        date: '2026-07-04',
        localName: 'Independence Day',
        name: 'Independence Day',
        countryCode: 'US',
        counties: null,
        types: ['Public']
      },
      {
        date: '2026-05-26',
        localName: 'დამოუკიდებლობის დღე',
        name: 'Independence Day',
        countryCode: 'GE',
        counties: null,
        types: ['Public']
      }
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('date.nager.at')) {
          return new Response(JSON.stringify(nagerPayload), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          });
        }
        return new Response('<html><body><table></table></body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' }
        });
      })
    );

    const entries = await getHolidaysForYear(2026);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe('2026-05-26');
  });

  it('Nager entry with counties array is filtered (regional)', async () => {
    const nagerPayload = [
      {
        date: '2026-06-15',
        localName: 'Regional Holiday',
        name: 'Regional Holiday',
        countryCode: 'GE',
        counties: ['Tbilisi'],
        types: ['Public']
      },
      {
        date: '2026-05-26',
        localName: 'დამოუკიდებლობის დღე',
        name: 'Independence Day',
        countryCode: 'GE',
        counties: null,
        types: ['Public']
      }
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('date.nager.at')) {
          return new Response(JSON.stringify(nagerPayload), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          });
        }
        return new Response('<html><body><table></table></body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' }
        });
      })
    );

    const entries = await getHolidaysForYear(2026);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe('2026-05-26');
  });

  it('Nager duplicate dates within single response are merged', async () => {
    const nagerPayload = [
      {
        date: '2026-01-01',
        localName: 'ახალი წელი',
        name: "New Year's Day",
        countryCode: 'GE',
        counties: null,
        types: ['Public']
      },
      {
        date: '2026-01-01',
        localName: 'სხვა სახელი',
        name: 'Other Name',
        countryCode: 'GE',
        counties: null,
        types: ['Public']
      }
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('date.nager.at')) {
          return new Response(JSON.stringify(nagerPayload), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          });
        }
        return new Response('<html><body><table></table></body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' }
        });
      })
    );

    const entries = await getHolidaysForYear(2026);
    const jan1Entries = entries.filter((e) => e.date === '2026-01-01');
    expect(jan1Entries).toHaveLength(1);
    expect(jan1Entries[0].title).toBe('ახალი წელი');
  });

  it('getHolidaysForYear with includeStateOnly=true returns all including state-only', async () => {
    const html = `
      <html>
        <body>
          <table>
            <tr><td>1 იანვარი - ახალი წელი</td></tr>
            <tr><td>2 იანვარი - მხოლოდ სახელმწიფო ორგანიზაციისთვის</td></tr>
          </table>
        </body>
      </html>
    `;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('date.nager.at')) {
          return new Response('nager down', { status: 500 });
        }
        return new Response(Buffer.from(html, 'utf8'), {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' }
        });
      })
    );

    const withStateOnly = await getHolidaysForYear(2026, { includeStateOnly: true });
    expect(withStateOnly.map((e) => e.date)).toEqual(['2026-01-01', '2026-01-02']);

    __clearHolidayCacheForTests();

    const withoutStateOnly = await getHolidaysForYear(2026, { includeStateOnly: false });
    expect(withoutStateOnly.map((e) => e.date)).toEqual(['2026-01-01']);
  });

  it('charset detection from Content-Type header does not throw', async () => {
    const nagerPayload = [
      {
        date: '2026-01-01',
        localName: 'ახალი წელი',
        name: "New Year's Day",
        countryCode: 'GE',
        counties: null,
        types: ['Public']
      }
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('date.nager.at')) {
          return new Response(JSON.stringify(nagerPayload), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          });
        }
        // yell.ge response with windows-1252 charset header but utf-8 content
        return new Response(Buffer.from('<html><body><table></table></body></html>', 'utf8'), {
          status: 200,
          headers: { 'content-type': 'text/html; charset=windows-1252' }
        });
      })
    );

    const entries = await getHolidaysForYear(2026);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe('2026-01-01');
  });

  it('non-standard charset falls back to utf-8', async () => {
    const nagerPayload = [
      {
        date: '2026-01-01',
        localName: 'ახალი წელი',
        name: "New Year's Day",
        countryCode: 'GE',
        counties: null,
        types: ['Public']
      }
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('date.nager.at')) {
          return new Response(JSON.stringify(nagerPayload), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          });
        }
        // yell.ge response with a completely unknown charset
        return new Response(Buffer.from('<html><body><table></table></body></html>', 'utf8'), {
          status: 200,
          headers: { 'content-type': 'text/html; charset=fake-encoding-xyz' }
        });
      })
    );

    // Should not throw even with unknown charset
    const entries = await getHolidaysForYear(2026);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe('2026-01-01');
  });
});
