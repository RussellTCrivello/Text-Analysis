import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, filterTimeline, sortTimeline, summarizeTimeline, timelineSeries, timelineStats, timelineFacets, paginateEvents } from './timeline';
import { freeTextSearch, applyColumnFilters, applyDateFilter, runAdvancedSearch, conditionsToSql, evaluateCondition, LocalSavedSearchStore, type SearchCondition } from './search';
import { computeEntityStats, computeWorkspaceStats, frequencyByPeriod, bucket, compareRecords } from './stats';
import { createBackup, verifyBackup, mergeData, diffData, describeDiff, checksumData, referentialProblems } from './backup';
import { MemoryAttachmentStore, describeAttachments } from './attachments';
import { MemoryStorage } from './persist';
import { Repository, type AppData } from './repository';
import { SqlEngine, buildDatabase } from './sql/engine';

function dataset(): AppData {
  return {
    sources: [
      { id: 's1', name: 'Reuters', type: 'website', importance: 0.9, country: 'UK', city: 'London', description: 'Wire service', date_entry: '2025-01-05', date_creation: '2025-01-05T00:00:00.000Z', date_modified: '' },
      { id: 's2', name: 'Al Jazeera', type: 'website', importance: 0.7, country: 'Qatar', city: 'Doha', description: '', date_entry: '2025-02-10', date_creation: '2025-02-10T00:00:00.000Z', date_modified: '' },
      { id: 's3', name: 'Field Analyst', type: 'person', importance: 0.4, country: 'Syria', city: 'Damascus', description: '', date_entry: '', date_creation: '2025-03-01T00:00:00.000Z', date_modified: '' },
    ],
    contents: [
      { id: 'c1', sources_id: 's1', title: 'Border report', content_data: 'Tensions rose along the northern border.', importance: 0.8, date_content: '2025-02-01', date_creation: '2025-02-01T00:00:00.000Z', date_modified: '' },
      { id: 'c2', sources_id: 's2', title: 'Election watch', content_data: 'Polls opened across the country.', importance: 0.5, date_content: '2025-03-15', date_creation: '2025-03-15T00:00:00.000Z', date_modified: '' },
      { id: 'c3', sources_id: 's3', title: '', content_data: '', importance: 0, date_content: '', date_creation: '2025-03-20T00:00:00.000Z', date_modified: '' },
    ],
    analyses: [
      { id: 'a1', content_id: 'c1', classification: 'Security', list_names_people: 'Ali, Sara', list_names_places: 'Damascus', list_coordinates: '33.5, 36.3', list_sides: 'Army', date_analysis: '2025-02-02', date_creation: '2025-02-02T00:00:00.000Z', date_modified: '' },
      { id: 'a2', content_id: 'c2', classification: 'Political', list_names_people: 'Omar', list_names_places: 'Doha', list_coordinates: '', list_sides: 'Opposition', date_analysis: '2025-03-16', date_creation: '2025-03-16T00:00:00.000Z', date_modified: '' },
    ],
  };
}

/* --------------------------------- timeline --------------------------------- */

test('timeline aggregates every record with a usable date', () => {
  const events = buildTimeline(dataset());
  assert.equal(events.length, 8); // 3 sources + 3 contents + 2 analyses
  assert.ok(events.every((e) => /^\d{4}-\d{2}-\d{2}/.test(e.date)));
  const analysis = events.find((e) => e.recordId === 'a1');
  assert.equal(analysis?.source, 'Reuters');
  assert.equal(analysis?.hasCoordinates, true);
  assert.deepEqual(analysis?.people, ['Ali', 'Sara']);
  // undated source falls back to its creation date
  assert.ok(events.some((e) => e.recordId === 's3' && e.date.startsWith('2025-03-01')));
});

test('timeline filters combine and facets list options', () => {
  const events = buildTimeline(dataset());
  const ranged = filterTimeline(events, { from: '2025-02-01', to: '2025-02-28' });
  assert.ok(ranged.length > 0 && ranged.every((e) => e.date >= '2025-02-01' && e.date <= '2025-02-28'));

  const byPerson = filterTimeline(events, { person: 'Ali' });
  assert.equal(byPerson.length, 1);

  const byType = filterTimeline(events, { types: ['analysis'] });
  assert.equal(byType.length, 2);

  const byQuery = filterTimeline(events, { search: 'border' });
  assert.ok(byQuery.length >= 2);

  const combined = filterTimeline(events, { from: '2025-02-01', to: '2025-02-28', person: 'Ali', category: 'Security' });
  assert.equal(combined.length, 1);

  const facets = timelineFacets(events);
  assert.ok(facets.people.includes('Omar'));
  assert.ok(facets.places.includes('Damascus'));
  assert.ok(facets.categories.includes('Security'));
});

