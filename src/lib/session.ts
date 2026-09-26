// ─── Nek Kadam: Session Management Service ───
// Handles: Login, Logout, Heartbeat, Activity Tracking, Dashboard & Admin APIs
// Stores session in IndexedDB for offline persistence

import { openDB } from 'idb';

// Allow overriding the server IP for mobile connectivity
const savedIp = typeof window !== 'undefined' ? localStorage.getItem('NEK_KADAM_SERVER_IP') : null;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SERVER_IP = savedIp || '192.168.29.180';
const SERVER_PORT = 3001;

/** Returns true if hostname is a private/local network address */
export function isPrivateNetwork(hostname: string): boolean {
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (hostname.startsWith('192.168.') || hostname.startsWith('10.')) return true;
  // 172.16.0.0 – 172.31.255.255
  const m = hostname.match(/^172\.(\d+)\./);
  if (m && +m[1] >= 16 && +m[1] <= 31) return true;
  return false;
}

export function setServerIp(ip: string) {
  if (ip) {
    localStorage.setItem('NEK_KADAM_SERVER_IP', ip);
  } else {
    localStorage.removeItem('NEK_KADAM_SERVER_IP');
  }
}

export function getServerIp() {
  return localStorage.getItem('NEK_KADAM_SERVER_IP') || '192.168.29.180';
}

const CLOUD_URL = 'https://nek-kadam.onrender.com';

export function checkIsCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as any)?.Capacitor;
  if (cap) {
    if (typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) return true;
    if (cap.isNativePlatform === true) return true;
    if (typeof cap.getPlatform === 'function') {
      const p = cap.getPlatform();
      if (p === 'android' || p === 'ios') return true;
    }
  }
  if (window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:') return true;
  if (window.location.hostname === 'localhost' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.location.port) {
    return true;
  }
  return false;
}

export function getBaseUrl(): string {
  const mode = (typeof window !== 'undefined' ? localStorage.getItem('NEK_KADAM_NETWORK_MODE') : null) || 'auto';
  const savedIp = typeof window !== 'undefined' ? localStorage.getItem('NEK_KADAM_SERVER_IP') : null;
  const isCapacitor = checkIsCapacitor();

  // 1. Explicit Internet Mode: always use Cloud URL
  if (mode === 'internet') {
    if (!isCapacitor && typeof window !== 'undefined' && window.location.hostname && !isPrivateNetwork(window.location.hostname)) {
      return ''; // Already on cloud web app -> relative
    }
    return CLOUD_URL;
  }

  // 2. Explicit LAN Mode: always use LAN IP or localhost
  if (mode === 'lan') {
    if (savedIp) return `http://${savedIp}:${SERVER_PORT}`;
    if (!isCapacitor && typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      return `http://localhost:${SERVER_PORT}`;
    }
    if (typeof window !== 'undefined' && window.location.hostname && isPrivateNetwork(window.location.hostname)) {
      return `${window.location.protocol}//${window.location.hostname}:${SERVER_PORT}`;
    }
    return `http://192.168.29.180:${SERVER_PORT}`;
  }

  // 3. Auto Mode (default)
  // For mobile / Capacitor APK: default to Cloud URL so it syncs live with the web app
  if (isCapacitor) {
    return CLOUD_URL;
  }

  // Server machine local browser (localhost)
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return `http://localhost:${SERVER_PORT}`;
  }

  // Access in browser on LAN (e.g. phone browser on http://192.168.29.180:5173)
  if (typeof window !== 'undefined' && window.location.hostname) {
    if (isPrivateNetwork(window.location.hostname)) {
      return `${window.location.protocol}//${window.location.hostname}:${SERVER_PORT}`;
    }
    // Public cloud domain (e.g. Render) -> relative same origin
    return '';
  }

  return CLOUD_URL;
}

// ─── Session Store (IndexedDB) ───
const sessionDb = openDB('nk_session', 1, {
  upgrade(db) { db.createObjectStore('session'); }
});

