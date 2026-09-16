/**
 * User-editable vocabularies.
 *
 * Fields such as `sources.type` and `analyses.classification` are not fixed
 * enumerations: the workspace owns the list of allowed values, the user can add
 * to it from any form, and the values are persisted with the workspace so a
 * team keeps one shared vocabulary. Built-in seeds can be extended but not
 * deleted, and values in use are protected from removal.
 */
import { timestamp } from './text';

export interface VocabularyEntry {
  value: string;
  /** Display label when it differs from the stored value. */
  label?: string;
  builtin?: boolean;
  createdAt?: string;
}

export interface VocabularySet {
  key: string;
  entries: VocabularyEntry[];
}

/** Field keys whose value list the user maintains. */
export const VOCABULARY_KEYS = ['sources.type', 'analyses.classification'] as const;
export type VocabularyKey = (typeof VOCABULARY_KEYS)[number] | string;

const BUILTIN: Record<string, string[]> = {
  'sources.type': [
    'website',
    'person',
    'organization',
    'publication',
    'social_media',
    'document',
    'other',
  ],
  'analyses.classification': [
    'Security / Diplomacy',
    'Political Analysis',
    'Economic / Trade',
    'Environmental Security',
    'Geopolitics',
    'Military',
    'Social',
    'Other',
  ],
};

