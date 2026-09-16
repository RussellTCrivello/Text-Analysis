/**
 * Timeline aggregation: turns sources, contents and analyses into a single
 * chronological event stream with filtering, sorting, statistics and chart
 * series — the data half of the Timeline workspace.
 */
import { isBlank, parseDate, splitList, truncate, uniqueSorted } from './text';
import type { AppData, Row } from './repository';

export type TimelineRecordType = 'source' | 'content' | 'analysis';

export interface TimelineEvent {
  id: string;
  type: TimelineRecordType;
  recordId: string;
  date: string;
  dayOfWeek: number;
  title: string;
  summary: string;
  source: string;
  people: string[];
  places: string[];
  classification: string;
  importance: number;
  hasCoordinates: boolean;
}

export interface TimelineFilters {
  from?: string;
  to?: string;
  search?: string;
  person?: string;
  place?: string;
  category?: string;
  types?: TimelineRecordType[];
}

export type TimelineSort = 'date' | 'people' | 'places' | 'classification' | 'source';
export type TimelineChart = 'daily' | 'monthly' | 'weekday' | 'type' | 'classification' | 'yearly';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function buildTimeline(data: AppData): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const sourceById = new Map(data.sources.map((s) => [String(s.id), s]));
  const contentById = new Map(data.contents.map((c) => [String(c.id), c]));

  for (const s of data.sources) {
    const iso = firstDate([s.date_entry, s.date_creation]);
    if (!iso) continue;
    events.push({
      id: `source:${s.id}`,
      type: 'source',
      recordId: String(s.id),
      date: iso,
      dayOfWeek: new Date(iso).getUTCDay(),
      title: String(s.name ?? ''),
      summary: truncate(s.description || s.note || `${s.type ?? ''} · ${s.country ?? ''}`, 200),
      source: String(s.name ?? ''),
      people: splitList(s.accounts),
      places: uniqueSorted([s.city, s.country].filter((v): v is string => !isBlank(v))),
      classification: String(s.type ?? ''),
      importance: Number(s.importance ?? 0),
      hasCoordinates: false,
    });
  }

  for (const c of data.contents) {
    const iso = firstDate([c.date_content, c.date_creation]);
    if (!iso) continue;
    const parent = sourceById.get(String(c.sources_id));
    events.push({
      id: `content:${c.id}`,
      type: 'content',
      recordId: String(c.id),
      date: iso,
      dayOfWeek: new Date(iso).getUTCDay(),
      title: String(c.title ?? '(untitled content)'),
      summary: truncate(c.content_data, 220),
      source: String(parent?.name ?? ''),
      people: [],
      places: uniqueSorted([parent?.city, parent?.country].filter((v): v is string => !isBlank(v))),
      classification: '',
      importance: Number(c.importance ?? 0),
      hasCoordinates: false,
    });
  }

  for (const a of data.analyses) {
    const iso = firstDate([a.date_analysis, a.date_creation]);
    if (!iso) continue;
    const content = contentById.get(String(a.content_id));
    const source = content ? sourceById.get(String(content.sources_id)) : undefined;
    events.push({
      id: `analysis:${a.id}`,
      type: 'analysis',
      recordId: String(a.id),
      date: iso,
      dayOfWeek: new Date(iso).getUTCDay(),
      title: String(a.classification ?? 'Analysis'),
      summary: truncate(content?.content_data ?? '', 220),
      source: String(source?.name ?? ''),
      people: splitList(a.list_names_people),
      places: splitList(a.list_names_places),
      classification: String(a.classification ?? ''),
      importance: Number(content?.importance ?? 0),
      hasCoordinates: !isBlank(a.list_coordinates),
    });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

function firstDate(values: unknown[]): string | null {
  for (const value of values) {
    const iso = parseDate(value);
    if (iso) return iso;
  }
  return null;
}

/** Date or date-time bound: bare dates expand to the whole day. */
function boundTs(value: string | null, edge: 'start' | 'end'): number | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/[T ]\d{1,2}:\d{2}/.test(raw)) return Date.parse(parseDate(raw) ?? raw);
  return Date.parse(`${raw}T${edge === 'start' ? '00:00:00' : '23:59:59'}Z`);
}

