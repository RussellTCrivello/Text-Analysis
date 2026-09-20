/**
 * Backup / restore / merge.
 *
 * Backups are self-describing envelopes carrying the schema version, record
 * counts, a content checksum and (optionally) the audit log, gazetteer and
 * taxonomy, so a file moved to another machine can be verified before it
 * touches live data.
 */
import { AuditLog, type AuditEntry } from './audit';
import { ENTITY_ORDER, type EntityName } from './schema';
import { fileStamp, fnv1a64, id as makeId, stableStringify, timestamp } from './text';
import { normalizeRecord } from './validation';
import type { AppData, Row } from './repository';

export const BACKUP_FORMAT = 'tam-backup';
export const BACKUP_VERSION = 3;
export const APP_VERSION = '2.2.0';

export interface BackupCounts {
  sources: number;
  contents: number;
  analyses: number;
}

export interface BackupEnvelope {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  appVersion: string;
  name: string;
  checksum: string;
  counts: BackupCounts;
  data: AppData;
  audit?: AuditEntry[];
  gazetteer?: unknown;
  taxonomy?: unknown;
  note?: string;
}

export interface BackupMeta {
  name: string;
  createdAt: string;
  counts: BackupCounts;
  bytes: number;
  checksum: string;
  version: number;
  appVersion: string;
  hasAudit: boolean;
}

export function countData(data: Partial<AppData>): BackupCounts {
  return {
    sources: data.sources?.length ?? 0,
    contents: data.contents?.length ?? 0,
    analyses: data.analyses?.length ?? 0,
  };
}

export function checksumData(data: AppData): string {
  return fnv1a64(stableStringify({ sources: data.sources, contents: data.contents, analyses: data.analyses }));
}

export function createBackup(
  data: AppData,
  options: { name?: string; note?: string; audit?: AuditLog | AuditEntry[]; gazetteer?: unknown; taxonomy?: unknown } = {},
): BackupEnvelope {
  const normalised: AppData = {
    sources: (data.sources ?? []).map((r) => normalizeRecord('sources', r)),
    contents: (data.contents ?? []).map((r) => normalizeRecord('contents', r)),
    analyses: (data.analyses ?? []).map((r) => normalizeRecord('analyses', r)),
  };
  const envelope: BackupEnvelope = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: timestamp(),
    appVersion: APP_VERSION,
    name: options.name ?? backupFilename(),
    checksum: checksumData(normalised),
    counts: countData(normalised),
    data: normalised,
    note: options.note,
    gazetteer: options.gazetteer,
    taxonomy: options.taxonomy,
  };
  const auditEntries = options.audit instanceof AuditLog ? options.audit.toJSON() : options.audit;
  if (auditEntries?.length) envelope.audit = auditEntries;
  return envelope;
}

export function backupFilename(prefix = 'backup_manual', date = new Date()): string {
  return `${prefix}_${fileStamp(date)}`;
}

export interface VerifyResult {
  ok: boolean;
  envelope?: BackupEnvelope;
  errors: string[];
  warnings: string[];
  meta?: BackupMeta;
}

/** A backup file may be a full envelope or a bare { sources, contents, analyses } payload. */
type BackupPayload = Partial<BackupEnvelope> & Partial<AppData>;

