/**
 * Attachment store.
 *
 * The desktop application keeps attachments in a per-source folder. In the
 * browser the equivalent is IndexedDB: real files, real bytes, real downloads —
 * not a list of filenames. The interface is asynchronous and has an in-memory
 * implementation so the core stays testable outside a browser.
 */
import { byteLength, fnv1a64, formatBytes, id as makeId, timestamp } from './text';

/** Where an attachment came from — its provenance. */
export type AttachmentOrigin = 'file' | 'url' | 'clipboard' | 'generated' | 'import';

export interface AttachmentMeta {
  id: string;
  contentId: string;
  name: string;
  mime: string;
  size: number;
  addedAt: string;
  checksum: string;
  /* provenance & linkage */
  /** What kind of record this file belongs to. */
  recordType?: 'content' | 'source' | 'analysis';
  /** Human label of the linked record, kept so the manager can show context. */
  recordTitle?: string;
  /** Parent source of the linked content record, when known. */
  sourceId?: string;
  sourceName?: string;
  origin?: AttachmentOrigin;
  /** Original location: file name as picked, or the URL it was captured from. */
  sourceUrl?: string;
  note?: string;
  attachedBy?: string;
}

export interface AttachmentPayload {
  name: string;
  mime: string;
  data: Uint8Array | Blob | string;
  recordType?: AttachmentMeta['recordType'];
  recordTitle?: string;
  sourceId?: string;
  sourceName?: string;
  origin?: AttachmentOrigin;
  sourceUrl?: string;
  note?: string;
  attachedBy?: string;
}

/** Shape persisted in IndexedDB: meta fields plus the file under `bytes`. */
type RawAttachmentRecord = AttachmentMeta & { bytes?: Blob | Uint8Array; blob?: Blob };

export interface AttachmentStore {
  list(contentId?: string): Promise<AttachmentMeta[]>;
  put(contentId: string, payload: AttachmentPayload): Promise<AttachmentMeta>;
  /** Returns the file as a real Blob, or null when the record (or its data) is missing. */
  get(id: string): Promise<{ meta: AttachmentMeta; blob: Blob } | null>;
  remove(id: string): Promise<boolean>;
  removeByContent(contentId: string): Promise<number>;
  /** Edit provenance metadata (note, source URL, linked record label). */
  update(id: string, patch: Partial<AttachmentMeta>): Promise<AttachmentMeta | null>;
  stats(): Promise<{ count: number; bytes: number; byContent: Record<string, number> }>;
}

const DB_NAME = 'tam_attachments';
const STORE = 'files';

async function toBytes(data: Uint8Array | Blob | string): Promise<Uint8Array> {
  if (typeof data === 'string') return new TextEncoder().encode(data);
  if (data instanceof Uint8Array) return data;
  return new Uint8Array(await data.arrayBuffer());
}

function metaOf(contentId: string, payload: AttachmentPayload, bytes: Uint8Array): AttachmentMeta {
  return {
    id: makeId('att'),
    contentId,
    name: payload.name,
    mime: payload.mime,
    size: bytes.length,
    addedAt: timestamp(),
    checksum: fnv1a64(String.fromCharCode(...bytes.subarray(0, 4096))),
    recordType: payload.recordType ?? 'content',
    recordTitle: payload.recordTitle,
    sourceId: payload.sourceId,
    sourceName: payload.sourceName,
    origin: payload.origin ?? 'file',
    sourceUrl: payload.sourceUrl,
    note: payload.note,
    attachedBy: payload.attachedBy ?? 'local-user',
  };
}

export class MemoryAttachmentStore implements AttachmentStore {
  private records = new Map<string, { meta: AttachmentMeta; bytes: Uint8Array }>();

