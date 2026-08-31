import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBaseUrl } from '../session';


describe('getBaseUrl tests', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Mock idb so session.ts doesn't crash on import
    vi.mock('idb', () => ({
      openDB: vi.fn(),
    }));

    // Start with a clean slate for window properties
    // @ts-ignore
    delete window.location;
    window.location = { hostname: 'localhost', protocol: 'http:' } as any;

    if (global.window && 'Capacitor' in (global.window as any)) {
       // @ts-ignore
      delete global.window.Capacitor;
    }

    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();

    // Restore window selectively to avoid crypto errors
    if (global.window) {
      window.location = originalLocation;
      if ('Capacitor' in window) {
         // @ts-ignore
        delete (window as any).Capacitor;
      }
    }
  });

  it('runs on localhost without capacitor', () => {
    expect(getBaseUrl()).toBe('http://localhost:3001');
  });

  it('runs on localhost with capacitor but no saved IP', () => {
    (window as any).Capacitor = {};
    expect(getBaseUrl()).toBe('https://nek-kadam.onrender.com');
  });

  it('runs on localhost with capacitor and saved IP', () => {
    (window as any).Capacitor = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === 'NEK_KADAM_SERVER_IP') return '192.168.1.100';
      return null;
    });
    expect(getBaseUrl()).toBe('http://192.168.1.100:3001');
  });

  it('runs with custom IP saved in settings (not localhost)', () => {
    window.location = { hostname: 'example.com', protocol: 'http:' } as any;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === 'NEK_KADAM_SERVER_IP') return '10.0.0.5';
      return null;
    });
    expect(getBaseUrl()).toBe('http://10.0.0.5:3001');
  });

  it('runs as capacitor APK (no custom IP, not localhost)', () => {
    window.location = { hostname: 'example.com', protocol: 'http:' } as any;
    (window as any).Capacitor = {};
    expect(getBaseUrl()).toBe('https://nek-kadam.onrender.com');
  });

  it('accessed in browser on LAN', () => {
    window.location = { hostname: '192.168.1.50', protocol: 'http:' } as any;
    expect(getBaseUrl()).toBe('http://192.168.1.50:3001');
  });

  it('accessed in browser on public domain', () => {
    window.location = { hostname: 'example.com', protocol: 'https:' } as any;
    expect(getBaseUrl()).toBe('');
  });

  it('runs in non-browser environment', () => {
    // Save original properties that we want to mask
    const origWindow = global.window;

    // In vitest with jsdom, `window` is a getter on `global`.
    // We can use Object.defineProperty to override it to undefined temporarily.
    Object.defineProperty(global, 'window', {
      value: undefined,
      configurable: true,
      writable: true
    });

    expect(getBaseUrl()).toBe('https://nek-kadam.onrender.com');

    // Restore window
    Object.defineProperty(global, 'window', {
      value: origWindow,
      configurable: true,
      writable: true
    });
  });
});
