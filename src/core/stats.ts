/**
 * Statistics engine shared by the Statistics dialogs, the Timeline analysis
 * panel, the All Data summary and the Performance Monitor.
 */
import { fieldsOf, SCHEMA, type EntityName } from './schema';
import { fold, isBlank, parseDate, splitCoordinates, splitList, toNumber } from './text';
import type { AppData, Row } from './repository';

export interface StatBucket {
  key: string;
  label: string;
  count: number;
  share: number;
  avgImportance?: number;
}

export interface FieldStats {
  field: string;
  filled: number;
  empty: number;
  unique: number;
  top: StatBucket[];
}

export interface EntityStats {
  entity: EntityName;
  total: number;
  avgImportance: number;
  importanceBands: StatBucket[];
  dateRange: { from: string | null; to: string | null };
  fields: FieldStats[];
  /** Analysis-only extras. */
  uniquePeople?: number;
  uniquePlaces?: number;
  withCoordinates?: number;
  classifications?: StatBucket[];
}

export const IMPORTANCE_BANDS: { label: string; min: number; max: number }[] = [
  { label: 'Critical (80–100%)', min: 0.8, max: 1.01 },
  { label: 'High (60–80%)', min: 0.6, max: 0.8 },
  { label: 'Medium (40–60%)', min: 0.4, max: 0.6 },
  { label: 'Low (20–40%)', min: 0.2, max: 0.4 },
  { label: 'Very low (0–20%)', min: 0, max: 0.2 },
];

export function bucket(rows: Row[], field: string, options: { split?: boolean; limit?: number } = {}): StatBucket[] {
  const counts = new Map<string, { label: string; count: number; importance: number[] }>();
  for (const row of rows) {
    const raw = row[field];
    const values = options.split ? splitList(raw) : [String(raw ?? '').trim()];
    for (const value of values) {
      const label = value.trim();
      if (!label) continue;
      const key = fold(label);
      const entry = counts.get(key) ?? { label, count: 0, importance: [] };
      entry.count++;
      const imp = toNumber(row.importance);
      if (imp !== null) entry.importance.push(imp);
      counts.set(key, entry);
    }
  }
  const total = [...counts.values()].reduce((n, c) => n + c.count, 0) || 1;
  const limit = options.limit ?? 20;
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((c) => ({
      key: fold(c.label),
      label: c.label,
      count: c.count,
      share: Number((c.count / total).toFixed(4)),
      avgImportance: c.importance.length
        ? Number((c.importance.reduce((a, b) => a + b, 0) / c.importance.length).toFixed(3))
        : undefined,
    }));
}

export function computeEntityStats(entity: EntityName, rows: Row[]): EntityStats {
  const total = rows.length;
  const importances = rows.map((r) => toNumber(r.importance)).filter((n): n is number => n !== null);
  const avgImportance = importances.length
    ? Number((importances.reduce((a, b) => a + b, 0) / importances.length).toFixed(4))
    : 0;

  const dateKeys = SCHEMA[entity].dateFields;
  let from: number | null = null;
  let to: number | null = null;
  let fromIso: string | null = null;
  let toIso: string | null = null;
  for (const row of rows) {
    for (const key of dateKeys) {
      const iso = parseDate(row[key]);
      if (!iso) continue;
      const ts = Date.parse(iso);
      if (from === null || ts < from) {
        from = ts;
        fromIso = iso.slice(0, 10);
      }
      if (to === null || ts > to) {
        to = ts;
        toIso = iso.slice(0, 10);
      }
      break;
    }
  }

  const fields: FieldStats[] = fieldsOf(entity)
    .filter((f) => f.kind !== 'id' && !f.system)
    .map((field) => {
      let filled = 0;
      const seen = new Set<string>();
      for (const row of rows) {
        const value = row[field.key];
        if (!isBlank(value)) {
          filled++;
          seen.add(fold(value));
        }
      }
      return {
        field: field.key,
        filled,
        empty: total - filled,
        unique: seen.size,
        top: bucket(rows, field.key, { split: field.kind === 'list', limit: 10 }),
      };
    });

  const stats: EntityStats = {
    entity,
    total,
    avgImportance,
    importanceBands: IMPORTANCE_BANDS.map((band) => {
      const count = importances.filter((n) => n >= band.min && n < band.max).length;
      return {
        key: band.label,
        label: band.label,
        count,
        share: total ? Number((count / total).toFixed(4)) : 0,
      };
    }),
    dateRange: { from: fromIso, to: toIso },
    fields,
  };

  if (entity === 'analyses') {
    const people = new Set<string>();
    const places = new Set<string>();
    let withCoordinates = 0;
    for (const row of rows) {
      for (const p of splitList(row.list_names_people)) people.add(fold(p));
      for (const p of splitList(row.list_names_places)) places.add(fold(p));
      if (splitCoordinates(row.list_coordinates).length) withCoordinates++;
    }
    stats.uniquePeople = people.size;
    stats.uniquePlaces = places.size;
    stats.withCoordinates = withCoordinates;
    stats.classifications = bucket(rows, 'classification', { split: true, limit: 12 });
  }

  return stats;
}

