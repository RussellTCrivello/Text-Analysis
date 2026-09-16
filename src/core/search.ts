/**
 * Search engine: free-text search across every tab, plus the condition-based
 * Advanced Search with saved searches and history.
 */
import { fold, isBlank, parseDate, toNumber } from './text';
import type { Row } from './repository';

export type SearchOperator =
  | 'contains'
  | 'not_contains'
  | 'equals'
  | 'not_equals'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'between'
  | 'in_list'
  | 'not_in_list'
  | 'is_empty'
  | 'is_not_empty'
  | 'regex';

export const SEARCH_OPERATORS: { value: SearchOperator; label: string; needsValue: boolean }[] = [
  { value: 'contains', label: 'contains', needsValue: true },
  { value: 'not_contains', label: 'does not contain', needsValue: true },
  { value: 'equals', label: 'equals', needsValue: true },
  { value: 'not_equals', label: 'does not equal', needsValue: true },
  { value: 'starts_with', label: 'starts with', needsValue: true },
  { value: 'ends_with', label: 'ends with', needsValue: true },
  { value: 'gt', label: 'greater than', needsValue: true },
  { value: 'lt', label: 'less than', needsValue: true },
  { value: 'gte', label: 'at least', needsValue: true },
  { value: 'lte', label: 'at most', needsValue: true },
  { value: 'between', label: 'between (a,b)', needsValue: true },
  { value: 'in_list', label: 'in list (a,b,c)', needsValue: true },
  { value: 'not_in_list', label: 'not in list', needsValue: true },
  { value: 'is_empty', label: 'is empty', needsValue: false },
  { value: 'is_not_empty', label: 'is not empty', needsValue: false },
  { value: 'regex', label: 'matches regex', needsValue: true },
];

export interface SearchCondition {
  id: string;
  field: string;
  operator: SearchOperator;
  value: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  entity: string;
  conditions: SearchCondition[];
  logic: 'AND' | 'OR';
  createdAt: string;
  uses: number;
}

/** Case-insensitive, diacritic-insensitive free-text search across the given fields. */
export function freeTextSearch<T extends Row>(rows: T[], term: string, fields?: string[]): T[] {
  const needle = fold(term);
  if (!needle) return rows;
  const terms = needle.split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    const haystack = fold(
      fields
        ? fields.map((f) => row[f]).join(' ')
        : Object.values(row)
            .map((v) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '')))
            .join(' '),
    );
    return terms.every((t) => haystack.includes(t));
  });
}

/** Date-range filter that keeps undated rows visible (per the interface spec). */
export function applyDateFilter<T extends Row>(
  rows: T[],
  from: string | null,
  to: string | null,
  dateFields: string[],
): T[] {
  if (!from && !to) return rows;
  const fromTs = boundTs(from, 'start');
  const toTs = boundTs(to, 'end');
  return rows.filter((row) => {
    for (const field of dateFields) {
      const iso = parseDate(row[field]);
      if (!iso) continue;
      const ts = Date.parse(iso);
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      return true;
    }
    // Rows with no usable date are always kept.
    return true;
  });
}

/**
 * Range bounds accept either a bare date (`2024-03-05`, expanded to the start or
 * end of that day) or a full date-time value, which is used exactly as given.
 */
function boundTs(value: string | null, edge: 'start' | 'end'): number | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/[T ]\d{1,2}:\d{2}/.test(raw)) {
    const iso = parseDate(raw);
    return iso ? Date.parse(iso) : null;
  }
  return Date.parse(`${raw}T${edge === 'start' ? '00:00:00' : '23:59:59'}Z`);
}

export function evaluateCondition(row: Row, condition: SearchCondition): boolean {
  const raw = row[condition.field];
  const value = condition.value ?? '';
  const cellText = isBlank(raw) ? '' : String(raw);
  const cellFold = fold(cellText);
  const needleFold = fold(value);

  switch (condition.operator) {
    case 'contains':
      return cellFold.includes(needleFold);
    case 'not_contains':
      return !cellFold.includes(needleFold);
    case 'equals':
      return cellFold === needleFold || numericEquals(cellText, value);
    case 'not_equals':
      return !(cellFold === needleFold || numericEquals(cellText, value));
    case 'starts_with':
      return cellFold.startsWith(needleFold);
    case 'ends_with':
      return cellFold.endsWith(needleFold);
    case 'is_empty':
      return isBlank(raw);
    case 'is_not_empty':
      return !isBlank(raw);
    case 'gt':
    case 'lt':
    case 'gte':
    case 'lte': {
      const a = compareValues(cellText, value);
      if (a === null) return false;
      if (condition.operator === 'gt') return a > 0;
      if (condition.operator === 'lt') return a < 0;
      if (condition.operator === 'gte') return a >= 0;
      return a <= 0;
    }
    case 'between': {
      const [lowRaw, highRaw] = value.split(',').map((v) => v.trim());
      const low = compareValues(cellText, lowRaw);
      const high = compareValues(cellText, highRaw);
      if (low === null || high === null) return false;
      return low >= 0 && high <= 0;
    }
    case 'in_list':
    case 'not_in_list': {
      const list = value.split(',').map((v) => fold(v.trim()));
      const parts = cellFold.split(/[,;]/).map((p) => p.trim());
      const hit = parts.some((p) => list.includes(p)) || list.includes(cellFold);
      return condition.operator === 'in_list' ? hit : !hit;
    }
    case 'regex': {
      try {
        return new RegExp(value, 'i').test(cellText);
      } catch {
        return false;
      }
    }
    default:
      return true;
  }
}