/** Structural + checksum verification of an untrusted backup payload. */
export function verifyBackup(raw: unknown): VerifyResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['File is not a JSON object'], warnings };
  const candidate = raw as BackupPayload;

  if (candidate.format !== BACKUP_FORMAT) {
    // Tolerate bare { sources, contents, analyses } payloads (legacy exports).
    const looksLikeData = candidate.sources || candidate.contents || candidate.analyses;
    if (!looksLikeData) errors.push(`Unrecognised backup format "${String(candidate.format ?? '')}"`);
    else warnings.push('Legacy payload without a backup envelope — counts and checksum were recomputed');
  }

  const data = (candidate.data ?? {
    sources: candidate.sources,
    contents: candidate.contents,
    analyses: candidate.analyses,
  }) as Partial<AppData>;

  for (const entity of ENTITY_ORDER) {
    const rows = data[entity];
    if (rows !== undefined && !Array.isArray(rows)) errors.push(`"${entity}" is not an array`);
  }
  if (errors.length) return { ok: false, errors, warnings };

  const normalised: AppData = {
    sources: (data.sources ?? []).map((r) => normalizeRecord('sources', r)),
    contents: (data.contents ?? []).map((r) => normalizeRecord('contents', r)),
    analyses: (data.analyses ?? []).map((r) => normalizeRecord('analyses', r)),
  };

  const checksum = checksumData(normalised);
  if (candidate.checksum && candidate.checksum !== checksum) {
    errors.push(`Checksum mismatch — expected ${candidate.checksum}, computed ${checksum}`);
  }
  if (candidate.version && candidate.version > BACKUP_VERSION) {
    warnings.push(`Backup was written by a newer schema (v${candidate.version}); some fields may be ignored`);
  }
  const counts = countData(normalised);
  if (candidate.counts) {
    for (const key of Object.keys(counts) as (keyof BackupCounts)[]) {
      if (candidate.counts[key] !== counts[key]) {
        errors.push(`Count mismatch for ${key}: manifest says ${candidate.counts[key]}, file holds ${counts[key]}`);
      }
    }
  }

  const orphans = referentialProblems(normalised);
  for (const problem of orphans) warnings.push(problem);

  const envelope: BackupEnvelope = {
    format: BACKUP_FORMAT,
    version: candidate.version ?? BACKUP_VERSION,
    createdAt: candidate.createdAt ?? timestamp(),
    appVersion: candidate.appVersion ?? 'unknown',
    name: candidate.name ?? backupFilename(),
    checksum,
    counts,
    data: normalised,
    audit: Array.isArray(candidate.audit) ? candidate.audit : undefined,
    gazetteer: candidate.gazetteer,
    taxonomy: candidate.taxonomy,
    note: candidate.note,
  };

  return {
    ok: errors.length === 0,
    envelope,
    errors,
    warnings,
    meta: {
      name: envelope.name,
      createdAt: envelope.createdAt,
      counts,
      bytes: JSON.stringify(envelope).length,
      checksum,
      version: envelope.version,
      appVersion: envelope.appVersion,
      hasAudit: Boolean(envelope.audit?.length),
    },
  };
}

export function referentialProblems(data: AppData): string[] {
  const problems: string[] = [];
  const sourceIds = new Set((data.sources ?? []).map((s) => String(s.id)));
  const contentIds = new Set((data.contents ?? []).map((c) => String(c.id)));
  const orphanContents = (data.contents ?? []).filter((c) => !sourceIds.has(String(c.sources_id))).length;
  const orphanAnalyses = (data.analyses ?? []).filter((a) => !contentIds.has(String(a.content_id))).length;
  if (orphanContents) problems.push(`${orphanContents} content record(s) reference a missing source`);
  if (orphanAnalyses) problems.push(`${orphanAnalyses} analysis record(s) reference missing content`);
  return problems;
}

/* ---------------------------------- merge ---------------------------------- */

export type MergePolicy = 'skip' | 'replace' | 'duplicate';

export interface MergeReport {
  data: AppData;
  added: BackupCounts;
  replaced: number;
  skipped: number;
  remapped: { entity: EntityName; from: string; to: string }[];
  conflicts: { entity: EntityName; id: string; policy: MergePolicy }[];
}

/**
 * Merge a backup into the current dataset.
 *
 * `skip`     — keep the current record when ids collide
 * `replace`  — overwrite the current record
 * `duplicate`— insert the incoming record under a fresh id and rewire its children
 */
