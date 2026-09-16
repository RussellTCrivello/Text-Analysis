/**
 * Import parsing: CSV/TSV (RFC 4180), JSON, JSON Lines, XML and XLSX.
 * Parsers are deterministic and pure so they can be unit-tested and reused.
 */
import { readZip } from '../export/zip';
import type { Row } from '../repository';

export type ImportFileFormat = 'csv' | 'tsv' | 'json' | 'jsonl' | 'xml' | 'xlsx';

export interface ParsedTable {
  headers: string[];
  rows: Row[];
  format: ImportFileFormat;
  /** Rows that could not be parsed, with their line numbers. */
  problems: { line: number; message: string }[];
}

export function detectFormat(filename: string, sample: string): ImportFileFormat {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) return 'xlsx';
  if (lower.endsWith('.tsv') || lower.endsWith('.txt')) {
    const firstLine = sample.split(/\r?\n/)[0] ?? '';
    if (firstLine.includes('\t') && !firstLine.includes(',')) return 'tsv';
    return 'csv';
  }
  if (lower.endsWith('.json')) {
    return sample.trimStart().startsWith('[') ? 'json' : 'jsonl';
  }
  if (lower.endsWith('.jsonl') || lower.endsWith('.ndjson')) return 'jsonl';
  if (lower.endsWith('.xml')) return 'xml';
  const trimmed = sample.trimStart();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return 'json';
  if (trimmed.startsWith('<')) return 'xml';
  const firstLine = trimmed.split(/\r?\n/)[0] ?? '';
  if (firstLine.includes('\t') && (firstLine.match(/\t/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)) return 'tsv';
  return 'csv';
}

/** RFC 4180 CSV/TSV parser with quote, embedded-newline and BOM handling. */
export function parseDelimited(text: string, delimiter = ','): ParsedTable {
  const clean = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  let line = 1;
  const problems: { line: number; message: string }[] = [];

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      if (field.trim() !== '') problems.push({ line, message: 'Quote inside unquoted field' });
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      record.push(field);
      field = '';
      continue;
    }
    if (ch === '\n') {
      record.push(field);
      rows.push(record);
      record = [];
      field = '';
      line++;
      continue;
    }
    if (ch === '\r') continue;
    field += ch;
  }
  if (field !== '' || record.length) {
    record.push(field);
    rows.push(record);
  }

  const table = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!table.length) return { headers: [], rows: [], format: delimiter === '\t' ? 'tsv' : 'csv', problems };

  const headers = table[0].map((h, i) => h.trim() || `column_${i + 1}`);
  const out: Row[] = [];
  table.slice(1).forEach((r, idx) => {
    const obj: Row = {};
    headers.forEach((h, i) => {
      obj[h] = (r[i] ?? '').trim();
    });
    if (Object.values(obj).some((v) => String(v).trim() !== '')) out.push(obj);
    else problems.push({ line: idx + 2, message: 'Empty row skipped' });
  });

  return { headers, rows: out, format: delimiter === '\t' ? 'tsv' : 'csv', problems };
}

export function parseJson(text: string): ParsedTable {
  const data = JSON.parse(text);
  const array = Array.isArray(data) ? data : Array.isArray((data as { records?: unknown[] }).records) ? (data as { records: unknown[] }).records : [data];
  return rowsFromObjects(array as Row[], 'json');
}

export function parseJsonLines(text: string): ParsedTable {
  const rows: Row[] = [];
  const problems: { line: number; message: string }[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      rows.push(JSON.parse(trimmed) as Row);
    } catch (err) {
      problems.push({ line: i + 1, message: `Invalid JSON: ${String(err)}` });
    }
  });
  return rowsFromObjects(rows, 'jsonl', problems);
}

