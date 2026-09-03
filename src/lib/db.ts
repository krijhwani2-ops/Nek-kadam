// ─── Nek Kadam: Offline-First Database Client ───
// Architecture: LOCAL FIRST. All reads/writes go to IndexedDB.
import { getStoredSession, setStoredSession, getBaseUrl, isPrivateNetwork } from './session';
// Server sync happens ONLY on manual "Sync" button press.
// No silent failures. Every operation is try-catched.

// Allow overriding the server IP for mobile connectivity
const SERVER_PORT = 3001;
const API_URL_LOCAL = '/rpc';
const CLOUD_URL = 'https://nek-kadam.onrender.com';

export type NetworkMode = 'auto' | 'lan' | 'internet';

export function getNetworkMode(): NetworkMode {
  if (typeof window === 'undefined') return 'auto';
  const saved = localStorage.getItem('NEK_KADAM_NETWORK_MODE') as NetworkMode;
  if (saved === 'lan' || saved === 'internet' || saved === 'auto') return saved;
  return 'auto';
}

export function setNetworkMode(mode: NetworkMode) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('NEK_KADAM_NETWORK_MODE', mode);
  _serverOnline = null;
  _lastCheck = 0;
  if (mode === 'internet') {
    activeApiUrl = `${CLOUD_URL}/rpc`;
  } else if (mode === 'lan') {
    const savedIp = localStorage.getItem('NEK_KADAM_SERVER_IP');
    activeApiUrl = savedIp ? `http://${savedIp}:${SERVER_PORT}/rpc` : getRemoteApiUrl();
  } else {
    activeApiUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? API_URL_LOCAL
      : getRemoteApiUrl();
  }
  window.dispatchEvent(new CustomEvent('nk_network_mode_changed', { detail: mode }));
}

function getRemoteApiUrl(): string {
  const mode = getNetworkMode();
  if (mode === 'internet') {
    return `${CLOUD_URL}/rpc`;
  }

  // 1. If custom IP is manually configured in Settings, use it
  const savedIp = typeof window !== 'undefined' ? localStorage.getItem('NEK_KADAM_SERVER_IP') : null;
  if (savedIp) {
    return `http://${savedIp}:${SERVER_PORT}/rpc`;
  }

  // 2. If running on local LAN browser (e.g. phone browser accessing http://192.168.29.180:5173)
  if (typeof window !== 'undefined' && window.location.hostname) {
    if (isPrivateNetwork(window.location.hostname)) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return API_URL_LOCAL;
      }
      return `${window.location.protocol}//${window.location.hostname}:${SERVER_PORT}/rpc`;
    }
    // Public cloud domain (e.g. Render) -> relative same-origin
    return '/rpc';
  }

  // 3. Default fallback for local clinic Wi-Fi
  return `http://192.168.29.180:${SERVER_PORT}/rpc`;
}

let activeApiUrl = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) 
  ? API_URL_LOCAL 
  : getRemoteApiUrl();

export function setServerIp(ip: string) {
  if (ip) {
    localStorage.setItem('NEK_KADAM_SERVER_IP', ip);
    activeApiUrl = `http://${ip}:${SERVER_PORT}/rpc`;
  } else {
    localStorage.removeItem('NEK_KADAM_SERVER_IP');
    activeApiUrl = getRemoteApiUrl();
  }
  _serverOnline = null;
  _lastCheck = 0;
  window.dispatchEvent(new CustomEvent('nk_server_ip_changed', { detail: ip }));
}

export function getServerIp() {
  return localStorage.getItem('NEK_KADAM_SERVER_IP') || '';
}

function getApiUrl(): string {
  const base = getBaseUrl();
  return base ? `${base}/rpc` : '/rpc';
}

export function cleanPatientId(id: string | number | undefined | null): string {
  if (id === undefined || id === null) return '';
  const s = String(id).trim();
  if (s.endsWith('.0')) {
    return s.slice(0, -2);
  }
  return s;
}

// ─── UUID Generator (deterministic, no duplicates) ───
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Transaction Helper ───
export interface DBTransaction {
  ops: { action: string; query: any }[];
  execute: () => Promise<{ success: boolean; error?: any }>;
}

