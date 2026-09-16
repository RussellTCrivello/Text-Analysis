/**
 * Application store.
 *
 * The React layer is a thin shell over `src/core`: every mutation goes through
 * the Repository (validation → uniqueness/duplicate checks → cascade rules →
 * audit entry → persistence), so the UI cannot write an invalid record even if
 * a view forgets to check.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Analysis, AppData as TypedAppData, Content, Source } from '../types';
import { sampleData } from '../data/sampleData';
import { AuditLog, type AuditEntry } from '../core/audit';
import { createAttachmentStore, type AttachmentStore } from '../core/attachments';
import {
  APP_VERSION,
  createBackup,
  mergeData,
  verifyBackup,
  type BackupEnvelope,
  type MergePolicy,
  type VerifyResult,
} from '../core/backup';
import { DEFAULT_TAXONOMY, extractFromText, type ExtractionResult, type TaxonomyRule } from '../core/extract/engine';
import { VocabularyStore, type VocabularyEntry } from '../core/vocabulary';
import { Gazetteer, type GazetteerEntry } from '../core/extract/gazetteer';
import { createStorage } from '../core/persist';
import { Repository, type AppData, type RepositoryStats, type Row, type WriteResult } from '../core/repository';
import { ENTITY_ORDER, type EntityName } from '../core/schema';
import type { ValidationIssue } from '../core/validation';
import { normalizeRecord } from '../core/validation';
import { formatBytes, id as makeId, timestamp } from '../core/text';
import { LocalSavedSearchStore, type SavedSearch } from '../core/search';
import { DEFAULT_PRINT_CONFIG, type PrintHeaderConfig } from '../core/print';
import { exportData, type ExportArtifact } from '../core/export/exporters';
import { SqlEngine, buildDatabase } from '../core/sql/engine';

const BACKUPS_KEY = 'tam.backups.v3';
const KNOWLEDGE_KEY = 'tam.knowledge.v3';
const LEGACY_DATA_KEY = 'tam_data';

export interface BackupEntry {
  id: string;
  name: string;
  date_creation: string;
  envelope: BackupEnvelope;
  data: TypedAppData;
  sourceCount: number;
  contentCount: number;
  analysisCount: number;
  bytes: number;
  checksum: string;
  note?: string;
}

interface KnowledgeState {
  gazetteer: GazetteerEntry[];
  taxonomy: TaxonomyRule[];
  searches: SavedSearch[];
  print: PrintHeaderConfig;
  vocabulary: Record<string, VocabularyEntry[]>;
}

const EMPTY_KNOWLEDGE: KnowledgeState = {
  gazetteer: [],
  taxonomy: DEFAULT_TAXONOMY,
  searches: [],
  print: DEFAULT_PRINT_CONFIG,
  vocabulary: {},
};

/** Field renames used by earlier builds of this workspace. */
function migrateLegacyRecord(record: Record<string, unknown>): Record<string, unknown> {
  const m: Record<string, unknown> = { ...record };
  const renames: [string, string][] = [
    ['link', 'link_sources'],
    ['entryDate', 'date_entry'],
    ['createdAt', 'date_creation'],
    ['updatedAt', 'date_modified'],
    ['text', 'content_data'],
    ['sourceId', 'sources_id'],
    ['contentId', 'content_id'],
    ['people', 'list_names_people'],
    ['places', 'list_names_places'],
    ['coordinates', 'list_coordinates'],
    ['parties', 'list_sides'],
    ['date', 'date_analysis'],
    ['dateContent', 'date_content'],
  ];
  for (const [from, to] of renames) {
    if (from in m && !(to in m)) {
      m[to] = m[from];
      delete m[from];
    }
  }
  if (typeof m.importance === 'number' && (m.importance as number) > 1) {
    m.importance = Math.min(1, (m.importance as number) / 5);
  }
  return m;
}

function loadLegacyData(): AppData | null {
  try {
    const raw = localStorage.getItem(LEGACY_DATA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      sources: (parsed.sources ?? []).map(migrateLegacyRecord),
      contents: (parsed.contents ?? []).map(migrateLegacyRecord),
      analyses: (parsed.analyses ?? []).map(migrateLegacyRecord),
    };
  } catch {
    return null;
  }
}

