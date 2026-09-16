import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportData, formatCellValue, escapeXml, buildHtmlTable, FORMAT_META, type ExportColumn } from './exporters';
import { createZip, readZip } from './zip';
import { buildPrintDocument, DEFAULT_PRINT_CONFIG, nextDocumentNumber } from '../print';

const columns: ExportColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'importance', label: 'Importance', format: 'percent' },
  { key: 'date_entry', label: 'Entry Date', format: 'date' },
];

const rows = [
  { id: 's1', name: 'Reuters, Ltd.', importance: 0.95, date_entry: '2025-01-01T00:00:00.000Z', note: 'line1\nline2' },
  { id: 's2', name: 'Al "Jazeera"', importance: 0.4, date_entry: '2025-02-03', note: '' },
];

test('csv follows RFC 4180 quoting and can carry a BOM', () => {
  const artifact = exportData(rows, { columns, format: 'csv', filename: 'sources', bom: true });
  const text = String(artifact.content);
  assert.ok(text.startsWith('\uFEFF'), 'BOM present for Excel');
  const lines = text.replace(/^\uFEFF/, '').split('\r\n');
  assert.equal(lines[0], 'ID,Name,Importance,Entry Date');
  assert.equal(lines[1], 's1,"Reuters, Ltd.",95.00%,2025-01-01');
  assert.equal(lines[2], 's2,"Al ""Jazeera""",40.00%,2025-02-03');
  assert.equal(artifact.filename, 'sources.csv');
  assert.equal(artifact.rows, 2);
});

test('multiline cells stay inside one csv field', () => {
  const artifact = exportData(rows, {
    columns: [{ key: 'note', label: 'Note' }],
    format: 'csv',
  });
  const text = String(artifact.content);
  assert.match(text, /"line1\r?\nline2"|line1\nline2/);
  assert.equal(text.split('\r\n').length, 3);
});

test('tsv, json, jsonl, xml and markdown outputs are well formed', () => {
  const tsv = exportData(rows, { columns, format: 'tsv' });
  assert.equal(String(tsv.content).split('\r\n')[1].split('\t')[1], 'Reuters, Ltd.');

  const json = exportData(rows, { columns, format: 'json' });
  const parsed = JSON.parse(String(json.content)) as { name: string }[];
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].name, 'Reuters, Ltd.');

  const jsonl = exportData(rows, { columns, format: 'jsonl' });
  assert.equal(String(jsonl.content).split('\n').length, 2);

  const xml = exportData(rows, { columns, format: 'xml', title: 'Sources' });
  const xmlText = String(xml.content);
  assert.match(xmlText, /<\?xml version="1\.0"/);
  assert.match(xmlText, /<name>Al &quot;Jazeera&quot;<\/name>/);
  assert.equal((xmlText.match(/<record>/g) ?? []).length, 2);

  const md = exportData(rows, { columns, format: 'markdown', title: 'Sources' });
  assert.match(String(md.content), /# Sources/);
  assert.match(String(md.content), /\| ID \| Name \| Importance \| Entry Date \|/);
});

test('xml escaping rejects control characters', () => {
  assert.equal(escapeXml('a<b>&"c"\u0001'), 'a&lt;b&gt;&amp;&quot;c&quot;');
});

test('xlsx is a real OOXML package with a worksheet and inline strings', () => {
  const artifact = exportData(rows, { columns, format: 'xlsx', sheetName: 'Sources' });
  assert.ok(artifact.content instanceof Uint8Array);
  const entries = readZip(artifact.content);
  const names = entries.map((e) => e.name);
  assert.ok(names.includes('[Content_Types].xml'), names.join(','));
  assert.ok(names.includes('xl/workbook.xml'));
  assert.ok(names.includes('xl/worksheets/sheet1.xml'));
  const sheet = new TextDecoder().decode(entries.find((e) => e.name === 'xl/worksheets/sheet1.xml')!.data);
  assert.match(sheet, /<c r="B1" t="inlineStr" s="1"><is><t xml:space="preserve">Name<\/t><\/is><\/c>/);
  assert.match(sheet, /<c r="B2" t="inlineStr"><is><t xml:space="preserve">Reuters, Ltd\.<\/t><\/is><\/c>/);
  assert.match(sheet, /<autoFilter/);
  // zip starts with the local file header signature
  assert.equal(artifact.content[0], 0x50);
  assert.equal(artifact.content[1], 0x4b);
});

test('docx is a real OOXML document', () => {
  const artifact = exportData(rows, { columns, format: 'docx', title: 'Source list' });
  const entries = readZip(artifact.content as Uint8Array);
  const names = entries.map((e) => e.name);
  assert.ok(names.includes('word/document.xml'), names.join(','));
  const doc = new TextDecoder().decode(entries.find((e) => e.name === 'word/document.xml')!.data);
  assert.match(doc, /<w:tbl>/);
  assert.match(doc, /Source list/);
  assert.equal((doc.match(/<w:tr>/g) ?? []).length, 3); // header + 2 rows
});