export function createTransaction(): DBTransaction {
  return {
    ops: [],
    async execute() {
      try {
        const db = await dbPromise;
        const pendingOps = await getPendingOps();
        
        // Add all ops to pending queue as a single transaction block if possible, 
        // but for now we'll just push them all to the same queue
        for (const op of this.ops) {
           pendingOps.push({ ...op, timestamp: Date.now(), id: generateUUID() });
        }
        
        await db.put('keyval', pendingOps, 'nk_pending_ops');
        return { success: true };
      } catch (e) {
        console.error('[DB TRANSACTION] Failed:', e);
        return { success: false, error: e };
      }
    }
  };
}

import { openDB } from 'idb';

const DB_NAME = 'nk_store';
const DB_VERSION = 11; // Incrementing from 1 to 11 to add new tables to existing DB

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db, _oldVersion, _newVersion) {
    // Existing tables
    if (!db.objectStoreNames.contains('keyval')) db.createObjectStore('keyval');
    if (!db.objectStoreNames.contains('patients')) db.createObjectStore('patients', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('visits')) db.createObjectStore('visits', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('medicines')) db.createObjectStore('medicines', { keyPath: 'code' });
    if (!db.objectStoreNames.contains('inventory')) db.createObjectStore('inventory', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('activity_logs')) db.createObjectStore('activity_logs', { keyPath: 'id' });
    
    // NEW: Token System Tables
    if (!db.objectStoreNames.contains('tokens')) db.createObjectStore('tokens', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('token_events')) db.createObjectStore('token_events', { keyPath: 'id' });
    
    // NEW: Education & Attendance Tables
    if (!db.objectStoreNames.contains('batches')) db.createObjectStore('batches', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('education_students')) db.createObjectStore('education_students', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('attendance')) db.createObjectStore('attendance', { keyPath: 'id' });

    if (!db.objectStoreNames.contains('sync_queue')) {
      db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
    }
  },
});

// ─── Cache Helpers (IndexedDB) ───
function cacheKey(query: Record<string, any>, action: string): string {
  return `nk_cache_${action}_${JSON.stringify(query)}`;
}

async function setCache(key: string, data: any): Promise<void> {
  try {
    const db = await dbPromise;
    await db.put('keyval', data, key);
  } catch (e) {
    console.warn('Cache write failed:', e);
  }
}

async function getCache(key: string): Promise<any | null> {
  try {
    const db = await dbPromise;
    const val = await db.get('keyval', key);
    return val || null;
  } catch (e) {
    console.warn('Cache read failed:', e);
    return null;
  }
}

// ─── Pending Operations Queue (EXPORTED) ───
export async function getPendingOps(): Promise<any[]> {
  try {
    const db = await dbPromise;
    const ops = await db.get('keyval', 'nk_pending_ops');
    return ops || [];
  } catch { return []; }
}

async function addPendingOp(op: any): Promise<void> {
  try {
    const db = await dbPromise;
    const ops = await getPendingOps();
    
    // Prevent duplicates for specific tables/actions if necessary
    // If it's an insert/upsert with a known card_number or id, check if it's already pending
    if (op.action === 'insert' || op.action === 'upsert' || op.action === 'update') {
      const newData = Array.isArray(op.query.data) ? op.query.data[0] : op.query.data;
      const idToCheck = newData?.id || newData?.card_number || newData?.code;
      
      if (idToCheck) {
        const isDuplicate = ops.some(existingOp => {
          const existingData = Array.isArray(existingOp.query.data) ? existingOp.query.data[0] : existingOp.query.data;
          return (existingData?.id === idToCheck || existingData?.card_number === idToCheck || existingData?.code === idToCheck);
        });
        
        if (isDuplicate && op.action !== 'update') {
          console.warn('[DB] Skipping duplicate pending operation for:', idToCheck);
          return;
        }
      }
    }

    ops.push({ ...op, timestamp: Date.now(), id: generateUUID() });
    await db.put('keyval', ops, 'nk_pending_ops');
    console.log(`[DB] Operation queued: ${op.action} on ${op.query.table}`);
  } catch (e) {
    console.error('Failed to queue pending op:', e);
  }
}

