/** Storage adapters. The core never touches `localStorage` directly. */

export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(prefix: string): string[];
  /** Approximate bytes used by keys with the given prefix. */
  usage(prefix: string): number;
}

export class StorageQuotaError extends Error {
  readonly bytes: number;
  constructor(bytes: number, cause?: unknown) {
    super(`Storage quota exceeded while writing ${bytes} bytes`);
    this.name = 'StorageQuotaError';
    this.bytes = bytes;
    if (cause) (this as { cause?: unknown }).cause = cause;
  }
}

export class MemoryStorage implements StorageAdapter {
  private map = new Map<string, string>();
  get(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  set(key: string, value: string): void {
    this.map.set(key, value);
  }
  remove(key: string): void {
    this.map.delete(key);
  }
  keys(prefix: string): string[] {
    return [...this.map.keys()].filter((k) => k.startsWith(prefix));
  }
  usage(prefix: string): number {
    let total = 0;
    for (const k of this.keys(prefix)) total += k.length + (this.map.get(k)?.length ?? 0);
    return total;
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  private readonly store: Storage;
  constructor(store: Storage = globalThis.localStorage) {
    this.store = store;
  }

  get(key: string): string | null {
    try {
      return this.store.getItem(key);
    } catch {
      return null;
    }
  }

  set(key: string, value: string): void {
    try {
      this.store.setItem(key, value);
    } catch (err) {
      throw new StorageQuotaError(value.length, err);
    }
  }

  remove(key: string): void {
    try {
      this.store.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  keys(prefix: string): string[] {
    const out: string[] = [];
    try {
      for (let i = 0; i < this.store.length; i++) {
        const k = this.store.key(i);
        if (k && k.startsWith(prefix)) out.push(k);
      }
    } catch {
      /* ignore */
    }
    return out;
  }

  usage(prefix: string): number {
    let total = 0;
    for (const k of this.keys(prefix)) total += k.length + (this.get(k)?.length ?? 0);
    return total * 2; // UTF-16 code units
  }
}

/** Pick the best adapter available in the current environment. */
export function createStorage(): StorageAdapter {
  try {
    if (typeof globalThis.localStorage !== 'undefined') {
      const probe = '__tam_probe__';
      globalThis.localStorage.setItem(probe, '1');
      globalThis.localStorage.removeItem(probe);
      return new LocalStorageAdapter();
    }
  } catch {
    /* fall through to memory */
  }
  return new MemoryStorage();
}
