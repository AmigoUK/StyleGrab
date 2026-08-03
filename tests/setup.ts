import { Blob as NodeBlob } from 'node:buffer';
import { cleanup } from '@testing-library/preact';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, vi } from 'vitest';

/**
 * Shared test environment: one fake `chrome` API and a throwaway IndexedDB per
 * test file. Everything the extension touches at runtime is stubbed here rather
 * than mocked per test, so a change to the surface we depend on breaks in one
 * place instead of six.
 */

export interface FakeTab {
  id?: number;
  url?: string;
  windowId?: number;
}

export const fakeChrome = {
  /** Version reported by chrome.runtime.getManifest(), shown by <AppVersion />. */
  version: '0.4.0',
  /** Backing store for chrome.storage.local. */
  storage: {} as Record<string, unknown>,
  /** Tabs returned by chrome.tabs.query — the first one is the "active" tab. */
  tabs: [{ id: 1, url: 'https://example.com/', windowId: 10 }] as FakeTab[],
  /** URLs passed to chrome.tabs.create, in order. */
  createdTabs: [] as string[],
  /** Value handed back as the result of chrome.scripting.executeScript. */
  scanResult: undefined as unknown,
  /** When set, captureVisibleTab rejects with it (thumbnails are best-effort). */
  captureError: null as Error | null,
  captureDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  /** Handler that answers chrome.runtime.sendMessage (i.e. the background). */
  onMessage: null as ((message: unknown) => unknown) | null,

  reset() {
    this.storage = {};
    this.tabs = [{ id: 1, url: 'https://example.com/', windowId: 10 }];
    this.createdTabs = [];
    this.scanResult = undefined;
    this.captureError = null;
    this.onMessage = null;
  },
};

const chromeStub = {
  storage: {
    local: {
      get: async (key?: string | string[] | null) => {
        if (key == null) return { ...fakeChrome.storage };
        const keys = Array.isArray(key) ? key : [key];
        return Object.fromEntries(
          keys.filter((k) => k in fakeChrome.storage).map((k) => [k, fakeChrome.storage[k]]),
        );
      },
      set: async (items: Record<string, unknown>) => {
        Object.assign(fakeChrome.storage, items);
      },
      remove: async (key: string) => {
        delete fakeChrome.storage[key];
      },
      clear: async () => {
        fakeChrome.storage = {};
      },
    },
  },
  tabs: {
    query: async () => fakeChrome.tabs,
    create: async ({ url }: { url: string }) => {
      fakeChrome.createdTabs.push(url);
      return { id: fakeChrome.createdTabs.length + 100, url };
    },
    captureVisibleTab: async () => {
      if (fakeChrome.captureError) throw fakeChrome.captureError;
      return fakeChrome.captureDataUrl;
    },
  },
  scripting: {
    executeScript: async () => [{ result: fakeChrome.scanResult }],
  },
  runtime: {
    sendMessage: async (message: unknown) => fakeChrome.onMessage?.(message),
    getURL: (path: string) => `chrome-extension://stylegrab-test${path}`,
    getManifest: () => ({ version: fakeChrome.version }),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  },
};

Object.defineProperty(globalThis, 'chrome', {
  configurable: true,
  writable: true,
  value: chromeStub as unknown as typeof chrome,
});

/** WXT injects this global into entrypoints; background.ts calls it at import time. */
Object.defineProperty(globalThis, 'defineBackground', {
  configurable: true,
  writable: true,
  value: (arg: unknown) => arg,
});

// jsdom has neither of these, and CardView leans on both for the download button.
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:stylegrab/test';
  URL.revokeObjectURL = () => {};
}

// jsdom's Blob is not structured-cloneable, so IndexedDB would store `{}` for a
// thumbnail. Node's Blob is, and it is what the extension really gets from
// `fetch(dataUrl).blob()` in the service worker.
Object.defineProperty(globalThis, 'Blob', {
  configurable: true,
  writable: true,
  value: NodeBlob,
});

beforeEach(() => {
  fakeChrome.reset();
  // A fresh factory per test keeps thumbnail records from leaking between cases.
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    writable: true,
    value: new IDBFactory(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
