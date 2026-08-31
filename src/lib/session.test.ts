import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as session from './session';

describe('session', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(async () => {
    await session.setStoredSession(null);
    vi.unstubAllGlobals();
  });

  describe('loginWithPasscode', () => {
    it('should return error if fetch fails (network error)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
      const result = await session.loginWithPasscode('1234');
      expect(result).toEqual({ success: false, error: 'Network error' });
    });

    it('should return success and store session if login succeeds', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          token: 'fake-token',
          user: { id: 'u1', name: 'John Doe', department: 'PED', role: 'doctor' }
        })
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await session.loginWithPasscode('1234', 'PED');

      expect(result).toEqual({
        success: true,
        user: { id: 'u1', name: 'John Doe', department: 'PED', role: 'doctor' },
        token: 'fake-token'
      });

      expect(localStorage.getItem('nk_token')).toBe('fake-token');
      expect(localStorage.getItem('nk_user_role')).toBe('doctor');
      expect(localStorage.getItem('nk_user_dept')).toBe('PED');

      const storedSession = await session.getStoredSession();
      expect(storedSession).toMatchObject({
        sessionId: 'fake-token',
        userId: 'u1',
        userName: 'John Doe',
        department: 'PED',
        role: 'doctor',
      });
    });

    it('should return error if login fails (invalid passcode)', async () => {
      const mockResponse = {
        ok: false,
        json: async () => ({
          error: 'Invalid passcode'
        })
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await session.loginWithPasscode('wrong-pass');
      expect(result).toEqual({ success: false, error: 'Invalid passcode' });
    });
  });

  describe('loginWithPC', () => {
    it('should return error if fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
      const result = await session.loginWithPC();
      expect(result).toEqual({ success: false, error: 'Network error' });
    });

    it('should return success and store session if login succeeds', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          token: 'fake-token-pc',
          user: { id: 'u2', name: 'PC User', role: 'admin' }
        })
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await session.loginWithPC();
      expect(result.success).toBe(true);
    });

    it('should return error if PC login fails', async () => {
      const mockResponse = {
        ok: false,
        json: async () => ({
          error: 'Invalid PC token'
        })
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await session.loginWithPC();
      expect(result).toEqual({ success: false, error: 'Invalid PC token' });
    });
  });

  describe('logout', () => {
    it('should clear stored session and local storage', async () => {
      localStorage.setItem('nk_token', 'token');
      localStorage.setItem('nk_user_role', 'admin');
      localStorage.setItem('nk_user_dept', 'GEN');

      await session.logout();

      expect(localStorage.getItem('nk_token')).toBeNull();
      const storedSession = await session.getStoredSession();
      expect(storedSession).toBeNull();
    });
  });

  describe('apiFetch', () => {
    it('should include Authorization header if session exists', async () => {
      await session.setStoredSession({
        sessionId: 'test-session-id',
        userId: 'u1',
        userName: 'Test',
        department: 'GEN',
        role: 'admin',
        loginTime: new Date().toISOString(),
        lastSyncTime: null,
      });

      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await session.apiFetch('/api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-session-id'
          })
        })
      );
    });

    it('should not include Authorization header if no session exists', async () => {
      await session.setStoredSession(null);

      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await session.apiFetch('/api/test');

      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.headers).not.toHaveProperty('Authorization');
    });
  });

  describe('fetchAdminUsers', () => {
    it('should return users array on success', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ users: [{ id: '1', name: 'User 1' }] })
      }));

      const result = await session.fetchAdminUsers();
      expect(result).toEqual([{ id: '1', name: 'User 1' }]);
    });

    it('should return empty array if response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
      const result = await session.fetchAdminUsers();
      expect(result).toEqual([]);
    });

    it('should return empty array on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
      const result = await session.fetchAdminUsers();
      expect(result).toEqual([]);
    });
  });

  describe('updateAdminUser', () => {
    it('should return true on success', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
      const result = await session.updateAdminUser({ id: '1', name: 'Updated' });
      expect(result).toBe(true);
    });

    it('should use userId if id is not present', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await session.updateAdminUser({ userId: '2', name: 'Updated' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/2'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('should return false if response not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
      const result = await session.updateAdminUser({ id: '1', name: 'Updated' });
      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
      const result = await session.updateAdminUser({ id: '1', name: 'Updated' });
      expect(result).toBe(false);
    });
  });

  describe('createAdminUser', () => {
    it('should return success and user on success', async () => {
      const mockUser = { id: '1', name: 'New User' };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ user: mockUser })
      }));

      const result = await session.createAdminUser({ name: 'New User' });
      expect(result).toEqual({ success: true, user: mockUser, error: undefined });
    });

    it('should return error if response not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'User already exists' })
      }));

      const result = await session.createAdminUser({ name: 'New User' });
      expect(result).toEqual({ success: false, user: undefined, error: 'User already exists' });
    });

    it('should return error on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const result = await session.createAdminUser({ name: 'New User' });
      expect(result).toEqual({ success: false, error: 'Network error' });
    });
  });

  describe('fetchDepartments', () => {
    it('should return departments array on success', async () => {
      const mockDepts = [{ id: 'GEN', name: 'General' }];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ departments: mockDepts })
      }));

      const result = await session.fetchDepartments();
      expect(result).toEqual(mockDepts);
    });

    it('should return empty array if response not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

      const result = await session.fetchDepartments();
      expect(result).toEqual([]);
    });

    it('should return empty array on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const result = await session.fetchDepartments();
      expect(result).toEqual([]);
    });
  });

  describe('fetchDashboardData', () => {
    it('should return dashboard data on success', async () => {
      const mockData = {
        stats: { totalPatients: 10, totalVisits: 20, patientsToday: 5 },
        recentLogs: []
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData
      }));

      const result = await session.fetchDashboardData();
      expect(result).toEqual(mockData);
    });

    it('should return null if response not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

      const result = await session.fetchDashboardData();
      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const result = await session.fetchDashboardData();
      expect(result).toBeNull();
    });
  });

  describe('logActivity', () => {
    it('should call fetch with correct data when session exists', async () => {
      await session.setStoredSession({
        sessionId: 'test',
        userId: 'u1',
        userName: 'User',
        department: 'GEN',
        role: 'admin',
        loginTime: new Date().toISOString(),
        lastSyncTime: null,
      });

      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await session.logActivity('LOGIN', 'User logged in');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/activity'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            action: 'LOGIN',
            details: 'User logged in',
            userId: 'u1',
            departmentId: 'GEN',
          })
        })
      );
    });

    it('should default details to empty string and user/dept to unknown/GEN if no session', async () => {
      await session.setStoredSession(null);

      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      await session.logActivity('LOGOUT');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/activity'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            action: 'LOGOUT',
            details: '',
            userId: 'unknown',
            departmentId: 'GEN',
          })
        })
      );
    });

    it('should catch and warn on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await session.logActivity('TEST');

      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to log activity:', expect.any(Error));
    });
  });

  describe('isPrivateNetwork', () => {
    it('should return true for localhost and 127.0.0.1', () => {
      expect(session.isPrivateNetwork('localhost')).toBe(true);
      expect(session.isPrivateNetwork('127.0.0.1')).toBe(true);
    });

    it('should return true for 192.168.x.x', () => {
      expect(session.isPrivateNetwork('192.168.1.1')).toBe(true);
      expect(session.isPrivateNetwork('192.168.29.180')).toBe(true);
    });

    it('should return true for 10.x.x.x', () => {
      expect(session.isPrivateNetwork('10.0.0.1')).toBe(true);
    });

    it('should return true for 172.16.x.x to 172.31.x.x', () => {
      expect(session.isPrivateNetwork('172.16.0.1')).toBe(true);
      expect(session.isPrivateNetwork('172.31.255.255')).toBe(true);
    });

    it('should return false for public IPs and domains', () => {
      expect(session.isPrivateNetwork('8.8.8.8')).toBe(false);
      expect(session.isPrivateNetwork('172.15.0.1')).toBe(false);
      expect(session.isPrivateNetwork('172.32.0.1')).toBe(false);
      expect(session.isPrivateNetwork('example.com')).toBe(false);
      expect(session.isPrivateNetwork('')).toBe(true);
    });
  });

  describe('setServerIp and getServerIp', () => {
    it('should save server IP to localStorage', () => {
      session.setServerIp('192.168.1.100');
      expect(localStorage.getItem('NEK_KADAM_SERVER_IP')).toBe('192.168.1.100');
    });

    it('should remove server IP from localStorage if empty', () => {
      localStorage.setItem('NEK_KADAM_SERVER_IP', '192.168.1.100');
      session.setServerIp('');
      expect(localStorage.getItem('NEK_KADAM_SERVER_IP')).toBeNull();
    });

    it('should return saved server IP or default', () => {
      expect(session.getServerIp()).toBe('192.168.29.180');
      session.setServerIp('10.0.0.5');
      expect(session.getServerIp()).toBe('10.0.0.5');
    });
  });

  describe('getBaseUrl', () => {
    let originalLocation: any;
    let originalCapacitor: any;

    beforeEach(() => {
      originalLocation = window.location;
      originalCapacitor = (window as any).Capacitor;
    });

    afterEach(() => {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true
      });
      (window as any).Capacitor = originalCapacitor;
    });

    it('should return localhost url if on localhost and no custom IP', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'localhost' },
        writable: true
      });
      expect(session.getBaseUrl()).toBe('http://localhost:3001');
    });

    it('should return custom IP url if on localhost and custom IP set (capacitor)', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'localhost' },
        writable: true
      });
      (window as any).Capacitor = {};
      localStorage.setItem('NEK_KADAM_SERVER_IP', '10.0.0.5');
      expect(session.getBaseUrl()).toBe('http://10.0.0.5:3001');
    });

    it('should return cloud URL if on localhost and capacitor but no custom IP', () => {
      localStorage.removeItem('NEK_KADAM_SERVER_IP');
      Object.defineProperty(window, 'location', {
        value: { hostname: 'localhost' },
        writable: true
      });
      (window as any).Capacitor = {};
      expect(session.getBaseUrl()).toBe('https://nek-kadam.onrender.com');
    });

    it('should return custom IP url if custom IP is saved', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'example.com' },
        writable: true
      });
      localStorage.setItem('NEK_KADAM_SERVER_IP', '10.0.0.5');
      expect(session.getBaseUrl()).toBe('http://10.0.0.5:3001');
    });

    it('should return cloud URL if running in Capacitor without custom IP', () => {
      localStorage.removeItem('NEK_KADAM_SERVER_IP');
      Object.defineProperty(window, 'location', {
        value: { hostname: 'example.com' },
        writable: true
      });
      (window as any).Capacitor = {};
      expect(session.getBaseUrl()).toBe('https://nek-kadam.onrender.com');
    });

    it('should return private network URL if on LAN', () => {
      localStorage.removeItem('NEK_KADAM_SERVER_IP');
      Object.defineProperty(window, 'location', {
        value: { hostname: '192.168.1.5', protocol: 'http:' },
        writable: true
      });
      expect(session.getBaseUrl()).toBe('http://192.168.1.5:3001');
    });

    it('should return empty string if on public domain', () => {
      localStorage.removeItem('NEK_KADAM_SERVER_IP');
      Object.defineProperty(window, 'location', {
        value: { hostname: 'example.com', protocol: 'https:' },
        writable: true
      });
      expect(session.getBaseUrl()).toBe('');
    });

    it('should return cloud url if window is undefined', () => {
      const originalWindow = global.window;
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true
      });
      expect(session.getBaseUrl()).toBe('https://nek-kadam.onrender.com');
      Object.defineProperty(global, 'window', {
        value: originalWindow,
        writable: true
      });
    });
  });

  describe('getStoredSession', () => {
    it('should return the stored session', async () => {
      const mockSession = {
        sessionId: 'test-session',
        userId: 'u1',
        userName: 'User',
        department: 'GEN',
        role: 'admin',
        loginTime: new Date().toISOString(),
        lastSyncTime: null
      };
      await session.setStoredSession(mockSession);
      const retrievedSession = await session.getStoredSession();
      expect(retrievedSession).toEqual(mockSession);
    });
  });
});
