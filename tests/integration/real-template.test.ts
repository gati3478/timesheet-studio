import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';
import { fillTimesheetTemplate } from '../../src/lib/server/docx';
import type { ComputedTimesheet, DayCode } from '../../src/lib/server/types';
import {
  getCell,
  getCellTextAt,
  hasBold,
  getSize,
  hasShading,
  isCentered
} from '../helpers/docx-assertions';

describe('fillTimesheetTemplate with real converted template', () => {
  it('writes expected coordinates for employee row and totals', async () => {
    const templatePath = path.resolve(process.cwd(), 'static/templates/timesheet_template.docx');
    const templateBuffer = await readFile(templatePath);

    const codes = new Map<number, DayCode>();
    for (let day = 1; day <= 31; day += 1) {
      codes.set(day, day <= 3 ? 'X' : day <= 6 ? '8' : '');
    }

    const computed: ComputedTimesheet = {
      dayCodesByDay: codes,
      firstHalfHours: 32,
      secondHalfHours: 0,
      workedDays: 4,
      totalWorkedHours: 32,
      paidVacationHours: 0,
      weekdayHolidayCount: 1,
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

    expect(getCellTextAt(documentNode, 0, 5, 2)).toContain('30.01');
    expect(getCellTextAt(documentNode, 0, 5, 4)).toContain('01.01.2026');
    expect(getCellTextAt(documentNode, 0, 5, 5)).toContain('31.01.2026');
    expect(getCellTextAt(documentNode, 0, 3, 1)).toContain('405627530');

    expect(getCellTextAt(documentNode, 1, 5, 1)).toContain('გიორგი პეტრიაშვილი');
    expect(getCellTextAt(documentNode, 1, 5, 2)).toContain('01005031116');

    expect(getCellTextAt(documentNode, 1, 5, 3)).toContain('X');
    expect(getCellTextAt(documentNode, 1, 5, 4)).toContain('X');
    expect(getCellTextAt(documentNode, 1, 5, 5)).toContain('X');
    expect(getCellTextAt(documentNode, 1, 5, 6)).toContain('8');
    expect(hasBold(getCell(documentNode, 1, 5, 3))).toBe(true);
    expect(getSize(getCell(documentNode, 1, 5, 3))).toBe('18');
    expect(isCentered(getCell(documentNode, 1, 5, 3))).toBe(true);
    expect(isCentered(getCell(documentNode, 1, 5, 18))).toBe(true);
    expect(hasShading(getCell(documentNode, 1, 5, 3))).toBe(true);
    expect(hasShading(getCell(documentNode, 1, 6, 3))).toBe(true);
    expect(hasShading(getCell(documentNode, 1, 6, 6))).toBe(false);

    expect(getCellTextAt(documentNode, 1, 5, 18)).toContain('32');
    expect(getCellTextAt(documentNode, 1, 5, 35)).toContain('0');
    expect(getCellTextAt(documentNode, 1, 5, 36)).toContain('4');
    expect(getCellTextAt(documentNode, 1, 5, 37)).toContain('32');
    expect(getCellTextAt(documentNode, 1, 5, 41)).toContain('32');
    expect(getCellTextAt(documentNode, 1, 5, 43)).toContain('0');
    expect(getCellTextAt(documentNode, 1, 5, 46)).toContain('1');

    const runs = xpath.select("//*[local-name()='r']", documentNode) as Element[];
    const nonSylfaenRuns = runs.filter((run) => {
      const rFonts = xpath.select(
        "./*[local-name()='rPr']/*[local-name()='rFonts']",
        run
      ) as Element[];
      if (rFonts.length === 0) {
        return true;
      }

      const node = rFonts[0];
      const values = [
        node.getAttribute('w:ascii') ?? node.getAttribute('ascii'),
        node.getAttribute('w:hAnsi') ?? node.getAttribute('hAnsi'),
        node.getAttribute('w:cs') ?? node.getAttribute('cs'),
        node.getAttribute('w:eastAsia') ?? node.getAttribute('eastAsia')
      ];

      return values.some((value) => value !== 'Sylfaen');
    });

    expect(nonSylfaenRuns).toHaveLength(0);

    const stylesXml = await zip.file('word/styles.xml')!.async('text');
    const stylesNode = new DOMParser().parseFromString(stylesXml, 'application/xml');
    const styleFonts = xpath.select("//*[local-name()='rFonts']", stylesNode) as Element[];

    const nonSylfaenStyleFonts = styleFonts.filter((fontNode) => {
      const values = [
        fontNode.getAttribute('w:ascii') ?? fontNode.getAttribute('ascii'),
        fontNode.getAttribute('w:hAnsi') ?? fontNode.getAttribute('hAnsi'),
        fontNode.getAttribute('w:cs') ?? fontNode.getAttribute('cs'),
        fontNode.getAttribute('w:eastAsia') ?? fontNode.getAttribute('eastAsia')
      ];

      return values.some((value) => value !== 'Sylfaen');
    });

    expect(nonSylfaenStyleFonts).toHaveLength(0);
  });
});