export interface WorkspaceStats {
  counts: Record<EntityName, number>;
  total: number;
  avgImportance: number;
  coverage: { label: string; value: number }[];
  byCountry: StatBucket[];
  bySourceType: StatBucket[];
  byClassification: StatBucket[];
  dateRange: { from: string | null; to: string | null };
  integrity: { orphanContents: number; orphanAnalyses: number };
}

export function computeWorkspaceStats(data: AppData): WorkspaceStats {
  const all = [...data.sources, ...data.contents, ...data.analyses];
  const importances = all.map((r) => toNumber(r.importance)).filter((n): n is number => n !== null);
  const sourceIds = new Set(data.sources.map((s) => String(s.id)));
  const contentIds = new Set(data.contents.map((c) => String(c.id)));
  const dated = [
    ...data.sources.map((s) => parseDate(s.date_entry) ?? parseDate(s.date_creation)),
    ...data.contents.map((c) => parseDate(c.date_content) ?? parseDate(c.date_creation)),
    ...data.analyses.map((a) => parseDate(a.date_analysis) ?? parseDate(a.date_creation)),
  ].filter((d): d is string => Boolean(d));
  dated.sort();

  const withText = data.contents.filter((c) => !isBlank(c.content_data)).length;
  const analysed = new Set(data.analyses.map((a) => String(a.content_id)));

  return {
    counts: {
      sources: data.sources.length,
      contents: data.contents.length,
      analyses: data.analyses.length,
    },
    total: all.length,
    avgImportance: importances.length
      ? Number((importances.reduce((a, b) => a + b, 0) / importances.length).toFixed(4))
      : 0,
    coverage: [
      { label: 'Contents with text', value: data.contents.length ? withText / data.contents.length : 0 },
      { label: 'Contents analysed', value: data.contents.length ? analysed.size / data.contents.length : 0 },
      {
        label: 'Analyses with coordinates',
        value: data.analyses.length
          ? data.analyses.filter((a) => splitCoordinates(a.list_coordinates).length).length / data.analyses.length
          : 0,
      },
    ].map((c) => ({ label: c.label, value: Number(c.value.toFixed(3)) })),
    byCountry: bucket(data.sources, 'country', { limit: 15 }),
    bySourceType: bucket(data.sources, 'type', { limit: 15 }),
    byClassification: bucket(data.analyses, 'classification', { split: true, limit: 15 }),
    dateRange: { from: dated[0]?.slice(0, 10) ?? null, to: dated[dated.length - 1]?.slice(0, 10) ?? null },
    integrity: {
      orphanContents: data.contents.filter((c) => !sourceIds.has(String(c.sources_id))).length,
      orphanAnalyses: data.analyses.filter((a) => !contentIds.has(String(a.content_id))).length,
    },
  };
}

/** Record frequency by day/month/year — used by the "Frequency" toolbar action. */
export function frequencyByPeriod(
  rows: Row[],
  dateField: string,
  period: 'day' | 'month' | 'year',
): StatBucket[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const iso = parseDate(row[dateField]);
    if (!iso) continue;
    const key = period === 'day' ? iso.slice(0, 10) : period === 'month' ? iso.slice(0, 7) : iso.slice(0, 4);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = rows.length || 1;
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ key, label: key, count, share: Number((count / total).toFixed(4)) }));
}

/** Compare up to N analyses side by side (the Analysis "Compare" action). */
export function compareRecords(rows: Row[], fields: string[]): { field: string; values: (string | null)[] }[] {
  return fields.map((field) => ({
    field,
    values: rows.map((row) => {
      const value = row[field];
      return isBlank(value) ? null : String(value);
    }),
  }));
}
