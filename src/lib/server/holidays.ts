import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import { format } from 'date-fns';
import type { HolidayEntry } from './types';
import staticHolidays from './georgian-holidays.json';

const YELL_HOLIDAY_URL = 'https://www.yell.ge/info/holiday.php?ht=1';
const NAGER_HOLIDAY_URL = 'https://date.nager.at/api/v3/PublicHolidays';
const HOLIDAY_CACHE_TTL_MS = 1000 * 60 * 60 * 6;

const monthStems: Array<[string, number]> = [
  ['იანვ', 1],
  ['თებერვ', 2],
  ['მარტ', 3],
  ['აპრ', 4],
  ['მაის', 5],
  ['მაი', 5],
  ['ივნის', 6],
  ['ივლის', 7],
  ['აგვისტ', 8],
  ['სექტემბ', 9],
  ['ოქტომბ', 10],
  ['ნოემბ', 11],
  ['დეკემბ', 12]
];

const stateOnlyKeywords = [
  'მხოლოდ სახელმწიფო',
  'სახელმწიფო ორგანიზაციის',
  'სახელმწიფო უწყებების',
  'ბიუჯეტური ორგანიზაცი'
];

type CachedHolidays = {
  fetchedAt: number;
  entries: HolidayEntry[];
};

const holidayCache = new Map<number, CachedHolidays>();

function detectCharset(contentType: string | null, htmlHead: string): string {
  if (contentType) {
    const fromHeader = /charset=([^;\s]+)/i.exec(contentType)?.[1]?.trim().toLowerCase();
    if (fromHeader) {
      return fromHeader;
    }
  }

  const fromMeta = /charset\s*=\s*["']?([^"'\s/>]+)/i.exec(htmlHead)?.[1]?.trim().toLowerCase();
  return fromMeta ?? 'utf-8';
}

function decodeHtmlBody(buffer: Buffer, contentType: string | null): string {
  const probe = buffer.toString('latin1', 0, Math.min(buffer.length, 2500));
  const charset = detectCharset(contentType, probe);

  if (charset === 'utf-8' || charset === 'utf8') {
    return buffer.toString('utf8');
  }

  if (iconv.encodingExists(charset)) {
    return iconv.decode(buffer, charset);
  }

  return buffer.toString('utf8');
}

function toIsoDate(year: number, month: number, day: number): string | null {
  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }

  return format(candidate, 'yyyy-MM-dd');
}

function findMonthNumber(monthWord: string): number | null {
  const normalized = monthWord.toLowerCase();
  for (const [stem, month] of monthStems) {
    if (normalized.startsWith(stem)) {
      return month;
    }
  }

  return null;
}

function extractDatesFromText(text: string, fallbackYear: number): string[] {
  const found = new Set<string>();

  const numericRangeRegex = /(?<!\d)(\d{1,2})\s*[-–—]\s*(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?(?!\d)/g;
  for (const match of text.matchAll(numericRangeRegex)) {
    const start = Number(match[1]);
    const end = Number(match[2]);
    const month = Number(match[3]);
    const year = Number(match[4] ?? fallbackYear);

    for (let day = start; day <= end; day += 1) {
      const iso = toIsoDate(year, month, day);
      if (iso) {
        found.add(iso);
      }
    }
  }

  const numericSingleRegex = /(?<!\d)(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?(?!\d)/g;
  for (const match of text.matchAll(numericSingleRegex)) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3] ?? fallbackYear);
    const iso = toIsoDate(year, month, day);
    if (iso) {
      found.add(iso);
    }
  }

  const geRangeRegex = /(?<!\d)(\d{1,2})\s*[-–—]\s*(\d{1,2})\s+([ა-ჰ]+)/giu;
  for (const match of text.matchAll(geRangeRegex)) {
    const start = Number(match[1]);
    const end = Number(match[2]);
    const month = findMonthNumber(match[3]);
    if (!month) {
      continue;
    }

    for (let day = start; day <= end; day += 1) {
      const iso = toIsoDate(fallbackYear, month, day);
      if (iso) {
        found.add(iso);
      }
    }
  }

  const geSingleRegex = /(?<!\d)(\d{1,2})\s+([ა-ჰ]+)/giu;
  for (const match of text.matchAll(geSingleRegex)) {
    const day = Number(match[1]);
    const month = findMonthNumber(match[2]);
    if (!month) {
      continue;
    }

    const iso = toIsoDate(fallbackYear, month, day);
    if (iso) {
      found.add(iso);
    }
  }

  return [...found];
}

type MonthContext = {
  month: number;
  year: number;
};

