import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import xpath from 'xpath';
import type { ComputedTimesheet, DayCode } from './types';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const DOCUMENT_XML_PATH = 'word/document.xml';
const STYLES_XML_PATH = 'word/styles.xml';
const TARGET_FONT = 'Sylfaen';
const VALUE_FONT_SIZE_HALF_POINTS = '18'; // 9pt

interface FillTemplateInput {
  templateBuffer: Buffer;
  companyCode: string;
  employeeName: string;
  employeeId: string;
  computed: ComputedTimesheet;
}

interface TableCellRef {
  table: number;
  row: number;
  cell: number;
}

const LEFT_DATE_CELL: TableCellRef = { table: 0, row: 5, cell: 2 };
const START_DATE_CELL: TableCellRef = { table: 0, row: 5, cell: 4 };
const END_DATE_CELL: TableCellRef = { table: 0, row: 5, cell: 5 };
const COMPANY_CODE_CELL: TableCellRef = { table: 0, row: 3, cell: 1 };

const EMPLOYEE_ROW_TABLE = 1;
const EMPLOYEE_ROW_INDEX = 5;
const FIRST_DAY_NUMBER = 1;
const LAST_DAY_NUMBER = 31;

const FIRST_HALF_HOURS_CELL = 18;
const SECOND_HALF_HOURS_CELL = 35;
const WORKED_DAYS_CELL = 36;
const TOTAL_WORKED_HOURS_CELL = 37;
const TOTAL_HOURS_DUPLICATE_CELL = 41;
const PAID_VACATION_HOURS_CELL = 43;
const WEEKDAY_HOLIDAY_COUNT_CELL = 46;

function w(name: string): string {
  return `w:${name}`;
}

function createWElement(document: Document, name: string): Element {
  return document.createElementNS(W_NS, w(name));
}

function findChildByLocalName(node: Node, localName: string): Element | null {
  const children = node.childNodes;
  for (let index = 0; index < children.length; index += 1) {
    const child = children.item(index);
    if (child?.nodeType === child.ELEMENT_NODE && (child as Element).localName === localName) {
      return child as Element;
    }
  }

  return null;
}

function getOrCreateChild(
  parent: Element,
  localName: string,
  position: 'prepend' | 'append' = 'prepend'
): Element {
  let child = findChildByLocalName(parent, localName);
  if (!child) {
    child = createWElement(parent.ownerDocument!, localName);
    if (position === 'prepend') parent.insertBefore(child, parent.firstChild);
    else parent.appendChild(child);
  }
  return child;
}

function removeChildByLocalName(parent: Element, localName: string): void {
  const children = Array.from(parent.childNodes);
  for (const child of children) {
    if (child.nodeType === child.ELEMENT_NODE && (child as Element).localName === localName) {
      parent.removeChild(child);
    }
  }
}

function setRFontsToTarget(rFonts: Element): void {
  rFonts.setAttributeNS(W_NS, w('ascii'), TARGET_FONT);
  rFonts.setAttributeNS(W_NS, w('hAnsi'), TARGET_FONT);
  rFonts.setAttributeNS(W_NS, w('cs'), TARGET_FONT);
  rFonts.setAttributeNS(W_NS, w('eastAsia'), TARGET_FONT);
}

function setParagraphCenter(paragraph: Element): void {
  const paragraphProperties = getOrCreateChild(paragraph, 'pPr');
  const justification = getOrCreateChild(paragraphProperties, 'jc', 'append');
  justification.setAttributeNS(W_NS, w('val'), 'center');
}

function setRunValueStyle(
  run: Element,
  options: {
    bold: boolean;
    sizeHalfPoints?: string;
  }
): void {
  const runProperties = getOrCreateChild(run, 'rPr');
  setRFontsToTarget(getOrCreateChild(runProperties, 'rFonts'));

  const sizeVal = options.sizeHalfPoints ?? VALUE_FONT_SIZE_HALF_POINTS;
  getOrCreateChild(runProperties, 'sz', 'append').setAttributeNS(W_NS, w('val'), sizeVal);
  getOrCreateChild(runProperties, 'szCs', 'append').setAttributeNS(W_NS, w('val'), sizeVal);

  removeChildByLocalName(runProperties, 'b');
  removeChildByLocalName(runProperties, 'bCs');
  if (options.bold) {
    const bold = createWElement(run.ownerDocument!, 'b');
    const boldCs = createWElement(run.ownerDocument!, 'bCs');
    runProperties.appendChild(bold);
    runProperties.appendChild(boldCs);
  }
}

