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
});