function extractMonthContext(text: string, fallbackYear: number): MonthContext | null {
  const monthWithYearRegex = /([ა-ჰ]+)\s*,?\s*(\d{4})/giu;

  let withYearMatch: RegExpExecArray | null = monthWithYearRegex.exec(text);
  while (withYearMatch) {
    const month = findMonthNumber(withYearMatch[1]);
    const year = Number(withYearMatch[2]);
    if (month && Number.isInteger(year)) {
      return { month, year };
    }
    withYearMatch = monthWithYearRegex.exec(text);
  }

  const normalized = normalizeText(text).replace(/[.,:;()[\]]/g, '');
  if (!normalized) {
    return null;
  }

  const monthOnlyRegex = /^([ა-ჰ]+)$/iu;
  const monthOnlyMatch = monthOnlyRegex.exec(normalized);
  if (!monthOnlyMatch) {
    return null;
  }

  const month = findMonthNumber(monthOnlyMatch[1]);
  if (!month) {
    return null;
  }

  return { month, year: fallbackYear };
}

function extractDayOnlyDatesFromText(
  text: string,
  fallbackYear: number,
  month: number | null
): string[] {
  if (!month) {
    return [];
  }

  const found = new Set<string>();
  const normalized = normalizeText(text);

  // Matches: "3-4 - ..." while avoiding numeric formats like 03.04.2026.
  const dayRangeRegex = /(?<!\d)(\d{1,2})\s*[-–—]\s*(\d{1,2})(?=\s*(?:[-–—:;,)\]]|$))/g;
  for (const match of normalized.matchAll(dayRangeRegex)) {
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (start > end) {
      continue;
    }

    for (let day = start; day <= end; day += 1) {
      const iso = toIsoDate(fallbackYear, month, day);
      if (iso) {
        found.add(iso);
      }
    }
  }

  // Matches: "3 - ...", "3, ...", "3; ..." while avoiding dotted date formats.
  const daySingleRegex = /(?<!\d)(\d{1,2})(?=\s*(?:[-–—:;,)\]]|$))/g;
  for (const match of normalized.matchAll(daySingleRegex)) {
    const day = Number(match[1]);
    const iso = toIsoDate(fallbackYear, month, day);
    if (iso) {
      found.add(iso);
    }
  }

  return [...found];
}

