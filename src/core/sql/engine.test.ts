import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SqlEngine, buildDatabase, buildSql, queryTemplates } from './engine';
import type { Row } from './executor';

function fixture() {
  const sources: Row[] = [
    { id: 's1', name: 'Reuters', type: 'website', importance: 0.95, country: 'UK', city: 'London', date_creation: '2025-01-01T00:00:00.000Z' },
    { id: 's2', name: 'Al Jazeera', type: 'website', importance: 0.78, country: 'Qatar', city: 'Doha', date_creation: '2025-01-02T00:00:00.000Z' },
    { id: 's3', name: 'Dr. Mitchell', type: 'person', importance: 0.4, country: 'USA', city: 'DC', date_creation: '2025-01-03T00:00:00.000Z' },
  ];
  const contents: Row[] = [
    { id: 'c1', sources_id: 's1', title: 'Border report', content_data: 'Tensions rose.', importance: 0.8, date_content: '2025-02-01', date_creation: '2025-02-02T00:00:00.000Z' },
    { id: 'c2', sources_id: 's1', title: 'Trade note', content_data: 'Exports fell.', importance: 0.3, date_content: '2025-02-05', date_creation: '2025-02-06T00:00:00.000Z' },
    { id: 'c3', sources_id: 's2', title: 'Election watch', content_data: 'Polls opened.', importance: 0.6, date_content: '2025-03-01', date_creation: '2025-03-02T00:00:00.000Z' },
  ];
  const analyses: Row[] = [
    { id: 'a1', content_id: 'c1', classification: 'Security', list_names_people: 'Ali, Sara', list_coordinates: '33.5,36.2', date_analysis: '2025-02-03', date_creation: '2025-02-04T00:00:00.000Z' },
    { id: 'a2', content_id: 'c3', classification: 'Political', list_names_people: 'Omar', list_coordinates: '', date_analysis: '2025-03-03', date_creation: '2025-03-04T00:00:00.000Z' },
  ];
  return buildDatabase({ sources, contents, analyses, allRecords: [] });
}

test('selects, filters and orders', () => {
  const engine = new SqlEngine(() => fixture());
  const { result, error } = engine.run(
    "SELECT name, importance FROM sources WHERE importance >= 0.75 ORDER BY importance DESC",
  );
  assert.equal(error, undefined);
  assert.deepEqual(result?.columns, ['name', 'importance']);
  assert.deepEqual(result?.rows.map((r) => r.name), ['Reuters', 'Al Jazeera']);
  assert.ok((result?.elapsedMs ?? 0) >= 0);
  assert.ok((result?.plan.length ?? 0) > 0);
});

test('aggregates with GROUP BY and HAVING', () => {
  const engine = new SqlEngine(() => fixture());
  const { result } = engine.run(
    'SELECT country, COUNT(*) AS n, ROUND(AVG(importance), 2) AS avg_imp FROM sources GROUP BY country HAVING COUNT(*) >= 1 ORDER BY n DESC, country ASC',
  );
  assert.equal(result?.rows.length, 3);
  const qatar = result?.rows.find((r) => r.country === 'Qatar');
  assert.equal(qatar?.n, 1);
  assert.equal(qatar?.avg_imp, 0.78);
});

test('inner and left joins with derived columns', () => {
  const engine = new SqlEngine(() => fixture());
  const inner = engine.run(
    'SELECT c.title, a.classification, a.source_name FROM contents c JOIN analyses a ON a.content_id = c.id',
  );
  assert.equal(inner.result?.rows.length, 2);
  assert.deepEqual(
    inner.result?.rows.map((r) => [r.title, r.classification, r.source_name]).sort(),
    [['Border report', 'Security', 'Reuters'], ['Election watch', 'Political', 'Al Jazeera']].sort(),
  );

  const left = engine.run(
    'SELECT s.name, COUNT(c.id) AS n FROM sources s LEFT JOIN contents c ON c.sources_id = s.id GROUP BY s.id ORDER BY n DESC',
  );
  assert.equal(left.result?.rows[0]?.name, 'Reuters');
  assert.equal(left.result?.rows[0]?.n, 2);
  const orphan = left.result?.rows.find((r) => r.name === 'Dr. Mitchell');
  assert.equal(orphan?.n, 0);
});

