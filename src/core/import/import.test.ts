import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectFormat, parseDelimited, parseJson, parseJsonLines, parseXml, parseXlsxBytes } from './parse';
import { autoMap, planImport, describePlan, sniffDelimiter, importanceLooksLikePercent } from './pipeline';
import { exportData } from '../export/exporters';
import { MemoryStorage } from '../persist';
import { Repository } from '../repository';

const CSV = `Name,Type,Link,Importance,Country,City
Reuters,website,https://reuters.com,0.95,UK,London
Al Jazeera,website,https://aljazeera.net,78,Qatar,Doha
,website,,0.5,,
Broken Row,website,not-a-url,2.0,Peru,Lima`;

test('detects file formats from name and content', () => {
  assert.equal(detectFormat('data.xlsx', ''), 'xlsx');
  assert.equal(detectFormat('data.csv', CSV), 'csv');
  assert.equal(detectFormat('data.tsv', 'a\tb\tc'), 'tsv');
  assert.equal(detectFormat('data.json', '[{"a":1}]'), 'json');
  assert.equal(detectFormat('data.json', '{"a":1}'), 'jsonl');
  assert.equal(detectFormat('data.xml', '<records/>'), 'xml');
  assert.equal(detectFormat('unknown.txt', 'a\tb\tc'), 'tsv');
  assert.equal(detectFormat('unknown', 'a,b,c'), 'csv');
});

test('parses RFC 4180 csv with quotes, embedded newlines and BOM', () => {
  const parsed = parseDelimited('\uFEFFa,b\n1,"x,y"\n2,"line1\nline2"\n');
  assert.deepEqual(parsed.headers, ['a', 'b']);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].b, 'x,y');
  assert.equal(parsed.rows[1].b, 'line1\nline2');
  assert.equal(parsed.problems.length, 0);
});

test('parses tab separated values', () => {
  const parsed = parseDelimited('name\tcountry\nReuters\tUK\n', '\t');
  assert.equal(parsed.format, 'tsv');
  assert.equal(parsed.rows[0].country, 'UK');
});

test('parses json, json lines and xml exports', () => {
  const json = parseJson('[{"name":"A","type":"blog"},{"name":"B","type":"news"}]');
  assert.deepEqual(json.headers, ['name', 'type']);
  assert.equal(json.rows.length, 2);

  const wrapped = parseJson('{"records":[{"name":"A"}]}');
  assert.equal(wrapped.rows.length, 1);

  const jsonl = parseJsonLines('{"name":"A"}\nnot json\n{"name":"B"}\n');
  assert.equal(jsonl.rows.length, 2);
  assert.equal(jsonl.problems.length, 1);

  const xml = parseXml(
    `<?xml version="1.0"?><records><record><name>Reuters</name><country>UK</country></record><record><name>Al Jazeera &amp; Co</name><country>Qatar</country></record></records>`,
  );
  assert.deepEqual(xml.headers, ['name', 'country']);
  assert.equal(xml.rows[1].name, 'Al Jazeera & Co');
});

test('maps headers to schema fields using aliases and fuzzy matching', () => {
  const parsed = parseDelimited(CSV);
  const mapping = autoMap(parsed.headers, parsed, 'sources');
  const byHeader = Object.fromEntries(mapping.map((m) => [m.header, m.field]));
  assert.equal(byHeader['Name'], 'name');
  assert.equal(byHeader['Type'], 'type');
  assert.equal(byHeader['Link'], 'link_sources');
  assert.equal(byHeader['Importance'], 'importance');
  assert.equal(byHeader['Country'], 'country');
  assert.equal(byHeader['City'], 'city');
  assert.ok(mapping.every((m) => m.confidence > 0));

  const odd = autoMap(['Source Name', 'Src', 'Whatever'], { headers: ['Source Name', 'Src', 'Whatever'], rows: [], format: 'csv', problems: [] }, 'contents');
  assert.equal(odd[0].field, 'sources_id');
  assert.equal(odd[1].field, null, 'a second column for the same field stays unmapped (no duplicate targets)');
  assert.equal(odd[2].field, null, 'unrecognised headers are left unmapped');
});

