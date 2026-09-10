import '@testing-library/jest-dom';
import { vi } from 'vitest';

if (typeof globalThis.indexedDB === 'undefined') {
  try {
    require('fake-indexeddb/auto');
  } catch (e) {
    (globalThis as any).indexedDB = {
      open: () => ({
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    };
  }
}

// Mock idb module to prevent IndexedDB undefined errors in jsdom environment
vi.mock('idb', () => ({
  openDB: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
    getAllKeys: vi.fn().mockResolvedValue([]),
    objectStoreNames: {
      contains: vi.fn().mockReturnValue(true),
    },
    createObjectStore: vi.fn(),
  }),
}));

