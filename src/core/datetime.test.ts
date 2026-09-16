import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatDateTime, fromDateTimeLocal, nowIso, parseDate, toDateTimeLocal } from './text';
import { applyDateFilter } from './search';
import { buildTimeline, filterTimeline } from './timeline';
import { MemoryAttachmentStore, describeProvenance, groupByRecord } from './attachments';
import type { AppData } from './repository';

describe('date-time values', () => {
  it('round-trips a local date-time through the input helpers', () => {
    const iso = fromDateTimeLocal('2024-03-05T14:30') as string;
    assert.ok(iso);
    assert.equal(toDateTimeLocal(iso), '2024-03-05T14:30');
  });

  it('keeps the time component when parsing and formatting', () => {
    const iso = parseDate('2024-03-05T14:30') as string;
    assert.ok(iso.includes('T14:30'));
    assert.equal(formatDateTime(iso), '2024-03-05 14:30');
  });

  it('treats a bare date as midnight so older records still display', () => {
    assert.equal(formatDateTime('2024-03-05'), '2024-03-05 00:00');
  });

  it('produces a full instant for "now"', () => {
    const value = nowIso();
    assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    assert.equal(toDateTimeLocal(value).length, 16);
  });
});

describe('date-time range filters', () => {
  const rows = [
    { id: 'a', date_entry: '2024-03-05T08:00:00.000Z' },
    { id: 'b', date_entry: '2024-03-05T18:30:00.000Z' },
    { id: 'c', date_entry: '2024-03-06T09:00:00.000Z' },
    { id: 'd', date_entry: '' },
  ];

  it('accepts a full date-time bound and excludes earlier rows', () => {
    const from = fromDateTimeLocal('2024-03-05T12:00') as string;
    const filtered = applyDateFilter(rows, from, null, ['date_entry']);
    assert.deepEqual(
      filtered.map((r) => r.id).sort(),
      ['b', 'c', 'd'],
    );
  });

  it('still expands a bare date bound to the whole day', () => {
    const filtered = applyDateFilter(rows, '2024-03-05', '2024-03-05', ['date_entry']);
    assert.deepEqual(
      filtered.map((r) => r.id).sort(),
      ['a', 'b', 'd'],
    );
  });

  it('applies the same bounds on the timeline', () => {
    const data: AppData = {
      sources: [
        { id: 's1', name: 'Morning', date_entry: '2024-03-05T08:00:00.000Z' },
        { id: 's2', name: 'Evening', date_entry: '2024-03-05T20:00:00.000Z' },
      ] as unknown as AppData['sources'],
      contents: [],
      analyses: [],
    };
    const events = buildTimeline(data);
    assert.equal(events.length, 2);
    const from = fromDateTimeLocal('2024-03-05T12:00') as string;
    const filtered = filterTimeline(events, { from });
    assert.deepEqual(filtered.map((e) => e.title), ['Evening']);
  });
});

describe('attachment provenance', () => {
  it('records where a file came from and which record it belongs to', async () => {
    const store = new MemoryAttachmentStore();
    const meta = await store.put('ct_1', {
      name: 'report.pdf',
      mime: 'application/pdf',
      data: 'bytes',
      recordType: 'content',
      recordTitle: 'Border incident summary',
      sourceId: 'src_1',
      sourceName: 'Field office',
      origin: 'file',
      sourceUrl: '/inbox/report.pdf',
      note: 'Scanned copy',
    });
    assert.equal(meta.recordTitle, 'Border incident summary');
    assert.equal(meta.sourceName, 'Field office');
    assert.equal(meta.origin, 'file');
    assert.equal(meta.sourceUrl, '/inbox/report.pdf');
    assert.equal(describeProvenance(meta), 'file from /inbox/report.pdf → Border incident summary');
  });

  it('edits provenance without touching the stored bytes', async () => {
    const store = new MemoryAttachmentStore();
    const meta = await store.put('ct_1', { name: 'a.txt', mime: 'text/plain', data: 'hello' });
    const updated = await store.update(meta.id, { note: 'Original from archive' });
    assert.equal(updated?.note, 'Original from archive');
    const fetched = await store.get(meta.id);
    assert.equal(await fetched?.blob.text(), 'hello');
  });

  it('groups attachments by the record they are linked to', async () => {
    const store = new MemoryAttachmentStore();
    await store.put('ct_1', { name: 'a.txt', mime: 'text/plain', data: 'a', recordTitle: 'First' });
    await store.put('ct_1', { name: 'b.txt', mime: 'text/plain', data: 'b', recordTitle: 'First' });
    await store.put('ct_2', { name: 'c.txt', mime: 'text/plain', data: 'c', recordTitle: 'Second' });
    const groups = groupByRecord(await store.list());
    assert.deepEqual(groups.map((g) => [g.recordId, g.items.length]), [
      ['ct_1', 2],
      ['ct_2', 1],
    ]);
  });
});