function norm(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export class VocabularyStore {
  private sets = new Map<string, VocabularyEntry[]>();
  private listeners = new Set<() => void>();

  constructor(seed?: Record<string, VocabularyEntry[]>) {
    for (const key of VOCABULARY_KEYS) {
      const custom = seed?.[key] ?? [];
      const merged: VocabularyEntry[] = (BUILTIN[key] ?? []).map((value) => {
        const override = custom.find((e) => norm(e.value) === norm(value));
        return override ? { ...override, value, builtin: true } : { value, builtin: true };
      });
      for (const entry of custom) {
        if (!merged.some((m) => norm(m.value) === norm(entry.value))) merged.push({ ...entry });
      }
      this.sets.set(key, merged);
    }
    // Any additional user-defined lists survive a round trip.
    for (const [key, entries] of Object.entries(seed ?? {})) {
      if (!this.sets.has(key)) this.sets.set(key, entries.map((e) => ({ ...e })));
    }
  }

  /** Subscribe to changes; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  keys(): string[] {
    return [...this.sets.keys()];
  }

  list(key: VocabularyKey): VocabularyEntry[] {
    return [...(this.sets.get(key) ?? [])];
  }

  values(key: VocabularyKey): string[] {
    return this.list(key).map((e) => e.value);
  }

  has(key: VocabularyKey, value: string): boolean {
    const needle = norm(value);
    return this.list(key).some((e) => norm(e.value) === needle);
  }

  entry(key: VocabularyKey, value: string): VocabularyEntry | undefined {
    const needle = norm(value);
    return this.list(key).find((e) => norm(e.value) === needle);
  }

  /**
   * Add a value. Returns the canonical entry (an existing one when the value is
   * already present, so callers can normalise what they store).
   */
  add(key: VocabularyKey, value: string): { entry: VocabularyEntry; created: boolean; reason?: string } {
    const trimmed = value.trim().replace(/\s+/g, ' ');
    if (!trimmed) return { entry: { value: '' }, created: false, reason: 'empty' };
    if (trimmed.length > 80) return { entry: { value: trimmed }, created: false, reason: 'too-long' };
    const existing = this.sets.get(key) ?? [];
    const found = existing.find((e) => norm(e.value) === norm(trimmed));
    if (found) return { entry: found, created: false };
    const entry: VocabularyEntry = { value: trimmed, createdAt: timestamp() };
    this.sets.set(key, [...existing, entry]);
    this.emit();
    return { entry, created: true };
  }

  /** Remove a value. Built-in and in-use values are protected. */
  remove(key: VocabularyKey, value: string, inUse = 0): { ok: boolean; reason?: string } {
    const entries = this.sets.get(key) ?? [];
    const found = entries.find((e) => norm(e.value) === norm(value));
    if (!found) return { ok: false, reason: 'missing' };
    if (found.builtin) return { ok: false, reason: 'builtin' };
    if (inUse > 0) return { ok: false, reason: 'in-use' };
    this.sets.set(
      key,
      entries.filter((e) => norm(e.value) !== norm(value)),
    );
    this.emit();
    return { ok: true };
  }

  /**
   * Rename or merge two values. Returns the canonical target so the caller can
   * rewrite the records that referenced the old value.
   */
  rename(key: VocabularyKey, from: string, to: string): { ok: boolean; canonical?: string; reason?: string } {
    const target = to.trim().replace(/\s+/g, ' ');
    if (!target) return { ok: false, reason: 'empty' };
    const entries = this.sets.get(key) ?? [];
    const source = entries.find((e) => norm(e.value) === norm(from));
    if (!source) return { ok: false, reason: 'missing' };
    const existing = entries.find((e) => norm(e.value) === norm(target) && norm(e.value) !== norm(from));
    if (existing) {
      // Merge: drop the source, keep the existing target.
      this.sets.set(
        key,
        entries.filter((e) => norm(e.value) !== norm(from)),
      );
      this.emit();
      return { ok: true, canonical: existing.value };
    }
    this.sets.set(
      key,
      entries.map((e) => (norm(e.value) === norm(from) ? { ...e, value: target, label: undefined } : e)),
    );
    this.emit();
    return { ok: true, canonical: target };
  }

  /** Restore the built-in seeds, keeping user additions. */
  resetBuiltins(key: VocabularyKey): void {
    const entries = this.list(key);
    const restored = (BUILTIN[key] ?? []).map<VocabularyEntry>((value) => {
      const existing = entries.find((e) => norm(e.value) === norm(value));
      return existing ? { ...existing, builtin: true } : { value, builtin: true };
    });
    this.sets.set(key, [...restored, ...entries.filter((e) => !e.builtin && !(BUILTIN[key] ?? []).some((b) => norm(b) === norm(e.value)))]);
    this.emit();
  }

  /** Values ranked by how often they appear in the given rows. */
  usage(key: VocabularyKey, rows: Record<string, unknown>[], field: string): { entry: VocabularyEntry; count: number }[] {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const raw = String(row[field] ?? '').trim();
      if (!raw) continue;
      const k = norm(raw);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return this.list(key)
      .map((entry) => ({ entry, count: counts.get(norm(entry.value)) ?? 0 }))
      .sort((a, b) => b.count - a.count || a.entry.value.localeCompare(b.entry.value));
  }

  /** Values present in data but missing from the vocabulary (drift detection). */
  orphans(key: VocabularyKey, rows: Record<string, unknown>[], field: string): { value: string; count: number }[] {
    const known = new Set(this.list(key).map((e) => norm(e.value)));
    const counts = new Map<string, { value: string; count: number }>();
    for (const row of rows) {
      const raw = String(row[field] ?? '').trim();
      if (!raw || known.has(norm(raw))) continue;
      const k = norm(raw);
      const found = counts.get(k);
      if (found) found.count += 1;
      else counts.set(k, { value: raw, count: 1 });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }

  toJSON(): Record<string, VocabularyEntry[]> {
    const out: Record<string, VocabularyEntry[]> = {};
    for (const [key, entries] of this.sets) out[key] = entries.map((e) => ({ ...e }));
    return out;
  }

  static fromJSON(raw: unknown): VocabularyStore {
    const seed: Record<string, VocabularyEntry[]> = {};
    if (raw && typeof raw === 'object') {
      for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (Array.isArray(value)) seed[key] = value.filter((e) => e && typeof e.value === 'string') as VocabularyEntry[];
      }
    }
    return new VocabularyStore(seed);
  }
}

export const DEFAULT_VOCABULARIES = BUILTIN;
