import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { VocabularyStore } from './vocabulary';
import { ENTITY_ORDER, fieldsOf } from './schema';

describe('vocabulary store', () => {
  it('seeds the built-in lists for the schema-backed fields', () => {
    const vocab = new VocabularyStore();
    assert.ok(vocab.has('sources.type', 'website'));
    assert.ok(vocab.has('analyses.classification', 'Military'));
    // Case- and whitespace-insensitive lookup.
    assert.ok(vocab.has('sources.type', '  SOCIAL_MEDIA '));
  });

  it('adds user values and reports whether something was created', () => {
    const vocab = new VocabularyStore();
    const first = vocab.add('sources.type', 'satellite feed');
    assert.equal(first.created, true);
    assert.equal(first.entry.value, 'satellite feed');
    // Re-adding the same value is idempotent and returns the canonical entry.
    const second = vocab.add('sources.type', '  Satellite   Feed ');
    assert.equal(second.created, false);
    assert.equal(second.entry.value, 'satellite feed');
    assert.equal(vocab.values('sources.type').filter((v) => v.toLowerCase() === 'satellite feed').length, 1);
  });

  it('refuses empty or oversized values', () => {
    const vocab = new VocabularyStore();
    assert.equal(vocab.add('sources.type', '   ').reason, 'empty');
    assert.equal(vocab.add('sources.type', 'x'.repeat(120)).reason, 'too-long');
  });

  it('protects built-in and in-use values from deletion', () => {
    const vocab = new VocabularyStore();
    assert.equal(vocab.remove('sources.type', 'website').reason, 'builtin');
    vocab.add('sources.type', 'wire service');
    assert.equal(vocab.remove('sources.type', 'wire service', 3).reason, 'in-use');
    assert.equal(vocab.remove('sources.type', 'wire service', 0).ok, true);
    assert.equal(vocab.has('sources.type', 'wire service'), false);
  });

  it('renames a value and merges when the target already exists', () => {
    const vocab = new VocabularyStore();
    vocab.add('analyses.classification', 'Cyber');
    const renamed = vocab.rename('analyses.classification', 'Cyber', 'Cyber / Information');
    assert.equal(renamed.ok, true);
    assert.equal(renamed.canonical, 'Cyber / Information');
    assert.equal(vocab.has('analyses.classification', 'Cyber'), false);

    vocab.add('analyses.classification', 'Cyber');
    const merged = vocab.rename('analyses.classification', 'Cyber', 'cyber / information');
    assert.equal(merged.ok, true);
    assert.equal(merged.canonical, 'Cyber / Information');
    assert.equal(vocab.values('analyses.classification').filter((v) => v.toLowerCase() === 'cyber / information').length, 1);
  });

  it('counts usage and detects values used in data but missing from the list', () => {
    const vocab = new VocabularyStore();
    const rows = [
      { type: 'website' },
      { type: 'WEBSITE' },
      { type: 'pirate radio' },
      { type: 'pirate radio' },
      { type: '' },
    ];
    const usage = vocab.usage('sources.type', rows, 'type');
    assert.equal(usage.find((u) => u.entry.value === 'website')?.count, 2);
    const orphans = vocab.orphans('sources.type', rows, 'type');
    assert.deepEqual(
      orphans.map((o) => o.value),
      ['pirate radio'],
    );
    assert.equal(orphans[0].count, 2);
    // Adopting an orphan makes it a normal option.
    vocab.add('sources.type', orphans[0].value);
    assert.equal(vocab.orphans('sources.type', rows, 'type').length, 0);
  });

  it('survives a JSON round trip including user additions', () => {
    const vocab = new VocabularyStore();
    vocab.add('sources.type', 'field notebook');
    const revived = VocabularyStore.fromJSON(vocab.toJSON());
    assert.ok(revived.has('sources.type', 'field notebook'));
    assert.ok(revived.has('sources.type', 'website'));
    assert.equal(revived.entry('sources.type', 'website')?.builtin, true);
  });

  it('notifies subscribers when the list changes', () => {
    const vocab = new VocabularyStore();
    let calls = 0;
    const unsubscribe = vocab.subscribe(() => {
      calls += 1;
    });
    vocab.add('sources.type', 'newsletter');
    assert.equal(calls, 1);
    unsubscribe();
    vocab.add('sources.type', 'bulletin');
    assert.equal(calls, 1);
  });

  it('restores built-ins without discarding user additions', () => {
    const vocab = new VocabularyStore();
    vocab.add('sources.type', 'telegram channel');
    vocab.remove('sources.type', 'telegram channel');
    vocab.resetBuiltins('sources.type');
    assert.ok(vocab.has('sources.type', 'website'));
    vocab.add('sources.type', 'telegram channel');
    vocab.resetBuiltins('sources.type');
    assert.ok(vocab.has('sources.type', 'telegram channel'));
  });
});

describe('schema vocabulary wiring', () => {
  it('declares a vocabulary for exactly the extensible option fields', () => {
    const declared = ENTITY_ORDER.flatMap((entity) =>
      fieldsOf(entity)
        .filter((f) => f.vocabulary)
        .map((f) => `${entity}.${f.key}`),
    );
    assert.deepEqual(declared.sort(), ['analyses.classification', 'sources.type']);
    const vocab = new VocabularyStore();
    for (const key of declared) assert.ok(vocab.values(key).length > 0, `empty vocabulary for ${key}`);
  });

  it('marks every date field as carrying a time component', () => {
    const dateFields = ENTITY_ORDER.flatMap((entity) => fieldsOf(entity).filter((f) => f.kind === 'date'));
    assert.ok(dateFields.length >= 5);
    for (const field of dateFields) {
      assert.equal(field.withTime, true, `${field.key} should capture date and time`);
      assert.equal(field.format, 'datetime', `${field.key} should be formatted with its time`);
    }
  });
});