function createRepository(): Repository {
  const repo = new Repository(createStorage());
  if (repo.stats().total === 0) {
    const legacy = loadLegacyData();
    if (legacy && legacy.sources.length + legacy.contents.length + legacy.analyses.length > 0) {
      repo.replaceAll(legacy, 'import', 'Migrated workspace data from the previous storage format');
    }
  }
  return repo;
}

function loadKnowledge(): KnowledgeState {
  try {
    const raw = localStorage.getItem(KNOWLEDGE_KEY);
    if (!raw) return { ...EMPTY_KNOWLEDGE };
    const parsed = JSON.parse(raw) as Partial<KnowledgeState>;
    return {
      gazetteer: Array.isArray(parsed.gazetteer) ? parsed.gazetteer : [],
      taxonomy: Array.isArray(parsed.taxonomy) && parsed.taxonomy.length ? parsed.taxonomy : DEFAULT_TAXONOMY,
      searches: Array.isArray(parsed.searches) ? parsed.searches : [],
      print: { ...DEFAULT_PRINT_CONFIG, ...(parsed.print ?? {}) },
      vocabulary: parsed.vocabulary && typeof parsed.vocabulary === 'object' ? parsed.vocabulary : {},
    };
  } catch {
    return { ...EMPTY_KNOWLEDGE };
  }
}

