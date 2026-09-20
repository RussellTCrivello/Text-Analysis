/**
 * Audit trail. Every mutation performed through the Repository is recorded here
 * (create / update / delete / import / bulk / restore), matching the
 * "Audit Trail: tracks create, update and delete operations" requirement.
 */
import { id, timestamp } from './text';
import type { EntityName } from './schema';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'bulk_delete'
  | 'bulk_update'
  | 'import'
  | 'restore'
  | 'merge'
  | 'reset'
  | 'load_sample';

export interface AuditEntry {
  id: string;
  ts: string;
  actor: string;
  action: AuditAction;
  entity: EntityName | 'workspace';
  recordId: string;
  title: string;
  summary: string;
  /** Only the fields that changed, for updates. */
  changes?: { field: string; before: unknown; after: unknown }[];
  meta?: Record<string, unknown>;
}

export interface AuditFilter {
  action?: AuditAction | 'all';
  entity?: EntityName | 'all';
  from?: string;
  to?: string;
  search?: string;
}

export interface AuditLogSnapshot {
  entries: AuditEntry[];
  truncated: boolean;
}

const DEFAULT_ACTOR = 'local-user';

export class AuditLog {
  private entries: AuditEntry[] = [];
  private readonly maxEntries: number;

  constructor(capacity = 2000) {
    this.maxEntries = capacity;
  }

  record(input: Omit<AuditEntry, 'id' | 'ts' | 'actor'> & Partial<Pick<AuditEntry, 'actor' | 'ts'>>): AuditEntry {
    const entry: AuditEntry = {
      id: id('log'),
      ts: input.ts ?? timestamp(),
      actor: input.actor ?? DEFAULT_ACTOR,
      action: input.action,
      entity: input.entity,
      recordId: input.recordId,
      title: input.title,
      summary: input.summary,
      changes: input.changes,
      meta: input.meta,
    };
    this.entries = [entry, ...this.entries].slice(0, this.maxEntries);
    return entry;
  }

  list(filter: AuditFilter = {}): AuditEntry[] {
    const q = (filter.search ?? '').trim().toLowerCase();
    const from = filter.from ? Date.parse(filter.from) : null;
    const to = filter.to ? Date.parse(filter.to) + 86399999 : null;
    return this.entries.filter((e) => {
      if (filter.action && filter.action !== 'all' && e.action !== filter.action) return false;
      if (filter.entity && filter.entity !== 'all' && e.entity !== filter.entity) return false;
      const ts = Date.parse(e.ts);
      if (from !== null && ts < from) return false;
      if (to !== null && ts > to) return false;
      if (q) {
        const haystack = `${e.title} ${e.summary} ${e.recordId} ${e.action}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  countsByAction(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const e of this.entries) out[e.action] = (out[e.action] ?? 0) + 1;
    return out;
  }

  get size(): number {
    return this.entries.length;
  }

  /** Ring-buffer size the log wraps at; UIs display "N / capacity". */
  get capacity(): number {
    return this.maxEntries;
  }

  get full(): boolean {
    return this.entries.length >= this.maxEntries;
  }

  clear(): void {
    this.entries = [];
  }

  snapshot(): AuditLogSnapshot {
    return { entries: [...this.entries], truncated: this.full };
  }

  restore(snapshot: AuditEntry[]): void {
    this.entries = [...snapshot].slice(0, this.maxEntries);
  }

  toJSON(): AuditEntry[] {
    return this.entries;
  }

  static fromJSON(raw: unknown): AuditLog {
    const log = new AuditLog();
    if (Array.isArray(raw)) log.restore(raw as AuditEntry[]);
    return log;
  }
}

/** Diff two records into the list of changed fields (system timestamps excluded). */
export function diffRecords(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>,
  ignore: string[] = ['date_modified'],
): { field: string; before: unknown; after: unknown }[] {
  if (!before) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: { field: string; before: unknown; after: unknown }[] = [];
  for (const key of keys) {
    if (ignore.includes(key)) continue;
    const a = before[key];
    const b = after[key];
    if (String(a ?? '') !== String(b ?? '')) out.push({ field: key, before: a, after: b });
  }
  return out;
}
