import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { fillTimesheetTemplate } from '../../src/lib/server/docx';
import type { ComputedTimesheet, DayCode } from '../../src/lib/server/types';
import {
  getCell,
  getCellText,
  hasBold,
  getSize,
  hasShading,
  isCentered
} from '../helpers/docx-assertions';
import { makeComputedTimesheet } from '../helpers/fixtures';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function makeCell(text = '', shaded = false): string {
  const shading = shaded ? '<w:shd w:val="clear" w:fill="C0C0C0" />' : '';
  return `<w:tc><w:tcPr>${shading}</w:tcPr><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
}

function makeRow(
  cellCount: number,
  values: Record<number, { text?: string; shaded?: boolean }> = {}
): string {
  const cells: string[] = [];
  for (let index = 0; index < cellCount; index += 1) {
    const value = values[index];
    cells.push(makeCell(value?.text ?? '', value?.shaded ?? false));
  }
  return `<w:tr>${cells.join('')}</w:tr>`;
}

async function buildTemplateBuffer(): Promise<Buffer> {
  const table0Rows = Array.from({ length: 6 }, (_, row) =>
    makeRow(6, row === 5 ? { 2: { text: 'old' }, 4: { text: 'old' }, 5: { text: 'old' } } : {})
  ).join('');

  const table1Rows = Array.from({ length: 8 }, (_, row) => {
    if (row !== 5) {
      return makeRow(47);
    }

    return makeRow(47, {
      1: { text: 'old-name' },
      2: { text: 'old-id' },
      3: { text: 'X', shaded: true },
      4: { text: 'X', shaded: true },
      5: { text: 'X', shaded: true }
    });
  }).join('');

  const xml = `
    <w:document xmlns:w="${W_NS}">
      <w:body>
        <w:tbl>${table0Rows}</w:tbl>
        <w:tbl>${table1Rows}</w:tbl>
      </w:body>
    </w:document>
  `;

  const zip = new JSZip();
  zip.file('word/document.xml', xml);
  return zip.generateAsync({ type: 'nodebuffer' });
}

function makeTestTimesheet(overrides: Partial<ComputedTimesheet> = {}): ComputedTimesheet {
  const dayCodesByDay = new Map<number, DayCode>();
  for (let day = 1; day <= 31; day += 1) {
    dayCodesByDay.set(day, '');
  }
  dayCodesByDay.set(1, 'X');
  dayCodesByDay.set(2, '8');
  dayCodesByDay.set(3, 'შ');

  return makeComputedTimesheet({
    dayCodesByDay,
    firstHalfHours: 56,
    secondHalfHours: 88,
    workedDays: 18,
    totalWorkedHours: 144,
    paidVacationHours: 8,
    weekdayHolidayCount: 3,
    startDateLabel: '01.01.2026',
    endDateLabel: '31.01.2026',
    lastWorkdayLabel: '30.01',
    ...overrides
  });
}

async function fillAndParse(computed: ComputedTimesheet): Promise<Document> {
  const templateBuffer = await buildTemplateBuffer();
  const output = await fillTimesheetTemplate({
    templateBuffer,
    companyCode: '123456789',
    employeeName: 'ნინო ბერიძე, პროგრამისტი',
    employeeId: '12345678901',
    computed
  });
  const zip = await JSZip.loadAsync(output);
  const xml = await zip.file('word/document.xml')!.async('text');
  return new DOMParser().parseFromString(xml, 'application/xml');
}

describe('fillTimesheetTemplate', () => {
  it('writes dates, row values, totals and day-cell shading', async () => {
    const computed = makeTestTimesheet();
    const documentNode = await fillAndParse(computed);

    expect(getCellText(getCell(documentNode, 0, 5, 2))).toBe('30.01');
    expect(getCellText(getCell(documentNode, 0, 5, 4))).toBe('01.01.2026');
    expect(getCellText(getCell(documentNode, 0, 5, 5))).toBe('31.01.2026');

    expect(getCellText(getCell(documentNode, 1, 5, 1))).toBe('ნინო ბერიძე, პროგრამისტი');
    expect(getCellText(getCell(documentNode, 1, 5, 2))).toBe('12345678901');

    expect(getCellText(getCell(documentNode, 1, 5, 3))).toBe('X');
    expect(getCellText(getCell(documentNode, 1, 5, 4))).toBe('8');
    expect(getCellText(getCell(documentNode, 1, 5, 5))).toBe('შ');
    expect(getCellText(getCell(documentNode, 1, 5, 6))).toBe('');

    expect(hasShading(getCell(documentNode, 1, 5, 3))).toBe(true);
    expect(hasShading(getCell(documentNode, 1, 5, 4))).toBe(false);
    expect(hasShading(getCell(documentNode, 1, 5, 5))).toBe(false);
    expect(hasShading(getCell(documentNode, 1, 6, 3))).toBe(true);
    expect(hasShading(getCell(documentNode, 1, 6, 4))).toBe(false);
    expect(hasShading(getCell(documentNode, 1, 6, 5))).toBe(false);

    expect(hasBold(getCell(documentNode, 1, 5, 3))).toBe(true);
    expect(hasBold(getCell(documentNode, 1, 5, 5))).toBe(true);
    expect(hasBold(getCell(documentNode, 1, 5, 4))).toBe(false);
    expect(getSize(getCell(documentNode, 1, 5, 3))).toBe('18');
    expect(getSize(getCell(documentNode, 1, 5, 4))).toBe('18');
    expect(isCentered(getCell(documentNode, 0, 3, 1))).toBe(false);
    expect(isCentered(getCell(documentNode, 1, 5, 1))).toBe(false);
    expect(isCentered(getCell(documentNode, 1, 5, 2))).toBe(false);
    expect(isCentered(getCell(documentNode, 1, 5, 3))).toBe(true);
    expect(isCentered(getCell(documentNode, 1, 5, 18))).toBe(true);

    expect(getCellText(getCell(documentNode, 1, 5, 18))).toBe('56');
    expect(getCellText(getCell(documentNode, 1, 5, 35))).toBe('88');
    expect(getCellText(getCell(documentNode, 1, 5, 36))).toBe('18');
    expect(getCellText(getCell(documentNode, 1, 5, 37))).toBe('144');
    expect(getCellText(getCell(documentNode, 1, 5, 41))).toBe('144');
    expect(getCellText(getCell(documentNode, 1, 5, 43))).toBe('8');
    expect(getCellText(getCell(documentNode, 1, 5, 46))).toBe('3');
  });

  it('fills an all-vacation month with zero worked hours', async () => {
    const dayCodesByDay = new Map<number, DayCode>();
    for (let day = 1; day <= 31; day += 1) {
      dayCodesByDay.set(day, '');
    }

    // Jan 2026: weekdays get შ, weekends get X
    // Day 1 Thu, 2 Fri, 3 Sat, 4 Sun, 5 Mon...
    for (let day = 1; day <= 31; day += 1) {
      const date = new Date(2026, 0, day);
      const dow = date.getDay();
      if (dow === 0 || dow === 6) {
        dayCodesByDay.set(day, 'X');
      } else {
        dayCodesByDay.set(day, 'შ');
      }
    }

    const computed = makeTestTimesheet({
      dayCodesByDay,
      firstHalfHours: 0,
      secondHalfHours: 0,
      workedDays: 0,
      totalWorkedHours: 0,
      paidVacationHours: 176,
      weekdayHolidayCount: 0
    });

    const documentNode = await fillAndParse(computed);

    expect(getCellText(getCell(documentNode, 1, 5, 36))).toBe('0');
    expect(getCellText(getCell(documentNode, 1, 5, 37))).toBe('0');
    expect(getCellText(getCell(documentNode, 1, 5, 43))).toBe('176');

    // Verify weekday cells have შ code
    expect(getCellText(getCell(documentNode, 1, 5, 3))).toBe('შ');
    expect(getCellText(getCell(documentNode, 1, 5, 4))).toBe('შ');
  });

  it('clears cells for days beyond month length (Feb 28 days)', async () => {
    const dayCodesByDay = new Map<number, DayCode>();
    for (let day = 1; day <= 28; day += 1) {
      dayCodesByDay.set(day, '8');
    }
    // Days 29-31 should be empty
    dayCodesByDay.set(29, '');
    dayCodesByDay.set(30, '');
    dayCodesByDay.set(31, '');

    const computed = makeTestTimesheet({
      dayCodesByDay,
      firstHalfHours: 88,
      secondHalfHours: 80,
      workedDays: 21,
      totalWorkedHours: 168,
      paidVacationHours: 0,
      weekdayHolidayCount: 0,
      startDateLabel: '01.02.2025',
      endDateLabel: '28.02.2025',
      lastWorkdayLabel: '28.02'
    });

    const documentNode = await fillAndParse(computed);

    // Days 29-31 use dayToCellIndex: day + 3 for days 16-31, so indices 32, 33, 34
    expect(getCellText(getCell(documentNode, 1, 5, 32))).toBe('');
    expect(getCellText(getCell(documentNode, 1, 5, 33))).toBe('');
    expect(getCellText(getCell(documentNode, 1, 5, 34))).toBe('');
  });
});