function isStateOnlyHoliday(text: string): boolean {
  const normalized = text.toLowerCase();
  return stateOnlyKeywords.some((keyword) => normalized.includes(keyword));
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function parseHolidayEntries(html: string, year: number): HolidayEntry[] {
  const $ = cheerio.load(html);
  const rows = $('tr').toArray();
  const lines: string[] = [];

  if (rows.length > 0) {
    for (const row of rows) {
      const text = normalizeText($(row).text());
      if (text.length > 0) {
        lines.push(text);
      }
    }
  } else {
    const bodyText = normalizeText($('body').text());
    lines.push(
      ...bodyText
        .split(/\s{2,}|\n/g)
        .map(normalizeText)
        .filter(Boolean)
    );
  }

  const merged = new Map<string, HolidayEntry>();
  let contextMonth: number | null = null;
  let contextYear = year;

  for (const line of lines) {
    if (!/\d/.test(line)) {
      const monthContext = extractMonthContext(line, contextYear);
      if (monthContext) {
        contextMonth = monthContext.month;
        contextYear = monthContext.year;
      }
      continue;
    }

    const monthContext = extractMonthContext(line, contextYear);
    if (monthContext) {
      contextMonth = monthContext.month;
      contextYear = monthContext.year;
    }

    const stateOnly = isStateOnlyHoliday(line);
    const lineYear = contextYear || year;
    const dates = [
      ...extractDatesFromText(line, lineYear),
      ...extractDayOnlyDatesFromText(line, lineYear, contextMonth)
    ];

    for (const date of dates) {
      if (!date.startsWith(`${year}-`)) {
        continue;
      }

      const existing = merged.get(date);
      if (!existing) {
        merged.set(date, { date, title: line, isStateOnly: stateOnly });
        continue;
      }

      merged.set(date, {
        date,
        title: existing.title,
        isStateOnly: existing.isStateOnly && stateOnly
      });
    }
  }

  return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
}

type NagerHoliday = {
  date?: unknown;
  localName?: unknown;
  name?: unknown;
  countryCode?: unknown;
  counties?: unknown;
  types?: unknown;
};

function parseNagerHolidays(payload: unknown, year: number): HolidayEntry[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  const merged = new Map<string, HolidayEntry>();

  for (const rawEntry of payload) {
    if (!rawEntry || typeof rawEntry !== 'object') {
      continue;
    }

    const entry = rawEntry as NagerHoliday;
    const date = typeof entry.date === 'string' ? entry.date : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !date.startsWith(`${year}-`)) {
      continue;
    }

    const countryCode =
      typeof entry.countryCode === 'string' ? entry.countryCode.toUpperCase() : undefined;
    if (countryCode && countryCode !== 'GE') {
      continue;
    }

    if (Array.isArray(entry.counties) && entry.counties.length > 0) {
      continue;
    }

    if (Array.isArray(entry.types) && entry.types.length > 0) {
      const typeSet = new Set(
        entry.types
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.toLowerCase())
      );
      if (!typeSet.has('public')) {
        continue;
      }
    }

    const localName = typeof entry.localName === 'string' ? normalizeText(entry.localName) : '';
    const englishName = typeof entry.name === 'string' ? normalizeText(entry.name) : '';
    const title = localName || englishName || date;

    const existing = merged.get(date);
    if (!existing) {
      merged.set(date, { date, title, isStateOnly: false });
      continue;
    }

    merged.set(date, {
      date,
      title: existing.title || title,
      isStateOnly: false
    });
  }

  return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function mergeHolidayEntries(...groups: HolidayEntry[][]): HolidayEntry[] {
  const merged = new Map<string, HolidayEntry>();

  for (const group of groups) {
    for (const entry of group) {
      const existing = merged.get(entry.date);
      if (!existing) {
        merged.set(entry.date, { ...entry });
        continue;
      }

      merged.set(entry.date, {
        date: entry.date,
        title: existing.title || entry.title,
        isStateOnly: existing.isStateOnly && entry.isStateOnly
      });
    }
  }

  return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchYellHolidayPage(): Promise<string> {
  const response = await fetch(YELL_HOLIDAY_URL, {
    headers: {
      'User-Agent': 'timesheet-generator/1.0'
    },
    signal: AbortSignal.timeout(10_000)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch yell.ge holiday source (${response.status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return decodeHtmlBody(buffer, response.headers.get('content-type'));
}

async function fetchYellHolidays(year: number): Promise<HolidayEntry[]> {
  const html = await fetchYellHolidayPage();
  return parseHolidayEntries(html, year);
}

async function fetchNagerHolidays(year: number): Promise<HolidayEntry[]> {
  const response = await fetch(`${NAGER_HOLIDAY_URL}/${year}/GE`, {
    headers: {
      'User-Agent': 'timesheet-generator/1.0',
      Accept: 'application/json'
    },
    signal: AbortSignal.timeout(10_000)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch date.nager.at holidays (${response.status}).`);
  }

  const payload = (await response.json()) as unknown;
  return parseNagerHolidays(payload, year);
}

function getStaticHolidaysForYear(year: number): HolidayEntry[] {
  const entries: HolidayEntry[] = [];

  for (const entry of staticHolidays) {
    const date = toIsoDate(year, entry.month, entry.day);
    if (date) {
      entries.push({ date, title: entry.title, isStateOnly: false });
    }
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchMergedHolidays(year: number): Promise<HolidayEntry[]> {
  const results = await Promise.allSettled([fetchNagerHolidays(year), fetchYellHolidays(year)]);

  const nagerEntries = results[0].status === 'fulfilled' ? results[0].value : [];
  const yellEntries = results[1].status === 'fulfilled' ? results[1].value : [];

  const merged = mergeHolidayEntries(nagerEntries, yellEntries);
  if (merged.length > 0) {
    return merged;
  }

  if (results[0].status === 'rejected' && results[1].status === 'rejected') {
    const nagerMsg = results[0].reason instanceof Error ? results[0].reason.message : 'Unknown';
    const yellMsg = results[1].reason instanceof Error ? results[1].reason.message : 'Unknown';
    console.warn(
      `Both holiday providers failed; using static fallback. Nager: ${nagerMsg} Yell: ${yellMsg}`
    );
  } else {
    console.warn('Holiday providers returned no entries; using static fallback.');
  }

  return getStaticHolidaysForYear(year);
}

function getCachedEntries(year: number): HolidayEntry[] | null {
  const cached = holidayCache.get(year);
  if (!cached) {
    return null;
  }

  if (Date.now() - cached.fetchedAt > HOLIDAY_CACHE_TTL_MS) {
    holidayCache.delete(year);
    return null;
  }

  return cached.entries;
}

export async function getHolidaysForYear(
  year: number,
  options: { includeStateOnly?: boolean } = {}
): Promise<HolidayEntry[]> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error('Year must be between 2000 and 2100.');
  }

  let entries = getCachedEntries(year);
  if (!entries) {
    entries = await fetchMergedHolidays(year);
    holidayCache.set(year, {
      fetchedAt: Date.now(),
      entries
    });
  }

  if (options.includeStateOnly) {
    return entries;
  }

  return entries.filter((entry) => !entry.isStateOnly);
}

export function __clearHolidayCacheForTests(): void {
  holidayCache.clear();
}