export interface NKSession {
  sessionId: string;
  userId: string;
  userName: string;
  department: string;
  role: string;
  loginTime: string;
  lastSyncTime: string | null;
}

export async function getStoredSession(): Promise<NKSession | null> {
  try {
    const db = await sessionDb;
    return (await db.get('session', 'current')) || null;
  } catch {
    return null;
  }
}

export async function setStoredSession(session: NKSession | null): Promise<void> {
  try {
    const db = await sessionDb;
    if (session) {
      await db.put('session', session, 'current');
    } else {
      await db.delete('session', 'current');
    }
  } catch (e) {
    console.error('Failed to store session:', e);
  }
}

export async function getLastSyncTime(): Promise<string | null> {
  try {
    const session = await getStoredSession();
    if (session?.lastSyncTime) return session.lastSyncTime;
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('nk_last_sync_time') || null;
    }
  } catch (_) {}
  return null;
}

export async function setLastSyncTime(timestamp: string): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('nk_last_sync_time', timestamp);
    }
    const session = await getStoredSession();
    if (session) {
      session.lastSyncTime = timestamp;
      await setStoredSession(session);
    }
  } catch (e) {
    console.error('Failed to update lastSyncTime:', e);
  }
}

// ─── API Calls with Auth ───
let refreshPromise: Promise<boolean> | null = null;

export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const session = await getStoredSession();
  let token = session?.sessionId || (typeof window !== 'undefined' ? localStorage.getItem('nk_token') : '') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const baseUrl = getBaseUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  let res = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
    signal: options.signal || controller.signal,
  });
  clearTimeout(timeoutId);

  // Handle 401 Unauthorized by attempting transparent PC login recovery on desktop/web
  if (res.status === 401 && !endpoint.startsWith('/api/login') && !endpoint.startsWith('/api/pc-login')) {
    if (!refreshPromise && !checkIsCapacitor()) {
      refreshPromise = (async () => {
        try {
          const pc = await loginWithPC();
          return pc.success;
        } catch {
          return false;
        } finally {
          refreshPromise = null;
        }
      })();
    }

    if (refreshPromise) {
      const renewed = await refreshPromise;
      if (renewed) {
        const freshSession = await getStoredSession();
        const freshToken = freshSession?.sessionId || (typeof window !== 'undefined' ? localStorage.getItem('nk_token') : '') || '';
        if (freshToken) {
          headers['Authorization'] = `Bearer ${freshToken}`;
          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), 5000);
          res = await fetch(`${baseUrl}${endpoint}`, {
            ...options,
            headers,
            signal: options.signal || retryController.signal,
          });
          clearTimeout(retryTimeoutId);
        }
      } else if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nk:auth_expired', { detail: { endpoint } }));
      }
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nk:auth_expired', { detail: { endpoint } }));
    }
  }

  return res;
}

// ─── Auth Operations ───
export async function loginWithPasscode(passcode: string, department?: string): Promise<{ success: boolean; user?: any; token?: string; error?: string }> {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode, department }),
    });
    const data = await res.json();
    if (res.ok && data.token) {
      const session: NKSession = {
        sessionId: data.token,
        userId: data.user.id,
        userName: data.user.name,
        department: data.user.department || department || 'GEN',
        role: data.user.role,
        loginTime: new Date().toISOString(),
        lastSyncTime: (typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('nk_last_sync_time') : null) || null,
      };
      await setStoredSession(session);
      localStorage.setItem('nk_token', data.token);
      localStorage.setItem('nk_user_role', data.user.role);
      localStorage.setItem('nk_user_dept', data.user.department || department || 'GEN');
      localStorage.setItem('nk_current_user', JSON.stringify(session));
      return { success: true, user: data.user, token: data.token };
    }
    return { success: false, error: data.error || 'Login failed' };
  } catch (e: any) {
    return { success: false, error: e.message || 'Network error' };
  }
}

