/** Minimal browser stubs so the React tree can be server-rendered in Node. */
const store = new Map<string, string>();
class LocalStorageStub {
  getItem(key: string): string | null { return store.has(key) ? store.get(key)! : null; }
  setItem(key: string, value: string): void { store.set(key, String(value)); }
  removeItem(key: string): void { store.delete(key); }
  clear(): void { store.clear(); }
  key(i: number): string | null { return [...store.keys()][i] ?? null; }
  get length(): number { return store.size; }
}
const w = globalThis as unknown as Record<string, unknown>;
w.localStorage = new LocalStorageStub();
w.sessionStorage = new LocalStorageStub();
w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
w.print = () => {};
w.confirm = () => true;
w.alert = () => {};
w.URL.createObjectURL = () => 'blob:stub';
w.URL.revokeObjectURL = () => {};
export {};
