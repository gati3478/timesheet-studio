import xpath from 'xpath';

export function getCell(
  documentNode: Document,
  tableIndex: number,
  rowIndex: number,
  cellIndex: number
): Element {
  const tables = xpath.select("//*[local-name()='tbl']", documentNode) as Element[];
  const rows = xpath.select("./*[local-name()='tr']", tables[tableIndex]) as Element[];
  const cells = xpath.select("./*[local-name()='tc']", rows[rowIndex]) as Element[];
  return cells[cellIndex];
}

export function getCellText(cell: Element): string {
  const textNodes = xpath.select(".//*[local-name()='t']", cell) as Node[];
  return textNodes.map((node) => node.textContent ?? '').join('');
}

export function getCellTextAt(
  documentNode: Document,
  tableIndex: number,
  rowIndex: number,
  cellIndex: number
): string {
  return getCellText(getCell(documentNode, tableIndex, rowIndex, cellIndex));
}

export function hasShading(cell: Element): boolean {
  const shading = xpath.select("./*[local-name()='tcPr']/*[local-name()='shd']", cell) as Node[];
  return shading.length > 0;
}

export function hasBold(cell: Element): boolean {
  const boldNodes = xpath.select(".//*[local-name()='rPr']/*[local-name()='b']", cell) as Node[];
  return boldNodes.length > 0;
}

export function getSize(cell: Element): string | null {
  const sizeNode = xpath.select(".//*[local-name()='rPr']/*[local-name()='sz']", cell) as Element[];
  if (sizeNode.length === 0) {
    return null;
  }

  return sizeNode[0].getAttribute('w:val') ?? sizeNode[0].getAttribute('val');
}

export function isCentered(cell: Element): boolean {
  const jcNode = xpath.select(".//*[local-name()='pPr']/*[local-name()='jc']", cell) as Element[];
  if (jcNode.length === 0) {
    return false;
  }

  const value = jcNode[0].getAttribute('w:val') ?? jcNode[0].getAttribute('val');
  return value === 'center';
}
