import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorage } from './persist';
import { Repository } from './repository';

function seed(repo: Repository) {
  const s1 = repo.insert('sources', {
    name: 'Reuters', type: 'website', link_sources: 'https://reuters.com', importance: 0.9, country: 'UK',
  });
  const s2 = repo.insert('sources', { name: 'Local Blog', type: 'blog', importance: 0.3, country: 'Egypt' });
  const c1 = repo.insert('contents', {
    sources_id: s1.record?.id, title: 'Border report', content_data: 'Tensions rose along the border.', importance: 0.8,
  });
  const c2 = repo.insert('contents', { sources_id: s2.record?.id, title: 'Market note', content_data: 'Prices fell.' });
  const a1 = repo.insert('analyses', { content_id: c1.record?.id, classification: 'Security', list_names_people: 'Ali' });
  return { s1, s2, c1, c2, a1 };
}

function newRepo() {
  return new Repository(new MemoryStorage(), 'test.data', 'test.audit', 'tester');
}

test('insert applies schema defaults, ids and timestamps', () => {
  const repo = newRepo();
  const result = repo.insert('sources', { name: 'Source A', type: 'person', country: 'Jordan' });
  assert.ok(result.ok, JSON.stringify(result.issues));
  const record = result.record!;
  assert.match(String(record.id), /^s/);
  assert.equal(record.importance, 0);
  assert.equal(record.date_creation, record.date_modified);
  assert.equal(repo.count('sources'), 1);
});

test('validation rejects missing required fields, bad URLs and duplicate names', () => {
  const repo = newRepo();
  assert.ok(repo.insert('sources', { name: 'Unique Name', type: 'website', link_sources: 'https://ok.example', country: 'Qatar' }).ok);

  const missing = repo.insert('sources', { type: 'website' });
  assert.equal(missing.ok, false);
  assert.ok(missing.issues.some((i) => i.field === 'name' && i.code === 'required'));
  assert.ok(missing.issues.some((i) => i.field === 'country' && i.code === 'required'));

  const badUrl = repo.insert('sources', { name: 'Bad Link', type: 'website', link_sources: 'not a url', country: 'Peru' });
  assert.ok(badUrl.issues.some((i) => i.code === 'url'));

  const dupName = repo.insert('sources', { name: 'unique name', type: 'blog', country: 'Chile' });
  assert.ok(dupName.issues.some((i) => i.code === 'duplicate'));

  const outOfRange = repo.insert('sources', { name: 'Range Check', type: 'blog', country: 'Peru', importance: 5 });
  assert.ok(outOfRange.ok, 'importance above 1 is accepted');
  assert.equal(outOfRange.record?.importance, 0.05, 'read as 5%');
  assert.ok(
    outOfRange.issues.some((i) => i.level === 'warning' && i.code === 'range'),
    'the reinterpretation is reported as a warning, never silent',
  );
});

test('exact duplicate detection blocks identical records', () => {
  const repo = newRepo();
  const payload = { name: 'Twin', type: 'website', country: 'Spain', link_sources: 'https://twin.example' };
  assert.ok(repo.insert('sources', payload).ok);
  const second = repo.insert('sources', { ...payload, name: 'Twin 2' });
  assert.ok(second.ok, 'different name is not a duplicate');
  const exact = repo.insert('sources', { ...payload });
  assert.ok(exact.issues.some((i) => i.code === 'duplicate' || i.code === 'exactDuplicate'));
});

test('deleting a source cascades to contents and analyses', () => {
  const repo = newRepo();
  const { s1 } = seed(repo);
  assert.equal(repo.count('contents'), 2);
  assert.equal(repo.count('analyses'), 1);

  const result = repo.remove('sources', String(s1.record?.id));
  assert.ok(result.ok);
  assert.equal(repo.count('sources'), 1);
  assert.equal(repo.count('contents'), 1);
  assert.equal(repo.count('analyses'), 0);
  assert.deepEqual(result.cascaded?.map((c) => [c.entity, c.ids.length]), [['contents', 1], ['analyses', 1]]);
  assert.equal(repo.findOrphans().contents, 0);
});

test('updates stamp date_modified and record field-level changes in the audit log', async () => {
  const repo = newRepo();
  const { s2 } = seed(repo);
  const before = s2.record?.date_modified;
  await new Promise((r) => setTimeout(r, 5));
  const result = repo.update('sources', { ...s2.record, country: 'Tunisia' });
  assert.ok(result.ok);
  assert.notEqual(result.record?.date_modified, before);

  const entry = repo.audit.list({ action: 'update' })[0];
  assert.equal(entry?.entity, 'sources');
  assert.ok(entry?.changes?.some((c) => c.field === 'country' && c.after === 'Tunisia'));
});

