/**
 * Repository — the relational core of the application.
 *
 * It owns the three collections and enforces everything a database would:
 *   • primary keys and system timestamps ("triggers" for date_modified)
 *   • foreign-key integrity with ON DELETE CASCADE (source → contents → analyses)
 *   • uniqueness, validation and duplicate detection on every write
 *   • transactions with rollback
 *   • an audit trail entry for every mutation
 *   • undo / redo over snapshots
 *   • persistence through an injected StorageAdapter
 *
 * The class is framework-agnostic: React, a CLI, or a test harness can all use it.
 */
import { AuditLog, diffRecords, type AuditAction, type AuditEntry } from './audit';
import { createStorage, StorageQuotaError, type StorageAdapter } from './persist';
import { SCHEMA, ENTITY_ORDER, type EntityName } from './schema';
import { hasErrors, normalizeRecord, validateRecord, type ValidationIssue } from './validation';
import { fileStamp, fnv1a64, id as makeId, stableStringify, timestamp } from './text';

export type Row = Record<string, unknown>;

export interface AppData {
  sources: Row[];
  contents: Row[];
  analyses: Row[];
}

export interface WriteResult {
  ok: boolean;
  issues: ValidationIssue[];
  record?: Row;
  /** Records removed as a consequence of a cascade delete. */
  cascaded?: { entity: EntityName; ids: string[] }[];
}

export interface WriteOptions {
  /** Skip validation (used by restore/merge of already-validated payloads). */
  skipValidation?: boolean;
  /** Reject records that exactly duplicate an existing row. */
  detectDuplicates?: boolean;
  /** Audit label; defaults to the operation name. */
  action?: AuditAction;
  /** Do not write an audit entry (internal use). */
  silent?: boolean;
}

export type ChangeType = 'insert' | 'update' | 'delete' | 'replace';
export interface ChangeEvent {
  type: ChangeType;
  entity: EntityName | 'workspace';
  ids: string[];
  action: AuditAction;
}

export interface RepositoryStats {
  counts: Record<EntityName, number>;
  total: number;
  bytes: number;
  checksum: string;
  undoDepth: number;
  redoDepth: number;
  auditEntries: number;
  orphans: Record<EntityName, number>;
  lastPersisted: string | null;
}

const EMPTY: AppData = { sources: [], contents: [], analyses: [] };
const UNDO_LIMIT = 30;

export class Repository {
  private collections: Record<EntityName, Row[]> = { sources: [], contents: [], analyses: [] };
  private listeners = new Set<(e: ChangeEvent) => void>();
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private lastPersistedAt: string | null = null;
  readonly audit: AuditLog;

  private readonly storage: StorageAdapter;
  private readonly dataKey: string;
  private readonly auditKey: string;
  private readonly actor: string;

  constructor(
    storage: StorageAdapter = createStorage(),
    dataKey = 'tam.data.v3',
    auditKey = 'tam.audit.v3',
    actor = 'local-user',
  ) {
    this.storage = storage;
    this.dataKey = dataKey;
    this.auditKey = auditKey;
    this.actor = actor;
    this.audit = new AuditLog();
    this.load();
  }

  /* --------------------------------- loading -------------------------------- */

