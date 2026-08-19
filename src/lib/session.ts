// ─── Nek Kadam: Session Management Service ───
// Handles: Login, Logout, Heartbeat, Activity Tracking
// Stores session in IndexedDB for offline persistence

import { openDB } from 'idb';

// Allow overriding the server IP for mobile connectivity
const savedIp = typeof window !== 'undefined' ? localStorage.getItem('NEK_KADAM_SERVER_IP') : null;
const SERVER_IP = savedIp || '192.168.29.180';
const SERVER_PORT = 3001;
const CLOUD_URL = 'https://nekkadam.onrender.com';

/** Returns true if hostname is a private/local network address */
function isPrivateNetwork(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
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

export function getBaseUrl(): string {
  // 0. Cloud detection: public domain browser → same-origin (no port needed)
  if (typeof window !== 'undefined'
      && typeof (window as any)?.Capacitor === 'undefined'
      && !isPrivateNetwork(window.location.hostname)) {
    return '';  // relative to same origin
  }

  // 1. For mobile/Capacitor (needs remote IP) - Check this first!
  if (typeof (window as any)?.Capacitor !== 'undefined') {
    const savedIp = localStorage.getItem('NEK_KADAM_SERVER_IP');
    if (savedIp) return `http://${savedIp}:${SERVER_PORT}`;
    return CLOUD_URL;  // APK defaults to cloud (works everywhere)
  }

  // 2. If running in browser/Electron on the server machine
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return `http://localhost:${SERVER_PORT}`;
  }

  // 3. If we have a manually saved IP in Settings (non-Capacitor remote)
  const savedIp = localStorage.getItem('NEK_KADAM_SERVER_IP');
  if (savedIp) return `http://${savedIp}:${SERVER_PORT}`;
  
  // 4. Default fallback to current host
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:${SERVER_PORT}`;
  }

  return `http://${SERVER_IP}:${SERVER_PORT}`;
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

export interface NKUser {
  id: string;
  name: string;
  department: string;
  role: string;
}

export interface DashboardData {
  loads: Record<string, { code: string; count: number }>;
  users: Array<{
    userId: string;
    name: string;
    deptCode: string;
    status: 'Online' | 'Idle' | 'Away';
  }>;
  recentLogs: Array<{
    id: string;
    userName: string;
    deptCode: string;
    action: string;
    timestamp: string;
  }>;
  stats: {
    patientsToday: number;
    totalPatients: number;
    totalVisits: number;
  };
}

// ─── Get/Set Session from IndexedDB ───
export async function getStoredSession(): Promise<NKSession | null> {
  try {
    const db = await sessionDb;
    return (await db.get('session', 'current')) || null;
  } catch { return null; }
}

export async function setStoredSession(s: NKSession | null): Promise<void> {
  try {
    const db = await sessionDb;
    if (s) {
      await db.put('session', s, 'current');
    } else {
      await db.delete('session', 'current');
    }
  } catch (e) { console.warn('Session store error:', e); }
}

// ─── Fetch Users List (for login dropdown) ───
export async function fetchUsers(): Promise<NKUser[]> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/users`, { 
      signal: AbortSignal.timeout(3000)
    });
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

// ─── Login ───
export async function loginUser(name: string, passcode: string): Promise<{ session: NKSession | null; error: string | null }> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, passcode }),
      signal: AbortSignal.timeout(5000)
    });
    const json = await res.json();
    
    if (!res.ok || json.error) return { session: null, error: json.error || 'Login failed' };
    
    const session: NKSession = {
      sessionId: json.token, // Store token here
      userId: json.user.id,
      userName: json.user.name,
      department: json.user.deptCode, // store code
      role: json.user.role,
      loginTime: new Date().toISOString(),
      lastSyncTime: null,
    };
    
    localStorage.setItem('nk_token', json.token);
    await setStoredSession(session);
    return { session, error: null };
  } catch (e: any) {
    return { session: null, error: 'Server not reachable. Check WiFi.' };
  }
}

// ─── PC Auto-Login (silent login for Electron/Local) ───
export async function pcAutoLogin(): Promise<NKSession | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/pc-login`, {
      signal: AbortSignal.timeout(3000)
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.token) return null;

    const session: NKSession = {
      sessionId: json.token,
      userId: json.user.id,
      userName: json.user.name,
      department: json.user.deptCode,
      role: json.user.role,
      loginTime: new Date().toISOString(),
      lastSyncTime: null,
    };
    localStorage.setItem('nk_token', json.token);
    await setStoredSession(session);
    return session;
  } catch {
    return null;
  }
}