function setStyledCellText(
  tc: Element,
  value: string,
  options: {
    bold?: boolean;
    centered?: boolean;
    sizeHalfPoints?: string;
  } = {}
): void {
  if (!value) {
    clearCellText(tc);
    return;
  }

  const paragraph = getOrCreateChild(tc, 'p', 'append');
  if (options.centered ?? false) {
    setParagraphCenter(paragraph);
  }

  const run = getOrCreateChild(paragraph, 'r', 'append');
  const text = getOrCreateChild(run, 't', 'append');
  if (value.startsWith(' ') || value.endsWith(' ')) {
    text.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
  } else {
    text.removeAttribute('xml:space');
  }
  text.textContent = value;

  const textNodes = xpath.select(".//*[local-name()='t']", tc) as Element[];
  for (let index = 1; index < textNodes.length; index += 1) {
    textNodes[index].textContent = '';
  }

  setRunValueStyle(run, {
    bold: options.bold ?? false,
    sizeHalfPoints: options.sizeHalfPoints
  });
}

function enforceSylfaenOnAllRuns(document: Document): void {
  const runs = xpath.select("//*[local-name()='r']", document) as Element[];
  for (const run of runs) {
    setRFontsToTarget(getOrCreateChild(getOrCreateChild(run, 'rPr'), 'rFonts'));
  }
}

function ensureStylesDefaultFont(stylesDocument: Document): void {
  const stylesRoot = xpath.select("/*[local-name()='styles']", stylesDocument) as Element[];
  if (!stylesRoot[0]) {
    return;
  }

  const docDefaults = xpath.select(
    "/*[local-name()='styles']/*[local-name()='docDefaults']",
    stylesDocument
  ) as Element[];
  let docDefaultsNode = docDefaults[0];
  if (!docDefaultsNode) {
    docDefaultsNode = createWElement(stylesDocument, 'docDefaults');
    stylesRoot[0].insertBefore(docDefaultsNode, stylesRoot[0].firstChild);
  }

  const rPrDefault = getOrCreateChild(docDefaultsNode, 'rPrDefault', 'append');
  const rPr = getOrCreateChild(rPrDefault, 'rPr', 'append');
  setRFontsToTarget(getOrCreateChild(rPr, 'rFonts'));
}

function enforceSylfaenInStyles(stylesXml: string): string {
  const stylesDocument = new DOMParser().parseFromString(stylesXml, 'application/xml');
  const serializer = new XMLSerializer();

  const allRFonts = xpath.select("//*[local-name()='rFonts']", stylesDocument) as Element[];
  for (const rFonts of allRFonts) {
    setRFontsToTarget(rFonts);
  }

  ensureStylesDefaultFont(stylesDocument);
  return serializer.serializeToString(stylesDocument);
}

function getTableCell(tables: Node[], target: TableCellRef): Element {
  const table = tables[target.table] as Element | undefined;
  if (!table) {
    throw new Error(`Table ${target.table} is missing in template.`);
  }

  const rows = xpath.select("./*[local-name()='tr']", table) as Node[];
  const row = rows[target.row] as Element | undefined;
  if (!row) {
    throw new Error(`Row ${target.row} is missing in table ${target.table}.`);
  }

  const cells = xpath.select("./*[local-name()='tc']", row) as Node[];
  const cell = cells[target.cell] as Element | undefined;
  if (!cell) {
    throw new Error(`Cell ${target.cell} is missing in table ${target.table}, row ${target.row}.`);
  }

  return cell;
}

function getEmployeeRowCells(tables: Node[]): Element[] {
  const table = tables[EMPLOYEE_ROW_TABLE] as Element | undefined;
  if (!table) {
    throw new Error(`Employee table ${EMPLOYEE_ROW_TABLE} missing in template.`);
  }

  const rows = xpath.select("./*[local-name()='tr']", table) as Node[];
  const row = rows[EMPLOYEE_ROW_INDEX] as Element | undefined;
  if (!row) {
    throw new Error(`Employee row ${EMPLOYEE_ROW_INDEX} missing in template.`);
  }

  const cells = xpath.select("./*[local-name()='tc']", row) as Element[];
  if (cells.length < 47) {
    throw new Error(`Employee row structure is invalid. Expected >=47 cells, got ${cells.length}.`);
  }

  return cells;
}

function clearCellText(tc: Element): void {
  const textNodes = xpath.select(".//*[local-name()='t']", tc) as Node[];
  for (const textNode of textNodes) {
    textNode.textContent = '';
  }
}

function setDayCellShading(tc: Element, enabled: boolean): void {
  const tcPr = getOrCreateChild(tc, 'tcPr');
  const existingShading = findChildByLocalName(tcPr, 'shd');

  if (!enabled) {
    if (existingShading) {
      tcPr.removeChild(existingShading);
    }
    return;
  }

  const shading = existingShading ?? createWElement(tc.ownerDocument!, 'shd');
  shading.setAttributeNS(W_NS, w('val'), 'clear');
  shading.setAttributeNS(W_NS, w('fill'), 'C0C0C0');
  if (!existingShading) {
    tcPr.appendChild(shading);
  }
}