  load(): void {
    const raw = this.storage.get(this.dataKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<AppData>;
        for (const entity of ENTITY_ORDER) {
          const rows = Array.isArray(parsed[entity]) ? parsed[entity] : [];
          this.collections[entity] = rows.map((r) => normalizeRecord(entity, r));
        }
      } catch {
        this.collections = { sources: [], contents: [], analyses: [] };
      }
    }
    const auditRaw = this.storage.get(this.auditKey);
    if (auditRaw) {
      try {
        this.audit.restore(JSON.parse(auditRaw) as AuditEntry[]);
      } catch {
        /* ignore corrupt audit log */
      }
    }
  }

  persist(): void {
    this.storage.set(this.dataKey, JSON.stringify(this.collections));
    this.storage.set(this.auditKey, JSON.stringify(this.audit.toJSON().slice(0, 500)));
    this.lastPersistedAt = timestamp();
  }

  /* ---------------------------------- reads --------------------------------- */

  list(entity: EntityName): Row[] {
    return this.collections[entity];
  }

  all(): AppData {
    return {
      sources: [...this.collections.sources],
      contents: [...this.collections.contents],
      analyses: [...this.collections.analyses],
    };
  }

  get(entity: EntityName, id: string): Row | undefined {
    return this.collections[entity].find((r) => String(r.id) === id);
  }

  count(entity: EntityName): number {
    return this.collections[entity].length;
  }

  /** Rows joined with their parent's title fields (source_name, content_title). */
  joined(entity: EntityName): Row[] {
    const spec = SCHEMA[entity];
    const parentRef = spec.parent;
    if (!parentRef || !spec.derived?.length) return this.list(entity);
    return this.list(entity).map((row) => {
      const parent = this.get(parentRef.entity, String(row[parentRef.field]));
      const extra: Row = {};
      for (const d of spec.derived ?? []) extra[d.key] = parent ? parent[d.from] : '';
      // contents have a grandparent (sources) reachable through contents
      if (entity === 'analyses') {
        const content = parent;
        const source = content ? this.get('sources', String(content.sources_id)) : undefined;
        extra.source_name = source ? source.name : '';
      }
      return { ...row, ...extra };
    });
  }

  /** Unified "All Data" projection used by the All Data tab and the SQL `all_records` view. */
  allRecords(): Row[] {
    const out: Row[] = [];
    for (const s of this.list('sources')) {
      out.push({
        record_type: 'Source',
        record_id: s.id,
        record_name: s.name,
        title: s.name,
        content_data: s.description || s.note || '',
        source_name: s.name,
        classification: '',
        importance: s.importance,
        display_date: s.date_entry || s.date_creation,
        date_created: s.date_creation,
        date_modified: s.date_modified,
        country: s.country,
        city: s.city,
        type: s.type,
      });
    }
    for (const c of this.list('contents')) {
      const parent = this.get('sources', String(c.sources_id));
      out.push({
        record_type: 'Content',
        record_id: c.id,
        record_name: c.title,
        title: c.title,
        content_data: c.content_data,
        source_name: parent ? parent.name : '',
        classification: '',
        importance: c.importance,
        display_date: c.date_content || c.date_creation,
        date_created: c.date_creation,
        date_modified: c.date_modified,
        country: parent ? parent.country : '',
        city: parent ? parent.city : '',
        type: 'content',
      });
    }
    for (const a of this.list('analyses')) {
      const content = this.get('contents', String(a.content_id));
      const source = content ? this.get('sources', String(content.sources_id)) : undefined;
      out.push({
        record_type: 'Analysis',
        record_id: a.id,
        record_name: a.classification,
        title: content ? content.title : '',
        content_data: content ? content.content_data : '',
        source_name: source ? source.name : '',
        classification: a.classification,
        importance: content ? content.importance : 0,
        display_date: a.date_analysis || a.date_creation,
        date_created: a.date_creation,
        date_modified: a.date_modified,
        country: source ? source.country : '',
        city: source ? source.city : '',
        type: 'analysis',
      });
    }
    return out;
  }

  /* --------------------------------- writes --------------------------------- */

  insert(entity: EntityName, raw: Row, opts: WriteOptions = {}): WriteResult {
    const issues = opts.skipValidation ? [] : this.validate(entity, raw, {});
    if (hasErrors(issues)) return { ok: false, issues };

    const record = normalizeRecord(entity, raw);
    record.id = String(record.id || makeId(SCHEMA[entity].idPrefix));
    record.date_creation = timestamp();
    record.date_modified = record.date_creation;

    this.pushUndo();
    this.collections[entity] = [...this.collections[entity], record];
    this.commit('insert', entity, [String(record.id)], opts.action ?? 'create', opts.silent, {
      title: this.titleOf(entity, record),
      summary: `Created ${entity.slice(0, -1)} ${record.id}`,
    });
    return { ok: true, issues, record };
  }

  update(entity: EntityName, raw: Row, opts: WriteOptions = {}): WriteResult {
    const idValue = String(raw.id ?? '');
    const before = this.get(entity, idValue);
    if (!before) {
      return {
        ok: false,
        issues: [{ field: 'id', level: 'error', code: 'unknownRef', message: `Record ${idValue} not found` }],
      };
    }
    const issues = opts.skipValidation ? [] : this.validate(entity, { ...before, ...raw }, { editingId: idValue });
    if (hasErrors(issues)) return { ok: false, issues };

    const record = normalizeRecord(entity, { ...before, ...raw });
    record.id = idValue;
    record.date_creation = before.date_creation;
    record.date_modified = timestamp();

    this.pushUndo();
    this.collections[entity] = this.collections[entity].map((r) => (String(r.id) === idValue ? record : r));
    this.commit('update', entity, [idValue], opts.action ?? 'update', opts.silent, {
      title: this.titleOf(entity, record),
      summary: `Updated ${entity.slice(0, -1)} ${idValue}`,
      changes: diffRecords(before, record),
    });
    return { ok: true, issues, record };
  }

  remove(entity: EntityName, idValue: string, opts: WriteOptions = {}): WriteResult {
    const record = this.get(entity, idValue);
    if (!record) {
      return {
        ok: false,
        issues: [{ field: 'id', level: 'error', code: 'unknownRef', message: `Record ${idValue} not found` }],
      };
    }
    this.pushUndo();
    const cascaded = this.cascadeRemove(entity, idValue);
    this.commit('delete', entity, [idValue], opts.action ?? 'delete', opts.silent, {
      title: this.titleOf(entity, record),
      summary: `Deleted ${entity.slice(0, -1)} ${idValue}${cascaded.length ? ` (+${cascaded.reduce((n, c) => n + c.ids.length, 0)} dependents)` : ''}`,
      meta: { cascaded },
    });
    return { ok: true, issues: [], cascaded };
  }

  bulkDelete(entity: EntityName, ids: string[], opts: WriteOptions = {}): WriteResult {
    this.pushUndo();
    const cascaded: { entity: EntityName; ids: string[] }[] = [];
    let removed = 0;
    for (const idValue of ids) {
      if (!this.get(entity, idValue)) continue;
      for (const c of this.cascadeRemove(entity, idValue)) {
        const existing = cascaded.find((x) => x.entity === c.entity);
        if (existing) existing.ids.push(...c.ids);
        else cascaded.push(c);
      }
      removed++;
    }
    this.commit('delete', entity, ids, opts.action ?? 'bulk_delete', opts.silent, {
      title: `${removed} ${entity}`,
      summary: `Bulk deleted ${removed} ${entity}`,
      meta: { cascaded },
    });
    return { ok: true, issues: [], cascaded };
  }

  /** Apply a partial patch to many rows in one audited operation. */
  bulkUpdate(entity: EntityName, ids: string[], patch: Row, opts: WriteOptions = {}): WriteResult {
    if (!Object.keys(patch).length) return { ok: true, issues: [] };
    this.pushUndo();
    let touched = 0;
    this.collections[entity] = this.collections[entity].map((row) => {
      if (!ids.includes(String(row.id))) return row;
      const next = normalizeRecord(entity, { ...row, ...patch });
      next.id = row.id;
      next.date_creation = row.date_creation;
      next.date_modified = timestamp();
      touched++;
      return next;
    });
    this.commit('update', entity, ids, opts.action ?? 'bulk_update', opts.silent, {
      title: `${touched} ${entity}`,
      summary: `Bulk updated ${touched} ${entity} (${Object.keys(patch).join(', ')})`,
      meta: { patch },
    });
    return { ok: true, issues: [] };
  }

  duplicate(entity: EntityName, idValue: string): WriteResult {
    const orig = this.get(entity, idValue);
    if (!orig) {
      return {
        ok: false,
        issues: [{ field: 'id', level: 'error', code: 'unknownRef', message: `Record ${idValue} not found` }],
      };
    }
    const copy: Row = { ...orig };
    delete copy.id;
    delete copy.date_creation;
    delete copy.date_modified;
    const titleField = SCHEMA[entity].titleField;
    if (typeof copy[titleField] === 'string') copy[titleField] = `${copy[titleField]} (Copy)`;
    if (entity === 'sources') copy.name = `${orig.name} (Copy)`;
    return this.insert(entity, copy, { skipValidation: true, action: 'create' });
  }

  /** Wholesale replace (reset / restore / load sample). */
  replaceAll(next: Partial<AppData>, action: AuditAction = 'restore', summary = 'Replaced workspace data'): void {
    this.pushUndo();
    for (const entity of ENTITY_ORDER) {
      const rows = next[entity];
      this.collections[entity] = (Array.isArray(rows) ? rows : []).map((r) => normalizeRecord(entity, r));
    }
    this.commit('replace', 'workspace', [], action, false, {
      title: 'Workspace',
      summary,
      meta: {
        sources: this.collections.sources.length,
        contents: this.collections.contents.length,
        analyses: this.collections.analyses.length,
      },
    });
  }

  clear(): void {
    this.replaceAll({ sources: [], contents: [], analyses: [] }, 'reset', 'Cleared all data');
  }

  /**
   * Transactional multi-row insert used by the import wizard and by merge:
   * if any row fails, nothing is committed.
   */
  insertMany(
    entity: EntityName,
    rows: Row[],
    opts: { action?: AuditAction; validate?: boolean; summary?: string } = {},
  ): { ok: boolean; inserted: number; issues: ValidationIssue[] } {
    const snapshot = JSON.stringify(this.collections);
    const issues: ValidationIssue[] = [];
    let inserted = 0;
    try {
      for (const row of rows) {
        if (opts.validate) {
          const rowIssues = this.validate(entity, row, { detectDuplicates: true });
          if (hasErrors(rowIssues)) {
            issues.push(...rowIssues.map((i) => ({ ...i, field: `row ${inserted + issues.length + 1}:${i.field}` })));
            continue;
          }
        }
        this.collections[entity] = [...this.collections[entity], this.finalize(entity, row)];
        inserted++;
      }
    } catch (err) {
      this.collections = JSON.parse(snapshot) as Record<EntityName, Row[]>;
      return {
        ok: false,
        inserted: 0,
        issues: [{ field: '*', level: 'error', code: 'unknownRef', message: String(err) }],
      };
    }
    this.commit('insert', entity, [], opts.action ?? 'import', false, {
      title: `${inserted} ${entity}`,
      summary: opts.summary ?? `Imported ${inserted} ${entity}`,
      meta: { skipped: issues.length },
    });
    return { ok: issues.length === 0, inserted, issues };
  }

  /* ------------------------------ transactions ------------------------------ */

  /** Run `fn`; any throw rolls the data back to the pre-transaction state. */
  transaction<T>(fn: () => T): T {
    const snapshot = JSON.stringify(this.collections);
    try {
      return fn();
    } catch (err) {
      this.collections = JSON.parse(snapshot) as Record<EntityName, Row[]>;
      throw err;
    }
  }

  /* ------------------------------- undo/redo -------------------------------- */

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(JSON.stringify(this.collections));
    this.collections = JSON.parse(prev) as Record<EntityName, Row[]>;
    this.commit('replace', 'workspace', [], 'restore', false, { title: 'Workspace', summary: 'Undo' });
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(JSON.stringify(this.collections));
    this.collections = JSON.parse(next) as Record<EntityName, Row[]>;
    this.commit('replace', 'workspace', [], 'restore', false, { title: 'Workspace', summary: 'Redo' });
  }

  /* ------------------------------ subscriptions ----------------------------- */

  subscribe(listener: (e: ChangeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /* ---------------------------------- meta ---------------------------------- */

  stats(): RepositoryStats {
    const payload = JSON.stringify(this.collections);
    return {
      counts: {
        sources: this.collections.sources.length,
        contents: this.collections.contents.length,
        analyses: this.collections.analyses.length,
      },
      total:
        this.collections.sources.length + this.collections.contents.length + this.collections.analyses.length,
      bytes: payload.length * 2,
      checksum: fnv1a64(stableStringify(this.collections)),
      undoDepth: this.undoStack.length,
      redoDepth: this.redoStack.length,
      auditEntries: this.audit.size,
      orphans: this.findOrphans(),
      lastPersisted: this.lastPersistedAt,
    };
  }

  /** Referential-integrity report: child rows whose parent no longer exists. */
  findOrphans(): Record<EntityName, number> {
    const out: Record<EntityName, number> = { sources: 0, contents: 0, analyses: 0 };
    for (const c of this.collections.contents) {
      if (!this.get('sources', String(c.sources_id))) out.contents++;
    }
    for (const a of this.collections.analyses) {
      if (!this.get('contents', String(a.content_id))) out.analyses++;
    }
    return out;
  }

  /** Resolve a parent reference given an id or the parent's human title. */
  resolveRef(entity: EntityName, value: unknown): string | null {
    const spec = SCHEMA[entity];
    if (!spec.parent) return null;
    const target = String(value ?? '').trim();
    if (!target) return null;
    const rows = this.list(spec.parent.entity);
    const byId = rows.find((r) => String(r.id) === target);
    if (byId) return String(byId.id);
    const label = SCHEMA[spec.parent.entity].titleField;
    const norm = target.toLowerCase();
    const byName = rows.find((r) => String(r[label] ?? '').toLowerCase() === norm);
    return byName ? String(byName.id) : null;
  }

  distinctValues(entity: EntityName, field: string): string[] {
    const seen = new Map<string, string>();
    for (const row of this.list(entity)) {
      const v = String(row[field] ?? '').trim();
      if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }

  validate(
    entity: EntityName,
    raw: Row,
    opts: { editingId?: string; detectDuplicates?: boolean } = {},
  ): ValidationIssue[] {
    const parents: Partial<Record<EntityName, Row[]>> = {};
    for (const e of ENTITY_ORDER) parents[e] = this.collections[e];
    return validateRecord(entity, raw, {
      entity,
      existing: this.collections[entity],
      parents,
      editingId: opts.editingId,
      detectDuplicates: opts.detectDuplicates ?? true,
    });
  }

  /* -------------------------------- internals ------------------------------- */

  private finalize(entity: EntityName, raw: Row): Row {
    const record = normalizeRecord(entity, raw);
    record.id = String(record.id || makeId(SCHEMA[entity].idPrefix));
    record.date_creation = String(record.date_creation || timestamp());
    record.date_modified = timestamp();
    return record;
  }

  private cascadeRemove(entity: EntityName, idValue: string): { entity: EntityName; ids: string[] }[] {
    const cascaded: { entity: EntityName; ids: string[] }[] = [];
    this.collections[entity] = this.collections[entity].filter((r) => String(r.id) !== idValue);

    if (entity === 'sources') {
      const childIds = this.collections.contents.filter((c) => String(c.sources_id) === idValue).map((c) => String(c.id));
      this.collections.contents = this.collections.contents.filter((c) => String(c.sources_id) !== idValue);
      const grandIds = this.collections.analyses.filter((a) => childIds.includes(String(a.content_id))).map((a) => String(a.id));
      this.collections.analyses = this.collections.analyses.filter((a) => !childIds.includes(String(a.content_id)));
      if (childIds.length) cascaded.push({ entity: 'contents', ids: childIds });
      if (grandIds.length) cascaded.push({ entity: 'analyses', ids: grandIds });
    } else if (entity === 'contents') {
      const childIds = this.collections.analyses.filter((a) => String(a.content_id) === idValue).map((a) => String(a.id));
      this.collections.analyses = this.collections.analyses.filter((a) => String(a.content_id) !== idValue);
      if (childIds.length) cascaded.push({ entity: 'analyses', ids: childIds });
    }
    return cascaded;
  }

  private titleOf(entity: EntityName, record: Row): string {
    return String(record[SCHEMA[entity].titleField] ?? record.id ?? '');
  }

  private pushUndo(): void {
    this.undoStack.push(JSON.stringify(this.collections));
    if (this.undoStack.length > UNDO_LIMIT) this.undoStack.shift();
    this.redoStack = [];
  }

  private commit(
    type: ChangeType,
    entity: EntityName | 'workspace',
    ids: string[],
    action: AuditAction,
    silent: boolean | undefined,
    audit: { title: string; summary: string; changes?: { field: string; before: unknown; after: unknown }[]; meta?: Record<string, unknown> },
  ): void {
    if (!silent) {
      this.audit.record({
        actor: this.actor,
        action,
        entity,
        recordId: ids[0] ?? '',
        title: audit.title,
        summary: audit.summary,
        changes: audit.changes?.length ? audit.changes : undefined,
        meta: audit.meta,
      });
    }
    try {
      this.persist();
    } catch (err) {
      if (err instanceof StorageQuotaError) {
        this.audit.record({
          actor: this.actor,
          action: 'update',
          entity: 'workspace',
          recordId: '',
          title: 'Storage',
          summary: `Persistence failed: ${err.message}`,
        });
      } else {
        throw err;
      }
    }
    const event: ChangeEvent = { type, entity, ids, action };
    for (const listener of this.listeners) listener(event);
  }

  /** Backup filename matching the desktop application's convention. */
  static backupFilename(kind: 'manual' | 'auto' = 'manual'): string {
    return `backup_${kind}_${fileStamp()}`;
  }
}

export const EMPTY_DATA: AppData = { ...EMPTY };