// ─── Logout ───
export async function logoutUser(): Promise<void> {
  try {
    const session = await getStoredSession();
    if (session) {
      fetch(`${getBaseUrl()}/api/logout`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionId}` 
        },
        body: JSON.stringify({}),
      }).catch(() => {}); // Fire and forget
    }
  } catch { /* safe */ }
  localStorage.removeItem('nk_token');
  await setStoredSession(null);
}

// ─── Heartbeat (call every 10-15 sec) ───
let _heartbeatInterval: any = null;
let _currentAction = 'Idle';

export function setCurrentAction(action: string) {
  _currentAction = action;
}

export function startHeartbeat() {
  stopHeartbeat();
  _heartbeatInterval = setInterval(async () => {
    try {
      const session = await getStoredSession();
      if (!session) return;
      
      await fetch(`${getBaseUrl()}/api/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId, currentAction: _currentAction }),
        signal: AbortSignal.timeout(3000)
      });
    } catch { /* offline — that's fine */ }
  }, 12000); // Every 12 seconds
}

export function stopHeartbeat() {
  if (_heartbeatInterval) {
    clearInterval(_heartbeatInterval);
    _heartbeatInterval = null;
  }
}

// ─── Log Activity ───
export async function logActivity(action: string, entity?: string, entityId?: string): Promise<void> {
  try {
    const session = await getStoredSession();
    if (!session) return;
    
    // Update current action
    setCurrentAction(action);
    
    await fetch(`${getBaseUrl()}/api/log-activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: session.userId,
        userName: session.userName,
        action,
        entity,
        entityId
      }),
      signal: AbortSignal.timeout(3000)
    });
  } catch { /* offline — skip logging */ }
}

// ─── Fetch Dashboard Data ───
export async function fetchDashboardData(): Promise<DashboardData | null> {
  try {
    const session = await getStoredSession();
    const res = await fetch(`${getBaseUrl()}/api/dashboard`, {
      headers: {
        'Authorization': session ? `Bearer ${session.sessionId}` : ''
      },
      signal: AbortSignal.timeout(4000)
    });
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Status Helper ───
export function getUserStatus(lastActiveAt: string): 'online' | 'idle' | 'offline' {
  const diff = Date.now() - new Date(lastActiveAt).getTime();
  if (diff < 30000) return 'online';   // < 30 sec
  if (diff < 120000) return 'idle';    // < 2 min
  return 'offline';                     // > 2 min
}

// ─── Admin Methods ───
export async function fetchDepartments(): Promise<any[]> {
  try {
    const session = await getStoredSession();
    const res = await fetch(`${getBaseUrl()}/api/admin/departments`, { 
      headers: { 'Authorization': session ? `Bearer ${session.sessionId}` : '' },
      signal: AbortSignal.timeout(3000) 
    });
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

export async function fetchAdminUsers(): Promise<any[]> {
  try {
    const session = await getStoredSession();
    const res = await fetch(`${getBaseUrl()}/api/admin/users`, { 
      headers: { 'Authorization': session ? `Bearer ${session.sessionId}` : '' },
      signal: AbortSignal.timeout(3000) 
    });
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

export async function updateAdminUser(user: any): Promise<boolean> {
  try {
    const session = await getStoredSession();
    const res = await fetch(`${getBaseUrl()}/api/admin/users/update`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': session ? `Bearer ${session.sessionId}` : ''
      },
      body: JSON.stringify(user)
    });
    const json = await res.json();
    return json.ok || false;
  } catch {
    return false;
  }
}

export async function createAdminUser(user: any): Promise<boolean> {
  try {
    const session = await getStoredSession();
    const res = await fetch(`${getBaseUrl()}/api/admin/users/create`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': session ? `Bearer ${session.sessionId}` : ''
      },
      body: JSON.stringify(user)
    });
    const json = await res.json();
    return json.ok || false;
  } catch {
    return false;
  }
}