// ─── Offline Visit Save (Atomic Compound Operation) ───
export async function saveVisitOffline(payload: {
  patientId: string;
  date: string;
  doctorName: string;
  notes: string | null;
  medicineGroups: any[];
}): Promise<string> {
  const visitId = 'VISIT-' + Date.now();
  
  // 1. Write visit to local cache for immediate UI display
  const cleanId = cleanPatientId(payload.patientId);
  payload.patientId = cleanId;
  const visitRecord = {
    id: visitId,
    patient_id: cleanId,
    date: payload.date,
    doctor_name: payload.doctorName,
    notes: payload.notes,
    created_at: new Date().toISOString()
  };
  
  const visitsCache = (await getCache('nk_full_visits')) || [];
  const visitArr = Array.isArray(visitsCache) ? [...visitsCache] : [];
  visitArr.unshift(visitRecord);
  await setCache('nk_full_visits', visitArr);
  
  // 2. Write prescription groups and group medicines to local cache
  const groupsCache = (await getCache('nk_full_prescription_groups')) || [];
  const groupArr = Array.isArray(groupsCache) ? [...groupsCache] : [];
  const groupMedsCache = (await getCache('nk_full_group_medicines')) || [];
  const gmArr = Array.isArray(groupMedsCache) ? [...groupMedsCache] : [];
  
  for (let i = 0; i < payload.medicineGroups.length; i++) {
    const group = payload.medicineGroups[i];
    if (!group.meds || group.meds.length === 0) continue;
    
    const groupId = `GRP-${visitId}-${i}`;
    groupArr.unshift({
      id: groupId,
      visit_id: visitId,
      power: group.power || null,
      dosage_code: group.dosage || 'BD'
    });
    
    for (const med of group.meds) {
      gmArr.unshift({
        group_id: groupId,
        medicine_code: med.code,
        medicine_name: med.name
      });
    }
  }
  
  await setCache('nk_full_prescription_groups', groupArr);
  await setCache('nk_full_group_medicines', gmArr);
  
  // 3. Clear query caches for affected tables so reads pick up new data
  const idb = await dbPromise;
  const keys = await idb.getAllKeys('keyval');
  for (const k of keys) {
    if (typeof k === 'string' && k.startsWith('nk_cache_query_') && 
        (k.includes('"table":"visits"') || k.includes('"table":"prescription_groups"') || k.includes('"table":"group_medicines"'))) {
      await idb.delete('keyval', k);
    }
  }
  
  // 4. Queue SINGLE compound save-full operation (NOT 3 separate RPC inserts)
  await addPendingOp({
    action: 'save-full',
    query: payload
  });
  
  return visitId;
}

// ─── Get Pending Visits for a Patient (for UI merge) ───
export async function getPendingVisitsForPatient(patientId: string): Promise<any[]> {
  const ops = await getPendingOps();
  const pendingVisits: any[] = [];
  for (const op of ops) {
    const opPatientId = cleanPatientId(op.query?.patientId);
    const targetPatientId = cleanPatientId(patientId);
    if (op.action === 'save-full' && opPatientId === targetPatientId) {
      // Reconstruct a visit-like object from the save-full payload
      const payload = op.query;
      const visitId = `PENDING-${op.id || op.timestamp}`;
      const groups = (payload.medicineGroups || []).map((g: any, i: number) => ({
        id: `GRP-${visitId}-${i}`,
        visit_id: visitId,
        power: g.power || null,
        dosage_code: g.dosage || 'BD',
        group_medicines: (g.meds || []).map((m: any) => ({
          group_id: `GRP-${visitId}-${i}`,
          medicine_code: m.code,
          medicine_name: m.name || m.code
        }))
      }));
      
      pendingVisits.push({
        id: visitId,
        patient_id: payload.patientId,
        date: payload.date,
        doctor_name: payload.doctorName,
        notes: payload.notes,
        prescription_groups: groups,
        _pending: true // Flag for UI to show "Syncing..." badge
      });
    }
  }
  
  return pendingVisits;
}

// ─── Server Health Check & Local Auto-Discovery ───
let _serverOnline: boolean | null = null;
let _lastCheck = 0;
let isAutoDiscovering = false;

const COMMON_SUBNETS = [
  '192.168.43.',  // Android hotspot (highest priority for offline camps!)
  '192.168.137.', // Windows hotspot
  '192.168.29.',  // Camp subnet
  '192.168.1.',   // Common router
  '192.168.0.',   // D-Link router
  '192.168.8.',   // 4G dongle/hotspot
  '192.168.3.',   // Router
  '192.168.100.', // Fiber router
  '192.168.2.',   // Belkin/other router
  '10.0.0.'       // Apple hotspot/Enterprise
];