test('timeline sorting, stats, summary and chart series', () => {
  const events = buildTimeline(dataset());
  const asc = sortTimeline(events, 'date', 'asc');
  const desc = sortTimeline(events, 'date', 'desc');
  assert.equal(asc[0].date, events[0].date);
  assert.equal(desc[0].date, asc[asc.length - 1].date);
  assert.ok(sortTimeline(events, 'source', 'asc').every((e, i, all) => i === 0 || all[i - 1].source.localeCompare(e.source) <= 0));

  const filtered = filterTimeline(events, { types: ['analysis', 'content'] });
  const stats = timelineStats(events, filtered);
  assert.equal(stats.total, 8);
  assert.equal(stats.filtered, 5);
  assert.equal(stats.analyses, 2);
  assert.equal(stats.withCoordinates, 1);

  const summary = summarizeTimeline(filtered);
  assert.equal(summary.total, 5);
  assert.ok(summary.topCategories.length > 0);
  assert.match(summary.narrative, /event\(s\) in range/);

  const weekday = timelineSeries(events, 'weekday');
  assert.equal(weekday.length, 7);
  assert.equal(weekday.reduce((n, p) => n + p.value, 0), events.length);
  const byType = timelineSeries(events, 'type');
  assert.deepEqual(byType.map((p) => p.name), ['source', 'content', 'analysis']);
  assert.equal(timelineSeries(events, 'monthly').length, 3);
  assert.ok(timelineSeries(events, 'classification').length >= 2);
  assert.equal(timelineSeries(events, 'daily').reduce((n, p) => n + p.value, 0), events.length);
});

test('timeline pagination slices the filtered set', () => {
  const events = buildTimeline(dataset());
  const page = paginateEvents(events, 2, 3);
  assert.equal(page.pages, 3);
  assert.equal(page.slice.length, 3);
  assert.equal(page.slice[0].id, events[3].id);
});

/* ---------------------------------- search ---------------------------------- */

test('free text search is diacritic and case insensitive', () => {
  const rows = dataset().sources as unknown as Record<string, unknown>[];
  assert.equal(freeTextSearch(rows, 'reuters').length, 1);
  assert.equal(freeTextSearch(rows, 'LONDON wire').length, 1);
  assert.equal(freeTextSearch(rows, 'website').length, 2);
  assert.equal(freeTextSearch(rows, 'website UK').length, 1);
  assert.equal(freeTextSearch(rows, '').length, rows.length);
  assert.equal(freeTextSearch(rows, 'nonexistent-token').length, 0);
});

test('date filter keeps undated rows and honours the range', () => {
  const rows = dataset().sources as unknown as Record<string, unknown>[];
  const filtered = applyDateFilter(rows, '2025-02-01', '2025-02-28', ['date_entry', 'date_creation']);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, 'Al Jazeera');
  assert.equal(applyDateFilter(rows, null, null, ['date_entry']).length, 3);
});

test('advanced search operators cover the documented set', () => {
  const rows = dataset().sources as unknown as Record<string, unknown>[];
  const cond = (field: string, operator: SearchCondition['operator'], value = ''): SearchCondition => ({
    id: `${field}-${operator}`,
    field,
    operator,
    value,
  });

  assert.equal(runAdvancedSearch(rows, [cond('country', 'contains', 'qat')]).length, 1);
  assert.equal(runAdvancedSearch(rows, [cond('country', 'not_contains', 'qat')]).length, 2);
  assert.equal(runAdvancedSearch(rows, [cond('name', 'starts_with', 'Al')]).length, 1);
  assert.equal(runAdvancedSearch(rows, [cond('name', 'ends_with', 'uters')]).length, 1);
  assert.equal(runAdvancedSearch(rows, [cond('importance', 'gte', '0.7')]).length, 2);
  assert.equal(runAdvancedSearch(rows, [cond('importance', 'lt', '0.5')]).length, 1);
  assert.equal(runAdvancedSearch(rows, [cond('importance', 'between', '0.6, 0.95')]).length, 2);
  assert.equal(runAdvancedSearch(rows, [cond('type', 'in_list', 'person, blog')]).length, 1);
  assert.equal(runAdvancedSearch(rows, [cond('type', 'not_in_list', 'website')]).length, 1);
  assert.equal(runAdvancedSearch(rows, [cond('city', 'is_not_empty')]).length, 3);
  assert.equal(runAdvancedSearch(rows, [cond('description', 'is_empty')]).length, 2);
  assert.equal(runAdvancedSearch(rows, [cond('name', 'regex', '^Al|Field')]).length, 2);
  assert.equal(evaluateCondition({ importance: 0.9 }, cond('importance', 'gt', '0.5')), true);

  // AND / OR composition
  const andResult = runAdvancedSearch(rows, [cond('type', 'equals', 'website'), cond('importance', 'gte', '0.8')], 'AND');
  assert.equal(andResult.length, 1);
  const orResult = runAdvancedSearch(rows, [cond('type', 'equals', 'person'), cond('importance', 'gte', '0.8')], 'OR');
  assert.equal(orResult.length, 2);
});