  async list(contentId?: string): Promise<AttachmentMeta[]> {
    const all = [...this.records.values()].map((r) => r.meta);
    return (contentId ? all.filter((m) => m.contentId === contentId) : all).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  async put(contentId: string, payload: AttachmentPayload): Promise<AttachmentMeta> {
    const bytes = await toBytes(payload.data);
    const meta = metaOf(contentId, payload, bytes);
    this.records.set(meta.id, { meta, bytes });
    return meta;
  }

  async update(id: string, patch: Partial<AttachmentMeta>): Promise<AttachmentMeta | null> {
    const found = this.records.get(id);
    if (!found) return null;
    const meta = { ...found.meta, ...patch, id: found.meta.id };
    this.records.set(id, { meta, bytes: found.bytes });
    return meta;
  }

  async get(id: string): Promise<{ meta: AttachmentMeta; blob: Blob } | null> {
    const found = this.records.get(id);
    if (!found) return null;
    return { meta: found.meta, blob: new Blob([found.bytes as BlobPart], { type: found.meta.mime }) };
  }

  async remove(id: string): Promise<boolean> {
    return this.records.delete(id);
  }

  async removeByContent(contentId: string): Promise<number> {
    let removed = 0;
    for (const [id, record] of this.records) {
      if (record.meta.contentId === contentId) {
        this.records.delete(id);
        removed++;
      }
    }
    return removed;
  }

  async stats(): Promise<{ count: number; bytes: number; byContent: Record<string, number> }> {
    const byContent: Record<string, number> = {};
    let bytes = 0;
    for (const { meta } of this.records.values()) {
      bytes += meta.size;
      byContent[meta.contentId] = (byContent[meta.contentId] ?? 0) + 1;
    }
    return { count: this.records.size, bytes, byContent };
  }
}

export class IndexedDbAttachmentStore implements AttachmentStore {
  private dbPromise: Promise<IDBDatabase>;

