import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import { MIN_YEAR, MAX_YEAR } from '../constants';
import type { HolidayEntry } from './types';
import staticHolidays from './georgian-holidays.json';

const YELL_HOLIDAY_URL = 'https://www.yell.ge/info/holiday.php?ht=1';
const NAGER_HOLIDAY_URL = 'https://date.nager.at/api/v3/PublicHolidays';
const HOLIDAY_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const FALLBACK_CACHE_TTL_MS = 1000 * 60 * 5;
const MAX_HTML_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_JSON_RESPONSE_BYTES = 1 * 1024 * 1024;
const MIN_EXPECTED_HOLIDAYS = 5;
const MAX_CACHE_ENTRIES = 10;

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
  fromFallback: boolean;
};

const holidayCache = new Map<number, CachedHolidays>();

async function readResponseBytes(response: Response, maxBytes: number): Promise<ArrayBuffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    const buf = await response.arrayBuffer();
    if (buf.byteLength > maxBytes) throw new Error('Holiday provider response exceeds size limit.');
    return buf;
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new Error('Holiday provider response exceeds size limit.');
    }
    chunks.push(value);
  }

  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
}

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

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
    if (month < 1 || month > 12) continue;
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
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    const year = Number(match[3] ?? fallbackYear);
    const iso = toIsoDate(year, month, day);
    if (iso) {
      found.add(iso);
    }
  }

  const geRangeRegex = /(?<!\d)(\d{1,2})\s*[-–—]\s*(\d{1,2})\s+([ა-ჰ]+)/gu;
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

  const geSingleRegex = /(?<!\d)(\d{1,2})\s+([ა-ჰ]+)/gu;
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
  const monthWithYearRegex = /([ა-ჰ]+)\s*,?\s*(\d{4})/gu;

  for (const withYearMatch of text.matchAll(monthWithYearRegex)) {
    const month = findMonthNumber(withYearMatch[1]);
    const year = Number(withYearMatch[2]);
    if (month && Number.isInteger(year)) {
      return { month, year };
    }
  }

  const normalized = normalizeText(text).replace(/[.,:;()[\]]/g, '');
  if (!normalized) {
    return null;
  }

  const monthOnlyRegex = /^([ა-ჰ]+)$/u;
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

function mergeEntryIntoMap(map: Map<string, HolidayEntry>, entry: HolidayEntry): void {
  const existing = map.get(entry.date);
  if (!existing) {
    map.set(entry.date, { ...entry });
    return;
  }

  map.set(entry.date, {
    date: entry.date,
    title: existing.title || entry.title,
    isStateOnly: existing.isStateOnly && entry.isStateOnly
  });
}

function sortedMapValues(map: Map<string, HolidayEntry>): HolidayEntry[] {
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
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
    const monthContext = extractMonthContext(line, contextYear);
    if (monthContext) {
      contextMonth = monthContext.month;
      contextYear = monthContext.year;
    }

    if (!/\d/.test(line)) continue;

    const stateOnly = isStateOnlyHoliday(line);
    const dates = [
      ...extractDatesFromText(line, contextYear),
      ...extractDayOnlyDatesFromText(line, contextYear, contextMonth)
    ];

    for (const date of dates) {
      if (!date.startsWith(`${year}-`)) {
        continue;
      }

      mergeEntryIntoMap(merged, { date, title: line, isStateOnly: stateOnly });
    }
  }

  return sortedMapValues(merged);
}

function parseNagerHolidays(payload: unknown, year: number): HolidayEntry[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  const merged = new Map<string, HolidayEntry>();

  for (const rawEntry of payload) {
    if (!rawEntry || typeof rawEntry !== 'object') {
      continue;
    }

    const entry = rawEntry as Record<string, unknown>;
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

    mergeEntryIntoMap(merged, { date, title, isStateOnly: false });
  }

  return sortedMapValues(merged);
}

function mergeHolidayEntries(...groups: HolidayEntry[][]): HolidayEntry[] {
  const merged = new Map<string, HolidayEntry>();

  for (const group of groups) {
    for (const entry of group) {
      mergeEntryIntoMap(merged, entry);
    }
  }

  return sortedMapValues(merged);
}

async function fetchYellHolidayPage(): Promise<string> {
  const response = await fetch(YELL_HOLIDAY_URL, {
    headers: {
      'User-Agent': 'timesheet-generator/1.0'
    },
    signal: AbortSignal.timeout(10_000),
    redirect: 'error'
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch yell.ge holiday source (${response.status}).`);
  }

  const arrayBuffer = await readResponseBytes(response, MAX_HTML_RESPONSE_BYTES);
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
    signal: AbortSignal.timeout(10_000),
    redirect: 'error'
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch date.nager.at holidays (${response.status}).`);
  }

  const arrayBuffer = await readResponseBytes(response, MAX_JSON_RESPONSE_BYTES);
  const payload = JSON.parse(new TextDecoder().decode(arrayBuffer)) as unknown;
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

type FetchResult = { entries: HolidayEntry[]; fromFallback: boolean };

async function fetchMergedHolidays(year: number): Promise<FetchResult> {
  const results = await Promise.allSettled([fetchNagerHolidays(year), fetchYellHolidays(year)]);

  const nagerEntries = results[0].status === 'fulfilled' ? results[0].value : [];
  const yellEntries = results[1].status === 'fulfilled' ? results[1].value : [];

  const merged = mergeHolidayEntries(nagerEntries, yellEntries);
  const anyProviderFailed = results.some((r) => r.status === 'rejected');

  if (merged.length > 0) {
    if (anyProviderFailed && merged.length < MIN_EXPECTED_HOLIDAYS) {
      console.warn(
        `Holiday result (${merged.length} entries) may be incomplete — a provider failed and count is below expected (${MIN_EXPECTED_HOLIDAYS}).`
      );
    }
    return { entries: merged, fromFallback: false };
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

  return { entries: getStaticHolidaysForYear(year), fromFallback: true };
}

function getCachedEntries(year: number): HolidayEntry[] | null {
  const cached = holidayCache.get(year);
  if (!cached) {
    return null;
  }

  const ttl = cached.fromFallback ? FALLBACK_CACHE_TTL_MS : HOLIDAY_CACHE_TTL_MS;
  if (Date.now() - cached.fetchedAt > ttl) {
    holidayCache.delete(year);
    return null;
  }

  return cached.entries;
}

const inFlightFetches = new Map<number, Promise<HolidayEntry[]>>();

export async function getHolidaysForYear(
  year: number,
  options: { includeStateOnly?: boolean } = {}
): Promise<HolidayEntry[]> {
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new Error(`Year must be between ${MIN_YEAR} and ${MAX_YEAR}.`);
  }

  let entries = getCachedEntries(year);
  if (!entries) {
    let promise = inFlightFetches.get(year);
    if (!promise) {
      promise = fetchMergedHolidays(year)
        .then((result) => {
          if (holidayCache.size >= MAX_CACHE_ENTRIES) {
            const oldestKey = holidayCache.keys().next().value;
            if (oldestKey !== undefined) holidayCache.delete(oldestKey);
          }
          holidayCache.set(year, {
            fetchedAt: Date.now(),
            entries: result.entries,
            fromFallback: result.fromFallback
          });
          return result.entries;
        })
        .finally(() => inFlightFetches.delete(year));
      inFlightFetches.set(year, promise);
    }
    entries = await promise;
  }

  if (options.includeStateOnly) {
    return entries;
  }

  return entries.filter((entry) => !entry.isStateOnly);
}

export function __clearHolidayCacheForTests(): void {
  holidayCache.clear();
  inFlightFetches.clear();
}
