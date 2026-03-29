import { isTauriApp } from './tauri';

const STORE_FILENAME = 'settings.json';

export interface KVStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

type TauriStore = Awaited<ReturnType<typeof import('@tauri-apps/plugin-store').load>>;

let tauriStorePromise: Promise<TauriStore> | null = null;

function getTauriStore(): Promise<TauriStore> {
  if (!tauriStorePromise) {
    // load() defaults to autoSave with 100ms debounce — writes persist to disk automatically
    tauriStorePromise = import('@tauri-apps/plugin-store').then((m) => m.load(STORE_FILENAME));
  }
  return tauriStorePromise;
}

class TauriKVStorage implements KVStorage {
  async getItem(key: string): Promise<string | null> {
    const store = await getTauriStore();
    return (await store.get<string>(key)) ?? null;
  }
  async setItem(key: string, value: string): Promise<void> {
    const store = await getTauriStore();
    await store.set(key, value);
  }
  async removeItem(key: string): Promise<void> {
    const store = await getTauriStore();
    await store.delete(key);
  }
}

class BrowserKVStorage implements KVStorage {
  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }
  async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }
  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
  }
}

let _storage: KVStorage | null = null;

export function getStorage(): KVStorage {
  if (!_storage) {
    _storage = isTauriApp() ? new TauriKVStorage() : new BrowserKVStorage();
  }
  return _storage;
}