function loadBackups(): BackupEntry[] {
  try {
    const raw = localStorage.getItem(BACKUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BackupEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((b) => b && b.envelope);
  } catch {
    return [];
  }
}

interface AppCtx {
  data: TypedAppData;
  repo: Repository;
  stats: RepositoryStats;
  audit: AuditEntry[];

  /* CRUD */
  addSource: (s: Partial<Source>) => WriteResult;
  updateSource: (s: Partial<Source> & { id: string }) => WriteResult;
  deleteSource: (id: string) => WriteResult;
  duplicateSource: (id: string) => WriteResult;
  addContent: (c: Partial<Content>) => WriteResult;
  updateContent: (c: Partial<Content> & { id: string }) => WriteResult;
  deleteContent: (id: string) => WriteResult;
  duplicateContent: (id: string) => WriteResult;
  addAnalysis: (a: Partial<Analysis>) => WriteResult;
  updateAnalysis: (a: Partial<Analysis> & { id: string }) => WriteResult;
  deleteAnalysis: (id: string) => WriteResult;
  duplicateAnalysis: (id: string) => WriteResult;
  bulkDeleteSources: (ids: string[]) => WriteResult;
  bulkDeleteContents: (ids: string[]) => WriteResult;
  bulkDeleteAnalyses: (ids: string[]) => WriteResult;
  bulkUpdate: (entity: EntityName, ids: string[], patch: Row) => WriteResult;
  validate: (entity: EntityName, values: Row, editingId?: string) => ValidationIssue[];

  /* history */
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  /* workspace */
  loadSampleData: () => void;
  clearAllData: () => void;
  importRows: (entity: EntityName, rows: Row[]) => { inserted: number; issues: ValidationIssue[] };

  /* backups */
  backups: BackupEntry[];
  createBackup: (name?: string, note?: string) => BackupEntry;
  restoreBackup: (id: string) => void;
  mergeBackup: (id: string, policy?: MergePolicy) => void;
  deleteBackup: (id: string) => void;
  restoreFromRaw: (data: TypedAppData, merge?: boolean, policy?: MergePolicy) => void;
  verifyBackupFile: (text: string) => VerifyResult;
  importBackupFile: (text: string, policy: MergePolicy) => VerifyResult;
  exportBackupFile: (id: string) => ExportArtifact | null;
  importData: (data: Partial<TypedAppData>, merge?: boolean) => void;

  /* knowledge */
  gazetteer: Gazetteer;
  /** User-editable option lists (sources.type, analyses.classification, …). */
  vocabulary: VocabularyStore;
  vocabularyTick: number;
  addVocabularyValue: (key: string, value: string) => { entry: VocabularyEntry; created: boolean; reason?: string };
  removeVocabularyValue: (key: string, value: string, inUse?: number) => { ok: boolean; reason?: string };
  renameVocabularyValue: (key: string, from: string, to: string) => { ok: boolean; canonical?: string; reason?: string };
  taxonomy: TaxonomyRule[];
  setTaxonomy: (rules: TaxonomyRule[]) => void;
  addGazetteerEntry: (entry: GazetteerEntry) => void;
  removeGazetteerEntry: (name: string) => boolean;
  extract: (text: string) => ExtractionResult;

  /* saved searches + print settings */
  searches: LocalSavedSearchStore;
  printConfig: PrintHeaderConfig;
  setPrintConfig: (patch: Partial<PrintHeaderConfig>) => void;

  /* attachments */
  attachments: AttachmentStore;

  /* sql */
  sql: SqlEngine;
}

const noopResult: WriteResult = { ok: true, issues: [] };

const AppContext = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<Repository | null>(null);
  if (!repoRef.current) repoRef.current = createRepository();
  const repo = repoRef.current;

  const [snapshot, setSnapshot] = useState<AppData>(() => repo.all());
  const [auditTick, setAuditTick] = useState(0);
  const [backups, setBackups] = useState<BackupEntry[]>(loadBackups);
  const [knowledge, setKnowledge] = useState<KnowledgeState>(loadKnowledge);
  const [searches] = useState(() => new LocalSavedSearchStore('tam.searches', loadKnowledge().searches));
  const [attachments] = useState<AttachmentStore>(() => createAttachmentStore());

  /* keep React in sync with the repository */
  useEffect(() => {
    const unsubscribe = repo.subscribe(() => {
      setSnapshot(repo.all());
      setAuditTick((n) => n + 1);
    });
    return unsubscribe;
  }, [repo]);

  const gazetteer = useMemo(() => Gazetteer.fromJSON(knowledge.gazetteer), [knowledge.gazetteer]);
  const vocabulary = useMemo(() => VocabularyStore.fromJSON(knowledge.vocabulary), [knowledge.vocabulary]);
  // Bumped whenever a vocabulary changes so consumers re-render their option lists.
  const [vocabularyTick, setVocabularyTick] = useState(0);
  useEffect(() => vocabulary.subscribe(() => setVocabularyTick((n) => n + 1)), [vocabulary]);

  useEffect(() => {
    localStorage.setItem(BACKUPS_KEY, JSON.stringify(backups));
  }, [backups]);

  useEffect(() => {
    localStorage.setItem(
      KNOWLEDGE_KEY,
      JSON.stringify({
        gazetteer: knowledge.gazetteer,
        taxonomy: knowledge.taxonomy,
        searches: searches.toJSON(),
        print: knowledge.print,
        vocabulary: vocabulary.toJSON(),
      } satisfies KnowledgeState),
    );
  }, [knowledge, searches, auditTick, vocabulary, vocabularyTick]);

  const typedData = useMemo<TypedAppData>(
    () => ({
      sources: snapshot.sources as unknown as Source[],
      contents: snapshot.contents as unknown as Content[],
      analyses: snapshot.analyses as unknown as Analysis[],
    }),
    [snapshot],
  );

  const stats = useMemo(() => repo.stats(), [snapshot, auditTick, repo]);
  const audit = useMemo(() => repo.audit.list(), [auditTick, repo]);

  const sql = useMemo(
    () =>
      new SqlEngine(() =>
        buildDatabase({
          sources: snapshot.sources,
          contents: snapshot.contents,
          analyses: snapshot.analyses,
          allRecords: repo.allRecords(),
        }),
      ),
    [snapshot, repo],
  );

  /* ---------------------------------- CRUD --------------------------------- */

  const add = useCallback((entity: EntityName, values: Row) => repo.insert(entity, values, { detectDuplicates: true }), [repo]);
  const update = useCallback((entity: EntityName, values: Row) => repo.update(entity, values, { detectDuplicates: true }), [repo]);

  const api = useMemo<AppCtx>(() => {
    const typedWrite = (result: WriteResult): WriteResult => result;

    const backupToEntry = (envelope: BackupEnvelope, id = makeId('bk')): BackupEntry => ({
      id,
      name: envelope.name,
      date_creation: envelope.createdAt,
      envelope,
      data: envelope.data as unknown as TypedAppData,
      sourceCount: envelope.counts.sources,
      contentCount: envelope.counts.contents,
      analysisCount: envelope.counts.analyses,
      bytes: JSON.stringify(envelope).length,
      checksum: envelope.checksum,
      note: envelope.note,
    });

    return {
      data: typedData,
      repo,
      stats,
      audit,

      addSource: (s) => typedWrite(add('sources', s as Row)),
      updateSource: (s) => typedWrite(update('sources', s as Row)),
      deleteSource: (id) => repo.remove('sources', id),
      duplicateSource: (id) => repo.duplicate('sources', id),
      addContent: (c) => typedWrite(add('contents', c as Row)),
      updateContent: (c) => typedWrite(update('contents', c as Row)),
      deleteContent: (id) => repo.remove('contents', id),
      duplicateContent: (id) => repo.duplicate('contents', id),
      addAnalysis: (a) => typedWrite(add('analyses', a as Row)),
      updateAnalysis: (a) => typedWrite(update('analyses', a as Row)),
      deleteAnalysis: (id) => repo.remove('analyses', id),
      duplicateAnalysis: (id) => repo.duplicate('analyses', id),
      bulkDeleteSources: (ids) => repo.bulkDelete('sources', ids),
      bulkDeleteContents: (ids) => repo.bulkDelete('contents', ids),
      bulkDeleteAnalyses: (ids) => repo.bulkDelete('analyses', ids),
      bulkUpdate: (entity, ids, patch) => repo.bulkUpdate(entity, ids, patch),
      validate: (entity, values, editingId) => repo.validate(entity, values, { editingId, detectDuplicates: true }),

      undo: () => repo.undo(),
      redo: () => repo.redo(),
      canUndo: repo.canUndo(),
      canRedo: repo.canRedo(),

      loadSampleData: () => repo.replaceAll(sampleData as unknown as AppData, 'load_sample', 'Loaded the sample dataset'),
      clearAllData: () => repo.clear(),
      importRows: (entity, rows) => repo.insertMany(entity, rows, { action: 'import', validate: true }),

      backups,
      createBackup: (name, note) => {
        const envelope = createBackup(repo.all(), {
          name,
          note,
          audit: repo.audit as AuditLog,
          gazetteer: gazetteer.toJSON(),
          taxonomy: knowledge.taxonomy,
        });
        const entry = backupToEntry(envelope);
        setBackups((prev) => [entry, ...prev]);
        repo.audit.record({
          action: 'restore',
          entity: 'workspace',
          recordId: entry.id,
          title: entry.name,
          summary: `Created backup with ${envelope.counts.sources} sources, ${envelope.counts.contents} contents, ${envelope.counts.analyses} analyses`,
        });
        setAuditTick((n) => n + 1);
        return entry;
      },
      restoreBackup: (id) => {
        const entry = backups.find((b) => b.id === id);
        if (!entry) return;
        repo.replaceAll(entry.envelope.data, 'restore', `Restored backup "${entry.name}"`);
      },
      mergeBackup: (id, policy = 'skip') => {
        const entry = backups.find((b) => b.id === id);
        if (!entry) return;
        const result = mergeData(repo.all(), entry.envelope.data, policy);
        repo.replaceAll(result.data, 'merge', `Merged backup "${entry.name}" (${policy})`);
      },
      deleteBackup: (id) => setBackups((prev) => prev.filter((b) => b.id !== id)),
      restoreFromRaw: (raw, merge = false, policy: MergePolicy = 'skip') => {
        const incoming = {
          sources: (raw.sources ?? []) as unknown as Row[],
          contents: (raw.contents ?? []) as unknown as Row[],
          analyses: (raw.analyses ?? []) as unknown as Row[],
        };
        if (merge) {
          const result = mergeData(repo.all(), incoming, policy);
          repo.replaceAll(result.data, 'merge', `Merged imported dataset (${policy})`);
        } else {
          repo.replaceAll(incoming, 'restore', 'Restored imported dataset');
        }
      },
      verifyBackupFile: (text) => {
        try {
          return verifyBackup(JSON.parse(text));
        } catch (err) {
          return { ok: false, errors: [`Could not read the file: ${String(err)}`], warnings: [] };
        }
      },
      importBackupFile: (text, policy) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch (err) {
          return { ok: false, errors: [`Could not read the file: ${String(err)}`], warnings: [] };
        }
        const result = verifyBackup(parsed);
        if (!result.ok || !result.envelope) return result;
        const entry = backupToEntry(result.envelope);
        setBackups((prev) => [entry, ...prev]);
        if (policy === 'skip' || policy === 'replace' || policy === 'duplicate') {
          const merged = mergeData(repo.all(), result.envelope.data, policy);
          repo.replaceAll(merged.data, 'merge', `Imported backup file "${entry.name}" (${policy})`);
        } else {
          repo.replaceAll(result.envelope.data, 'restore', `Imported backup file "${entry.name}"`);
        }
        return result;
      },
      exportBackupFile: (id) => {
        const entry = backups.find((b) => b.id === id);
        if (!entry) return null;
        const json = JSON.stringify(entry.envelope, null, 2);
        return exportData(
          [{ backup: json }],
          { columns: [{ key: 'backup', label: 'backup' }], format: 'json', filename: entry.name },
        );
      },
      importData: (partial, merge = true) => {
        const incoming = {
          sources: (partial.sources ?? []) as unknown as Row[],
          contents: (partial.contents ?? []) as unknown as Row[],
          analyses: (partial.analyses ?? []) as unknown as Row[],
        };
        if (!merge) {
          repo.replaceAll(incoming, 'import', 'Imported dataset');
          return;
        }
        const result = mergeData(repo.all(), incoming, 'skip');
        repo.replaceAll(result.data, 'import', 'Merged imported dataset');
      },

      gazetteer,
      vocabulary,
      vocabularyTick,
      addVocabularyValue: (key, value) => vocabulary.add(key, value),
      removeVocabularyValue: (key, value, inUse = 0) => vocabulary.remove(key, value, inUse),
      renameVocabularyValue: (key, from, to) => vocabulary.rename(key, from, to),
      taxonomy: knowledge.taxonomy,
      setTaxonomy: (rules) => setKnowledge((k) => ({ ...k, taxonomy: rules })),
      addGazetteerEntry: (entry) => {
        gazetteer.upsert(entry);
        setKnowledge((k) => ({ ...k, gazetteer: gazetteer.toJSON().filter((e) => !e.builtin) }));
      },
      removeGazetteerEntry: (name) => {
        const removed = gazetteer.remove(name);
        if (removed) setKnowledge((k) => ({ ...k, gazetteer: gazetteer.toJSON().filter((e) => !e.builtin) }));
        return removed;
      },
      extract: (text) => extractFromText(text, { gazetteer, taxonomy: knowledge.taxonomy }),

      searches,
      printConfig: knowledge.print,
      setPrintConfig: (patch) => setKnowledge((k) => ({ ...k, print: { ...k.print, ...patch } })),

      attachments,
      sql,
    };
  }, [typedData, stats, audit, backups, knowledge, gazetteer, vocabulary, vocabularyTick, repo, searches, attachments, sql, add, update, auditTick]);

  void noopResult;

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useAppData(): AppCtx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppData must be used inside <AppProvider>');
  return ctx;
}

/** Convenience hook for views that only need the records. */
export function useRecords(): TypedAppData {
  return useAppData().data;
}

export { APP_VERSION, formatBytes, normalizeRecord, timestamp, ENTITY_ORDER };
export type { BackupEnvelope, MergePolicy, VerifyResult, ValidationIssue, SavedSearch, GazetteerEntry, TaxonomyRule };
