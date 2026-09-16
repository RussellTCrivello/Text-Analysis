/**
 * Extraction engine — turns free text into structured analysis fields.
 *
 * The desktop application describes this as extracting people, places and
 * coordinates "manually, or from the content itself". This is a transparent,
 * explainable pipeline (no opaque model calls): every candidate carries its
 * confidence, the evidence sentence and the character span, so the analyst can
 * accept or reject each suggestion in the UI before it is saved.
 */
import { fold, isBlank, normalizeWhitespace, splitList, uniqueSorted } from '../text';
import { extractCoordinates, type Coordinate } from './coordinates';
import { extractDates, type DateMatch } from './dates';
import {
  Gazetteer,
  NON_NAME_WORDS,
  ORG_SUFFIXES,
  PERSON_TITLES_AR,
  PERSON_TITLES_EN,
  STOPWORDS_AR,
  STOPWORDS_EN,
  type PlaceMatch,
} from './gazetteer';

export interface Candidate {
  value: string;
  confidence: number;
  evidence: string;
  start: number;
  end: number;
  count: number;
  /** Gazetteer metadata for places. */
  lat?: number;
  lon?: number;
  country?: string;
  kind?: string;
}

export interface TaxonomyRule {
  classification: string;
  keywords: string[];
}

export interface ExtractionOptions {
  gazetteer?: Gazetteer;
  /** Classification taxonomy; user-editable from the Data Dictionary workspace. */
  taxonomy?: TaxonomyRule[];
  minConfidence?: number;
  maxCandidates?: number;
  /** Skip expensive passes for very large documents. */
  maxChars?: number;
}

export interface ExtractionResult {
  people: Candidate[];
  places: Candidate[];
  organizations: Candidate[];
  sides: Candidate[];
  coordinates: (Coordinate & { confidence: number })[];
  dates: DateMatch[];
  classifications: Candidate[];
  keywords: Candidate[];
  stats: {
    characters: number;
    words: number;
    sentences: number;
    language: 'en' | 'ar';
    truncated: boolean;
    elapsedMs: number;
  };
  /** Field values ready to apply to an analysis record. */
  suggestion: {
    classification: string;
    list_names_people: string;
    list_names_places: string;
    list_coordinates: string;
    list_sides: string;
    date_analysis: string;
  };
}

export const DEFAULT_TAXONOMY: TaxonomyRule[] = [
  {
    classification: 'Security / Diplomacy',
    keywords: ['security','ceasefire','sanctions','treaty','diplomatic','embassy','negotiation','peace talks','armistice','deterrence','امن','وقف إطلاق النار','عقوبات','دبلوماسي','سفارة','مفاوضات'],
  },
  {
    classification: 'Political Analysis',
    keywords: ['election','parliament','president','government','coalition','opposition','vote','cabinet','referendum','party','انتخابات','برلمان','حكومة','معارضة','استفتاء','حزب'],
  },
  {
    classification: 'Economic / Trade',
    keywords: ['economy','trade','exports','imports','oil','gas','inflation','currency','tariff','investment','budget','bank','اقتصاد','تجارة','نفط','تضخم','استثمار','ميزانية'],
  },
  {
    classification: 'Environmental Security',
    keywords: ['climate','drought','flood','water','emissions','earthquake','wildfire','pollution','تغير المناخ','جفاف','فيضان','مياه','انبعاثات','زلزال'],
  },
  {
    classification: 'Geopolitics',
    keywords: ['border','territory','alliance','influence','proxy','sovereignty','region','sphere','نفوذ','حدود','تحالف','سيادة'],
  },
  {
    classification: 'Military',
    keywords: ['army','troops','missile','drone','strike','brigade','battalion','weapon','airstrike','offensive','جيش','قوات','صاروخ','مسيرة','ضربة','هجوم'],
  },
  {
    classification: 'Social',
    keywords: ['protest','migration','refugee','humanitarian','education','health','unemployment','احتجاج','لاجئين','هجرة','مساعدات','تعليم','صحة','بطالة'],
  },
  {
    classification: 'Media / Information',
    keywords: ['report','journalist','media','broadcast','statement','press release','coverage','disinformation','تقرير','صحفي','إعلام','بيان','تغطية'],
  },
];

const ARABIC_RE = /[\u0600-\u06FF]/;

export function detectLanguage(text: string): 'en' | 'ar' {
  let arabic = 0;
  let latin = 0;
  for (const ch of text.slice(0, 4000)) {
    if (ARABIC_RE.test(ch)) arabic++;
    else if (/[a-zA-Z]/.test(ch)) latin++;
  }
  return arabic > latin ? 'ar' : 'en';
}

