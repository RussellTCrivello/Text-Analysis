import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryAttachmentStore, describeProvenance } from './attachments';

/**
 * Contract tests for the attachment store. These guard the bug that made
 * Open/Download fail in browsers: reads must return a real Blob built from
 * the field the writer uses, and metadata updates must never touch the
 * stored file bytes.
 */
test('attachment store round-trips file data through get()', async () => {
  const store = new MemoryAttachmentStore();
  const meta = await store.put('c1', { name: 'a.txt', mime: 'text/plain', data: 'hello world' });
  const found = await store.get(meta.id);
  assert.ok(found, 'record must be readable');
  assert.ok(found.blob instanceof Blob, 'get() must yield a real Blob');
  assert.equal(await found.blob.text(), 'hello world');
  assert.equal(found.meta.size, 11);
});

test('update() patches metadata without losing the file', async () => {
  const store = new MemoryAttachmentStore();
  const meta = await store.put('c1', {
    name: 'a.txt',
    mime: 'text/plain',
    data: 'keep me',
    note: 'first',
  });
  const patched = await store.update(meta.id, { note: 'second', name: 'b.txt' });
  assert.equal(patched?.name, 'b.txt');
  const found = await store.get(meta.id);
  assert.equal(await found!.blob.text(), 'keep me', 'file must survive a metadata update');
  assert.equal(found!.meta.note, 'second');
  assert.equal(found!.meta.id, meta.id, 'id is immutable');
});

test('update() of a missing record is a no-op and get() of none is null', async () => {
  const store = new MemoryAttachmentStore();
  assert.equal(await store.update('missing', { note: 'x' }), null);
  assert.equal(await store.get('missing'), null);
});

test('list filters by record and remove drops both meta and bytes', async () => {
  const store = new MemoryAttachmentStore();
  const one = await store.put('c1', { name: 'x.bin', mime: 'application/octet-stream', data: 'AAAA' });
  await store.put('c2', { name: 'y.bin', mime: 'application/octet-stream', data: 'BBBB' });
  assert.deepEqual((await store.list('c1')).map((m) => m.id), [one.id]);
  assert.equal(await store.remove(one.id), true);
  assert.equal(await store.get(one.id), null);
  const stats = await store.stats();
  assert.equal(stats.count, 1);
});

test('provenance description is safe with optional fields', async () => {
  const store = new MemoryAttachmentStore();
  const meta = await store.put('c1', { name: 'z.txt', mime: 'text/plain', data: 'z' });
  assert.doesNotThrow(() => describeProvenance(meta));
});
