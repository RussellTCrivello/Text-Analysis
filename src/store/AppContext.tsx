import React, { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { Analysis, AppData, BackupRecord, Content, Source } from '../types';
import { generateId, sampleData } from '../data/sampleData';

const STORAGE_KEY = 'tam_data';
const BACKUPS_KEY = 'tam_backups';

function migrateRecord(r: Record<string, unknown>): Record<string, unknown> {
  // Migrate old field names to current schema
  const m = { ...r };
  if ('link' in m && !('link_sources' in m)) { m.link_sources = m.link; delete m.link; }
  if ('entryDate' in m && !('date_entry' in m)) { m.date_entry = m.entryDate; delete m.entryDate; }
  if ('createdAt' in m && !('date_creation' in m)) { m.date_creation = m.createdAt; delete m.createdAt; }
  if ('updatedAt' in m && !('date_modified' in m)) { m.date_modified = m.updatedAt; delete m.updatedAt; }
  if ('text' in m && !('content_data' in m)) { m.content_data = m.text; delete m.text; }
  if ('sourceId' in m && !('sources_id' in m)) { m.sources_id = m.sourceId; delete m.sourceId; }
  if ('contentId' in m && !('content_id' in m)) { m.content_id = m.contentId; delete m.contentId; }
  if ('people' in m && !('list_names_people' in m)) { m.list_names_people = m.people; delete m.people; }
  if ('places' in m && !('list_names_places' in m)) { m.list_names_places = m.places; delete m.places; }
  if ('coordinates' in m && !('list_coordinates' in m)) { m.list_coordinates = m.coordinates; delete m.coordinates; }
  if ('parties' in m && !('list_sides' in m)) { m.list_sides = m.parties; delete m.parties; }
  if ('date' in m && !('date_analysis' in m)) { m.date_analysis = m.date; delete m.date; }
  if ('dateContent' in m && !('date_content' in m)) { m.date_content = m.dateContent; delete m.dateContent; }
  // Normalize importance: old 1-5 integer scale → 0-1 float
  if (typeof m.importance === 'number' && m.importance > 1) {
    m.importance = Math.min(1, m.importance / 5);
  }
  // Ensure required string fields exist
  if (!('content_data' in m)) m.content_data = '';
  if (!('link_sources' in m)) m.link_sources = '';
  if (!('date_entry' in m)) m.date_entry = '';
  if (!('date_creation' in m)) m.date_creation = new Date().toISOString();
  if (!('date_modified' in m)) m.date_modified = new Date().toISOString();
  return m;
}

function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          sources: Array.isArray(parsed.sources) ? parsed.sources.map(migrateRecord) as unknown as Source[] : [],
          contents: Array.isArray(parsed.contents) ? parsed.contents.map(migrateRecord) as unknown as Content[] : [],
          analyses: Array.isArray(parsed.analyses) ? parsed.analyses.map(migrateRecord) as unknown as Analysis[] : [],
        };
      }
    }
  } catch {}
  return { sources: [], contents: [], analyses: [] };
}