  constructor(dbName = DB_NAME) {
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('contentId', 'contentId', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /** Shape persisted in IndexedDB: meta fields plus the file under `bytes`.
   *  `blob` is only read, for compatibility with older builds. */
  private async rawGet(id: string): Promise<RawAttachmentRecord | undefined> {
    return this.tx<RawAttachmentRecord | undefined>('readonly', (store) =>
      store.get(id) as unknown as IDBRequest<RawAttachmentRecord | undefined>,
    );
  }

  private static metaOfRecord(record: RawAttachmentRecord): AttachmentMeta {
    const { bytes, blob, ...meta } = record;
    void bytes;
    void blob;
    return meta as AttachmentMeta;
  }

  private static fileOf(record: RawAttachmentRecord): Blob | null {
    const data = record.bytes ?? record.blob;
    if (data instanceof Blob) return data;
    if (data) return new Blob([data as BlobPart], { type: record.mime ?? 'application/octet-stream' });
    return null;
  }

  private async tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.dbPromise;
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = fn(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async list(contentId?: string): Promise<AttachmentMeta[]> {
    const all = await this.tx<RawAttachmentRecord[]>('readonly', (store) => store.getAll() as unknown as IDBRequest<RawAttachmentRecord[]>);
    const metas = all.map(IndexedDbAttachmentStore.metaOfRecord);
    const filtered = contentId ? metas.filter((m) => m.contentId === contentId) : metas;
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  async put(contentId: string, payload: AttachmentPayload): Promise<AttachmentMeta> {
    const bytes = await toBytes(payload.data);
    const meta = metaOf(contentId, payload, bytes);
    await this.tx('readwrite', (store) =>
      store.put({ ...meta, bytes: new Blob([bytes as BlobPart], { type: meta.mime }) }) as unknown as IDBRequest,
    );
    return meta;
  }

  /** Patch metadata without touching the stored file. (The previous version
   *  read the file through a mismatched field name, which truncated it.) */
  async update(id: string, patch: Partial<AttachmentMeta>): Promise<AttachmentMeta | null> {
    const record = await this.rawGet(id);
    if (!record) return null;
    const file = IndexedDbAttachmentStore.fileOf(record);
    const meta = { ...IndexedDbAttachmentStore.metaOfRecord(record), ...patch, id: record.id };
    await this.tx('readwrite', (store) =>
      store.put({ ...meta, bytes: file ?? new Blob() }) as unknown as IDBRequest,
    );
    return meta;
  }

  async get(id: string): Promise<{ meta: AttachmentMeta; blob: Blob } | null> {
    const record = await this.rawGet(id);
    if (!record) return null;
    const blob = IndexedDbAttachmentStore.fileOf(record);
    if (!blob) return null; // metadata survives, but the file bytes are gone
    return { meta: IndexedDbAttachmentStore.metaOfRecord(record), blob };
  }

  async remove(id: string): Promise<boolean> {
    const before = await this.rawGet(id);
    if (!before) return false;
    await this.tx('readwrite', (store) => store.delete(id) as unknown as IDBRequest);
    return true;
  }

  async removeByContent(contentId: string): Promise<number> {
    const metas = await this.list(contentId);
    for (const meta of metas) await this.remove(meta.id);
    return metas.length;
  }

  async stats(): Promise<{ count: number; bytes: number; byContent: Record<string, number> }> {
    const all = await this.tx<RawAttachmentRecord[]>('readonly', (store) => store.getAll() as unknown as IDBRequest<RawAttachmentRecord[]>);
    const byContent: Record<string, number> = {};
    let bytes = 0;
    for (const record of all) {
      const meta = IndexedDbAttachmentStore.metaOfRecord(record);
      bytes += meta.size;
      byContent[meta.contentId] = (byContent[meta.contentId] ?? 0) + 1;
    }
    return { count: all.length, bytes, byContent };
  }
}

export function createAttachmentStore(): AttachmentStore {
  if (typeof indexedDB !== 'undefined') {
    try {
      return new IndexedDbAttachmentStore();
    } catch {
      /* fall through */
    }
  }
  return new MemoryAttachmentStore();
}

/* ------------------------------- UI helpers -------------------------------- */

export async function openAttachment(store: AttachmentStore, id: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const found = await store.get(id);
  if (!found) return false;
  const url = URL.createObjectURL(found.blob);
  const win = window.open(url, '_blank', 'noopener');
  if (!win) {
    // Popup blocked — fall back to a download.
    downloadBlob(found.blob, found.meta.name);
  }
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return true;
}

export async function downloadAttachment(store: AttachmentStore, id: string): Promise<boolean> {
  const found = await store.get(id);
  if (!found) return false;
  downloadBlob(found.blob, found.meta.name);
  return true;
}

export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function readAttachmentText(store: AttachmentStore, id: string): Promise<string | null> {
  const found = await store.get(id);
  if (!found) return null;
  return found.blob.text();
}

/** One-line provenance summary for tables and toasts. */
export function describeProvenance(meta: AttachmentMeta): string {
  const origin = meta.origin ?? 'file';
  const where = meta.sourceUrl ? ` from ${meta.sourceUrl}` : '';
  const link = meta.recordTitle ? ` → ${meta.recordTitle}` : meta.contentId ? ` → ${meta.contentId}` : '';
  return `${origin}${where}${link}`;
}

/** Attachments grouped by the record they belong to. */
export function groupByRecord(metas: AttachmentMeta[]): { recordId: string; recordTitle: string; items: AttachmentMeta[] }[] {
  const map = new Map<string, { recordId: string; recordTitle: string; items: AttachmentMeta[] }>();
  for (const meta of metas) {
    const key = meta.contentId || '(unlinked)';
    const bucket = map.get(key) ?? { recordId: key, recordTitle: meta.recordTitle ?? key, items: [] };
    bucket.items.push(meta);
    map.set(key, bucket);
  }
  return [...map.values()].sort((a, b) => a.recordTitle.localeCompare(b.recordTitle));
}

export function describeAttachments(metas: AttachmentMeta[]): string {
  if (!metas.length) return 'No attachments';
  const total = metas.reduce((n, m) => n + m.size, 0);
  return `${metas.length} file(s) · ${formatBytes(total)}`;
}

export function textByteSize(value: string): number {
  return byteLength(value);
}
