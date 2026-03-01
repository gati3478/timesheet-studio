import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';
import { fillTimesheetTemplate } from '../../src/lib/server/docx';
import type { ComputedTimesheet, DayCode } from '../../src/lib/server/types';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function makeCell(text = '', shaded = false): string {
  const shading = shaded ? '<w:shd w:val="clear" w:fill="C0C0C0" />' : '';
  return `<w:tc><w:tcPr>${shading}</w:tcPr><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
}

function makeRow(cellCount: number, values: Record<number, { text?: string; shaded?: boolean }> = {}): string {
  const cells: string[] = [];
  for (let index = 0; index < cellCount; index += 1) {
    const value = values[index];
    cells.push(makeCell(value?.text ?? '', value?.shaded ?? false));
  }
  return `<w:tr>${cells.join('')}</w:tr>`;
}

async function buildTemplateBuffer(): Promise<Buffer> {
  const table0Rows = Array.from({ length: 6 }, (_, row) => makeRow(6, row === 5 ? { 2: { text: 'old' }, 4: { text: 'old' }, 5: { text: 'old' } } : {})).join('');

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

function getCell(document: Document, tableIndex: number, rowIndex: number, cellIndex: number): Element {
  const tables = xpath.select("//*[local-name()='tbl']", document) as Element[];
  const rows = xpath.select("./*[local-name()='tr']", tables[tableIndex]) as Element[];
  const cells = xpath.select("./*[local-name()='tc']", rows[rowIndex]) as Element[];
  return cells[cellIndex];
}

function getCellText(cell: Element): string {
  const textNodes = xpath.select(".//*[local-name()='t']", cell) as Node[];
  return textNodes.map((node) => node.textContent ?? '').join('');
}

function hasShading(cell: Element): boolean {
  const shading = xpath.select("./*[local-name()='tcPr']/*[local-name()='shd']", cell) as Node[];
  return shading.length > 0;
}

function hasBold(cell: Element): boolean {
  const boldNodes = xpath.select(".//*[local-name()='rPr']/*[local-name()='b']", cell) as Node[];
  return boldNodes.length > 0;
}

function getSize(cell: Element): string | null {
  const sizeNode = xpath.select(".//*[local-name()='rPr']/*[local-name()='sz']", cell) as Element[];
  if (sizeNode.length === 0) {
    return null;
  }

  return sizeNode[0].getAttribute('w:val') ?? sizeNode[0].getAttribute('val');
}

function isCentered(cell: Element): boolean {
  const jcNode = xpath.select(".//*[local-name()='pPr']/*[local-name()='jc']", cell) as Element[];
  if (jcNode.length === 0) {
    return false;
  }

  const value = jcNode[0].getAttribute('w:val') ?? jcNode[0].getAttribute('val');
  return value === 'center';
}

describe('fillTimesheetTemplate', () => {
  it('writes dates, row values, totals and day-cell shading', async () => {
    const templateBuffer = await buildTemplateBuffer();

    const dayCodesByDay = new Map<number, DayCode>();
    for (let day = 1; day <= 31; day += 1) {
      dayCodesByDay.set(day, '');
    }
    dayCodesByDay.set(1, 'X');
    dayCodesByDay.set(2, '8');
    dayCodesByDay.set(3, 'შ');

    const computed: ComputedTimesheet = {
      dayCodesByDay,
      firstHalfHours: 56,
      secondHalfHours: 88,
      workedDays: 18,
      totalWorkedHours: 144,
      paidVacationHours: 8,
      weekdayHolidayCount: 3,
      startDateLabel: '01.01.2026',
      endDateLabel: '31.01.2026',
      lastWorkdayLabel: '30.01'
    };

    const output = await fillTimesheetTemplate({
      templateBuffer,
      companyCode: '405627530',
      employeeName: 'გიორგი პეტრიაშვილი, უფროსი დეველოპერი',
      employeeId: '01005031116',
      computed
    });

    const zip = await JSZip.loadAsync(output);
    const xml = await zip.file('word/document.xml')!.async('text');
    const documentNode = new DOMParser().parseFromString(xml, 'application/xml');

    expect(getCellText(getCell(documentNode, 0, 5, 2))).toBe('30.01');
    expect(getCellText(getCell(documentNode, 0, 5, 4))).toBe('01.01.2026');
    expect(getCellText(getCell(documentNode, 0, 5, 5))).toBe('31.01.2026');

    expect(getCellText(getCell(documentNode, 1, 5, 1))).toBe('გიორგი პეტრიაშვილი, უფროსი დეველოპერი');
    expect(getCellText(getCell(documentNode, 1, 5, 2))).toBe('01005031116');

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
});