test('LIKE, IN, BETWEEN, IS NULL and DISTINCT', () => {
  const engine = new SqlEngine(() => fixture());
  assert.equal(engine.run("SELECT * FROM contents WHERE title LIKE '%report%'").result?.rows.length, 1);
  assert.equal(engine.run("SELECT * FROM sources WHERE country IN ('UK', 'USA')").result?.rows.length, 2);
  assert.equal(
    engine.run("SELECT * FROM contents WHERE date_content BETWEEN '2025-02-01' AND '2025-02-28'").result?.rows.length,
    2,
  );
  assert.equal(engine.run("SELECT * FROM analyses WHERE list_coordinates IS NULL OR list_coordinates = ''").result?.rows.length, 1);
  assert.equal(engine.run('SELECT DISTINCT type FROM sources').result?.rows.length, 2);
});

test('positional ORDER BY', () => {
  const engine = new SqlEngine(() => fixture());
  const { result } = engine.run('SELECT name, importance FROM sources ORDER BY 2 DESC');
  assert.equal(result?.rows[0]?.name, 'Reuters');
});

test('LIMIT and OFFSET', () => {
  const engine = new SqlEngine(() => fixture());
  assert.equal(engine.run('SELECT * FROM sources ORDER BY name LIMIT 2').result?.rows.length, 2);
  assert.equal(engine.run('SELECT * FROM sources ORDER BY name LIMIT 2 OFFSET 2').result?.rows[0]?.name, 'Reuters');
});

test('string functions and concatenation', () => {
  const engine = new SqlEngine(() => fixture());
  const { result } = engine.run(
    "SELECT UPPER(name) || ' / ' || country AS label, LENGTH(name) AS len FROM sources WHERE id = 's1'",
  );
  assert.equal(result?.rows[0]?.label, 'REUTERS / UK');
  assert.equal(result?.rows[0]?.len, 7);
});

test('reports syntax and runtime errors with hints', () => {
  const engine = new SqlEngine(() => fixture());
  const syntax = engine.run('SELECT FROM sources');
  assert.equal(syntax.error?.kind, 'syntax');

  const unknownTable = engine.run('SELECT * FROM source');
  assert.match(unknownTable.error?.message ?? '', /Unknown table "source"/);

  const unknownColumn = engine.run('SELECT nm FROM sources');
  assert.match(unknownColumn.error?.hint ?? '', /Did you mean name/);

  const writeAttempt = engine.run('DELETE FROM sources');
  assert.equal(writeAttempt.error?.kind, 'syntax');
});

test('visual builder produces executable SQL', () => {
  const engine = new SqlEngine(() => fixture());
  const sql = buildSql({
    table: 'sources',
    fields: ['country'],
    filters: [{ field: 'importance', operator: '>=', value: '0.5' }],
    groupBy: 'country',
    aggregate: 'count',
    aggregateAlias: 'n',
    orderBy: 'n',
    orderDir: 'DESC',
    limit: 10,
  });
  const { result, error } = engine.run(sql);
  assert.equal(error, undefined, sql);
  assert.ok(result && result.rows.length > 0);
  assert.match(sql, /GROUP BY country/);
  assert.match(sql, /COUNT\(\*\) AS n/);
});

test('templates all execute against the live schema', () => {
  const db = fixture();
  const templates = queryTemplates(db);
  assert.ok(templates.length >= 10, `expected at least 10 templates, got ${templates.length}`);
  const engine = new SqlEngine(() => db);
  for (const t of templates) {
    const { error } = engine.run(t.sql);
    assert.equal(error, undefined, `${t.label}: ${error?.message}`);
  }
});
