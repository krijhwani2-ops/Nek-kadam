// ─── Nek Kadam: Session Management Service ───
// Handles: Login, Logout, Heartbeat, Activity Tracking, Dashboard & Admin APIs
// Stores session in IndexedDB for offline persistence

import { openDB } from 'idb';

// Allow overriding the server IP for mobile connectivity
const savedIp = typeof window !== 'undefined' ? localStorage.getItem('NEK_KADAM_SERVER_IP') : null;
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

export function getBaseUrl(): string {
  // 1. If running in browser/Electron on the server machine (localhost)
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    if (typeof (window as any)?.Capacitor !== 'undefined') {
      const savedIp = localStorage.getItem('NEK_KADAM_SERVER_IP');
      if (savedIp) return `http://${savedIp}:${SERVER_PORT}`;
      return CLOUD_URL; // APK on mobile connects to Cloud URL by default
    }
    return `http://localhost:${SERVER_PORT}`;
  }

  // 2. If a custom IP is manually saved in Settings, respect it unconditionally
  const savedIp = typeof window !== 'undefined' ? localStorage.getItem('NEK_KADAM_SERVER_IP') : null;
  if (savedIp) {
    return `http://${savedIp}:${SERVER_PORT}`;
  }

  // 3. For mobile / Capacitor APK
  if (typeof (window as any)?.Capacitor !== 'undefined') {
    return CLOUD_URL;
  }

  // 4. If accessed in browser on LAN (e.g. phone browser on http://192.168.29.180:5173)
  if (typeof window !== 'undefined' && window.location.hostname) {
    if (isPrivateNetwork(window.location.hostname)) {
      return `${window.location.protocol}//${window.location.hostname}:${SERVER_PORT}`;
    }
    // Public cloud domain (e.g. Render / Custom domain) -> relative same origin
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

// ─── API Calls with Auth ───
export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const session = await getStoredSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (session) {
    headers['Authorization'] = `Bearer ${session.sessionId}`;
  }
  const baseUrl = getBaseUrl();
  return fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });
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
        lastSyncTime: null,
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
        lastSyncTime: null,
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
    const res = await apiFetch('/api/users');
    if (res.ok) {
      const data = await res.json();
      return data.users || [];
    }
    return [];
  } catch {
    return [];
  }
}

export async function updateAdminUser(user: any): Promise<boolean> {
  try {
    const userId = user.id || user.userId;
    const res = await apiFetch(`/api/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(user),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function createAdminUser(user: any): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const res = await apiFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
    const data = await res.json();
    return { success: res.ok, user: data.user, error: data.error };
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
