/** Shared, dependency-free text / number / date primitives used across the core. */

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const ARABIC_NORMALIZE: [RegExp, string][] = [
  [/[\u0622\u0623\u0625]/g, '\u0627'], // أ إ آ → ا
  [/\u0649/g, '\u064A'], // ى → ي
  [/\u0629/g, '\u0647'], // ة → ه
  [/\u0643/g, '\u06A9'], // keep ك stable for matching
];

/** Unicode-ish fold used for case-insensitive, diacritic-insensitive matching. */
export function fold(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  s = s.replace(ARABIC_DIACRITICS, '');
  for (const [re, to] of ARABIC_NORMALIZE) s = s.replace(re, to);
  return s.toLowerCase().trim();
}

export function normalizeWhitespace(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return Number.isNaN(value);
  return normalizeWhitespace(value) === '' || String(value).toLowerCase() === 'none';
}

/** Split a list field on ; , newline or • — tolerant of the mixed data the spec allows. */
export function splitList(value: unknown): string[] {
  const s = String(value ?? '').trim();
  if (!s) return [];
  return s
    .split(/[;\n\u2022|]+|\s{2,},|,\s+/)
    .map((p) => p.trim().replace(/^[-*]\s*/, ''))
    .filter(Boolean);
}

/** Coordinates are always "lat,lon" pairs, so split them on ; or newline only. */
export function splitCoordinates(value: unknown): string[] {
  return String(value ?? '')
    .split(/[;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function joinList(values: string[]): string {
  return values.filter(Boolean).join(', ');
}

export function uniqueSorted(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = normalizeWhitespace(raw);
    if (!v) continue;
    const k = fold(v);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

export function levenshtein(a: string, b: string): number {
  const s = fold(a);
  const t = fold(b);
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  let prev = Array.from({ length: t.length + 1 }, (_, i) => i);
  let curr = new Array<number>(t.length + 1);
  for (let i = 1; i <= s.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= t.length; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1));
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[t.length];
}

/** 0..1 similarity, alias-aware (used by the import mapper). */
export function similarity(a: string, b: string): number {
  const x = fold(a).replace(/[_\-\s]/g, '');
  const y = fold(b).replace(/[_\-\s]/g, '');
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.85;
  const dist = levenshtein(x, y);
  return Math.max(0, 1 - dist / Math.max(x.length, y.length));
}

export function truncate(value: unknown, max = 120): string {
  const s = normalizeWhitespace(value);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function slugify(value: string): string {
  return fold(value)
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'record';
}

export function sanitizeFilename(value: string, fallback = 'export'): string {
  const cleaned = value
    .replace(/[\\/:*?"<>|\u0000-\u001F]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  return cleaned || fallback;
}

/* ---------------------------------- numbers --------------------------------- */

export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;
  const s = String(value).trim().replace(/,/g, '').replace(/%$/, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Accepts 0..1, 0..100, or "85%" and normalises to the stored 0..1 scale. */
export function toImportance(value: unknown): number | null {
  const n = toNumber(value);
  if (n === null) return null;
  const hadPercent = typeof value === 'string' && value.trim().endsWith('%');
  let v = n;
  if (hadPercent) v = n / 100;
  else if (n > 1) v = n / 100;
  return Math.min(1, Math.max(0, v));
}

export function formatPercent(value: unknown, digits = 1): string {
  const n = toNumber(value);
  if (n === null) return '-';
  const pct = n > 1 ? n : n * 100;
  return `${pct.toFixed(digits)}%`;
}

/* ----------------------------------- dates ---------------------------------- */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  'يناير': 1, 'كانون الثاني': 1, 'فبراير': 2, 'شباط': 2, 'مارس': 3, 'آذار': 3,
  'أبريل': 4, 'نيسان': 4, 'مايو': 5, 'أيار': 5, 'يونيو': 6, 'حزيران': 6,
  'يوليو': 7, 'تموز': 7, 'أغسطس': 8, 'آب': 8, 'سبتمبر': 9, 'أيلول': 9,
  'أكتوبر': 10, 'تشرين الأول': 10, 'نوفمبر': 11, 'تشرين الثاني': 11, 'ديسمبر': 12, 'كانون الأول': 12,
};

/** Parse the date formats users actually type; returns an ISO date or null. */
export function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const raw = String(value).trim();
  if (!raw) return null;

  // ISO / ISO with time
  let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return isoOf(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));

  // dd/mm/yyyy or dd-mm-yyyy. Ambiguous values are read day-first (the
  // convention used by every locale this application ships), so 03/02/2024 is
  // 3 February 2024. ISO input is handled by the branch above and is unaffected.
  m = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    let day = +m[1];
    let month = +m[2];
    let year = +m[3];
    if (year < 100) year += year > 50 ? 1900 : 2000;
    if (day <= 12 && month > 12) {
      const swap = day;
      day = month;
      month = swap;
    }
    return isoOf(year, month, day);
  }

  // "12 March 2024" / "March 12, 2024" / Arabic month names
  m = raw.match(/^(\d{1,2})\s+([^\d\s,]+)\s+(\d{4})/) ?? raw.match(/^([^\d\s,]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const first = m[1];
    const second = m[2];
    const third = m[3];
    const monthByName = MONTHS[first.replace(/\./g, '').toLowerCase()] ?? MONTHS[fold(first)];
    if (monthByName) return isoOf(+third, monthByName, +second);
    const monthByName2 = MONTHS[second.replace(/\./g, '').toLowerCase()] ?? MONTHS[fold(second)];
    if (monthByName2) return isoOf(+third, monthByName2, +first);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function isoOf(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

export function formatDate(value: unknown, withTime = false): string {
  const iso = parseDate(value);
  if (!iso) return '-';
  const dt = new Date(iso);
  const ymd = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  if (!withTime) return ymd;
  return `${ymd} ${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Value for an `<input type="datetime-local">`: `YYYY-MM-DDTHH:mm` in local
 * time. Returns '' when the value carries no usable date.
 */
export function toDateTimeLocal(value: unknown): string {
  const iso = parseDate(value);
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Inverse of {@link toDateTimeLocal}: local wall-clock string → ISO instant. */
export function fromDateTimeLocal(value: string): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return parseDate(raw);
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Local ISO instant for "now", for use as a default date-time field value. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** `YYYY-MM-DD HH:mm` — the canonical display form for every date field. */
export function formatDateTime(value: unknown): string {
  return formatDate(value, true);
}

export function startOfDay(value: unknown): number | null {
  const iso = parseDate(value);
  if (!iso) return null;
  const d = new Date(iso);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function timestamp(): string {
  return new Date().toISOString();
}

export function fileStamp(d = new Date()): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

/* --------------------------------- hashing ---------------------------------- */

export function crc32(bytes: Uint8Array): number {
  let crc = ~0;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

/** FNV-1a 64 (as two 32-bit halves) — stable, fast, dependency free. */
export function fnv1a64(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c & 0xff;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= (c >> 8) & 0xff;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

/** Deterministic JSON stringify — key order independent, safe for checksums. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function byteLength(text: string): number {
  return utf8Bytes(text).length;
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function id(prefix: string, entropy = 6): string {
  const rand = Math.random().toString(36).slice(2, 2 + entropy);
  return `${prefix}${Date.now().toString(36).slice(-5)}${rand}`;
}