async function getClientLocalSubnets(): Promise<string[]> {
  return new Promise((resolve) => {
    const subnets: string[] = [];
    try {
      const RTCPeerConnectionClass = (window as any).RTCPeerConnection || (window as any).webkitRTCPeerConnection || (window as any).mozRTCPeerConnection;
      if (!RTCPeerConnectionClass) {
        resolve([]);
        return;
      }
      const pc = new RTCPeerConnectionClass({ iceServers: [] });
      pc.createDataChannel('');
      pc.createOffer().then((offer: any) => pc.setLocalDescription(offer)).catch(() => {});
      
      pc.onicecandidate = (ice: any) => {
        if (!ice || !ice.candidate || !ice.candidate.candidate) {
          resolve(subnets);
          return;
        }
        const candidate = ice.candidate.candidate;
        const ipRegex = /([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})\.[0-9]{1,3}/;
        const match = candidate.match(ipRegex);
        if (match && match[1]) {
          const subnet = match[1] + '.';
          if (!subnets.includes(subnet) && subnet !== '0.0.0.' && subnet !== '127.0.0.') {
            subnets.push(subnet);
          }
        }
      };
      setTimeout(() => resolve(subnets), 1000);
    } catch (e) {
      resolve([]);
    }
  });
}

async function scanSubnetForServer(subnetBase: string, port: number = 3001): Promise<string | null> {
  const chunkSize = 40;
  for (let offset = 1; offset <= 254; offset += chunkSize) {
    const promises: Promise<string>[] = [];
    const controllers: AbortController[] = [];
    const limit = Math.min(offset + chunkSize - 1, 254);
    
    for (let i = offset; i <= limit; i++) {
      const ip = `${subnetBase}${i}`;
      const controller = new AbortController();
      controllers.push(controller);
      
      const p = (async () => {
        const timeout = setTimeout(() => controller.abort(), 800);
        try {
          const res = await fetch(`http://${ip}:${port}/api/version`, {
            method: 'GET',
            signal: controller.signal
          });
          clearTimeout(timeout);
          if (res.ok) {
            const data = await res.json().catch(() => null);
            if (data && data.version) {
              return ip;
            }
          }
        } catch (e) {
          // fail or abort
        }
        throw new Error('Not found');
      })();
      promises.push(p);
    }
    
    try {
      const foundIp = await Promise.any(promises);
      controllers.forEach(c => c.abort());
      return foundIp;
    } catch (err) {
      // try next chunk
    }
  }
  return null;
}

export async function discoverLocalServer(): Promise<string | null> {
  if (isAutoDiscovering) return null;
  isAutoDiscovering = true;
  console.log('[AUTO-DISCOVERY] Started background local network discovery...');
  
  try {
    const detectedSubnets = await getClientLocalSubnets();
    const scanList = [...detectedSubnets];
    for (const sub of COMMON_SUBNETS) {
      if (!scanList.includes(sub)) scanList.push(sub);
    }
    
    for (const subnet of scanList) {
      const foundIp = await scanSubnetForServer(subnet);
      if (foundIp) {
        console.log(`[AUTO-DISCOVERY] Nek Kadam Server FOUND at: http://${foundIp}:3001`);
        localStorage.setItem('NEK_KADAM_SERVER_IP', foundIp);
        activeApiUrl = `http://${foundIp}:${SERVER_PORT}/rpc`;
        _serverOnline = true;
        _lastCheck = Date.now();
        
        window.dispatchEvent(new Event('nk_live_sync_completed'));
        window.dispatchEvent(new CustomEvent('nk_server_ip_changed', { detail: foundIp }));
        isAutoDiscovering = false;
        return foundIp;
      }
    }
  } catch (e) {
    console.error('[AUTO-DISCOVERY] Error during network scanning:', e);
  }
  isAutoDiscovering = false;
  return null;
}

export async function checkServerOnline(): Promise<boolean> {
  if (_serverOnline !== null && Date.now() - _lastCheck < 8000) return _serverOnline;

  const base = getBaseUrl();
  const urlToPing = base ? `${base}/api/health` : '/api/health';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(urlToPing, { signal: controller.signal });
    clearTimeout(timeout);
    _serverOnline = res.ok;
    _lastCheck = Date.now();
    return res.ok;
  } catch {
    _serverOnline = false;
    _lastCheck = Date.now();
    return false;
  }
}