function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadBackups(): BackupRecord[] {
  try {
    const raw = localStorage.getItem(BACKUPS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveBackups(backups: BackupRecord[]) {
  localStorage.setItem(BACKUPS_KEY, JSON.stringify(backups));
}

interface AppCtx {
  data: AppData;
  backups: BackupRecord[];
  addSource: (s: Omit<Source, 'id' | 'date_creation' | 'date_modified'>) => void;
  updateSource: (s: Source) => void;
  deleteSource: (id: string) => void;
  duplicateSource: (id: string) => void;
  addContent: (c: Omit<Content, 'id' | 'date_creation' | 'date_modified'>) => void;
  updateContent: (c: Content) => void;
  deleteContent: (id: string) => void;
  duplicateContent: (id: string) => void;
  addAnalysis: (a: Omit<Analysis, 'id' | 'date_creation' | 'date_modified'>) => void;
  updateAnalysis: (a: Analysis) => void;
  deleteAnalysis: (id: string) => void;
  duplicateAnalysis: (id: string) => void;
  bulkDeleteSources: (ids: string[]) => void;
  bulkDeleteContents: (ids: string[]) => void;
  bulkDeleteAnalyses: (ids: string[]) => void;
  loadSampleData: () => void;
  clearAllData: () => void;
  createBackup: (name?: string) => void;
  restoreBackup: (id: string) => void;
  mergeBackup: (id: string) => void;
  deleteBackup: (id: string) => void;
  restoreFromRaw: (data: AppData, merge?: boolean) => void;
  importData: (data: Partial<AppData>, merge?: boolean) => void;
}

const emptyData: AppData = { sources: [], contents: [], analyses: [] };
const AppContext = createContext<AppCtx>({
  data: emptyData, backups: [],
  addSource: () => {}, updateSource: () => {}, deleteSource: () => {}, duplicateSource: () => {},
  addContent: () => {}, updateContent: () => {}, deleteContent: () => {}, duplicateContent: () => {},
  addAnalysis: () => {}, updateAnalysis: () => {}, deleteAnalysis: () => {}, duplicateAnalysis: () => {},
  bulkDeleteSources: () => {}, bulkDeleteContents: () => {}, bulkDeleteAnalyses: () => {},
  loadSampleData: () => {}, clearAllData: () => {},
  createBackup: () => {}, restoreBackup: () => {}, mergeBackup: () => {}, deleteBackup: () => {},
  restoreFromRaw: () => {}, importData: () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<AppData>(loadData);
  const [backups, setBackupsState] = useState<BackupRecord[]>(loadBackups);

  const setData = useCallback((fn: (prev: AppData) => AppData) => {
    setDataState(prev => {
      const next = fn(prev);
      saveData(next);
      return next;
    });
  }, []);

  const setBackups = useCallback((fn: (prev: BackupRecord[]) => BackupRecord[]) => {
    setBackupsState(prev => {
      const next = fn(prev);
      saveBackups(next);
      return next;
    });
  }, []);

  const now = () => new Date().toISOString();

  const addSource = (s: Omit<Source, 'id' | 'date_creation' | 'date_modified'>) =>
    setData(d => ({ ...d, sources: [...d.sources, { ...s, id: generateId('s'), date_creation: now(), date_modified: now() }] }));

  const updateSource = (s: Source) =>
    setData(d => ({ ...d, sources: d.sources.map(x => x.id === s.id ? { ...s, date_modified: now() } : x) }));

  const deleteSource = (id: string) =>
    setData(d => ({ ...d, sources: d.sources.filter(x => x.id !== id) }));

  const duplicateSource = (id: string) =>
    setData(d => {
      const orig = d.sources.find(x => x.id === id);
      if (!orig) return d;
      return { ...d, sources: [...d.sources, { ...orig, id: generateId('s'), name: orig.name + ' (Copy)', date_creation: now(), date_modified: now() }] };
    });

  const addContent = (c: Omit<Content, 'id' | 'date_creation' | 'date_modified'>) =>
    setData(d => ({ ...d, contents: [...d.contents, { ...c, id: generateId('c'), date_creation: now(), date_modified: now() }] }));

  const updateContent = (c: Content) =>
    setData(d => ({ ...d, contents: d.contents.map(x => x.id === c.id ? { ...c, date_modified: now() } : x) }));

  const deleteContent = (id: string) =>
    setData(d => ({ ...d, contents: d.contents.filter(x => x.id !== id) }));

  const duplicateContent = (id: string) =>
    setData(d => {
      const orig = d.contents.find(x => x.id === id);
      if (!orig) return d;
      return { ...d, contents: [...d.contents, { ...orig, id: generateId('c'), title: orig.title + ' (Copy)', date_creation: now(), date_modified: now() }] };
    });

  const addAnalysis = (a: Omit<Analysis, 'id' | 'date_creation' | 'date_modified'>) =>
    setData(d => ({ ...d, analyses: [...d.analyses, { ...a, id: generateId('a'), date_creation: now(), date_modified: now() }] }));

  const updateAnalysis = (a: Analysis) =>
    setData(d => ({ ...d, analyses: d.analyses.map(x => x.id === a.id ? { ...a, date_modified: now() } : x) }));

  const deleteAnalysis = (id: string) =>
    setData(d => ({ ...d, analyses: d.analyses.filter(x => x.id !== id) }));

  const duplicateAnalysis = (id: string) =>
    setData(d => {
      const orig = d.analyses.find(x => x.id === id);
      if (!orig) return d;
      return { ...d, analyses: [...d.analyses, { ...orig, id: generateId('a'), date_creation: now(), date_modified: now() }] };
    });

  const bulkDeleteSources = (ids: string[]) =>
    setData(d => ({ ...d, sources: d.sources.filter(x => !ids.includes(x.id)) }));

  const bulkDeleteContents = (ids: string[]) =>
    setData(d => ({ ...d, contents: d.contents.filter(x => !ids.includes(x.id)) }));

  const bulkDeleteAnalyses = (ids: string[]) =>
    setData(d => ({ ...d, analyses: d.analyses.filter(x => !ids.includes(x.id)) }));

  const loadSampleData = () => setData(() => ({ ...sampleData }));
  const clearAllData = () => setData(() => ({ sources: [], contents: [], analyses: [] }));

  const createBackup = (name?: string) => {
    const rec: BackupRecord = {
      id: generateId('bk'),
      name: name ?? `backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
      date_creation: now(),
      data: { ...data },
      sourceCount: data.sources.length,
      contentCount: data.contents.length,
      analysisCount: data.analyses.length,
    };
    setBackups(bs => [rec, ...bs]);
  };

  const restoreBackup = (id: string) => {
    const bk = backups.find(b => b.id === id);
    if (bk) setData(() => ({ ...bk.data }));
  };

  const mergeBackup = (id: string) => {
    const bk = backups.find(b => b.id === id);
    if (!bk) return;
    setData(d => ({
      sources: [...d.sources, ...bk.data.sources.filter(s => !d.sources.find(x => x.id === s.id))],
      contents: [...d.contents, ...bk.data.contents.filter(c => !d.contents.find(x => x.id === c.id))],
      analyses: [...d.analyses, ...bk.data.analyses.filter(a => !d.analyses.find(x => x.id === a.id))],
    }));
  };

  const deleteBackup = (id: string) => setBackups(bs => bs.filter(b => b.id !== id));

  const restoreFromRaw = (raw: AppData, merge = false) => {
    if (merge) {
      setData(d => ({
        sources: [...d.sources, ...raw.sources.filter(s => !d.sources.find(x => x.id === s.id))],
        contents: [...d.contents, ...raw.contents.filter(c => !d.contents.find(x => x.id === c.id))],
        analyses: [...d.analyses, ...raw.analyses.filter(a => !d.analyses.find(x => x.id === a.id))],
      }));
    } else {
      setData(() => raw);
    }
  };

  const importData = (partial: Partial<AppData>, merge = true) => {
    setData(d => ({
      sources: merge
        ? [...d.sources, ...(partial.sources ?? []).filter(s => !d.sources.find(x => x.id === s.id))]
        : (partial.sources ?? d.sources),
      contents: merge
        ? [...d.contents, ...(partial.contents ?? []).filter(c => !d.contents.find(x => x.id === c.id))]
        : (partial.contents ?? d.contents),
      analyses: merge
        ? [...d.analyses, ...(partial.analyses ?? []).filter(a => !d.analyses.find(x => x.id === a.id))]
        : (partial.analyses ?? d.analyses),
    }));
  };

  return (
    <AppContext.Provider value={{
      data, backups,
      addSource, updateSource, deleteSource, duplicateSource,
      addContent, updateContent, deleteContent, duplicateContent,
      addAnalysis, updateAnalysis, deleteAnalysis, duplicateAnalysis,
      bulkDeleteSources, bulkDeleteContents, bulkDeleteAnalyses,
      loadSampleData, clearAllData,
      createBackup, restoreBackup, mergeBackup, deleteBackup,
      restoreFromRaw, importData,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppData() {
  return useContext(AppContext);
}
