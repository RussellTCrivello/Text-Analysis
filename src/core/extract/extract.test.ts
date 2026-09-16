import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TAXONOMY, extractFromText, mergeSuggestion, tokenize } from './engine';
import { extractCoordinates, parseCoordinatePair, distanceKm, mapUrl, centroid } from './coordinates';
import { extractDates } from './dates';
import { Gazetteer } from './gazetteer';

const SAMPLE = `On 12 March 2025, Dr. Sarah Mitchell briefed reporters in Damascus about the ceasefire.
President Ahmad al-Saleh said the Syrian Arab Army had withdrawn from Daraa near coordinates 32.6189, 36.1021.
The United Nations and the Ministry of Foreign Affairs confirmed that Omar Haddad travelled from Amman to Beirut.
Oil exports fell sharply, according to the report by the Global Policy Institute.`;

test('extracts people from titles and attributions', () => {
  const result = extractFromText(SAMPLE);
  const names = result.people.map((p) => p.value);
  assert.ok(names.some((n) => n.includes('Sarah Mitchell')), names.join(' | '));
  assert.ok(names.some((n) => n.includes('Ahmad')), names.join(' | '));
  for (const person of result.people) {
    assert.ok(person.confidence > 0 && person.confidence <= 1);
    assert.ok(person.evidence.length > 0);
  }
});

test('extracts known and inferred places with gazetteer metadata', () => {
  const result = extractFromText(SAMPLE);
  const places = result.places.map((p) => p.value.toLowerCase());
  assert.ok(places.includes('damascus'), places.join(' | '));
  assert.ok(places.includes('daraa'), places.join(' | '));
  const damascus = result.places.find((p) => p.value.toLowerCase() === 'damascus');
  assert.ok(damascus?.lat && damascus?.lon);
  assert.equal(damascus?.country, 'Syria');
});

test('extracts organisations and sides', () => {
  const result = extractFromText(SAMPLE);
  const orgs = result.organizations.map((o) => o.value.toLowerCase());
  assert.ok(orgs.some((o) => o.includes('ministry of foreign affairs')), orgs.join(' | '));
  const sides = result.sides.map((s) => s.value.toLowerCase());
  assert.ok(sides.some((s) => s.includes('army')), sides.join(' | '));
});

test('extracts decimal, DMS and hemispheric coordinates', () => {
  const decimal = extractCoordinates('Meeting point at 33.5138, 36.2765 near the square.');
  assert.equal(decimal.length, 1);
  assert.equal(decimal[0].lat, 33.5138);
  assert.equal(decimal[0].lon, 36.2765);

  const dms = extractCoordinates(`Position 33°30'50"N 36°16'35"E confirmed.`);
  assert.equal(dms.length, 1);
  assert.equal(dms[0].format, 'dms');
  assert.ok(Math.abs(dms[0].lat - 33.5139) < 0.001);

  const hemi = extractCoordinates('Site N33.5 E36.2 was inspected.');
  assert.equal(hemi.length, 1);
  assert.equal(hemi[0].lat, 33.5);

  // Year pairs must not be mistaken for coordinates.
  assert.equal(extractCoordinates('Between 2024, 2025 the situation changed.').length, 0);
});

test('parses coordinate pairs and rejects invalid ones', () => {
  assert.deepEqual(parseCoordinatePair('39.92, 32.85'), { lat: 39.92, lon: 32.85 });
  assert.equal(parseCoordinatePair('95, 200'), null);
  assert.equal(parseCoordinatePair(''), null);
  assert.equal(distanceKm({ lat: 33.5138, lon: 36.2765 }, { lat: 33.5138, lon: 36.2765 }), 0);
  assert.ok(distanceKm({ lat: 33.5, lon: 36.3 }, { lat: 31.9, lon: 35.9 }) > 100);
  assert.match(mapUrl(33.5, 36.3), /^https:\/\/www\.openstreetmap\.org/);
  assert.deepEqual(centroid([{ lat: 10, lon: 20 }, { lat: 20, lon: 40 }]), { lat: 15, lon: 30 });
});

test('extracts dates in several formats', () => {
  const found = extractDates('Signed on 12 March 2025 and revised 2025-04-01, earlier 03/02/2024.');
  const values = found.map((d) => d.value.slice(0, 10));
  assert.ok(values.includes('2025-03-12'), values.join(','));
  assert.ok(values.includes('2025-04-01'), values.join(','));
  assert.ok(values.includes('2024-02-03'), values.join(','));
});

test('classifies text using the editable taxonomy', () => {
  const military = extractFromText('The army launched a missile strike with drones against the battalion.');
  assert.equal(military.classifications[0]?.value, 'Military');

  const economic = extractFromText('Oil exports and trade tariffs pushed inflation higher across the economy.');
  assert.equal(economic.classifications[0]?.value, 'Economic / Trade');

  const custom = extractFromText('Water shortages hit the region.', {
    taxonomy: [{ classification: 'Water Crisis', keywords: ['water', 'shortage'] }, ...DEFAULT_TAXONOMY],
  });
  assert.equal(custom.classifications[0]?.value, 'Water Crisis');
});

test('produces an apply-ready suggestion and merges without losing manual data', () => {
  const result = extractFromText(SAMPLE);
  assert.ok(result.suggestion.list_names_people.length > 0);
  assert.match(result.suggestion.list_coordinates, /^-?\d+\.\d+, -?\d+\.\d+/);
  assert.ok(result.stats.words > 20);
  assert.equal(result.stats.language, 'en');

  const merged = mergeSuggestion(
    { list_names_people: 'Manual Person', classification: 'Custom Class' },
    result.suggestion,
    'merge',
  );
  assert.ok(merged.list_names_people?.includes('Manual Person'));
  assert.ok(merged.list_names_people?.includes('Sarah Mitchell'));
  assert.equal(merged.classification, 'Custom Class', 'merge keeps a manual classification');

  const replaced = mergeSuggestion({ classification: 'Custom Class' }, result.suggestion, 'replace');
  assert.equal(replaced.classification, result.suggestion.classification);

  const filled = mergeSuggestion({ list_names_people: 'Manual Person' }, result.suggestion, 'fill-empty');
  assert.equal(filled.list_names_people, 'Manual Person', 'fill-empty leaves populated fields alone');
});

test('handles Arabic text', () => {
  const arabic = extractFromText(
    'قال الدكتور أحمد الحسن في دمشق إن الحكومة السورية أرسلت قوات الجيش إلى درعا بتاريخ 12 مارس 2025.',
  );
  assert.equal(arabic.stats.language, 'ar');
  assert.ok(arabic.places.some((p) => p.value.includes('دمشق')));
  assert.ok(arabic.people.some((p) => p.value.includes('أحمد')));
  assert.ok(arabic.dates.length >= 1);
  assert.ok(tokenize('قال الدكتور أحمد', 'ar').length >= 3);
});

test('gazetteer is extensible at runtime', () => {
  const g = new Gazetteer();
  const before = g.size;
  g.upsert({ name: 'Testville', kind: 'city', country: 'Testland', lat: 1, lon: 2 });
  assert.equal(g.size, before + 1);
  const result = extractFromText('The delegation arrived in Testville yesterday.', { gazetteer: g });
  assert.ok(result.places.some((p) => p.value === 'Testville'));
  assert.ok(g.remove('Testville'));
  assert.equal(g.size, before);
  assert.equal(g.remove('Syria'), false, 'built-in entries cannot be deleted');
  const roundTrip = Gazetteer.fromJSON(g.toJSON());
  assert.equal(roundTrip.size, g.size);
});
