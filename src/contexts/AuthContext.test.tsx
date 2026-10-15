import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import * as sessionModule from '../lib/session';

// Mock dependencies
vi.mock('../lib/session', () => ({
  getBaseUrl: vi.fn(() => 'http://mock.url'),
  setStoredSession: vi.fn(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('provides default unauthenticated state', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.session).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('handles login flow correctly', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    const mockUser = {
      id: 'user-1',
      name: 'Test User',
      department: 'Medical',
      role: 'Doctor',
    };
    const mockToken = 'mock-token';

    await act(async () => {
      result.current.login(mockUser, mockToken);
    });

    // Check state
    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.session).toEqual(expect.objectContaining({
      userId: 'user-1',
      userName: 'Test User',
      department: 'Medical',
      role: 'Doctor',
    }));

    // Check localStorage
    expect(localStorage.getItem('nk_token')).toBe(mockToken);
    const storedUser = JSON.parse(localStorage.getItem('nk_current_user') || '{}');
    expect(storedUser.userId).toBe('user-1');

    // Check setStoredSession called
    expect(sessionModule.setStoredSession).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: mockToken,
      userId: 'user-1',
    }));

    // Check heartbeat fetch initiated
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/presence/heartbeat'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"currentScreen":"Dashboard"'),
      })
    );
  });

  it('handles logout flow correctly', async () => {
    // Setup initial authenticated state
    localStorage.setItem('nk_token', 'mock-token');
    localStorage.setItem('nk_current_user', JSON.stringify({
      userId: 'user-1',
      userName: 'Test User',
      department: 'Medical',
      role: 'Doctor',
      loginTime: new Date().toISOString(),
    }));

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    // Verify initial login state from localStorage
    expect(result.current.isLoggedIn).toBe(true);

    mockFetch.mockClear();

    await act(async () => {
      result.current.logout();
    });

    // Check state reset
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.session).toBeNull();

    // Check localStorage cleared
    expect(localStorage.getItem('nk_token')).toBeNull();
    expect(localStorage.getItem('nk_current_user')).toBeNull();

    // Check setStoredSession cleared
    expect(sessionModule.setStoredSession).toHaveBeenCalledWith(null);

    // Check offline heartbeat sent
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/presence/heartbeat'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"currentStatus":"OFFLINE"'),
      })
    );
  });

  it('handles invalid token on mount', () => {
    localStorage.setItem('nk_token', 'null');
    localStorage.setItem('nk_current_user', '{"some": "data"}');

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.session).toBeNull();
    expect(localStorage.getItem('nk_token')).toBeNull();
    expect(localStorage.getItem('nk_current_user')).toBeNull();
    expect(sessionModule.setStoredSession).toHaveBeenCalledWith(null);
  });

  it('restores session from valid localStorage on mount', () => {
    const mockSession = {
      userId: 'user-1',
      userName: 'Test User',
      department: 'Medical',
      role: 'Doctor',
      loginTime: new Date().toISOString(),
    };

    localStorage.setItem('nk_token', 'mock-token');
    localStorage.setItem('nk_current_user', JSON.stringify(mockSession));

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.session).toEqual(expect.objectContaining({
      userId: 'user-1',
    }));

    // Check it syncs with IndexedDB (setStoredSession)
    expect(sessionModule.setStoredSession).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'mock-token',
      userId: 'user-1',
    }));
  });
});