test('xls SpreadsheetML and doc HTML declare their applications', () => {
  const xls = exportData(rows, { columns, format: 'xls' });
  assert.match(String(xls.content), /<\?mso-application progid="Excel.Sheet"\?>/);
  const doc = exportData(rows, { columns, format: 'doc' });
  assert.match(String(doc.content), /mso 9/);
  assert.match(String(doc.content), /<table>/);
});

test('pdf export builds a paginated document and warns about non-Latin glyphs', () => {
  const artifact = exportData(rows, { columns, format: 'pdf', title: 'Sources', orientation: 'landscape' });
  const bytes = artifact.content as Uint8Array;
  const head = new TextDecoder().decode(bytes.subarray(0, 8));
  assert.equal(head.slice(0, 5), '%PDF-');
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /\/Type \/Catalog/);
  assert.match(text, /%%EOF\s*$/);
  assert.match(text, /Page 1 of 1/);
  assert.equal(artifact.warnings.length, 0);

  const arabic = exportData([{ name: 'مصدر عربي' }], {
    columns: [{ key: 'name', label: 'Name' }],
    format: 'pdf',
  });
  assert.ok(arabic.warnings[0]?.includes('Arabic'), arabic.warnings.join('|'));
});

test('pdf paginates large tables across pages', () => {
  const many = Array.from({ length: 200 }, (_, i) => ({ id: `r${i}`, name: `Row ${i}`, importance: 0.5, date_entry: '2025-01-01' }));
  const artifact = exportData(many, { columns, format: 'pdf' });
  const text = new TextDecoder().decode(artifact.content as Uint8Array);
  const pageMatches = text.match(/\/Type \/Page[^s]/g) ?? [];
  assert.ok(pageMatches.length > 3, `expected several pages, got ${pageMatches.length}`);
  assert.match(text, /Page 1 of \d+/);
});

test('html export renders header lines, counts and styling', () => {
  const html = buildHtmlTable(
    [['s1', 'Reuters', '95.00%', '2025-01-01']],
    columns,
    { title: 'Sources', headerLines: ['Ministry of Research', 'Department A'], docNumber: 'DOC-1', generatedAt: '2025-01-01' },
  );
  assert.match(html, /Ministry of Research/);
  assert.match(html, /DOC-1/);
  assert.match(html, /1 records/);
  assert.match(html, /<th>Importance<\/th>/);
});

test('formatCellValue handles percent, dates and numbers', () => {
  assert.equal(formatCellValue(0.85, 'percent'), '85.00%');
  assert.equal(formatCellValue(0.855, 'percent'), '85.50%');
  assert.equal(formatCellValue('2025-03-04T10:00:00.000Z', 'date'), '2025-03-04');
  assert.equal(formatCellValue('2025-03-04T10:20:00.000Z', 'datetime'), '2025-03-04 10:20');
  assert.equal(formatCellValue(null), '');
  assert.equal(formatCellValue(1.234567), '1.234567');
});

test('zip round-trips entries with UTF-8 names', () => {
  const bytes = createZip([
    { name: 'a.txt', data: 'hello' },
    { name: 'مجلد/ب.txt', data: 'مرحبا' },
  ]);
  const entries = readZip(bytes);
  assert.deepEqual(entries.map((e) => e.name), ['a.txt', 'مجلد/ب.txt']);
  assert.equal(new TextDecoder().decode(entries[1].data), 'مرحبا');
});

test('print document honours header settings and document numbering', () => {
  const config = { ...DEFAULT_PRINT_CONFIG, header1: 'Ministry', header2: 'Dept', docNumberPrefix: 'REP', docNumberSequence: 7, includePageNumbers: true };
  const html = buildPrintDocument({ columns, rows, config, title: 'Source register' });
  assert.match(html, /Ministry/);
  assert.match(html, /Source register/);
  assert.match(html, /2 records/);
  assert.match(html, /REP-\d{8}-007/);
  assert.match(html, /counter\(pages\)/);
  assert.match(html, /@page \{ size: A4 landscape/);
  assert.match(nextDocumentNumber({ ...config, docNumberManual: 'MANUAL-1' }), /^MANUAL-1$/);
});

test('format metadata covers every advertised format', () => {
  for (const format of ['csv', 'tsv', 'json', 'jsonl', 'xml', 'html', 'markdown', 'xlsx', 'xls', 'docx', 'doc', 'pdf', 'txt'] as const) {
    const artifact = exportData(rows, { columns, format });
    assert.equal(artifact.format, format);
    assert.ok(artifact.bytes > 0, format);
    assert.equal(artifact.filename.endsWith(`.${FORMAT_META[format].ext}`), true, format);
  }
});

test('maxRows caps the export size', () => {
  const artifact = exportData(rows, { columns, format: 'csv', maxRows: 1 });
  assert.equal(artifact.rows, 1);
  assert.equal(String(artifact.content).split('\r\n').length, 2);
});