function setDayCellValue(tc: Element, value: string): void {
  if (!value) {
    clearCellText(tc);
    setDayCellShading(tc, false);
    return;
  }

  setStyledCellText(tc, value, {
    centered: true,
    sizeHalfPoints: VALUE_FONT_SIZE_HALF_POINTS,
    bold: value === 'X' || value === 'შ'
  });
  setDayCellShading(tc, value === 'X');
}

function dayToCellIndex(day: number): number {
  return day <= 15 ? day + 2 : day + 3;
}

function applyDayColumnShading(tables: Node[], dayCodesByDay: Map<number, DayCode>): void {
  const employeeTable = tables[EMPLOYEE_ROW_TABLE] as Element | undefined;
  if (!employeeTable) {
    return;
  }

  const rows = xpath.select("./*[local-name()='tr']", employeeTable) as Element[];
  if (rows.length <= EMPLOYEE_ROW_INDEX) {
    return;
  }

  for (let rowIndex = EMPLOYEE_ROW_INDEX; rowIndex < rows.length; rowIndex += 1) {
    const cells = xpath.select("./*[local-name()='tc']", rows[rowIndex]) as Element[];
    for (let day = FIRST_DAY_NUMBER; day <= LAST_DAY_NUMBER; day += 1) {
      const cell = cells[dayToCellIndex(day)];
      if (cell) setDayCellShading(cell, dayCodesByDay.get(day) === 'X');
    }
  }
}

export async function fillTimesheetTemplate(input: FillTemplateInput): Promise<Buffer> {
  const zip = await JSZip.loadAsync(input.templateBuffer);
  const documentXml = await zip.file(DOCUMENT_XML_PATH)?.async('text');

  if (!documentXml) {
    throw new Error(`${DOCUMENT_XML_PATH} not found in template.`);
  }

  const documentNode = new DOMParser().parseFromString(documentXml, 'application/xml');
  const tables = xpath.select("//*[local-name()='tbl']", documentNode) as Node[];

  setStyledCellText(getTableCell(tables, LEFT_DATE_CELL), input.computed.lastWorkdayLabel, {
    bold: true
  });
  setStyledCellText(getTableCell(tables, START_DATE_CELL), input.computed.startDateLabel);
  setStyledCellText(getTableCell(tables, END_DATE_CELL), input.computed.endDateLabel);
  setStyledCellText(getTableCell(tables, COMPANY_CODE_CELL), input.companyCode);

  const rowCells = getEmployeeRowCells(tables);

  setStyledCellText(rowCells[1], input.employeeName, { sizeHalfPoints: '14' });
  setStyledCellText(rowCells[2], input.employeeId, { sizeHalfPoints: '14' });

  for (let day = 1; day <= 31; day += 1) {
    const code = input.computed.dayCodesByDay.get(day) ?? '';
    setDayCellValue(rowCells[dayToCellIndex(day)], code);
  }

  const totalsStyle = { centered: true, sizeHalfPoints: VALUE_FONT_SIZE_HALF_POINTS } as const;
  const totalsCells: [number, number][] = [
    [FIRST_HALF_HOURS_CELL, input.computed.firstHalfHours],
    [SECOND_HALF_HOURS_CELL, input.computed.secondHalfHours],
    [WORKED_DAYS_CELL, input.computed.workedDays],
    [TOTAL_WORKED_HOURS_CELL, input.computed.totalWorkedHours],
    [TOTAL_HOURS_DUPLICATE_CELL, input.computed.totalWorkedHours],
    [PAID_VACATION_HOURS_CELL, input.computed.paidVacationHours],
    [WEEKDAY_HOLIDAY_COUNT_CELL, input.computed.weekdayHolidayCount]
  ];
  for (const [idx, value] of totalsCells) {
    setStyledCellText(rowCells[idx], String(value), totalsStyle);
  }
  applyDayColumnShading(tables, input.computed.dayCodesByDay);
  enforceSylfaenOnAllRuns(documentNode);

  const serializer = new XMLSerializer();
  zip.file(DOCUMENT_XML_PATH, serializer.serializeToString(documentNode));

  const stylesXml = await zip.file(STYLES_XML_PATH)?.async('text');
  if (stylesXml) {
    zip.file(STYLES_XML_PATH, enforceSylfaenInStyles(stylesXml));
  }

  return zip.generateAsync({ type: 'nodebuffer' });
}