export async function loginWithPC(): Promise<{ success: boolean; user?: any; token?: string; error?: string }> {
  try {
    const baseUrl = getBaseUrl();
    const res = await fetch(`${baseUrl}/api/pc-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.ok && data.token) {
      const session: NKSession = {
        sessionId: data.token,
        userId: data.user.id,
        userName: data.user.name,
        department: data.user.department || 'GEN',
        role: data.user.role,
        loginTime: new Date().toISOString(),
        lastSyncTime: (typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('nk_last_sync_time') : null) || null,
      };
      await setStoredSession(session);
      localStorage.setItem('nk_token', data.token);
      localStorage.setItem('nk_user_role', data.user.role);
      localStorage.setItem('nk_user_dept', data.user.department || 'GEN');
      localStorage.setItem('nk_current_user', JSON.stringify(session));
      return { success: true, user: data.user, token: data.token };
    }
    return { success: false, error: data.error || 'PC Login failed' };
  } catch (e: any) {
    return { success: false, error: e.message || 'Network error' };
  }
}

export async function logout(): Promise<void> {
  await setStoredSession(null);
  localStorage.removeItem('nk_token');
  localStorage.removeItem('nk_user_role');
  localStorage.removeItem('nk_user_dept');
  localStorage.removeItem('nk_current_user');
}

// ─── User Management (Admin) ───
export async function fetchAdminUsers(): Promise<any[]> {
  try {
    const res = await apiFetch('/api/admin/users');
    if (res.ok) {
      const data = await res.json();
      return data.users || data.data || [];
    }
    // Fallback if /api/admin/users fails
    const fallback = await apiFetch('/api/users');
    if (fallback.ok) {
      const data = await fallback.json();
      return data.users || data.data || [];
    }
    return [];
  } catch {
    return [];
  }
}

export async function updateAdminUser(user: any): Promise<boolean> {
  try {
    const userId = user.id || user.userId;
    const res = await apiFetch('/api/admin/users/update', {
      method: 'POST',
      body: JSON.stringify({
        id: userId,
        name: user.name,
        passcode: user.passcode,
        department: user.department || user.departmentId,
        role: user.role,
        is_active: user.is_active !== undefined ? user.is_active : (user.isActive !== undefined ? Boolean(user.isActive) : true),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function createAdminUser(user: any): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const res = await apiFetch('/api/admin/users/create', {
      method: 'POST',
      body: JSON.stringify({
        name: user.name,
        passcode: user.passcode,
        department: user.department || user.departmentId,
        role: user.role,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { success: res.ok && (data.ok || data.success), user: data.user, error: data.error };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteAdminUser(id: string, options?: { hard?: boolean }): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const res = await apiFetch('/api/admin/users/delete', {
      method: 'POST',
      body: JSON.stringify({
        id,
        hard: options?.hard ?? true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data.ok || data.success)) {
      return { success: true, message: data.message };
    }
    return { success: false, error: data.error || 'Failed to delete user' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function fetchDepartments(): Promise<any[]> {
  try {
    const res = await apiFetch('/api/departments');
    if (res.ok) {
      const data = await res.json();
      return data.departments || [];
    }
    return [];
  } catch {
    return [];
  }
}

// ─── Dashboard & Activity Logging ───
export interface DashboardData {
  stats: {
    totalPatients: number;
    totalVisits: number;
    patientsToday: number;
    pendingQueue?: number;
  };
  recentLogs: Array<{
    id: string;
    userName: string;
    deptCode: string;
    action: string;
    timestamp: string;
  }>;
}

export async function fetchDashboardData(): Promise<DashboardData | null> {
  try {
    const res = await apiFetch('/api/dashboard');
    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch {
    return null;
  }
}

export async function logActivity(action: string, details?: string): Promise<void> {
  try {
    const session = await getStoredSession();
    await apiFetch('/api/activity', {
      method: 'POST',
      body: JSON.stringify({
        action,
        details: details || '',
        userId: session?.userId || 'unknown',
        departmentId: session?.department || 'GEN',
      }),
    });
  } catch (e) {
    console.warn('Failed to log activity:', e);
  }
}