test('conditions translate into SQL that the engine executes', () => {
  const conditions: SearchCondition[] = [
    { id: '1', field: 'country', operator: 'in_list', value: 'UK, Qatar' },
    { id: '2', field: 'importance', operator: 'gte', value: '0.7' },
  ];
  const where = conditionsToSql(conditions, 'AND');
  assert.match(where, /country IN \('UK', 'Qatar'\)/);
  assert.match(where, /importance >= '0\.7'/);

  const data = dataset();
  const engine = new SqlEngine(() => buildDatabase({ ...data, allRecords: [] }));
  const { result, error } = engine.run(`SELECT name FROM sources WHERE ${where} ORDER BY name`);
  assert.equal(error, undefined);
  assert.deepEqual(result?.rows.map((r) => r.name), ['Al Jazeera', 'Reuters']);
});

test('saved searches persist usage counts', () => {
  const store = new LocalSavedSearchStore();
  const saved = store.save({
    id: 'ss1',
    name: 'High importance',
    entity: 'sources',
    conditions: [{ id: 'c1', field: 'importance', operator: 'gte', value: '0.7' }],
    logic: 'AND',
  });
  store.touch(saved.id);
  store.touch(saved.id);
  assert.equal(store.list('sources')[0].uses, 2);
  assert.equal(store.list('contents').length, 0);
  assert.ok(store.remove(saved.id));
  assert.equal(store.list().length, 0);
});

/* ---------------------------------- stats ----------------------------------- */

test('entity statistics cover totals, bands, coverage and analysis extras', () => {
  const data = dataset();
  const stats = computeEntityStats('sources', data.sources as unknown as Record<string, unknown>[]);
  assert.equal(stats.total, 3);
  assert.equal(stats.avgImportance, Number(((0.9 + 0.7 + 0.4) / 3).toFixed(4)));
  assert.equal(stats.importanceBands.reduce((n, b) => n + b.count, 0), 3);
  assert.equal(stats.dateRange.from, '2025-01-05');
  assert.equal(stats.dateRange.to, '2025-03-01', 'the undated source falls back to its creation date');
  const typeField = stats.fields.find((f) => f.field === 'type');
  assert.equal(typeField?.top[0].count, 2);
  assert.equal(typeField?.unique, 2);

  const analysisStats = computeEntityStats('analyses', data.analyses as unknown as Record<string, unknown>[]);
  assert.equal(analysisStats.uniquePeople, 3);
  assert.equal(analysisStats.uniquePlaces, 2);
  assert.equal(analysisStats.withCoordinates, 1);
  assert.equal(analysisStats.classifications?.length, 2);
});

test('workspace statistics report coverage and referential integrity', () => {
  const data = dataset();
  const stats = computeWorkspaceStats(data);
  assert.equal(stats.total, 8);
  assert.equal(stats.counts.sources, 3);
  assert.equal(stats.integrity.orphanContents, 0);
  assert.equal(stats.integrity.orphanAnalyses, 0);
  const coverage = Object.fromEntries(stats.coverage.map((c) => [c.label, c.value]));
  assert.equal(coverage['Contents with text'], Number((2 / 3).toFixed(3)));
  assert.equal(coverage['Contents analysed'], Number((2 / 3).toFixed(3)));
  assert.equal(coverage['Analyses with coordinates'], 0.5);
  assert.equal(stats.byCountry[0].count, 1);

  const broken: AppData = {
    sources: [],
    contents: [{ id: 'c9', sources_id: 'missing', title: 'x', content_data: 'y', importance: 0, date_content: '', date_creation: '', date_modified: '' }],
    analyses: [],
  };
  assert.equal(computeWorkspaceStats(broken).integrity.orphanContents, 1);
  assert.equal(referentialProblems(broken).length, 1);
});