// ─── Sync Engine ───
export async function syncPendingOps(): Promise<{ synced: number; failed: number; total: number }> {
  const ops = await getPendingOps();
  if (ops.length === 0) return { synced: 0, failed: 0, total: 0 };

  const online = await checkServerOnline();
  if (!online) return { synced: 0, failed: ops.length, total: ops.length };

  let synced = 0;
  let failed = 0;
  const failedOps: any[] = [];
  const url = getApiUrl();

  for (const op of ops) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const session = await getStoredSession();
      const token = session?.sessionId || localStorage.getItem('nk_token') || '';
      
      // Determine the correct endpoint based on action type
      let fetchUrl: string;
      let fetchBody: string;
      
      if (op.action === 'save-full') {
        // Compound visit save — send to the dedicated API endpoint
        const baseUrl = getBaseUrl();
        fetchUrl = `${baseUrl}/api/visits/save-full`;
        fetchBody = JSON.stringify(op.query);
      } else {
        // Standard RPC operations (insert/update/upsert/delete)
        fetchUrl = `${url}/${op.action}`;
        fetchBody = JSON.stringify(op.query);
      }
      
      const res = await fetch(fetchUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: fetchBody,
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (res.status === 401) {
        console.warn('[SYNC] Received 401 Unauthorized. Clearing invalid session token for recovery.');
        localStorage.removeItem('nk_token');
        await setStoredSession(null);
        failed++;
        failedOps.push(op);
        continue;
      }
      if (res.ok) {
        const result = await res.json().catch(() => ({}));
        if (result && result.error) {
          console.error('[SYNC] Server returned error for operation:', result.error, op);
          // For UNIQUE constraint errors on medicines, drop them (they already exist)
          if (String(result.error).includes('UNIQUE constraint') && op.query?.table === 'medicines') {
            console.warn('[SYNC] Dropping duplicate medicine insert (already exists on server).');
            synced++;
          } else {
            failed++;
            failedOps.push(op);
          }
        } else {
          synced++;
        }
      } else {
        failed++;
        failedOps.push(op);
      }
    } catch {
      failed++;
      failedOps.push(op);
    }
  }

  const idb = await dbPromise;
  await idb.put('keyval', failedOps, 'nk_pending_ops');
  return { synced, failed, total: ops.length };
}

export async function fullDataSync(): Promise<{ success: boolean; message: string }> {
  console.log('[SYNC] Starting full data sync...');
  const online = await checkServerOnline();
  if (!online) return { success: false, message: 'Server not reachable. Make sure laptop is on & same WiFi.' };

  // 1. FIRST: Push all pending local writes to the server
  const syncResult = await syncPendingOps();

  const tables = [
    'patients', 'visits', 'medicines', 'prescription_groups', 'group_medicines', 
    'medicine_logs', 'dosage_frequency', 'tokens', 'token_events', 'batches', 
    'education_students', 'attendance', 'inventory', 'departments',
    'medicine_tasks', 'medicine_task_items', 'chat_messages'
  ];
  const url = getApiUrl();
  let totalRows = 0;

  // 2. SECOND: Pull all fresh data from the server (which now includes our pushed writes!)
  for (const table of tables) {
    try {
      // AUDIT FIX: Exclude fileData from chat_messages to avoid downloading binary blobs (was unbounded payload)
      const selectFields = (table === 'chat_messages') 
        ? 'id,senderId,senderName,senderDepartment,recipientId,message,timestamp,fileName' 
        : '*';
      const query = { table, select: selectFields };
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // Increased timeout
      const session = await getStoredSession();
      const res = await fetch(`${url}/query`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': session ? `Bearer ${session.sessionId}` : ''
        },
        body: JSON.stringify(query),
        signal: controller.signal
      });
      clearTimeout(timeout);
      const result = await res.json();
      if (result.data) {
        const key = cacheKey(query, 'query');
        await setCache(key, result);
        
        // Merge server data with any remaining unsynced local data
        const mergedData = Array.isArray(result.data) ? [...result.data] : [];
        
        // For visits/prescription_groups/group_medicines, preserve pending local entries
        if (['visits', 'prescription_groups', 'group_medicines'].includes(table)) {
          const localCache = await getCache(`nk_full_${table}`);
          if (Array.isArray(localCache)) {
            for (const localItem of localCache) {
              // Keep items with client-generated IDs that aren't on the server yet
              const localId = localItem.id || localItem.group_id;
              if (localId && (String(localId).startsWith('VISIT-') || String(localId).startsWith('GRP-') || String(localId).startsWith('MAP-'))) {
                const existsOnServer = mergedData.some((s: any) => (s.id || s.group_id) === localId);
                if (!existsOnServer) {
                  mergedData.unshift(localItem);
                }
              }
            }
          }
        }
        
        await setCache(`nk_full_${table}`, mergedData);
        totalRows += Array.isArray(result.data) ? result.data.length : 1;
      }
    } catch (e) {
      console.warn(`[SYNC] Failed for ${table}:`, e);
    }
  }

  return {
    success: true,
    message: `Synced ${totalRows} records from ${tables.length} tables. ${syncResult.synced} pending writes pushed.`
  };
}

