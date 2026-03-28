import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { fillTimesheetTemplate } from '../../src/lib/server/docx';
import { makeComputedTimesheet } from '../helpers/fixtures';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function makeInput(templateBuffer: Buffer) {
  return {
    templateBuffer,
    companyCode: 'TEST-001',
    employeeName: 'Test User',
    employeeId: 'E001',
    computed: makeComputedTimesheet()
  };
}

async function buildDocxZip(documentXml?: string): Promise<Buffer> {
  const zip = new JSZip();
  if (documentXml !== undefined) {
    zip.file('word/document.xml', documentXml);
  }
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
}

function wrapBody(inner: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    `<w:document xmlns:w="${W_NS}">`,
    '<w:body>',
    inner,
    '</w:body>',
    '</w:document>'
  ].join('');
}

function makeRow(cellCount: number): string {
  return '<w:tr>' + '<w:tc><w:p><w:r><w:t></w:t></w:r></w:p></w:tc>'.repeat(cellCount) + '</w:tr>';
}

function makeTable(rows: string[]): string {
  return '<w:tbl>' + rows.join('') + '</w:tbl>';
}

describe('fillTimesheetTemplate error paths', () => {
  it('throws when word/document.xml is missing from the ZIP', async () => {
    const buffer = await buildDocxZip(); // no document.xml
    await expect(fillTimesheetTemplate(makeInput(buffer))).rejects.toThrow(
      'word/document.xml not found in template.'
    );
  });

  it('throws when table[0] is missing — no <w:tbl> elements', async () => {
    const xml = wrapBody(''); // body with no tables
    const buffer = await buildDocxZip(xml);
    await expect(fillTimesheetTemplate(makeInput(buffer))).rejects.toThrow(
      'Table 0 is missing in template.'
    );
  });

  it('throws when table[1] is missing — only 1 table', async () => {
    // Table 0 needs enough rows/cells for getTableCell calls:
    // LEFT_DATE_CELL: row 5, cell 4; START_DATE_CELL: row 5, cell 5;
    // COMPANY_CODE_CELL: row 3, cell 1
    // We need at least 6 rows (0-5), and row 5 needs 6 cells, row 3 needs 2 cells.
    const rows = [];
    for (let r = 0; r < 6; r++) {
      if (r === 3) {
        rows.push(makeRow(2)); // row 3 needs at least cell index 1
      } else if (r === 5) {
        rows.push(makeRow(6)); // row 5 needs at least cell index 5
      } else {
        rows.push(makeRow(1));
      }
    }
    const xml = wrapBody(makeTable(rows)); // only 1 table
    const buffer = await buildDocxZip(xml);
    await expect(fillTimesheetTemplate(makeInput(buffer))).rejects.toThrow(
      'Employee table 1 missing in template.'
    );
  });

  it('throws when employee row has <47 cells', async () => {
    // Table 0: as above
    const table0Rows = [];
    for (let r = 0; r < 6; r++) {
      if (r === 3) {
        table0Rows.push(makeRow(2));
      } else if (r === 5) {
        table0Rows.push(makeRow(6));
      } else {
        table0Rows.push(makeRow(1));
      }
    }

    // Table 1: needs 6 rows (0-5), but row 5 has only 10 cells (<47)
    const table1Rows = [];
    for (let r = 0; r < 6; r++) {
      if (r === 5) {
        table1Rows.push(makeRow(10)); // too few cells
      } else {
        table1Rows.push(makeRow(1));
      }
    }

    const xml = wrapBody(makeTable(table0Rows) + makeTable(table1Rows));
    const buffer = await buildDocxZip(xml);
    await expect(fillTimesheetTemplate(makeInput(buffer))).rejects.toThrow(
      'Employee row structure is invalid. Expected >=47 cells, got 10.'
    );
  });

  it('skips missing cells in applyDayColumnShading columns', async () => {
    // Build a valid-enough template that passes getTableCell and getEmployeeRowCells,
    // but has rows after row 5 with fewer cells so applyDayColumnShading hits the
    // `if (!cell) continue` path.
    const table0Rows = [];
    for (let r = 0; r < 6; r++) {
      if (r === 3) {
        table0Rows.push(makeRow(2));
      } else if (r === 5) {
        table0Rows.push(makeRow(6));
      } else {
        table0Rows.push(makeRow(1));
      }
    }

    // Table 1: row 5 has 47 cells (valid), rows 6 and 7 have only 2 cells (too few for day columns)
    const table1Rows = [];
    for (let r = 0; r < 8; r++) {
      if (r === 5) {
        table1Rows.push(makeRow(47));
      } else if (r === 6 || r === 7) {
        table1Rows.push(makeRow(2)); // short rows — triggers continue at line 403-405
      } else {
        table1Rows.push(makeRow(1));
      }
    }

    const xml = wrapBody(makeTable(table0Rows) + makeTable(table1Rows));
    const buffer = await buildDocxZip(xml);

    // Should succeed without throwing — the shading loop gracefully skips missing cells
    const result = await fillTimesheetTemplate(makeInput(buffer));
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('succeeds when word/styles.xml is missing from the ZIP', async () => {
    // Table 0: needs row 3 (cell 1), row 5 (cells 2, 4, 5)
    const table0Rows = [];
    for (let r = 0; r < 6; r++) {
      if (r === 3) {
        table0Rows.push(makeRow(2));
      } else if (r === 5) {
        table0Rows.push(makeRow(6));
      } else {
        table0Rows.push(makeRow(1));
      }
    }

    // Table 1: row 5 needs at least 47 cells for getEmployeeRowCells
    const table1Rows = [];
    for (let r = 0; r < 6; r++) {
      if (r === 5) {
        table1Rows.push(makeRow(47));
      } else {
        table1Rows.push(makeRow(1));
      }
    }

    const xml = wrapBody(makeTable(table0Rows) + makeTable(table1Rows));
    // buildDocxZip only adds word/document.xml — no word/styles.xml
    const buffer = await buildDocxZip(xml);

    // Should succeed without error when styles.xml is absent
    const result = await fillTimesheetTemplate(makeInput(buffer));
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // Verify the output ZIP does not contain word/styles.xml
    const outputZip = await JSZip.loadAsync(result);
    expect(outputZip.file('word/styles.xml')).toBeNull();
  });
});