test('frequency, bucketing and record comparison', () => {
  const rows = dataset().contents as unknown as Record<string, unknown>[];
  const daily = frequencyByPeriod(rows, 'date_content', 'day');
  assert.equal(daily.length, 2);
  assert.equal(daily[0].label, '2025-02-01');
  const monthly = frequencyByPeriod(dataset().analyses as unknown as Record<string, unknown>[], 'date_analysis', 'month');
  assert.deepEqual(monthly.map((m) => m.label), ['2025-02', '2025-03']);

  const buckets = bucket(dataset().analyses as unknown as Record<string, unknown>[], 'list_names_people', { split: true });
  assert.equal(buckets.length, 3);
  assert.equal(buckets[0].count, 1);

  const compared = compareRecords(dataset().analyses as unknown as Record<string, unknown>[], ['classification', 'list_coordinates']);
  assert.equal(compared.length, 2);
  assert.deepEqual(compared[1].values, ['33.5, 36.3', null]);
});

/* ---------------------------------- backup ---------------------------------- */

test('backup envelopes carry counts and a verifiable checksum', () => {
  const data = dataset();
  const envelope = createBackup(data, { name: 'test-backup', note: 'unit test' });
  assert.equal(envelope.counts.sources, 3);
  assert.equal(envelope.counts.analyses, 2);
  assert.equal(envelope.checksum, checksumData(envelope.data));

  const verified = verifyBackup(envelope);
  assert.ok(verified.ok, verified.errors.join('; '));
  assert.equal(verified.meta?.hasAudit, false);
  assert.ok((verified.meta?.bytes ?? 0) > 0);

  const tampered = JSON.parse(JSON.stringify(envelope));
  tampered.data.sources.pop();
  const bad = verifyBackup(tampered);
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => /Checksum|Count mismatch/.test(e)));

  assert.equal(verifyBackup('nope').ok, false);
  assert.equal(verifyBackup({ format: 'something-else' }).ok, false);
});

test('legacy payloads and newer schema versions are tolerated with warnings', () => {
  const legacy = { sources: dataset().sources, contents: [], analyses: [] };
  const result = verifyBackup(legacy);
  assert.ok(result.ok, result.errors.join(';'));
  assert.ok(result.warnings.some((w) => /Legacy payload/.test(w)));

  const future = { ...createBackup(dataset()), version: 99 };
  const futureResult = verifyBackup(future);
  assert.ok(futureResult.ok);
  assert.ok(futureResult.warnings.some((w) => /newer schema/.test(w)));
});

test('merge policies skip, replace or duplicate conflicting records', () => {
  const current = dataset();
  const incoming = JSON.parse(JSON.stringify(current)) as AppData;
  incoming.sources[0].country = 'United Kingdom';
  incoming.sources.push({ ...incoming.sources[0], id: 's9', name: 'New Source', country: 'Chile' });

  const skip = mergeData(current, incoming, 'skip');
  assert.equal(skip.data.sources.length, 4);
  assert.equal(skip.data.sources[0].country, 'UK');
  assert.equal(skip.skipped >= 1, true);
  assert.equal(skip.added.sources, 1);

  const replace = mergeData(current, incoming, 'replace');
  assert.equal(replace.data.sources[0].country, 'United Kingdom');
  assert.equal(replace.replaced >= 1, true);

  const duplicate = mergeData(current, incoming, 'duplicate');
  assert.equal(duplicate.data.sources.length, 5);
  assert.equal(duplicate.remapped.length >= 1, true);
  assert.ok(duplicate.conflicts.length >= 1);
});

test('merge rewires children of duplicated parents', () => {
  const current: AppData = {
    sources: [{ id: 's1', name: 'Reuters', type: 'website', importance: 0.5, country: 'UK', city: '', description: '', accounts: '', note: '', ownership: '', date_entry: '', date_creation: '', date_modified: '' }],
    contents: [],
    analyses: [],
  };
  const incoming: AppData = {
    sources: [{ ...current.sources[0], country: 'United Kingdom' }],
    contents: [{ id: 'c1', sources_id: 's1', title: 'Child', content_data: 'text', attachments: '', note: '', importance: 0.2, date_content: '', date_creation: '', date_modified: '' }],
    analyses: [{ id: 'a1', content_id: 'c1', classification: 'Security', list_names_people: '', list_names_places: '', list_coordinates: '', list_sides: '', date_analysis: '', date_creation: '', date_modified: '' }],
  };

  const merged = mergeData(current, incoming, 'duplicate');
  const newSource = merged.data.sources.find((s) => s.country === 'United Kingdom');
  assert.ok(newSource && newSource.id !== 's1');
  const child = merged.data.contents.find((c) => c.id === 'c1');
  assert.equal(child?.sources_id, newSource?.id, 'content follows the duplicated source');
  const analysis = merged.data.analyses[0];
  assert.equal(analysis.content_id, 'c1');
  assert.equal(referentialProblems(merged.data).length, 0);
});