export function extractFromText(input: string, options: ExtractionOptions = {}): ExtractionResult {
  const started = performance.now();
  const gazetteer = options.gazetteer ?? new Gazetteer();
  const taxonomy = options.taxonomy ?? DEFAULT_TAXONOMY;
  const minConfidence = options.minConfidence ?? 0.5;
  const maxCandidates = options.maxCandidates ?? 25;
  const maxChars = options.maxChars ?? 200_000;

  const truncated = input.length > maxChars;
  const text = truncated ? input.slice(0, maxChars) : input;
  const language = detectLanguage(text);

  const sentences = splitSentences(text);
  const words = tokenize(text, language);

  const coordinateMatches = extractCoordinates(text);
  const dateMatches = extractDates(text);
  const placeMatches = gazetteer.matchPlaces(text);
  const unknownPlaceCandidates = findUnknownPlaces(text, placeMatches);

  const placeCandidates: Candidate[] = [
    ...placeMatches.map((p) => ({
      value: normalizeWhitespace(p.value),
      confidence: p.confidence,
      evidence: sentenceAround(text, p.start, p.end),
      start: p.start,
      end: p.end,
      lat: p.lat,
      lon: p.lon,
      country: p.country,
      kind: p.kind as string | undefined,
      count: 1,
    })),
    // normalise the inferred candidates so the array has one shape

    ...unknownPlaceCandidates.map((c) => ({ ...c, count: c.count ?? 1 })),
  ];
  const places = mergeCandidates(placeCandidates, maxCandidates);

  const organizations = mergeCandidates(findOrganizations(text, gazetteer), maxCandidates);
  const people = mergeCandidates(findPeople(text, language, places, organizations), maxCandidates);
  const sides = mergeCandidates(
    [...findSides(text), ...organizations.filter((o) => o.confidence >= 0.75)],
    maxCandidates,
  );
  const classifications = mergeCandidates(scoreTaxonomy(text, taxonomy), 8);
  const keywords = mergeCandidates(scoreKeywords(words, language), 20);

  const bestClassification = classifications[0]?.confidence && classifications[0].confidence >= minConfidence
    ? classifications[0].value
    : (classifications[0]?.value ?? '');

  return {
    people,
    places,
    organizations,
    sides,
    coordinates: coordinateMatches,
    dates: dateMatches,
    classifications,
    keywords,
    stats: {
      characters: text.length,
      words: words.length,
      sentences: sentences.length,
      language,
      truncated,
      elapsedMs: Math.max(0.01, performance.now() - started),
    },
    suggestion: {
      classification: bestClassification,
      list_names_people: uniqueSorted(people.filter((p) => p.confidence >= minConfidence).map((p) => p.value)).join(', '),
      list_names_places: uniqueSorted(
        [
          ...places.filter((p) => p.confidence >= minConfidence).map((p) => p.value),
        ],
      ).join(', '),
      list_coordinates: uniqueSorted(
        coordinateMatches.map((c) => `${round(c.lat)}, ${round(c.lon)}`),
      ).join('; '),
      list_sides: uniqueSorted(sides.filter((s) => s.confidence >= minConfidence).map((s) => s.value)).join(', '),
      date_analysis: dateMatches[0]?.value ? dateMatches[0].value.slice(0, 10) : '',
    },
  };
}

function round(n: number): string {
  return String(Math.round(n * 10000) / 10000);
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?؟。])\s+|\n{2,}/)
    .map((s) => normalizeWhitespace(s))
    .filter((s) => s.length > 1);
}

export function tokenize(text: string, language: 'en' | 'ar' = detectLanguage(text)): string[] {
  const pattern = language === 'ar' ? /[\u0600-\u06FF][\u0600-\u06FF'’-]*/g : /[A-Za-z][A-Za-z'’-]*/g;
  return text.match(pattern) ?? [];
}

function sentenceAround(text: string, start: number, end: number): string {
  const from = text.lastIndexOf('.', start - 1) + 1;
  let to = text.indexOf('.', end);
  if (to === -1) to = Math.min(text.length, end + 120);
  return normalizeWhitespace(text.slice(from, to)).slice(0, 220);
}

/* --------------------------------- people ---------------------------------- */