export function mergeData(current: AppData, incoming: AppData, policy: MergePolicy = 'skip'): MergeReport {
  const remapped: { entity: EntityName; from: string; to: string }[] = [];
  const conflicts: { entity: EntityName; id: string; policy: MergePolicy }[] = [];
  const added = { sources: 0, contents: 0, analyses: 0 };
  let replaced = 0;
  let skipped = 0;

  const result: AppData = {
    sources: [...(current.sources ?? [])],
    contents: [...(current.contents ?? [])],
    analyses: [...(current.analyses ?? [])],
  };

  const idMap = (entity: EntityName, oldId: string): string => {
    const found = remapped.find((r) => r.entity === entity && r.from === oldId);
    return found ? found.to : oldId;
  };

  const mergeEntity = (entity: EntityName, rows: Row[], childField?: string) => {
    const byId = new Map(result[entity].map((r) => [String(r.id), r]));
    for (const raw of rows) {
      const record = normalizeRecord(entity, raw);
      const originalId = String(record.id);
      const existing = byId.get(originalId);

      if (!existing) {
        if (childField && (record as Row)[childField]) {
          const parentEntity: EntityName = entity === 'contents' ? 'sources' : 'contents';
          (record as Row)[childField] = idMap(parentEntity, String((record as Row)[childField]));
        }
        result[entity].push(record);
        byId.set(originalId, record);
        added[entity]++;
        continue;
      }

      // Compare semantically: the stored row may predate the current schema, so
      // normalise both sides before diffing or every record looks "changed".
      const identical = stableStringify(normalizeRecord(entity, existing)) === stableStringify(record);
      if (identical) {
        skipped++;
        continue;
      }

      conflicts.push({ entity, id: originalId, policy });
      if (policy === 'replace') {
        const index = result[entity].findIndex((r) => String(r.id) === originalId);
        record.date_modified = timestamp();
        result[entity][index] = record;
        byId.set(originalId, record);
        replaced++;
      } else if (policy === 'duplicate') {
        const newId = makeId(entity === 'sources' ? 's' : entity === 'contents' ? 'c' : 'a');
        const copy: Row = { ...record, id: newId, date_creation: timestamp(), date_modified: timestamp() };
        if (childField && copy[childField]) {
          const parentEntity: EntityName = entity === 'contents' ? 'sources' : 'contents';
          copy[childField] = idMap(parentEntity, String(copy[childField]));
        }
        result[entity].push(copy);
        remapped.push({ entity, from: originalId, to: newId });
        added[entity]++;
      } else {
        skipped++;
      }
    }
  };

  mergeEntity('sources', incoming.sources ?? []);
  mergeEntity('contents', incoming.contents ?? [], 'sources_id');
  mergeEntity('analyses', incoming.analyses ?? [], 'content_id');

  return { data: result, added, replaced, skipped, remapped, conflicts };
}

/* ----------------------------------- diff ---------------------------------- */

export interface DataDiff {
  added: BackupCounts;
  removed: BackupCounts;
  changed: BackupCounts;
  unchanged: BackupCounts;
}

export function diffData(a: AppData, b: AppData): DataDiff {
  const out: DataDiff = {
    added: { sources: 0, contents: 0, analyses: 0 },
    removed: { sources: 0, contents: 0, analyses: 0 },
    changed: { sources: 0, contents: 0, analyses: 0 },
    unchanged: { sources: 0, contents: 0, analyses: 0 },
  };
  for (const entity of ENTITY_ORDER) {
    // Normalise both sides first: a stored row may predate the current
    // schema (different casing, un-normalised lists), and the diff should
    // reflect semantic differences only — otherwise every legacy record
    // reads as "changed".
    const left = new Map((a[entity] ?? []).map((r) => [String(r.id), normalizeRecord(entity, r)]));
    const right = new Map((b[entity] ?? []).map((r) => [String(r.id), normalizeRecord(entity, r)]));
    for (const [id, row] of right) {
      const before = left.get(id);
      if (!before) out.added[entity]++;
      else if (stableStringify(before) !== stableStringify(row)) out.changed[entity]++;
      else out.unchanged[entity]++;
    }
    for (const id of left.keys()) if (!right.has(id)) out.removed[entity]++;
  }
  return out;
}

export function describeDiff(diff: DataDiff): string {
  const parts: string[] = [];
  for (const entity of ENTITY_ORDER) {
    const bits: string[] = [];
    if (diff.added[entity]) bits.push(`+${diff.added[entity]}`);
    if (diff.changed[entity]) bits.push(`~${diff.changed[entity]}`);
    if (diff.removed[entity]) bits.push(`-${diff.removed[entity]}`);
    if (bits.length) parts.push(`${entity} ${bits.join(' ')}`);
  }
  return parts.length ? parts.join(', ') : 'no differences';
}