test('diff summarises added, changed and removed records', () => {
  const a = dataset();
  const b = JSON.parse(JSON.stringify(a)) as AppData;
  b.sources[0].country = 'United Kingdom';
  b.sources.pop();
  b.analyses.push({ ...b.analyses[0], id: 'a9', classification: 'Economic' });
  const diff = diffData(a, b);
  assert.equal(diff.changed.sources, 1);
  assert.equal(diff.removed.sources, 1);
  assert.equal(diff.added.analyses, 1);
  assert.match(describeDiff(diff), /sources ~1 -1/);
  assert.equal(describeDiff(diffData(a, a)), 'no differences');
});

test('repository restore and merge round-trip through a backup', () => {
  const repo = new Repository(new MemoryStorage(), 'b.data', 'b.audit');
  repo.replaceAll(dataset());
  const envelope = createBackup(repo.all(), { name: 'snapshot' });

  repo.clear();
  assert.equal(repo.count('sources'), 0);

  const verified = verifyBackup(envelope);
  assert.ok(verified.ok);
  repo.replaceAll(verified.envelope!.data, 'restore', 'Restored from snapshot');
  assert.equal(repo.count('sources'), 3);
  assert.equal(repo.count('analyses'), 2);
  assert.ok(repo.audit.list({ action: 'restore' }).length >= 1);
});

/* -------------------------------- attachments ------------------------------- */

test('attachment store keeps real bytes per content record', async () => {
  const store = new MemoryAttachmentStore();
  const first = await store.put('c1', { name: 'report.pdf', mime: 'application/pdf', data: 'PDF-BYTES' });
  const second = await store.put('c1', { name: 'صورة.png', mime: 'image/png', data: new TextEncoder().encode('image-bytes') });
  await store.put('c2', { name: 'other.txt', mime: 'text/plain', data: 'other' });

  assert.equal((await store.list('c1')).length, 2);
  assert.equal((await store.list()).length, 3);

  const fetched = await store.get(first.id);
  assert.equal(await fetched?.blob.text(), 'PDF-BYTES');
  assert.equal(fetched?.meta.checksum.length, 16);

  const stats = await store.stats();
  assert.equal(stats.count, 3);
  assert.equal(stats.byContent.c1, 2);
  assert.ok(stats.bytes > 0);
  assert.match(describeAttachments(await store.list('c1')), /2 file\(s\)/);

  assert.ok(await store.remove(second.id));
  assert.equal(await store.remove(second.id), false);
  assert.equal(await store.removeByContent('c1'), 1);
  assert.equal((await store.list()).length, 1);
});

/* ------------------------------ integration --------------------------------- */

test('SQL, timeline and stats agree on the same dataset', () => {
  const data = dataset();
  const engine = new SqlEngine(() => buildDatabase({ ...data, allRecords: [] }));
  const { result } = engine.run('SELECT COUNT(*) AS n FROM analyses WHERE list_coordinates != \'\'');
  assert.equal(result?.rows[0].n, 1);

  const events = buildTimeline(data);
  assert.equal(events.filter((e) => e.hasCoordinates).length, 1);
  assert.equal(computeEntityStats('analyses', data.analyses as unknown as Record<string, unknown>[]).withCoordinates, 1);
});

test('applyColumnFilters matches display values across every column', () => {
  const rows = [
    { id: '1', title: 'Investigation', source: 'Reuters', n: 0.9 },
    { id: '2', title: 'Interview', source: 'Al Jazeera', n: 0.2 },
  ];
  const valueOf = (row: (typeof rows)[number], key: string) => String(row[key as keyof typeof row] ?? '');
  assert.equal(applyColumnFilters(rows, {}, valueOf).length, 2, 'no filters → untouched');
  assert.equal(applyColumnFilters(rows, { source: 'reuters' }, valueOf).length, 1, 'case-insensitive contains');
  assert.equal(applyColumnFilters(rows, { source: ' ', title: '' }, valueOf).length, 2, 'blank filters are ignored');
  assert.equal(applyColumnFilters(rows, { source: 'a', title: 'i' }, valueOf).length, 1, 'all active filters must match');
});