export function filterTimeline(events: TimelineEvent[], filters: TimelineFilters): TimelineEvent[] {
  const from = boundTs(filters.from ?? null, 'start');
  const to = boundTs(filters.to ?? null, 'end');
  const query = (filters.search ?? '').trim().toLowerCase();

  return events.filter((event) => {
    const ts = Date.parse(event.date);
    if (from !== null && ts < from) return false;
    if (to !== null && ts > to) return false;
    if (filters.types?.length && !filters.types.includes(event.type)) return false;
    if (filters.person && !event.people.some((p) => p.toLowerCase() === filters.person?.toLowerCase())) return false;
    if (filters.place && !event.places.some((p) => p.toLowerCase() === filters.place?.toLowerCase())) return false;
    if (filters.category && event.classification.toLowerCase() !== filters.category.toLowerCase()) return false;
    if (query) {
      const haystack = [event.title, event.summary, event.classification, event.source, ...event.people, ...event.places]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function sortTimeline(
  events: TimelineEvent[],
  sort: TimelineSort = 'date',
  direction: 'asc' | 'desc' = 'asc',
): TimelineEvent[] {
  const factor = direction === 'asc' ? 1 : -1;
  const sorted = [...events].sort((a, b) => {
    switch (sort) {
      case 'people':
        return cmp(join(a.people), join(b.people)) || cmp(a.date, b.date);
      case 'places':
        return cmp(join(a.places), join(b.places)) || cmp(a.date, b.date);
      case 'classification':
        return cmp(a.classification, b.classification) || cmp(a.date, b.date);
      case 'source':
        return cmp(a.source, b.source) || cmp(a.date, b.date);
      default:
        return cmp(a.date, b.date);
    }
  });
  return factor === 1 ? sorted : sorted.reverse();
}

function join(values: string[]): string {
  return values.join(', ').toLowerCase();
}

function cmp(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

export interface TimelineStats {
  total: number;
  filtered: number;
  sources: number;
  contents: number;
  analyses: number;
  withCoordinates: number;
}

export function timelineStats(all: TimelineEvent[], filtered: TimelineEvent[]): TimelineStats {
  return {
    total: all.length,
    filtered: filtered.length,
    sources: filtered.filter((e) => e.type === 'source').length,
    contents: filtered.filter((e) => e.type === 'content').length,
    analyses: filtered.filter((e) => e.type === 'analysis').length,
    withCoordinates: filtered.filter((e) => e.hasCoordinates).length,
  };
}

export interface TimelineSummary {
  total: number;
  byType: { type: TimelineRecordType; count: number; share: number }[];
  topCategories: { label: string; count: number; share: number }[];
  topPeople: { label: string; count: number }[];
  topPlaces: { label: string; count: number }[];
  mostActivePeriod: { label: string; count: number } | null;
  range: { from: string | null; to: string | null };
  narrative: string;
}

export function summarizeTimeline(events: TimelineEvent[]): TimelineSummary {
  const total = events.length || 1;
  const byType = (['source', 'content', 'analysis'] as TimelineRecordType[]).map((type) => {
    const count = events.filter((e) => e.type === type).length;
    return { type, count, share: Number((count / total).toFixed(4)) };
  });

  const topCategories = countBy(events.map((e) => e.classification).filter(Boolean), 5).map(([label, count]) => ({
    label,
    count,
    share: Number((count / total).toFixed(4)),
  }));
  const topPeople = countBy(events.flatMap((e) => e.people), 5).map(([label, count]) => ({ label, count }));
  const topPlaces = countBy(events.flatMap((e) => e.places), 5).map(([label, count]) => ({ label, count }));
  const months = countBy(events.map((e) => e.date.slice(0, 7)), 1);
  const mostActive = months[0] ? { label: months[0][0], count: months[0][1] } : null;
  const dates = events.map((e) => e.date).sort();

  const narrative = [
    `${events.length} event(s) in range`,
    byType.map((b) => `${b.count} ${b.type}s (${(b.share * 100).toFixed(0)}%)`).join(', '),
    topCategories.length ? `top categories: ${topCategories.map((c) => `${c.label} (${c.count})`).join(', ')}` : '',
    mostActive ? `busiest month: ${mostActive.label} (${mostActive.count})` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    total: events.length,
    byType,
    topCategories,
    topPeople,
    topPlaces,
    mostActivePeriod: mostActive,
    range: { from: dates[0]?.slice(0, 10) ?? null, to: dates[dates.length - 1]?.slice(0, 10) ?? null },
    narrative,
  };
}

function countBy(values: string[], limit: number): [string, number][] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit || undefined);
}

export function timelineSeries(events: TimelineEvent[], chart: TimelineChart): { name: string; value: number }[] {
  switch (chart) {
    case 'daily':
      return countBy(events.map((e) => e.date.slice(0, 10)), 0)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, value]) => ({ name, value }));
    case 'monthly':
      return countBy(events.map((e) => e.date.slice(0, 7)), 0)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, value]) => ({ name, value }));
    case 'yearly':
      return countBy(events.map((e) => e.date.slice(0, 4)), 0)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, value]) => ({ name, value }));
    case 'weekday':
      return WEEKDAYS.map((name, index) => ({ name, value: events.filter((e) => e.dayOfWeek === index).length }));
    case 'type':
      return (['source', 'content', 'analysis'] as TimelineRecordType[]).map((type) => ({
        name: type,
        value: events.filter((e) => e.type === type).length,
      }));
    case 'classification':
      return countBy(events.map((e) => e.classification).filter(Boolean), 12).map(([name, value]) => ({ name, value }));
    default:
      return [];
  }
}

/** Filter option lists (people / places / categories) for the Timeline toolbar. */
export function timelineFacets(events: TimelineEvent[]): { people: string[]; places: string[]; categories: string[] } {
  return {
    people: uniqueSorted(events.flatMap((e) => e.people)),
    places: uniqueSorted(events.flatMap((e) => e.places)),
    categories: uniqueSorted(events.map((e) => e.classification).filter(Boolean)),
  };
}

export function paginateEvents<T>(items: T[], page: number, pageSize: number): { slice: T[]; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  return { slice: items.slice((current - 1) * pageSize, current * pageSize), pages };
}

export function timelineRows(events: TimelineEvent[]): Row[] {
  return events.map((e) => ({
    id: e.recordId,
    record_type: e.type,
    date: e.date.slice(0, 10),
    title: e.title,
    summary: e.summary,
    source: e.source,
    people: e.people.join(', '),
    places: e.places.join(', '),
    classification: e.classification,
    importance: e.importance,
  }));
}

export { WEEKDAYS };