export function parseXml(text: string): ParsedTable {
  // Minimal, dependency-free XML reader: enough for <records><record>… flat exports.
  const problems: { line: number; message: string }[] = [];
  const rowPattern = /<record\b[^>]*>([\s\S]*?)<\/record>/gi;
  const fieldPattern = /<([\w:.-]+)\b[^>]*>([\s\S]*?)<\/\1>/g;
  const rows: Row[] = [];
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = rowPattern.exec(text))) {
    index++;
    const inner = match[1];
    const row: Row = {};
    fieldPattern.lastIndex = 0;
    let field: RegExpExecArray | null;
    while ((field = fieldPattern.exec(inner))) {
      row[field[1]] = decodeEntities(field[2]).trim();
    }
    if (Object.keys(row).length) rows.push(row);
    else problems.push({ line: index, message: 'Record element had no fields' });
  }

  if (!rows.length) {
    // Fall back: treat any repeated element as a row.
    const anyPattern = /<(\w+)\b[^>]*>([\s\S]*?)<\/\1>/g;
    const groups = new Map<string, string[]>();
    let m2: RegExpExecArray | null;
    while ((m2 = anyPattern.exec(text))) {
      const list = groups.get(m2[1]) ?? [];
      list.push(m2[2]);
      groups.set(m2[1], list);
    }
    const repeated = [...groups.entries()].filter(([, v]) => v.length > 1);
    if (repeated.length) problems.push({ line: 1, message: `No <record> elements found; saw repeated <${repeated[0][0]}> elements instead` });
  }

  return rowsFromObjects(rows, 'xml', problems);
}

export function parseXlsxBytes(bytes: Uint8Array): ParsedTable {
  const entries = readZip(bytes);
  const decode = (name: string) => new TextDecoder().decode(entries.find((e) => e.name === name)?.data ?? new Uint8Array());

  const shared = decode('xl/sharedStrings.xml');
  const sharedStrings: string[] = [];
  if (shared) {
    const siPattern = /<si>([\s\S]*?)<\/si>/g;
    let m: RegExpExecArray | null;
    while ((m = siPattern.exec(shared))) {
      const text = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decodeEntities(t[1])).join('');
      sharedStrings.push(text);
    }
  }

  const sheetNames = entries.filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name)).map((e) => e.name).sort();
  if (!sheetNames.length) throw new Error('No worksheets found in the workbook');
  const sheet = new TextDecoder().decode(entries.find((e) => e.name === sheetNames[0])?.data ?? new Uint8Array());

  const rowPattern = /<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  const cellPattern = /<c\b[^>]*r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>|<c\b[^>]*r="([A-Z]+)\d+"([^>]*)\/>/g;
  const rows: string[][] = [];
  let maxCol = 0;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowPattern.exec(sheet))) {
    const rowIndex = parseInt(rowMatch[1], 10);
    const cells: string[] = [];
    cellPattern.lastIndex = 0;
    let cell: RegExpExecArray | null;
    while ((cell = cellPattern.exec(rowMatch[2]))) {
      const ref = cell[1] ?? cell[4];
      const attrs = cell[2] ?? cell[5] ?? '';
      const inner = cell[3] ?? '';
      const colIndex = columnToIndex(ref);
      maxCol = Math.max(maxCol, colIndex);
      let value = '';
      if (/t="inlineStr"/.test(attrs)) {
        value = [...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decodeEntities(t[1])).join('');
      } else if (/t="s"/.test(attrs)) {
        const vMatch = /<v>([\s\S]*?)<\/v>/.exec(inner);
        value = vMatch ? (sharedStrings[parseInt(vMatch[1], 10)] ?? '') : '';
      } else {
        const vMatch = /<v>([\s\S]*?)<\/v>/.exec(inner);
        value = vMatch ? decodeEntities(vMatch[1]) : '';
      }
      cells[colIndex] = value;
    }
    rows[rowIndex - 1] = cells;
  }

  const compact = rows.filter((r) => r && r.some((c) => (c ?? '').trim() !== ''));
  if (!compact.length) return { headers: [], rows: [], format: 'xlsx', problems: [{ line: 0, message: 'Worksheet is empty' }] };
  const headers = (compact[0] ?? []).map((h, i) => (h ?? '').trim() || `column_${i + 1}`);
  const out: Row[] = compact.slice(1).map((r) => {
    const obj: Row = {};
    for (let i = 0; i <= maxCol; i++) obj[headers[i] ?? `column_${i + 1}`] = (r[i] ?? '').trim();
    return obj;
  });
  return { headers, rows: out, format: 'xlsx', problems: [] };
}

function columnToIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function rowsFromObjects(objects: Row[], format: ImportFileFormat, problems: { line: number; message: string }[] = []): ParsedTable {
  const headers: string[] = [];
  for (const obj of objects) {
    for (const key of Object.keys(obj ?? {})) if (!headers.includes(key)) headers.push(key);
  }
  const rows = objects.filter((o) => o && typeof o === 'object').map((o) => {
    const row: Row = {};
    for (const h of headers) {
      const v = (o as Row)[h];
      row[h] = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : v;
    }
    return row;
  });
  return { headers, rows, format, problems };
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&');
}