test('plan validates rows, normalises importance and reports per-row problems', () => {
  const repo = new Repository(new MemoryStorage(), 'i.data', 'i.audit');
  const parsed = parseDelimited(CSV);
  const mapping = autoMap(parsed.headers, parsed, 'sources');
  const plan = planImport(parsed, mapping, 'sources', {
    existing: [],
    parents: { sources: [], contents: [], analyses: [] },
    resolveRef: () => null,
  });

  assert.equal(plan.total, 4, describePlan(plan));
  assert.equal(plan.ok, 1, describePlan(plan));
  assert.equal(plan.warnings, 1, describePlan(plan));
  assert.equal(plan.errors, 2, describePlan(plan));

  const first = plan.rows[0];
  assert.equal(first.status, 'ok');
  assert.equal(first.values.importance, 0.95);

  const second = plan.rows[1];
  assert.equal(second.values.importance, 0.78, '78 is read as 78% and stored as 0.78');
  assert.equal(second.status, 'warning');
  assert.ok(second.issues.some((i) => i.level === 'warning' && i.code === 'range'));

  const empty = plan.rows[2];
  assert.equal(empty.status, 'error');
  assert.ok(empty.issues.some((i) => i.field === 'name' && i.code === 'required'));
  assert.ok(empty.issues.some((i) => i.field === 'country' && i.code === 'required'));

  const broken = plan.rows[3];
  assert.equal(broken.status, 'error');
  assert.ok(broken.issues.some((i) => i.field === 'link_sources' && i.code === 'url'));
  assert.equal(broken.values.importance, 0.02, '2.0 is read as 2% under the documented percent rule');
  assert.equal(plan.accepted.length, 2);
  assert.equal(plan.unmapped.length, 0);
});

test('plan resolves parent references by name and rejects unknown ones', () => {
  const repo = new Repository(new MemoryStorage(), 'i2.data', 'i2.audit');
  repo.insert('sources', { name: 'Reuters', type: 'website', country: 'UK', link_sources: 'https://r.example' });

  const parsed = parseDelimited('Source,Title,Content\nReuters,Border report,Tensions rose.\nUnknown Outlet,Other,Text here.\n');
  const mapping = autoMap(parsed.headers, parsed, 'contents');
  const plan = planImport(parsed, mapping, 'contents', {
    existing: repo.list('contents'),
    parents: { sources: repo.list('sources'), contents: repo.list('contents'), analyses: repo.list('analyses') },
    resolveRef: (entity, value) => repo.resolveRef(entity, value),
  });

  assert.equal(plan.rows[0].status, 'ok');
  assert.equal(plan.rows[0].values.sources_id, repo.list('sources')[0].id);
  assert.equal(plan.rows[1].status, 'error');
  assert.ok(plan.rows[1].issues.some((i) => i.code === 'unknownRef'));

  const applied = repo.insertMany('contents', plan.accepted, { validate: false, summary: 'Imported contents' });
  assert.equal(applied.inserted, 1);
  assert.equal(repo.count('contents'), 1);
});

test('sniffs delimiters and flags percent-scaled importance columns', () => {
  assert.equal(sniffDelimiter('a;b;c\n1;2;3'), ';');
  assert.equal(sniffDelimiter('a\tb\n1\t2'), '\t');
  assert.equal(sniffDelimiter('a,b\n1,2'), ',');
  assert.equal(importanceLooksLikePercent(['0.5', '80']), true);
  assert.equal(importanceLooksLikePercent(['0.5', '0.8']), false);
});

test('re-imports an exported xlsx workbook (round trip)', async () => {
  const rows = [
    { name: 'Reuters', type: 'website', link_sources: 'https://reuters.com', importance: 0.95, country: 'UK', city: 'London' },
    { name: 'Al Jazeera', type: 'website', link_sources: 'https://aljazeera.net', importance: 0.78, country: 'Qatar', city: 'Doha' },
  ];
  const artifact = exportData(rows, {
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'type', label: 'Type' },
      { key: 'link_sources', label: 'Link' },
      { key: 'importance', label: 'Importance' },
      { key: 'country', label: 'Country' },
      { key: 'city', label: 'City' },
    ],
    format: 'xlsx',
    filename: 'roundtrip',
  });

  const parsed = await parseXlsxBytes(artifact.content as Uint8Array);
  assert.deepEqual(parsed.headers, ['Name', 'Type', 'Link', 'Importance', 'Country', 'City']);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].Name, 'Reuters');
  assert.equal(Number(parsed.rows[1].Importance), 0.78);

  const mapping = autoMap(parsed.headers, parsed, 'sources');
  const repo = new Repository(new MemoryStorage(), 'rt.data', 'rt.audit');
  const plan = planImport(parsed, mapping, 'sources', {
    existing: [],
    parents: { sources: [], contents: [], analyses: [] },
    resolveRef: () => null,
  });
  assert.equal(plan.ok, 2, JSON.stringify(plan.rows.map((r) => r.issues)));
  assert.equal(repo.insertMany('sources', plan.accepted, { validate: false }).inserted, 2);
});

