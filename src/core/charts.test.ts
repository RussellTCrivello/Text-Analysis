import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryCounts, countPerDay, createdWithin, paletteFor } from './charts';

const DAY = 24 * 60 * 60 * 1000;
// Fixed "now" at midday to avoid local-midnight edge flakiness.
const NOW = new Date(2026, 8, 17, 12, 0, 0);

const iso = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * DAY).toISOString();

test('countPerDay buckets trailing-window creations, zeros included', () => {
  const series = countPerDay([iso(0), iso(0), iso(2), iso(13), iso(14), iso(200), 'garbage'], 14, NOW);
  assert.equal(series.length, 14);
  assert.equal(series[13], 2, 'today is the last bucket');
  assert.equal(series[11], 1, 'two days ago');
  assert.equal(series[0], 1, 'oldest in-window day');
  assert.equal(series.reduce((a, b) => a + b, 0), 4, 'out-of-window and unparseable are dropped');
  assert.deepEqual(countPerDay([], 5, NOW), [0, 0, 0, 0, 0]);
});

test('createdWithin counts the trailing inclusive window', () => {
  assert.equal(createdWithin([iso(0), iso(6), iso(7), iso(30)], 7, NOW), 2, 'day -6 inclusive, -7 outside');
  assert.equal(createdWithin([undefined, '', 'nope'], 7, NOW), 0, 'missing values ignored');
});

test('categoryCounts ranks top-N with an Other tail and exact shares', () => {
  const slices = categoryCounts(['a', 'a', 'a', 'b', 'b', 'c', '', 'd', 'e', 'f'], 3, 'Other');
  assert.equal(slices.length, 4, '3 + Other');
  assert.deepEqual(slices.map((s) => s.label), ['a', 'b', 'c', 'Other'], 'ties broken alphabetically');
  assert.equal(slices[0].value, 3);
  assert.equal(slices[3].value, 3, 'd,e,f collapse into Other');
  const sum = slices.reduce((n, s) => n + s.share, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, 'shares sum to 1');
  assert.deepEqual(categoryCounts([]), [], 'empty population → empty');
});

test('paletteFor is stable and within the palette', () => {
  assert.equal(paletteFor('website'), paletteFor('website'));
  assert.match(paletteFor('website'), /^#[0-9A-F]{6}$/i);
  assert.notEqual(paletteFor('website'), paletteFor('podcast'), 'different labels generally differ');
});

test('paletteFor switches to the colour-blind-safe palette on request', () => {
  // Same label, stable within a mode…
  assert.equal(paletteFor('website', 'deuteranopia'), paletteFor('website', 'deuteranopia'));
  // …but the CVD palettes differ from the default for at least one label.
  let differs = false;
  for (const label of ['a', 'b', 'c', 'website', 'podcast']) {
    if (paletteFor(label) !== paletteFor(label, 'tritanopia')) differs = true;
  }
  assert.ok(differs, 'CVD palette should not be identical to the default');
  // Every mode still returns a valid hex colour.
  assert.match(paletteFor('website', 'protanopia'), /^#[0-9A-F]{6}$/i);
});