function numericEquals(a: string, b: string): boolean {
  const na = toNumber(a);
  const nb = toNumber(b);
  return na !== null && nb !== null && na === nb;
}

function compareValues(cell: string, value: string): number | null {
  const na = toNumber(cell);
  const nb = toNumber(value);
  if (na !== null && nb !== null) return na === nb ? 0 : na < nb ? -1 : 1;
  const da = parseDate(cell);
  const db = parseDate(value);
  if (da && db) return da < db ? -1 : da > db ? 1 : 0;
  if (isBlank(cell) && isBlank(value)) return 0;
  if (isBlank(cell)) return null;
  return fold(cell).localeCompare(fold(value));
}

export function runAdvancedSearch<T extends Row>(
  rows: T[],
  conditions: SearchCondition[],
  logic: 'AND' | 'OR' = 'AND',
): T[] {
  const active = conditions.filter((c) => c.field && c.operator);
  if (!active.length) return rows;
  return rows.filter((row) => {
    const results = active.map((c) => evaluateCondition(row, c));
    return logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
  });
}

/** Translate conditions into the equivalent SQL WHERE clause (Reports integration). */
export function conditionsToSql(conditions: SearchCondition[], logic: 'AND' | 'OR' = 'AND'): string {
  const parts = conditions
    .filter((c) => c.field && c.operator)
    .map((c) => {
      const f = c.field;
      const v = c.value.replace(/'/g, "''");
      switch (c.operator) {
        case 'contains': return `${f} LIKE '%${v}%'`;
        case 'not_contains': return `${f} NOT LIKE '%${v}%'`;
        case 'equals': return numericEquals('', c.value) ? `${f} = ${c.value}` : `${f} = '${v}'`;
        case 'not_equals': return `${f} != '${v}'`;
        case 'starts_with': return `${f} LIKE '${v}%'`;
        case 'ends_with': return `${f} LIKE '%${v}'`;
        case 'gt': return `${f} > '${v}'`;
        case 'lt': return `${f} < '${v}'`;
        case 'gte': return `${f} >= '${v}'`;
        case 'lte': return `${f} <= '${v}'`;
        case 'between': {
          const [a, b] = c.value.split(',').map((x) => x.trim());
          return `${f} BETWEEN '${a}' AND '${b}'`;
        }
        case 'in_list': return `${f} IN (${c.value.split(',').map((x) => `'${x.trim().replace(/'/g, "''")}'`).join(', ')})`;
        case 'not_in_list': return `${f} NOT IN (${c.value.split(',').map((x) => `'${x.trim().replace(/'/g, "''")}'`).join(', ')})`;
        case 'is_empty': return `(${f} IS NULL OR ${f} = '')`;
        case 'is_not_empty': return `(${f} IS NOT NULL AND ${f} != '')`;
        case 'regex': return `${f} LIKE '%${v}%'`;
        default: return '1=1';
      }
    });
  return parts.join(logic === 'AND' ? ' AND ' : ' OR ');
}

/* ---------------------------- saved search store ---------------------------- */

export interface SavedSearchStore {
  list(entity?: string): SavedSearch[];
  save(search: Omit<SavedSearch, 'createdAt' | 'uses'>): SavedSearch;
  remove(id: string): boolean;
  touch(id: string): void;
}

export class LocalSavedSearchStore implements SavedSearchStore {
  private items: SavedSearch[] = [];
  private readonly key: string;

  constructor(key = 'tam.searches', seed: SavedSearch[] = []) {
    this.key = key;
    this.items = [...seed];
  }

  list(entity?: string): SavedSearch[] {
    const filtered = entity ? this.items.filter((s) => s.entity === entity) : this.items;
    return [...filtered].sort((a, b) => b.uses - a.uses || b.createdAt.localeCompare(a.createdAt));
  }

  save(search: Omit<SavedSearch, 'createdAt' | 'uses'>): SavedSearch {
    const existing = this.items.find((s) => s.name === search.name && s.entity === search.entity);
    if (existing) {
      existing.conditions = search.conditions;
      existing.logic = search.logic;
      return existing;
    }
    const record: SavedSearch = { ...search, createdAt: new Date().toISOString(), uses: 0 };
    this.items = [record, ...this.items];
    return record;
  }

  remove(id: string): boolean {
    const before = this.items.length;
    this.items = this.items.filter((s) => s.id !== id);
    return this.items.length !== before;
  }

  touch(id: string): void {
    const found = this.items.find((s) => s.id === id);
    if (found) found.uses++;
  }

  toJSON(): SavedSearch[] {
    return [...this.items];
  }
}