test('xlsx import also reads DEFLATE zips (as written by real Office)', async () => {
  const { crc32 } = await import('../text');
  const rows = [{ name: 'Reuters', type: 'website', link_sources: '', importance: 0.9, country: 'UK', city: 'London' }];
  const artifact = exportData(rows, {
    columns: [{ key: 'name', label: 'Name' }, { key: 'type', label: 'Type' }, { key: 'link_sources', label: 'Link' }, { key: 'importance', label: 'Importance' }, { key: 'country', label: 'Country' }, { key: 'city', label: 'City' }],
    format: 'xlsx',
    filename: 'deflate-rt',
  });
  const { readZip } = await import('../export/zip');
  const store = readZip(artifact.content as Uint8Array);

  // Re-package every entry with DEFLATE (method 8), like Excel/Word would.
  const encode = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of store) {
    const comp = new Blob([entry.data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const deflated = new Uint8Array(await new Response(comp).arrayBuffer());
    const nameBytes = encode.encode(entry.name);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 8, true); // deflate
    lv.setUint32(14, crc, true);
    lv.setUint32(18, deflated.length, true);
    lv.setUint32(22, entry.data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    parts.push(local, deflated);
    const dir = new Uint8Array(46 + nameBytes.length);
    const dv = new DataView(dir.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint16(8, 0x0800, true);
    dv.setUint16(10, 8, true);
    dv.setUint32(16, crc, true);
    dv.setUint32(20, deflated.length, true);
    dv.setUint32(24, entry.data.length, true);
    dv.setUint16(28, nameBytes.length, true);
    dv.setUint32(42, offset, true);
    dir.set(nameBytes, 46);
    central.push(dir);
    offset += local.length + deflated.length;
  }
  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, store.length, true);
  ev.setUint16(10, store.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const deflatedZip = new Uint8Array(offset + centralSize + 22);
  let at = 0;
  for (const c of [...parts, ...central, end]) { deflatedZip.set(c, at); at += c.length; }

  const parsed = await parseXlsxBytes(deflatedZip);
  assert.ok(parsed.headers.includes('Name'));
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].Name, 'Reuters');
});

test('parseXlsxBytes rejects non-workbook OOXML with a clear message', async () => {
  const artifact = exportData([{ name: 'x' }], { columns: [{ key: 'name', label: 'Name' }], format: 'docx', filename: 'doc' });
  await assert.rejects(
    () => parseXlsxBytes(artifact.content as Uint8Array),
    /not an Excel workbook/,
  );
});

test('validation messages are field-key-free (the UI supplies translated labels)', () => {
  const repo = new Repository(new MemoryStorage(), 'm.data', 'm.audit');
  void repo;
  const plan = planImport(
    { headers: ['Name'], rows: [{ Name: '' }], format: 'csv', problems: [] },
    [{ header: 'Name', field: 'name', confidence: 1, suggestions: [], sample: '' }],
    'sources',
    { existing: [], parents: { sources: [], contents: [], analyses: [] }, resolveRef: () => null },
  );
  const issue = plan.rows[0].issues.find((i) => i.code === 'required');
  assert.ok(issue, 'expected a required issue');
  assert.equal(issue.message, 'is required', 'message must not embed the raw field key');
  assert.equal(issue.field, 'name');
});

test('ref columns accept names: resolved for storage, file text kept for the preview', () => {
  const repo = new Repository(new MemoryStorage(), 'rn.data', 'rn.audit');
  repo.insertMany('sources', [{ id: 'src-reuters', name: 'Reuters', type: 'website' }], { validate: false });
  const parsed = {
    headers: ['Title', 'Body', 'Source'],
    rows: [{ Title: 'Investigation piece', Body: 'The full text of the article goes here.', Source: 'reuters' }],
    format: 'csv' as const,
    problems: [],
  };
  const mapping = [
    { header: 'Title', field: 'title', confidence: 1, suggestions: [], sample: 'Investigation piece' },
    { header: 'Body', field: 'content_data', confidence: 1, suggestions: [], sample: 'The full text…' },
    { header: 'Source', field: 'sources_id', confidence: 1, suggestions: [], sample: 'reuters' },
  ];
  const plan = planImport(parsed, mapping, 'contents', {
    existing: repo.list('contents'),
    parents: { sources: repo.list('sources'), contents: [], analyses: [] },
    resolveRef: (e, v) => repo.resolveRef(e, v),
  });
  assert.equal(plan.errors, 0, JSON.stringify(plan.rows[0].issues));
  assert.equal(plan.rows[0].values.sources_id, 'src-reuters', 'stored value is the parent id');
  assert.equal(plan.rows[0].raw.sources_id, 'reuters', 'the preview keeps what the file actually said');
});