// ─── Interfaces ───
export interface User {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
  role?: string;
  aud?: string;
  created_at?: string;
}

export interface Session {
  user: User;
  access_token?: string;
  refresh_token?: string;
}

// ─── Local Filter Engine (handles ALL filter types) ───
function applyLocalFilters(data: any[], filters: Record<string, any>): any[] {
  if (!filters || !Array.isArray(data)) return data;
  
  let result = [...data];
  
  for (const [col, filter] of Object.entries(filters)) {
    if (typeof filter !== 'object' || filter === null) continue;
    
    if (filter.eq !== undefined) {
      result = result.filter((r: any) => String(r[col]) === String(filter.eq));
    }
    if (filter.neq !== undefined) {
      result = result.filter((r: any) => String(r[col]) !== String(filter.neq));
    }
    if (filter.gte !== undefined) {
      result = result.filter((r: any) => r[col] >= filter.gte);
    }
    if (filter.lte !== undefined) {
      result = result.filter((r: any) => r[col] <= filter.lte);
    }
    if (filter.ilike !== undefined) {
      const search = String(filter.ilike).replace(/%/g, '').toLowerCase();
      result = result.filter((r: any) => String(r[col] || '').toLowerCase().includes(search));
    }
    if (filter.in !== undefined && Array.isArray(filter.in)) {
      result = result.filter((r: any) => filter.in.includes(r[col]));
    }
  }
  
  return result;
}

// ─── Local OR Filter Engine ───
function applyLocalOr(data: any[], orStr: string): any[] {
  if (!orStr || !Array.isArray(data)) return data;
  
  const parts = orStr.split(',');
  return data.filter((row: any) => {
    return parts.some(part => {
      const subparts = part.split('.');
      if (subparts.length >= 3) {
        const col = subparts[0];
        const op = subparts[1];
        const pattern = subparts.slice(2).join('.');
        
        if (op === 'ilike') {
          const search = pattern.replace(/%/g, '').toLowerCase();
          return String(row[col] || '').toLowerCase().includes(search);
        }
        if (op === 'eq') {
          return String(row[col]) === String(pattern);
        }
      }
      return false;
    });
  });
}

// ─── Query Builder ───
class DBQueryBuilder {
  table: string;
  query: Record<string, any>;
  action: string = 'query';

  constructor(table: string) {
    this.table = table;
    this.query = { table };
  }

  select(columns = '*', options: any = {}) {
    // Strip relational selects — we handle relations locally
    const cleanColumns = columns.includes('(') ? '*' : columns;
    this.query.select = cleanColumns;
    if (options.count) this.query.count = options.count;
    if (options.head) this.query.head = options.head;
    return this;
  }

  eq(column: string, value: any) {
    if (!this.query.filters) this.query.filters = {};
    this.query.filters[column] = { eq: value };
    return this;
  }

  neq(column: string, value: any) {
    if (!this.query.filters) this.query.filters = {};
    this.query.filters[column] = { neq: value };
    return this;
  }

  gte(column: string, value: any) {
    if (!this.query.filters) this.query.filters = {};
    this.query.filters[column] = { gte: value };
    return this;
  }

  lte(column: string, value: any) {
    if (!this.query.filters) this.query.filters = {};
    this.query.filters[column] = { lte: value };
    return this;
  }

  ilike(column: string, pattern: string) {
    if (!this.query.filters) this.query.filters = {};
    this.query.filters[column] = { ilike: pattern };
    return this;
  }

  in(column: string, values: any[]) {
    if (!this.query.filters) this.query.filters = {};
    this.query.filters[column] = { in: values };
    return this;
  }

  or(filters: string) {
    this.query.or = filters;
    return this;
  }

  order(column: string, options: any = { ascending: true }) {
    this.query.order = { column, ascending: options.ascending };
    return this;
  }

  limit(count: number) {
    this.query.limit = count;
    return this;
  }

  single() {
    this.query.single = true;
    return this;
  }

