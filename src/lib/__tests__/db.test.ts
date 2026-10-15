import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// First, mock the dependencies before importing db
vi.mock('../session', () => ({
  getStoredSession: vi.fn().mockResolvedValue({ sessionId: 'mock-session-id' }),
  setStoredSession: vi.fn(),
  getBaseUrl: vi.fn().mockReturnValue('http://localhost:3001'),
  isPrivateNetwork: vi.fn().mockReturnValue(true)
}));

const originalWindow = global.window;
const originalLocalStorage = global.localStorage;

describe('db.ts checkServerOnline', () => {
  let checkServerOnline: any;
  let _discoverLocalServerSpy: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();

    global.fetch = vi.fn();

    const mockStorage = new Map();
    global.localStorage = {
      getItem: (key) => mockStorage.get(key) || null,
      setItem: (key, val) => mockStorage.set(key, val),
      removeItem: (key) => mockStorage.delete(key),
      clear: () => mockStorage.clear(),
      length: 0,
      key: () => null,
    } as any;

    global.window = {
      location: {
        hostname: '192.168.1.100', // Private network
        protocol: 'http:',
      },
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as any;

    const dbModule = await import('../db');
    checkServerOnline = dbModule.checkServerOnline;
    // We can't easily spy on a function inside the same module if it's called internally
    // without it being exported and called from exports (like `exports.discoverLocalServer()`).
    // In db.ts, discoverLocalServer is called directly by checkServerOnline:
    // discoverLocalServer().catch(...)
    // So vi.spyOn(dbModule, 'discoverLocalServer') won't catch it unless checkServerOnline calls dbModule.discoverLocalServer

    // Instead, since discoverLocalServer logs "[AUTO-DISCOVERY]", we can spy on console.log
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    global.window = originalWindow;
    global.localStorage = originalLocalStorage;
  });

  it('should return true if local LAN server responds with ok: true', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({ ok: true } as Response);

    const isOnline = await checkServerOnline();

    expect(isOnline).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('http://192.168.1.100:3001/rpc/query', expect.any(Object));
  });

  it('should fallback to Cloud URL and return true if LAN fails but Cloud responds ok', async () => {
    vi.mocked(global.fetch)
      .mockRejectedValueOnce(new Error('LAN connection failed')) // LAN fails
      .mockResolvedValueOnce({ ok: true } as Response);          // Cloud succeeds

    const isOnline = await checkServerOnline();

    expect(isOnline).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(1, 'http://192.168.1.100:3001/rpc/query', expect.any(Object));
    expect(global.fetch).toHaveBeenNthCalledWith(2, 'https://nek-kadam.onrender.com/rpc/query', expect.any(Object));
  });

  it('should fallback to relative /rpc and return true if LAN and Cloud fail but relative succeeds', async () => {
    vi.mocked(global.fetch)
      .mockRejectedValueOnce(new Error('LAN connection failed')) // LAN fails
      .mockRejectedValueOnce(new Error('Cloud connection failed')) // Cloud fails
      .mockResolvedValueOnce({ ok: true } as Response);            // Relative succeeds

    const isOnline = await checkServerOnline();

    expect(isOnline).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(global.fetch).toHaveBeenNthCalledWith(3, '/rpc/query', expect.any(Object));
  });

  it('should return false and trigger discoverLocalServer if all connections fail', async () => {
    vi.mocked(global.fetch)
      .mockRejectedValueOnce(new Error('LAN fail'))
      .mockRejectedValueOnce(new Error('Cloud fail'))
      .mockRejectedValueOnce(new Error('Relative fail'));

    const isOnline = await checkServerOnline();

    expect(isOnline).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(3);

    // We can verify discoverLocalServer started by checking if the console.log for its start was called
    expect(console.log).toHaveBeenCalledWith('[AUTO-DISCOVERY] Started background local network discovery...');
  });

  it('should return cached result if called again within 5000ms', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({ ok: true } as Response);

    let isOnline = await checkServerOnline();
    expect(isOnline).toBe(true);

    // clear all mocks including fetch because other functions in db.ts might be calling fetch periodically
    vi.mocked(global.fetch).mockClear();

    vi.advanceTimersByTime(2000);

    isOnline = await checkServerOnline();
    expect(isOnline).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(0); // Should not have been called again by checkServerOnline
  });

  it('should re-check if cached result is older than 5000ms', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);

    await checkServerOnline();

    vi.mocked(global.fetch).mockClear();
    vi.mocked(global.fetch).mockResolvedValueOnce({ ok: true } as Response);

    vi.advanceTimersByTime(6000);

    await checkServerOnline();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
