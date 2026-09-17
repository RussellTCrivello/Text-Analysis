/**
 * Pure chart maths for the overview band (sparklines, donut, deltas).
 * Kept React-free so it is unit-testable and reusable by print/exports.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Count items per calendar day for the trailing `days` window (today last).
 * Dates that fail to parse are ignored; missing days count as zero so the
 * sparkline keeps a stable x-axis.
 */
export function countPerDay(
  dates: (string | number | undefined)[],
  days = 14,
  now: Date = new Date(),
): number[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const buckets = new Array<number>(days).fill(0);
  for (const raw of dates) {
    if (raw === undefined || raw === null || raw === '') continue;
    const t = typeof raw === 'number' ? raw : Date.parse(String(raw));
    if (Number.isNaN(t)) continue;
    const d = new Date(t);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const idx = days - 1 - Math.round((today - day) / DAY_MS);
    if (idx >= 0 && idx < days) buckets[idx] += 1;
  }
  return buckets;
}

/** Items created in the last `days` (inclusive of today). */
export function createdWithin(
  dates: (string | number | undefined)[],
  days = 7,
  now: Date = new Date(),
): number {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - (days - 1) * DAY_MS;
  let n = 0;
  for (const raw of dates) {
    if (raw === undefined || raw === null || raw === '') continue;
    const t = typeof raw === 'number' ? raw : Date.parse(String(raw));
    if (!Number.isNaN(t) && t >= cutoff) n += 1;
  }
  return n;
}

export interface CategorySlice {
  label: string;
  value: number;
  /** 0..1 of the whole population, exact across slices (largest absorbs drift). */
  share: number;
}

/** Top-N categorical distribution with an "Other" tail. Empty → []. */
export function categoryCounts(values: (string | undefined)[], top = 4, otherLabel = 'Other'): CategorySlice[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const v of values) {
    const key = String(v ?? '').trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    total += 1;
  }
  if (!total) return [];
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const head = sorted.slice(0, top);
  const tail = sorted.slice(top).reduce((n, [, c]) => n + c, 0);
  const slices: CategorySlice[] = head.map(([label, value]) => ({
    label,
    value,
    share: value / total,
  }));
  if (tail > 0) slices.push({ label: otherLabel, value: tail, share: tail / total });
  return slices;
}

const CATEGORY_PALETTE = [
  '#6366F1', // iris
  '#0EA5E9', // sky
  '#8B5CF6', // violet
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
] as const

/** Stable hue for an arbitrary category string (source types, tags…). */
export function paletteFor(value: string): string {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0
  return CATEGORY_PALETTE[h % CATEGORY_PALETTE.length]
}