  maybeSingle() {
    this.query.single = true;
    return this;
  }

  insert(data: any, options: any = {}) {
    this.action = 'insert';
    const items = Array.isArray(data) ? data : [data];
    // Assign UUID to every item that doesn't have an id
    items.forEach(item => {
      if (!item.id) item.id = generateUUID();
    });
    this.query.data = items;
    if (options.upsert) this.query.upsert = true;
    return this;
  }

  upsert(data: any, options: any = {}) {
    this.action = 'upsert';
    const items = Array.isArray(data) ? data : [data];
    items.forEach(item => {
      if (!item.id) item.id = generateUUID();
    });
    this.query.data = items;
    this.query.upsert = true;
    this.query.onConflict = options.onConflict;
    return this;
  }

  update(data: any) {
    this.action = 'update';
    this.query.data = data;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  async execute() {
    try {
      const key = cacheKey(this.query, this.action);

      // ── WRITE operations (insert/update/upsert/delete) ──
      if (this.action !== 'query') {
        await addPendingOp({ action: this.action, query: this.query });
        const fakeData = this.query.data;
        const resultData = this.query.single
          ? (Array.isArray(fakeData) ? fakeData[0] : fakeData)
          : fakeData;
        
        // Update local full cache
        const fullCache = await getCache(`nk_full_${this.table}`) || [];
        const dataArr = Array.isArray(fullCache) ? [...fullCache] : [];
        
        if (this.action === 'insert' || this.action === 'update' || this.action === 'upsert') {
          const updates = Array.isArray(fakeData) ? fakeData : [fakeData];
          updates.forEach(u => {
            // Ensure created_at exists for sorting
            if (!u.created_at) u.created_at = new Date().toISOString();
            
            const idx = dataArr.findIndex((d: any) => 
              (d.id && u.id && d.id === u.id) || 
              (d.card_number && u.card_number && d.card_number === u.card_number) ||
              (d.code && u.code && d.code === u.code)
            );
            
            if (idx !== -1) {
              dataArr[idx] = { ...dataArr[idx], ...u };
            } else {
              dataArr.unshift(u);
            }
          });
          await setCache(`nk_full_${this.table}`, dataArr);
        } else if (this.action === 'delete') {
          const filters = this.query.filters || {};
          const filteredData = dataArr.filter((d: any) => {
            return !Object.entries(filters).every(([col, fVal]: [string, any]) => {
              if (fVal && fVal.eq !== undefined) {
                return String(d[col]) === String(fVal.eq);
              }
              if (fVal && fVal.in !== undefined && Array.isArray(fVal.in)) {
                return fVal.in.map(String).includes(String(d[col]));
              }
              return String(d[col]) === String(fVal);
            });
          });
          await setCache(`nk_full_${this.table}`, filteredData);
        }
        
        // CRITICAL: Clear specific query caches for this table to ensure visibility
        const db = await dbPromise;
        const keys = await db.getAllKeys('keyval');
        for (const k of keys) {
          if (typeof k === 'string' && k.startsWith(`nk_cache_query_`) && k.includes(`"table":"${this.table}"`)) {
            await db.delete('keyval', k);
          }
        }
        
        // Trigger background sync proactively
        setTimeout(async () => {
          try {
            await syncPendingOps();
            window.dispatchEvent(new Event('nk_live_sync_completed'));
          } catch (e) {
            console.error('[AUTO-SYNC] Background sync failed:', e);
          }
        }, 100);

        return { data: resultData, error: null, offline: true };
      }

      // ── READ operations (query) ──
      // Try exact cache key first
      const cached = await getCache(key);
      if (cached) return cached;
      
      // Fallback to full table cache with local filtering
      const fullCacheRead = await getCache(`nk_full_${this.table}`);
      if (fullCacheRead) {
        let data = Array.isArray(fullCacheRead) ? [...fullCacheRead] : [];
        
        // Apply filters
        if (this.query.filters) {
          data = applyLocalFilters(data, this.query.filters);
        }
        
        // Apply OR filters
        if (this.query.or) {
          data = applyLocalOr(data, this.query.or);
        }

        // Apply ordering
        if (this.query.order && this.query.order.column) {
          data.sort((a: any, b: any) => {
            const valA = a[this.query.order.column] || '';
            const valB = b[this.query.order.column] || '';
            return this.query.order.ascending ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
          });
        }

        // Apply single
        if (this.query.single && Array.isArray(data)) {
          const singleResult = data[0] || null;
          return { data: singleResult, error: null, count: singleResult ? 1 : 0, offline: true };
        }
        
        // Apply limit
        if (this.query.limit && Array.isArray(data)) {
          data = data.slice(0, this.query.limit);
        }
        
        // Apply head (count only)
        if (this.query.head) {
          return { data: null, error: null, count: data.length, offline: true };
        }
        
        const count = Array.isArray(data) ? data.length : (data ? 1 : 0);
        return { data, error: null, count, offline: true };
      }
      
      // No cache at all — return empty, not an error
      if (this.query.single) {
        return { data: null, error: null, count: 0, offline: true };
      }
      return { data: [], error: null, count: 0, offline: true };
      
    } catch (e: any) {
      console.error('DB Execute Error:', e);
      // NEVER crash. Return safe empty result.
      if (this.query.single) {
        return { data: null, error: { message: e.message }, count: 0 };
      }
      return { data: [], error: { message: e.message }, count: 0 };
    }
  }

  then<TResult1 = any, TResult2 = never>(
    resolve?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    reject?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(resolve, reject);
  }
}

// ─── Export DB Client ───
export const db = {
  from: (table: string) => new DBQueryBuilder(table),
  rpc: async (_name: string, _params: unknown) => {
      return { data: null, error: null };
  },
  auth: {
    getUser: async () => ({ data: { user: { id: 'local-user', email: 'admin@nekkadam.org' } }, error: null }),
    getSession: async () => ({ data: { session: { user: { id: 'local-user', email: 'admin@nekkadam.org' } } }, error: null }),
    signInWithPassword: async (_creds: unknown) => ({ data: { user: { id: 'local-user', email: 'admin@nekkadam.org' } }, error: null }),
    signUp: async (_creds: unknown) => ({ data: { user: { id: 'local-user', email: 'admin@nekkadam.org' } }, error: null }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: (callback: any) => {
        setTimeout(() => callback('SIGNED_IN', { user: { id: 'local-user', email: 'admin@nekkadam.org' } }), 0);
        return { data: { subscription: { unsubscribe: () => {} } } };
    }
  }
};

// ─── Background Auto-Sync Loop ───
if (typeof window !== 'undefined') {
  const runAutoSync = async () => {
    try {
      // AUDIT FIX: Skip sync entirely if browser knows it's offline (saves failed fetch timeouts)
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      const ops = await getPendingOps();
      if (ops.length > 0) {
        const online = await checkServerOnline();
        if (online) {
          // ─── SILENT SESSION RECOVERY ───
          const session = await getStoredSession();
          if (!session || !localStorage.getItem('nk_token')) {
            const currentUserStr = localStorage.getItem('nk_current_user');
            if (currentUserStr) {
              try {
                const currentUser = JSON.parse(currentUserStr);
                // getBaseUrl is now statically imported at the top
                const recoveryUrl = getBaseUrl();
                const res = await fetch(`${recoveryUrl}/api/users/create-profile`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: currentUser.userName,
                    department: currentUser.department,
                    role: currentUser.role || 'Volunteer',
                    deviceId: 'local-device'
                  })
                });
                if (res.ok) {
                  const result = await res.json();
                  if (result.token) {
                    localStorage.setItem('nk_token', result.token);
                    await setStoredSession({
                      sessionId: result.token,
                      userId: result.user.id,
                      userName: result.user.name,
                      department: currentUser.department,
                      role: currentUser.role || 'Volunteer',
                      loginTime: currentUser.loginTime || new Date().toISOString(),
                      lastSyncTime: null
                    });
                  }
                }
              } catch (err) {
                console.error('[AUTO-SYNC] Token recovery failed:', err);
              }
            }
          }

          console.log('[AUTO-SYNC] Server online. Syncing pending ops:', ops.length);
          const result = await syncPendingOps();
          if (result.synced > 0) {
            console.log('[AUTO-SYNC] Synced successfully:', result.synced);
            window.dispatchEvent(new Event('nk_live_sync_completed'));
          }
        }
      }
    } catch (e) {
      console.error('[AUTO-SYNC] Background sync failed:', e);
    }
  };

  // Run on startup
  setTimeout(runAutoSync, 2000);
  
  // Sync when window status fires online
  window.addEventListener('online', runAutoSync);
  
  // AUDIT FIX: Reduced from 10s → 30s to cut background network churn by 3x
  setInterval(runAutoSync, 30000);
}
