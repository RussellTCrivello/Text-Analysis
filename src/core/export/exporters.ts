/**
 * Export engine.
 *
 * Every format is produced by the core (no third-party libraries), so exports
 * behave identically in tests, in the browser, and in any future host:
 *
 *   csv / tsv      RFC 4180 quoting, optional UTF-8 BOM (Excel-friendly)
 *   json / jsonl   pretty JSON and newline-delimited JSON
 *   xml            escaped, schema-labelled document
 *   html / md      printable HTML table and Markdown table
 *   xlsx           genuine OOXML workbook (zip written by core/export/zip)
 *   xls            SpreadsheetML 2003 (Excel 2003 XML)
 *   docx           genuine OOXML document
 *   doc            Word-compatible HTML
 *   pdf            hand-built PDF 1.4 with paginated table, header and footer
 */
import { byteLength, formatDate, sanitizeFilename, timestamp, utf8Bytes } from '../text';
import { createZip } from './zip';

export type ExportFormat =
  | 'csv'
  | 'tsv'
  | 'json'
  | 'jsonl'
  | 'xml'
  | 'html'
  | 'markdown'
  | 'xlsx'
  | 'xls'
  | 'docx'
  | 'doc'
  | 'pdf'
  | 'txt';

export interface ExportColumn {
  key: string;
  label: string;
  format?: 'percent' | 'date' | 'datetime' | 'text';
}

export type Row = Record<string, unknown>;

export interface ExportOptions {
  columns: ExportColumn[];
  format: ExportFormat;
  filename?: string;
  includeHeaders?: boolean;
  bom?: boolean;
  delimiter?: string;
  sheetName?: string;
  /** Document chrome used by pdf/html/docx. */
  title?: string;
  subtitle?: string;
  headerLines?: string[];
  footerText?: string;
  docNumber?: string;
  pageSize?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  /** Maximum rows written (0/undefined = all). */
  maxRows?: number;
}

export interface ExportArtifact {
  filename: string;
  mime: string;
  content: Uint8Array | string;
  bytes: number;
  rows: number;
  columns: number;
  format: ExportFormat;
  warnings: string[];
  generatedAt: string;
}