function findPeople(
  text: string,
  language: 'en' | 'ar',
  places: Candidate[],
  organizations: Candidate[],
): Candidate[] {
  const out: Candidate[] = [];
  const taken: [number, number][] = [];
  const claim = (start: number, end: number) => {
    if (taken.some(([s, e]) => start < e && end > s)) return false;
    taken.push([start, end]);
    return true;
  };

  const titles = [...PERSON_TITLES_EN, ...PERSON_TITLES_AR];
  // `(?<![\\p{L}\\p{N}])` instead of `\\b`: JavaScript's `\\b` is ASCII-only, so it
  // never matches in front of an Arabic title such as الدكتور.
  const titlePattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(${titles.map(escapeRe).join('|')})\\.?\\s+([\\p{Lu}\\p{L}][\\p{L}.]{1,20}(?:\\s+[\\p{Lu}\\p{L}][\\p{L}.]{1,20}){0,2})`,
    'gu',
  );

  let m: RegExpExecArray | null;
  while ((m = titlePattern.exec(text))) {
    const title = m[1];
    const rawName = m[2];
    const nameStart = m.index + title.length + (m[0].length - title.length - rawName.length);
    const name = cleanName(rawName);
    if (!name || name.length < 3) continue;
    if (NON_NAME_WORDS.has(name.split(' ')[0])) continue;
    if (isPlaceOrOrg(name, places, organizations)) continue;
    if (!claim(nameStart, nameStart + rawName.length)) continue;
    out.push({
      value: name,
      confidence: 0.88,
      evidence: sentenceAround(text, m.index, nameStart + rawName.length),
      start: nameStart,
      end: nameStart + rawName.length,
      count: 1,
      kind: `title:${title}`,
    });
  }

  // Quoted attribution: "…" said Jane Doe / قال فلان
  const attribution = /["”"]\s*(?:said|says|told|added|according to|قال|قالت|بحسب)\s+([^\n."”]{3,60})/gi;
  while ((m = attribution.exec(text))) {
    const rawName = m[1].trim();
    const name = cleanName(rawName);
    if (!name || name.split(' ').length < 2) continue;
    if (NON_NAME_WORDS.has(name.split(' ')[0])) continue;
    if (isPlaceOrOrg(name, places, organizations)) continue;
    const start = m.index + m[0].indexOf(rawName);
    if (!claim(start, start + rawName.length)) continue;
    out.push({
      value: name,
      confidence: 0.8,
      evidence: sentenceAround(text, m.index, start + rawName.length),
      start,
      end: start + rawName.length,
      count: 1,
      kind: 'attribution',
    });
  }

  // Repeated capitalised bigrams that are not places/orgs (weak signal).
  const bigramCounts = new Map<string, { count: number; start: number; end: number; sample: string }>();
  const bigramRe = /\b([A-Z][a-z]{2,})\s+([A-Z][a-z]{2,})\b/g;
  while ((m = bigramRe.exec(text))) {
    const first = m[1];
    const second = m[2];
    if (NON_NAME_WORDS.has(first) || NON_NAME_WORDS.has(second)) continue;
    if (isStopwordish(first) || isStopwordish(second)) continue;
    const key = `${first} ${second}`;
    if (isPlaceOrOrg(key, places, organizations)) continue;
    const entry = bigramCounts.get(key);
    if (entry) entry.count++;
    else bigramCounts.set(key, { count: 1, start: m.index, end: m.index + m[0].length, sample: sentenceAround(text, m.index, m.index + m[0].length) });
  }
  for (const [value, entry] of bigramCounts) {
    if (entry.count < 2) continue;
    if (!claim(entry.start, entry.end)) continue;
    out.push({
      value,
      confidence: Math.min(0.7, 0.45 + entry.count * 0.08),
      evidence: entry.sample,
      start: entry.start,
      end: entry.end,
      count: entry.count,
      kind: 'bigram',
    });
  }

  void language;
  return out;
}

function cleanName(raw: string): string {
  return normalizeWhitespace(raw)
    .replace(/[,.;:]+$/g, '')
    .replace(/\b(said|told|added|that|who|and|of|for|from|في|من|قال|قالت)\b.*$/i, '')
    .trim();
}

function isStopwordish(word: string): boolean {
  return STOPWORDS_EN.has(word.toLowerCase()) || STOPWORDS_AR.has(word);
}

function isPlaceOrOrg(name: string, places: Candidate[], orgs: Candidate[]): boolean {
  const key = fold(name);
  return places.some((p) => fold(p.value) === key) || orgs.some((o) => fold(o.value) === key);
}

/* --------------------------------- places ---------------------------------- */

function findUnknownPlaces(text: string, known: PlaceMatch[]): Candidate[] {
  const out: Candidate[] = [];
  const pattern = /\b(?:in|at|from|near|to|toward|towards|across|outside|داخل|في|من|قرب|خارج)\s+([A-Z][\p{L}]{2,}(?:\s+[A-Z][\p{L}]{2,}){0,2})/gu;
  const taken: [number, number][] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text))) {
    const rawName = m[1];
    const start = m.index + m[0].indexOf(rawName);
    const end = start + rawName.length;
    if (taken.some(([s, e]) => start < e && end > s)) continue;
    if (known.some((p) => start >= p.start && end <= p.end)) continue;
    const name = cleanName(rawName);
    if (!name || NON_NAME_WORDS.has(name.split(' ')[0])) continue;
    if (isStopwordish(name.split(' ')[0])) continue;
    taken.push([start, end]);
    out.push({
      value: name,
      confidence: 0.55,
      evidence: sentenceAround(text, start, end),
      start,
      end,
      count: 1,
      kind: 'prepositional',
    });
  }
  return out;
}

/* ------------------------------- organisations ------------------------------ */

const ORG_CONNECTORS = new Set([
  'of','for','and','the','al','bin','von','van','de','du','del','la','le','el','ministry','general',
]);

interface WordToken { text: string; start: number; end: number }

function wordTokens(text: string): WordToken[] {
  const out: WordToken[] = [];
  const pattern = /[\p{L}\p{N}.&'-]+/gu;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text))) {
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

const ARABIC_LETTER = /[\u0600-\u06FF]/;

function isCapitalised(token: string): boolean {
  if (ARABIC_LETTER.test(token)) return true;
  return /^[\p{Lu}]/u.test(token);
}

/**
 * Organisation detection: find a marker token ("Ministry", "Army", "وزارة", …)
 * and grow the name outward across capitalised words and connectors, so
 * "the Ministry of Foreign Affairs" is captured as one organisation.
 */
function findOrganizations(text: string, gazetteer: Gazetteer): Candidate[] {
  const markers = new Set(
    [...ORG_SUFFIXES, ...gazetteer.orgSuffixes()].map((m) => fold(m).replace(/[.,]$/, '')),
  );
  const tokens = wordTokens(text);
  const taken: [number, number][] = [];
  const out: Candidate[] = [];

  tokens.forEach((token, i) => {
    const key = fold(token.text).replace(/[.,]$/, '');
    if (!markers.has(key) || key.length < 3) return;

    let start = i;
    while (start - 1 >= 0 && i - (start - 1) <= 4) {
      const prev = tokens[start - 1];
      const prevKey = fold(prev.text);
      const usable = isCapitalised(prev.text) || ORG_CONNECTORS.has(prevKey);
      if (!usable || markers.has(prevKey)) break;
      start--;
    }
    let end = i;
    while (end + 1 < tokens.length && end + 1 - i <= 3) {
      const next = tokens[end + 1];
      const nextKey = fold(next.text);
      const usable = isCapitalised(next.text) || ORG_CONNECTORS.has(nextKey);
      if (!usable || markers.has(nextKey)) break;
      end++;
    }
    // Trim leading/trailing connectors ("the", "of").
    while (start < i && ORG_CONNECTORS.has(fold(tokens[start].text))) start++;
    while (end > i && ORG_CONNECTORS.has(fold(tokens[end].text))) end--;

    const from = tokens[start].start;
    const to = tokens[end].end;
    if (taken.some(([s, e]) => from < e && to > s)) return;
    taken.push([from, to]);

    const name = normalizeWhitespace(text.slice(from, to));
    const capitalisedCount = tokens.slice(start, end + 1).filter((t) => isCapitalised(t.text)).length;
    out.push({
      value: name,
      confidence: Math.min(0.95, Number((0.6 + capitalisedCount * 0.08).toFixed(3))),
      evidence: sentenceAround(text, from, to),
      start: from,
      end: to,
      count: 1,
      kind: `marker:${token.text}`,
    });
  });

  return out;
}

/* ---------------------------------- sides ---------------------------------- */

const SIDE_PATTERNS = [
  /\b(the\s+)?(government|regime|opposition|rebels?|militia|militias|coalition|alliance|army|military|police|security forces|parliament|congress|senate|administration|movement|front)\b/gi,
  /\b(الحكومة|النظام|المعارضة|المتمردين|الميليشيات|التحالف|الجيش|الشرطة|قوات الأمن|البرلمان|الحركة|الجبهة)\b/g,
];

function findSides(text: string): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const pattern of SIDE_PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text))) {
      const value = normalizeWhitespace(m[0]);
      const key = fold(value);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        value,
        confidence: 0.6,
        evidence: sentenceAround(text, m.index, m.index + m[0].length),
        start: m.index,
        end: m.index + m[0].length,
        count: 1,
        kind: 'side',
      });
    }
  }
  return out;
}

/* ------------------------------ classification ------------------------------ */

function scoreTaxonomy(text: string, taxonomy: TaxonomyRule[]): Candidate[] {
  const haystack = fold(text);
  const out: Candidate[] = [];
  for (const rule of taxonomy) {
    let hits = 0;
    const matched: string[] = [];
    for (const kw of rule.keywords) {
      const needle = fold(kw);
      if (!needle) continue;
      let idx = haystack.indexOf(needle);
      while (idx !== -1) {
        hits++;
        if (!matched.includes(kw)) matched.push(kw);
        idx = haystack.indexOf(needle, idx + needle.length);
      }
    }
    if (!hits) continue;
    const coverage = Math.min(1, hits / 6);
    out.push({
      value: rule.classification,
      confidence: Number((0.35 + coverage * 0.6).toFixed(3)),
      evidence: `matched: ${matched.slice(0, 6).join(', ')}`,
      start: -1,
      end: -1,
      count: hits,
      kind: 'taxonomy',
    });
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}

function scoreKeywords(words: string[], language: 'en' | 'ar'): Candidate[] {
  const stop = language === 'ar' ? STOPWORDS_AR : STOPWORDS_EN;
  const counts = new Map<string, number>();
  for (const raw of words) {
    const w = language === 'ar' ? raw : raw.toLowerCase();
    if (w.length < 4 || stop.has(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const total = Math.max(1, words.length);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([value, count]) => ({
      value,
      confidence: Number(Math.min(0.95, count / 10 + 0.1).toFixed(3)),
      evidence: `${count} occurrence(s) · ${((count / total) * 100).toFixed(2)}% of tokens`,
      start: -1,
      end: -1,
      count,
      kind: 'keyword',
    }));
}

/* --------------------------------- helpers --------------------------------- */

function mergeCandidates(candidates: (Candidate & { lat?: number; lon?: number; country?: string })[], limit: number): Candidate[] {
  const byValue = new Map<string, Candidate>();
  for (const c of candidates) {
    const value = normalizeWhitespace(c.value);
    if (!value) continue;
    const key = fold(value);
    const existing = byValue.get(key);
    if (!existing) {
      byValue.set(key, { ...c, value, count: c.count || 1 });
      continue;
    }
    existing.count = (existing.count || 1) + (c.count || 1);
    existing.confidence = Math.min(0.99, Math.max(existing.confidence, c.confidence) + 0.03);
    if (c.lat !== undefined && existing.lat === undefined) {
      existing.lat = c.lat;
      existing.lon = c.lon;
      existing.country = c.country;
    }
  }
  return [...byValue.values()].sort((a, b) => b.confidence - a.confidence || b.count - a.count).slice(0, limit);
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Merge an extraction result into existing analysis field values.
 *
 *  merge      — list fields are unioned; a manual classification is kept
 *  fill-empty — only blank fields are filled
 *  replace    — the extraction wins everywhere
 */
export type MergeMode = 'merge' | 'fill-empty' | 'replace';

export function mergeSuggestion(
  current: {
    classification?: string;
    list_names_people?: string;
    list_names_places?: string;
    list_coordinates?: string;
    list_sides?: string;
  },
  suggestion: ExtractionResult['suggestion'],
  mode: MergeMode = 'merge',
): typeof current {
  const combine = (existing: string | undefined, incoming: string, separator: string) => {
    if (mode === 'fill-empty' && !isBlank(existing)) return existing;
    if (mode === 'replace') return incoming;
    const base = splitList(existing ?? '');
    const extra = incoming
      .split(separator === ';' ? /;\s*/ : /,\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    return uniqueSorted([...base, ...extra]).join(separator === ';' ? '; ' : ', ');
  };

  const classification =
    mode === 'replace'
      ? suggestion.classification
      : mode === 'fill-empty'
        ? (isBlank(current.classification) ? suggestion.classification : current.classification)
        : (!isBlank(current.classification) ? current.classification : suggestion.classification);

  return {
    classification: classification ?? '',
    list_names_people: combine(current.list_names_people, suggestion.list_names_people, ',') ?? '',
    list_names_places: combine(current.list_names_places, suggestion.list_names_places, ',') ?? '',
    list_coordinates: combine(current.list_coordinates, suggestion.list_coordinates, ';') ?? '',
    list_sides: combine(current.list_sides, suggestion.list_sides, ',') ?? '',
  };
}
