import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock idb so that openDB rejects the promise, simulating a failure opening IndexedDB
vi.mock('idb', () => {
  return {
    openDB: vi.fn(() => Promise.reject(new Error('IndexedDB not allowed'))),
  };
});

describe('session tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getStoredSession returns null when db rejects', async () => {
    // Dynamic import to ensure the mock is applied when module loads
    const { getStoredSession } = await import('../session');

    // Test the error handling inside getStoredSession
    const result = await getStoredSession();
    expect(result).toBeNull();
  });

  it('setStoredSession catches and logs error when db rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Dynamic import to ensure the mock is applied when module loads
    const { setStoredSession } = await import('../session');

    const mockSession = {
      sessionId: 'test',
      userId: '1',
      userName: 'Test User',
      department: 'GEN',
      role: 'USER',
      loginTime: new Date().toISOString(),
      lastSyncTime: null,
    };

    // Should not throw an exception, it should be caught
    await setStoredSession(mockSession);

    // The console.error should be called because of the catch block in setStoredSession
    expect(consoleSpy).toHaveBeenCalledWith('Failed to store session:', expect.any(Error));

    consoleSpy.mockRestore();
  });
});