export const FORMAT_META: Record<ExportFormat, { label: string; ext: string; mime: string; binary: boolean }> = {
  csv: { label: 'CSV (.csv)', ext: 'csv', mime: 'text/csv;charset=utf-8', binary: false },
  tsv: { label: 'Tab separated (.tsv)', ext: 'tsv', mime: 'text/tab-separated-values;charset=utf-8', binary: false },
  json: { label: 'JSON (.json)', ext: 'json', mime: 'application/json', binary: false },
  jsonl: { label: 'JSON Lines (.jsonl)', ext: 'jsonl', mime: 'application/x-ndjson', binary: false },
  xml: { label: 'XML (.xml)', ext: 'xml', mime: 'application/xml', binary: false },
  html: { label: 'HTML (.html)', ext: 'html', mime: 'text/html;charset=utf-8', binary: false },
  markdown: { label: 'Markdown (.md)', ext: 'md', mime: 'text/markdown;charset=utf-8', binary: false },
  xlsx: { label: 'Excel workbook (.xlsx)', ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', binary: true },
  xls: { label: 'Excel 2003 XML (.xls)', ext: 'xls', mime: 'application/vnd.ms-excel', binary: false },
  docx: { label: 'Word document (.docx)', ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', binary: true },
  doc: { label: 'Word HTML (.doc)', ext: 'doc', mime: 'application/msword', binary: false },
  pdf: { label: 'PDF document (.pdf)', ext: 'pdf', mime: 'application/pdf', binary: true },
  txt: { label: 'Plain text (.txt)', ext: 'txt', mime: 'text/plain;charset=utf-8', binary: false },
};

/* --------------------------------- formatting ------------------------------- */

export function formatCellValue(value: unknown, format?: ExportColumn['format']): string {
  if (value === null || value === undefined) return '';
  if (format === 'percent') {
    const n = Number(value);
    if (Number.isNaN(n)) return String(value);
    return `${(n > 1 ? n : n * 100).toFixed(2)}%`;
  }
  if (format === 'date' || format === 'datetime') {
    const iso = String(value);
    if (!iso) return '';
    return formatDate(iso, format === 'datetime');
  }
  if (typeof value === 'number') return String(Number(value.toFixed ? Number(value.toFixed(6)) : value));
  return String(value);
}

function applyColumns(rows: Row[], columns: ExportColumn[]): string[][] {
  return rows.map((row) => columns.map((c) => formatCellValue(row[c.key], c.format)));
}

/* ----------------------------------- csv ------------------------------------ */

function csvCell(value: string, delimiter: string): string {
  if (value === '') return '';
  const needsQuotes = value.includes('"') || value.includes(delimiter) || /[\r\n]/.test(value) || /^\s|\s$/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function buildDelimited(matrix: string[][], headers: string[], delimiter: string, includeHeaders: boolean): string {
  const lines: string[] = [];
  if (includeHeaders) lines.push(headers.map((h) => csvCell(h, delimiter)).join(delimiter));
  for (const row of matrix) lines.push(row.map((c) => csvCell(c, delimiter)).join(delimiter));
  return lines.join('\r\n');
}

/* ----------------------------------- xml ------------------------------------ */

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Strip control characters that XML 1.0 forbids.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function safeXmlName(name: string): string {
  const cleaned = name.replace(/[^\p{L}\p{N}_.-]/gu, '_');
  return /^[\p{L}_]/u.test(cleaned) ? cleaned : `_${cleaned}`;
}

function buildXml(matrix: string[][], columns: ExportColumn[], meta: { title?: string; generatedAt: string }): string {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>'];
  lines.push(`<records generated="${escapeXml(meta.generatedAt)}" count="${matrix.length}">`);
  if (meta.title) lines.push(`  <title>${escapeXml(meta.title)}</title>`);
  for (const row of matrix) {
    lines.push('  <record>');
    row.forEach((cell, i) => {
      const name = safeXmlName(columns[i]?.key ?? `field${i}`);
      lines.push(`    <${name}>${escapeXml(cell)}</${name}>`);
    });
    lines.push('  </record>');
  }
  lines.push('</records>');
  return lines.join('\n');
}

/* ----------------------------------- html ----------------------------------- */

export function buildHtmlTable(
  matrix: string[][],
  columns: ExportColumn[],
  meta: { title?: string; subtitle?: string; headerLines?: string[]; footerText?: string; docNumber?: string; generatedAt?: string },
): string {
  const head = columns.map((c) => `<th>${escapeXml(c.label)}</th>`).join('');
  const body = matrix
    .map(
      (row, i) =>
        `<tr class="${i % 2 ? 'odd' : 'even'}">${row.map((c) => `<td>${escapeXml(c) || '&nbsp;'}</td>`).join('')}</tr>`,
    )
    .join('\n');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeXml(meta.title ?? 'Export')}</title>
<style>
  body { font-family: 'Source Sans 3', 'Segoe UI', system-ui, sans-serif; color: #0f172a; margin: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #64748b; font-size: 12px; margin-bottom: 12px; }
  .hdr { font-size: 12px; color: #334155; margin-bottom: 2px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: start; vertical-align: top; }
  th { background: #0f766e; color: #fff; font-weight: 600; }
  tr.odd td { background: #f1f5f9; }
  .foot { margin-top: 12px; font-size: 11px; color: #64748b; }
  @page { margin: 14mm; }
</style>
</head>
<body>
${(meta.headerLines ?? []).map((l) => `<div class="hdr">${escapeXml(l)}</div>`).join('\n')}
<h1>${escapeXml(meta.title ?? 'Export')}</h1>
${meta.subtitle ? `<div class="sub">${escapeXml(meta.subtitle)}</div>` : ''}
<div class="sub">${matrix.length} records${meta.docNumber ? ` · ${escapeXml(meta.docNumber)}` : ''}${meta.generatedAt ? ` · ${escapeXml(meta.generatedAt)}` : ''}</div>
<table>
<thead><tr>${head}</tr></thead>
<tbody>
${body}
</tbody>
</table>
${meta.footerText ? `<div class="foot">${escapeXml(meta.footerText)}</div>` : ''}
</body>
</html>`;
}

/* --------------------------------- markdown --------------------------------- */

function buildMarkdown(matrix: string[][], columns: ExportColumn[], title?: string): string {
  const lines: string[] = [];
  if (title) lines.push(`# ${title}`, '');
  lines.push(`| ${columns.map((c) => c.label.replace(/\|/g, '\\|')).join(' | ')} |`);
  lines.push(`| ${columns.map(() => '---').join(' | ')} |`);
  for (const row of matrix) lines.push(`| ${row.map((c) => c.replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`);
  return lines.join('\n');
}

/* ----------------------------------- xlsx ----------------------------------- */

const COL_NAMES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function columnName(index: number): string {
  let n = index;
  let out = '';
  do {
    out = COL_NAMES[n % 26] + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

function cellRef(col: number, row: number): string {
  return `${columnName(col)}${row}`;
}

function buildXlsx(matrix: string[][], columns: ExportColumn[], sheetName: string): Uint8Array {
  const rowsXml: string[] = [];
  if (columns.length) {
    const headerCells = columns
      .map((c, i) => `<c r="${cellRef(i, 1)}" t="inlineStr" s="1"><is><t xml:space="preserve">${escapeXml(c.label)}</t></is></c>`)
      .join('');
    rowsXml.push(`<row r="1">${headerCells}</row>`);
  }
  matrix.forEach((row, r) => {
    const cells = row
      .map((cell, i) => {
        const numeric = cell !== '' && /^-?\d+(\.\d+)?$/.test(cell);
        if (numeric) return `<c r="${cellRef(i, r + 2)}"><v>${cell}</v></c>`;
        return `<c r="${cellRef(i, r + 2)}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
      })
      .join('');
    rowsXml.push(`<row r="${r + 2}">${cells}</row>`);
  });

  const lastCol = columnName(Math.max(0, columns.length - 1));
  const dimension = `A1:${lastCol}${matrix.length + 1}`;
  const cols = columns
    .map((c, i) => {
      const width = Math.min(60, Math.max(10, c.label.length + 4));
      return `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`;
    })
    .join('');

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="${dimension}"/>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${rowsXml.join('')}</sheetData>
<autoFilter ref="${dimension}"/>
</worksheet>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${escapeXml(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>
</styleSheet>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  return createZip([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'xl/workbook.xml', data: workbook },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
    { name: 'xl/styles.xml', data: styles },
    { name: 'xl/worksheets/sheet1.xml', data: sheet },
  ]);
}

/* --------------------------- xls (SpreadsheetML) ---------------------------- */

function buildSpreadsheetMl(matrix: string[][], columns: ExportColumn[], sheetName: string): string {
  const head = columns.map((c) => `<Cell ss:StyleID="hdr"><Data ss:Type="String">${escapeXml(c.label)}</Data></Cell>`).join('');
  const rows = matrix
    .map(
      (row) =>
        `<Row>${row
          .map((cell) => {
            const numeric = cell !== '' && /^-?\d+(\.\d+)?$/.test(cell);
            return `<Cell><Data ss:Type="${numeric ? 'Number' : 'String'}">${escapeXml(cell)}</Data></Cell>`;
          })
          .join('')}</Row>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
<Style ss:ID="hdr"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0F766E" ss:Pattern="Solid"/></Style>
</Styles>
<Worksheet ss:Name="${escapeXml(sheetName.slice(0, 31))}">
<Table>
<Row>${head}</Row>
${rows}
</Table>
</Worksheet>
</Workbook>`;
}

/* ----------------------------------- docx ----------------------------------- */

function buildDocx(matrix: string[][], columns: ExportColumn[], meta: { title?: string; subtitle?: string }): Uint8Array {
  const esc = escapeXml;
  const paragraph = (text: string, opts: { bold?: boolean; size?: number } = {}) =>
    `<w:p><w:pPr>${opts.bold ? '<w:rPr><w:b/></w:rPr>' : ''}</w:pPr><w:r><w:rPr>${opts.bold ? '<w:b/>' : ''}<w:sz w:val="${(opts.size ?? 22) * 2}"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;

  const tableRows = [
    `<w:tr><w:trPr><w:tblHeader/></w:trPr>${columns
      .map(
        (c) =>
          `<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="0F766E"/></w:tcPr>${paragraph(c.label, { bold: true, size: 10 })}</w:tc>`,
      )
      .join('')}</w:tr>`,
    ...matrix.map(
      (row) =>
        `<w:tr>${row.map((cell) => `<w:tc>${paragraph(cell, { size: 10 })}</w:tc>`).join('')}</w:tr>`,
    ),
  ];

  const grid = columns.map(() => '<w:gridCol w:w="1800"/>').join('');
  const body = [
    meta.title ? paragraph(meta.title, { bold: true, size: 16 }) : '',
    meta.subtitle ? paragraph(meta.subtitle, { size: 11 }) : '',
    `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="CBD5E1"/><w:left w:val="single" w:sz="4" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="4" w:color="CBD5E1"/><w:right w:val="single" w:sz="4" w:color="CBD5E1"/><w:insideH w:val="single" w:sz="4" w:color="CBD5E1"/><w:insideV w:val="single" w:sz="4" w:color="CBD5E1"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${tableRows.join('')}</w:tbl>`,
    paragraph(`Generated ${meta.subtitle ? '' : ''}${new Date().toISOString().slice(0, 19).replace('T', ' ')} · ${matrix.length} records`, { size: 9 }),
  ].join('');

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  return createZip([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'word/document.xml', data: document },
  ]);
}

function buildWordHtml(html: string): string {
  return html.replace(
    '<head>',
    '<head>\n<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->',
  );
}

/* ------------------------------------ pdf ----------------------------------- */

interface PdfPage {
  ops: string[];
}

const PDF_ESCAPES: Record<string, string> = { '\\': '\\\\', '(': '\\(', ')': '\\)' };

function pdfText(value: string): { text: string; lossy: boolean } {
  let lossy = false;
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code > 0xff) {
      // WinAnsi cannot represent this glyph (e.g. Arabic); fall back to '?'
      lossy = true;
      out += '?';
      continue;
    }
    out += PDF_ESCAPES[ch] ?? ch;
  }
  return { text: out, lossy };
}

function textWidth(value: string, size: number): number {
  // Helvetica average advance ≈ 0.52em — good enough for column layout.
  return value.length * size * 0.52;
}

function wrapText(value: string, maxWidth: number, size: number, maxLines = 4): string[] {
  if (!value) return [''];
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate, size) <= maxWidth || !current) {
      current = candidate;
      if (textWidth(current, size) > maxWidth && current.length > 24) {
        lines.push(current.slice(0, 24));
        current = current.slice(24);
      }
    } else {
      lines.push(current);
      current = word;
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (!lines.length) lines.push('');
  return lines;
}

function buildPdf(
  matrix: string[][],
  columns: ExportColumn[],
  meta: {
    title?: string;
    subtitle?: string;
    headerLines?: string[];
    footerText?: string;
    docNumber?: string;
    pageSize: 'a4' | 'letter';
    orientation: 'portrait' | 'landscape';
  },
): { bytes: Uint8Array; lossy: boolean; pages: number } {
  const dims =
    meta.pageSize === 'a4'
      ? { w: 595.28, h: 841.89 }
      : { w: 612, h: 792 };
  const pageWidth = meta.orientation === 'landscape' ? dims.h : dims.w;
  const pageHeight = meta.orientation === 'landscape' ? dims.w : dims.h;
  const margin = 36;
  const usable = pageWidth - margin * 2;

  const fontSize = 8;
  const headerSize = 9;
  const pad = 4;
  const lineHeight = 11;

  // Column widths proportional to the widest cell (capped).
  const weights = columns.map((c, i) => {
    let widest = textWidth(c.label, headerSize) + pad * 2;
    for (const row of matrix.slice(0, 200)) {
      widest = Math.max(widest, Math.min(220, textWidth(row[i] ?? '', fontSize) + pad * 2));
    }
    return Math.max(38, Math.min(240, widest));
  });
  const scale = usable / weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => w * scale);

  let lossy = false;
  const pages: PdfPage[] = [];
  let ops: string[] = [];

  const startPage = (first: boolean) => {
    ops = [];
    let y = pageHeight - margin;
    for (const line of meta.headerLines ?? []) {
      const t = pdfText(line);
      lossy = lossy || t.lossy;
      ops.push(textOp(t.text, margin, y, 9, false, '0.35 0.35 0.35'));
      y -= 12;
    }
    if (meta.title) {
      const t = pdfText(meta.title);
      lossy = lossy || t.lossy;
      ops.push(textOp(t.text, margin, y - 6, 16, true, '0.06 0.09 0.16'));
      y -= 26;
    }
    if (meta.subtitle) {
      const t = pdfText(meta.subtitle);
      lossy = lossy || t.lossy;
      ops.push(textOp(t.text, margin, y, 10, false, '0.39 0.45 0.55'));
      y -= 16;
    }
    if (first) {
      const metaLine = `${matrix.length} records${meta.docNumber ? ` · ${meta.docNumber}` : ''} · ${new Date().toISOString().slice(0, 10)}`;
      const t = pdfText(metaLine);
      ops.push(textOp(t.text, margin, y, 9, false, '0.39 0.45 0.55'));
      y -= 18;
    }
    return y;
  };

  const drawHeaderRow = (y: number): number => {
    let x = margin;
    ops.push(`0.06 0.46 0.43 rg ${margin} ${y - 14} ${usable} 14 re f`);
    columns.forEach((c, i) => {
      const t = pdfText(c.label);
      lossy = lossy || t.lossy;
      ops.push(textOp(t.text, x + pad, y - 11, headerSize, true, '1 1 1'));
      x += widths[i];
    });
    return y - 14;
  };

  let y = startPage(true);
  y = drawHeaderRow(y);
  pages.push({ ops });

  for (const row of matrix) {
    const wrapped = row.map((cell, i) => wrapText(cell, widths[i] - pad * 2, fontSize));
    const height = Math.max(...wrapped.map((w) => w.length)) * lineHeight + 6;
    if (y - height < margin + 28) {
      pages.push({ ops: [] });
      const newPage = pages[pages.length - 1];
      let ny = startPage(false);
      ny = drawHeaderRow(ny);
      newPage.ops = ops;
      y = ny;
    }
    const rowTop = y;
    let x = margin;
    ops.push(`0.94 0.96 0.98 rg ${margin} ${y - height} ${usable} ${height} re f`);
    wrapped.forEach((lines, i) => {
      lines.forEach((line, li) => {
        const t = pdfText(line);
        lossy = lossy || t.lossy;
        ops.push(textOp(t.text, x + pad, rowTop - 10 - li * lineHeight, fontSize, false, '0.06 0.09 0.16'));
      });
      x += widths[i];
    });
    // hairlines
    let lx = margin;
    for (const w of widths) {
      ops.push(`0.8 0.84 0.88 RG 0.5 w ${lx} ${rowTop - height} m ${lx} ${rowTop} l S`);
      lx += w;
    }
    ops.push(`0.8 0.84 0.88 RG 0.5 w ${margin} ${rowTop - height} m ${pageWidth - margin} ${rowTop - height} l S`);
    y -= height;
  }

  // Footers with page numbers.
  pages.forEach((page, index) => {
    const footer = `${meta.footerText ?? 'Text Analysis Manager'} · Page ${index + 1} of ${pages.length}`;
    const t = pdfText(footer);
    lossy = lossy || t.lossy;
    page.ops.push(textOp(t.text, margin, margin - 14, 8, false, '0.39 0.45 0.55'));
  });

  const objects: string[] = [];
  const pageObjectNumbers: number[] = [];
  const contentObjectNumbers: number[] = [];

  const fontRegular = 3;
  const fontBold = 4;
  const pagesObject = 2;

  let objectNumber = 5;
  for (let i = 0; i < pages.length; i++) {
    pageObjectNumbers.push(objectNumber++);
    contentObjectNumbers.push(objectNumber++);
  }

  objects.push(`1 0 obj\n<< /Type /Catalog /Pages ${pagesObject} 0 R >>\nendobj`);
  objects.push(
    `2 0 obj\n<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectNumbers.map((n) => `${n} 0 R`).join(' ')}] >>\nendobj`,
  );
  objects.push(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj`);
  objects.push(`4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj`);

  pages.forEach((page, i) => {
    const pageNum = pageObjectNumbers[i];
    const contentNum = contentObjectNumbers[i];
    objects.push(
      `${pageNum} 0 obj\n<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentNum} 0 R >>\nendobj`,
    );
    const stream = page.ops.join('\n');
    objects.push(`${contentNum} 0 obj\n<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj`);
  });

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(byteLength(pdf));
    pdf += `${obj}\n`;
  }
  const xrefOffset = byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return { bytes: utf8Bytes(pdf), lossy, pages: pages.length };
}

function textOp(text: string, x: number, y: number, size: number, bold: boolean, color: string): string {
  return `${color} rg BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${text}) Tj ET`;
}

/* ---------------------------------- driver ---------------------------------- */

export function exportData(rows: Row[], options: ExportOptions): ExportArtifact {
  const { columns, format } = options;
  if (!columns.length) throw new Error('Export requires at least one column');
  const limited = options.maxRows && options.maxRows > 0 ? rows.slice(0, options.maxRows) : rows;
  const matrix = applyColumns(limited, columns);
  const meta = FORMAT_META[format];
  const warnings: string[] = [];
  const generatedAt = timestamp();
  const base = sanitizeFilename(options.filename ?? 'export');
  const filename = `${base}.${meta.ext}`;
  const includeHeaders = options.includeHeaders ?? true;

  let content: Uint8Array | string;

  switch (format) {
    case 'csv':
      content = buildDelimited(matrix, columns.map((c) => c.label), options.delimiter ?? ',', includeHeaders);
      if (options.bom) content = `\uFEFF${content}`;
      break;
    case 'tsv':
      content = buildDelimited(matrix, columns.map((c) => c.label), '\t', includeHeaders);
      break;
    case 'json':
      content = JSON.stringify(
        limited.map((row) => Object.fromEntries(columns.map((c) => [c.key, row[c.key] ?? null]))),
        null,
        2,
      );
      break;
    case 'jsonl':
      content = limited
        .map((row) => JSON.stringify(Object.fromEntries(columns.map((c) => [c.key, row[c.key] ?? null]))))
        .join('\n');
      break;
    case 'xml':
      content = buildXml(matrix, columns, { title: options.title, generatedAt });
      break;
    case 'html':
      content = buildHtmlTable(matrix, columns, {
        title: options.title,
        subtitle: options.subtitle,
        headerLines: options.headerLines,
        footerText: options.footerText,
        docNumber: options.docNumber,
        generatedAt,
      });
      break;
    case 'markdown':
      content = buildMarkdown(matrix, columns, options.title);
      break;
    case 'xlsx':
      content = buildXlsx(matrix, columns, options.sheetName ?? options.title ?? 'Export');
      break;
    case 'xls':
      content = buildSpreadsheetMl(matrix, columns, options.sheetName ?? options.title ?? 'Export');
      break;
    case 'docx':
      content = buildDocx(matrix, columns, { title: options.title, subtitle: options.subtitle });
      break;
    case 'doc':
      content = buildWordHtml(
        buildHtmlTable(matrix, columns, {
          title: options.title,
          subtitle: options.subtitle,
          headerLines: options.headerLines,
          footerText: options.footerText,
          docNumber: options.docNumber,
          generatedAt,
        }),
      );
      break;
    case 'txt':
      content = [
        options.title ?? 'Export',
        options.subtitle ?? '',
        `${matrix.length} records · ${generatedAt}`,
        '',
        buildDelimited(matrix, columns.map((c) => c.label), '\t', includeHeaders),
      ]
        .filter(Boolean)
        .join('\n');
      break;
    case 'pdf': {
      const pdf = buildPdf(matrix, columns, {
        title: options.title ?? 'Export',
        subtitle: options.subtitle,
        headerLines: options.headerLines,
        footerText: options.footerText,
        docNumber: options.docNumber,
        pageSize: options.pageSize ?? 'a4',
        orientation: options.orientation ?? (columns.length > 6 ? 'landscape' : 'portrait'),
      });
      content = pdf.bytes;
      if (pdf.lossy) {
        warnings.push(
          'Some characters (for example Arabic script) cannot be embedded by the built-in PDF writer. Use Print → Save as PDF for full script coverage.',
        );
      }
      break;
    }
    default:
      throw new Error(`Unsupported export format: ${String(format)}`);
  }

  const bytes = typeof content === 'string' ? byteLength(content) : content.length;
  return {
    filename,
    mime: meta.mime,
    content,
    bytes,
    rows: limited.length,
    columns: columns.length,
    format,
    warnings,
    generatedAt,
  };
}

/** Trigger a browser download for an artifact (no-op safe outside a browser). */
export function downloadArtifact(artifact: ExportArtifact): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return false;
  const blob = new Blob([artifact.content as BlobPart], { type: artifact.mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = artifact.filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

export function artifactToDataUrl(artifact: ExportArtifact): string {
  if (typeof artifact.content === 'string') {
    return `data:${artifact.mime};charset=utf-8,${encodeURIComponent(artifact.content)}`;
  }
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < artifact.content.length; i += chunk) {
    binary += String.fromCharCode(...artifact.content.subarray(i, i + chunk));
  }
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(artifact.content).toString('base64');
  return `data:${artifact.mime};base64,${base64}`;
}