test('audit trail records create, update, bulk delete and restore', () => {
  const repo = newRepo();
  const { s1, a1 } = seed(repo);
  repo.update('sources', { ...s1.record, note: 'checked' });
  repo.bulkDelete('analyses', [String(a1.record?.id)]);
  repo.replaceAll({ sources: [], contents: [], analyses: [] }, 'reset', 'cleared');

  const actions = repo.audit.list().map((e) => e.action);
  assert.ok(actions.includes('create'));
  assert.ok(actions.includes('update'));
  assert.ok(actions.includes('bulk_delete'));
  assert.ok(actions.includes('reset'));
  const filtered = repo.audit.list({ action: 'create', entity: 'sources' });
  assert.ok(filtered.length >= 2);
});

test('undo and redo restore previous states', () => {
  const repo = newRepo();
  seed(repo);
  const before = repo.count('sources');
  repo.remove('sources', String(repo.list('sources')[0].id));
  assert.equal(repo.count('sources'), before - 1);
  assert.ok(repo.canUndo());
  repo.undo();
  assert.equal(repo.count('sources'), before);
  assert.ok(repo.canRedo());
  repo.redo();
  assert.equal(repo.count('sources'), before - 1);
});

test('bulk update patches only the selected rows', () => {
  const repo = newRepo();
  seed(repo);
  const ids = repo.list('contents').map((c) => String(c.id));
  repo.bulkUpdate('contents', [ids[0]], { importance: 0.42 });
  const updated = repo.get('contents', ids[0]);
  const untouched = repo.get('contents', ids[1]);
  assert.equal(Number(updated?.importance), 0.42);
  assert.notEqual(Number(untouched?.importance), 0.42);
});

test('transactions roll back when a step throws', () => {
  const repo = newRepo();
  seed(repo);
  const before = repo.count('sources');
  assert.throws(() =>
    repo.transaction(() => {
      repo.insert('sources', { name: 'Temp', type: 'x', country: 'Y' }, { skipValidation: true });
      throw new Error('boom');
    }),
  );
  assert.equal(repo.count('sources'), before);
});

test('insertMany is atomic for the whole batch', () => {
  const repo = newRepo();
  const result = repo.insertMany(
    'sources',
    [
      { name: 'Batch A', type: 'blog', country: 'Italy' },
      { name: 'Batch B', type: 'blog', country: 'Greece' },
    ],
    { validate: true },
  );
  assert.equal(result.inserted, 2);
  assert.equal(repo.count('sources'), 2);
});

test('persistence round-trips through the storage adapter', () => {
  const storage = new MemoryStorage();
  const first = new Repository(storage, 'd', 'a');
  seed(first);
  const second = new Repository(storage, 'd', 'a');
  assert.equal(second.count('sources'), 2);
  assert.equal(second.count('analyses'), 1);
  assert.ok(second.audit.size > 0);
  assert.ok(second.stats().bytes > 0);
});

test('duplicate() copies a record with a fresh id and (Copy) suffix', () => {
  const repo = newRepo();
  const { s1 } = seed(repo);
  const copy = repo.duplicate('sources', String(s1.record?.id));
  assert.ok(copy.ok);
  assert.equal(copy.record?.name, 'Reuters (Copy)');
  assert.notEqual(copy.record?.id, s1.record?.id);
});

test('resolveRef maps parent names to ids for imports', () => {
  const repo = newRepo();
  const { s1 } = seed(repo);
  assert.equal(repo.resolveRef('contents', 'Reuters'), s1.record?.id);
  assert.equal(repo.resolveRef('contents', 'reuters'), s1.record?.id);
  assert.equal(repo.resolveRef('contents', 'Unknown Outlet'), null);
  assert.equal(repo.resolveRef('contents', s1.record?.id), s1.record?.id);
});

test('allRecords builds the unified view with derived columns', () => {
  const repo = newRepo();
  seed(repo);
  const rows = repo.allRecords();
  assert.equal(rows.length, 5);
  const analysisRow = rows.find((r) => r.record_type === 'Analysis');
  assert.equal(analysisRow?.source_name, 'Reuters');
  assert.equal(analysisRow?.classification, 'Security');
});
