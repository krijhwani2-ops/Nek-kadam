// ─── Nek Kadam: Incremental Delta Synchronization Engine ───
// High-efficiency delta sync using Last-Write-Wins (LWW) reconciliation.
// Only transfers records modified since lastSyncTime.

import { dbPromise, getPendingOps, syncPendingOps, checkServerOnline } from './db';
import { getStoredSession, getBaseUrl, getLastSyncTime, setLastSyncTime } from './session';

export interface SyncResult {
  success: boolean;
  message: string;
  pushedOps: number;
  pulledRecords: number;
  lastSyncTime: string | null;
  tablesUpdated: string[];
}

export interface DeltaSyncOptions {
  forceFull?: boolean;
  tables?: string[];
}

export interface SyncStatus {
  lastSyncTime: string | null;
  pendingOpsCount: number;
  isOnline: boolean;
}

export const DEFAULT_SYNC_TABLES = [
  'patients',
  'visits',
  'prescription_groups',
  'group_medicines',
  'medicines',
  'tokens',
  'departments',
  'batches',
  'education_students',
  'attendance',
  'medicine_tasks',
  'medicine_task_items'
];

/**
 * Returns the primary key field name for a table in local cache.
 */
export function getTablePrimaryKey(table: string): string {
  if (table === 'patients') return 'card_number';
  if (table === 'medicines') return 'code';
  return 'id';
}

/**
 * Extracts the unique primary key value from an entity.
 */
export function getRecordKey(table: string, item: any): string | null {
  if (!item || typeof item !== 'object') return null;
  if (table === 'patients') {
    const key = item.card_number || item.id;
    return key !== undefined && key !== null ? String(key) : null;
  }
  if (table === 'medicines') {
    const key = item.code || item.id;
    return key !== undefined && key !== null ? String(key) : null;
  }
  const key = item.id !== undefined && item.id !== null ? item.id : item.group_id;
  return key !== undefined && key !== null ? String(key) : null;
}

/**
 * Parses timestamp from record for Last-Write-Wins comparison.
 */
export function getRecordTimestamp(item: any): number {
  if (!item || typeof item !== 'object') return 0;
  const raw = item.updated_at || item.updatedAt || item.created_at || item.createdAt || item.timestamp;
  if (!raw) return 0;
  const ms = new Date(raw).getTime();
  return isNaN(ms) ? 0 : ms;
}

/**
 * Reconciles local cached records with incoming remote delta records using Last-Write-Wins (LWW).
 * Preserves local unsynced visits/items (with temporary IDs like VISIT-, GRP-, MAP-) and newer offline edits.
 */
export function reconcileTableDeltas(
  table: string,
  localCache: any[],
  remoteDeltas: any[]
): { merged: any[]; count: number } {
  const safeLocal = Array.isArray(localCache) ? localCache : [];
  const safeRemote = Array.isArray(remoteDeltas) ? remoteDeltas : [];

  const recordMap = new Map<string, any>();
  const fallbackList: any[] = [];

  // 1. Index local cached records
  for (const item of safeLocal) {
    const key = getRecordKey(table, item);
    if (key) {
      recordMap.set(key, item);
    } else {
      fallbackList.push(item);
    }
  }

  let updatedCount = 0;

  // 2. Merge remote deltas using LWW
  for (const remoteItem of safeRemote) {
    const key = getRecordKey(table, remoteItem);
    if (!key) {
      fallbackList.push(remoteItem);
      updatedCount++;
      continue;
    }

    if (!recordMap.has(key)) {
      // New record from server
      recordMap.set(key, remoteItem);
      updatedCount++;
    } else {
      const localItem = recordMap.get(key);
      const localTime = getRecordTimestamp(localItem);
      const remoteTime = getRecordTimestamp(remoteItem);

      // Server wins if remote timestamp is greater or equal to local timestamp
      if (remoteTime >= localTime) {
        recordMap.set(key, { ...localItem, ...remoteItem });
        updatedCount++;
      } else {
        // Local edit is newer (offline edit pending push) — preserve local!
      }
    }
  }

  // 3. Preserve pending local visits/groups with client-generated temporary IDs
  if (['visits', 'prescription_groups', 'group_medicines'].includes(table)) {
    for (const localItem of safeLocal) {
      const key = getRecordKey(table, localItem);
      if (key && (key.startsWith('VISIT-') || key.startsWith('GRP-') || key.startsWith('MAP-'))) {
        if (!recordMap.has(key)) {
          recordMap.set(key, localItem);
        }
      }
    }
  }

  const merged = [...Array.from(recordMap.values()), ...fallbackList];
  return { merged, count: updatedCount };
}

/**
 * Executes a two-way incremental delta synchronization:
 * 1. Pushes pending local writes from IndexedDB (nk_pending_ops).
 * 2. Pulls delta changes from server where updated_at > last_sync_time.
 * 3. Reconciles conflicts using Last-Write-Wins based on timestamps.
 * 4. Merges deltas into IndexedDB full cache (nk_full_<table_name>).
 * 5. Updates session lastSyncTime and emits 'nk_live_sync_completed'.
 */
export async function syncDelta(options?: DeltaSyncOptions): Promise<SyncResult> {
  const isOnline = await checkServerOnline();
  const currentLastSync = await getLastSyncTime();

  if (!isOnline) {
    return {
      success: false,
      message: 'Server not reachable. Check network or local Wi-Fi connection.',
      pushedOps: 0,
      pulledRecords: 0,
      lastSyncTime: currentLastSync,
      tablesUpdated: []
    };
  }

  // Step 1: Push pending local writes first
  const pushResult = await syncPendingOps();

  // Step 2: Determine sync horizon
  const lastSyncTime = options?.forceFull ? null : currentLastSync;
  const targetTables = options?.tables || DEFAULT_SYNC_TABLES;
  const baseUrl = getBaseUrl();
  const session = await getStoredSession();
  const token = session?.sessionId || (typeof window !== 'undefined' ? localStorage.getItem('nk_token') : '') || '';

  let totalPulled = 0;
  const tablesUpdated: string[] = [];
  let newServerTime = new Date().toISOString();

  try {
    // Step 3: Fetch deltas from POST /api/sync/delta
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(`${baseUrl}/api/sync/delta`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        lastSyncTime,
        tables: targetTables
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        message: 'Unauthorized: Authentication required for delta sync.',
        pushedOps: pushResult.synced,
        pulledRecords: 0,
        lastSyncTime: currentLastSync,
        tablesUpdated: []
      };
    }

    if (res.ok) {
      const deltaData = await res.json();
      if (deltaData.serverTime) {
        newServerTime = deltaData.serverTime;
      }

      const deltas = deltaData.deltas || deltaData.tables || {};
      const idb = await dbPromise;

      for (const table of targetTables) {
        const tableDeltas = Array.isArray(deltas[table]) ? deltas[table] : [];
        if (tableDeltas.length > 0 || options?.forceFull) {
          const cacheKey = `nk_full_${table}`;
          const existingCache = (await idb.get('keyval', cacheKey)) || [];
          const { merged, count } = reconcileTableDeltas(table, existingCache, tableDeltas);
          await idb.put('keyval', merged, cacheKey);

          totalPulled += tableDeltas.length;
          if (count > 0 || tableDeltas.length > 0) {
            tablesUpdated.push(table);
          }
        }
      }
    } else {
      // Fallback to /rpc/query if /api/sync/delta is not available
      const idb = await dbPromise;
      for (const table of targetTables) {
        const timestampCol = (table === 'medicine_tasks') ? 'updatedAt' : 'updated_at';
        const query: any = { table };
        if (lastSyncTime) {
          query.filters = { [timestampCol]: { gt: lastSyncTime } };
        }

        const rpcRes = await fetch(`${baseUrl}/rpc/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(query)
        });

        if (rpcRes.ok) {
          const rpcData = await rpcRes.json();
          const rows = Array.isArray(rpcData.data) ? rpcData.data : [];
          const cacheKey = `nk_full_${table}`;
          const existingCache = (await idb.get('keyval', cacheKey)) || [];
          const { merged, count } = reconcileTableDeltas(table, existingCache, rows);
          await idb.put('keyval', merged, cacheKey);

          totalPulled += rows.length;
          if (count > 0 || rows.length > 0) {
            tablesUpdated.push(table);
          }
        }
      }
    }

    // Step 4: Advance lastSyncTime on success
    await setLastSyncTime(newServerTime);

    // Step 5: Notify application listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('nk_live_sync_completed', {
          detail: {
            lastSyncTime: newServerTime,
            pushed: pushResult.synced,
            pulled: totalPulled,
            tables: tablesUpdated
          }
        })
      );
    }

    return {
      success: true,
      message: `Delta sync completed: ${totalPulled} records updated across ${tablesUpdated.length} tables. ${pushResult.synced} local writes pushed.`,
      pushedOps: pushResult.synced,
      pulledRecords: totalPulled,
      lastSyncTime: newServerTime,
      tablesUpdated
    };
  } catch (err: any) {
    console.error('[DELTA SYNC ERROR]', err);
    return {
      success: false,
      message: `Sync error: ${err.message || 'Unknown network failure'}`,
      pushedOps: pushResult.synced,
      pulledRecords: totalPulled,
      lastSyncTime: currentLastSync,
      tablesUpdated
    };
  }
}

/**
 * Triggers a full synchronization, resetting the delta marker.
 */
export async function fullSync(tables?: string[]): Promise<SyncResult> {
  return syncDelta({ forceFull: true, tables });
}

/**
 * Retrieves the current synchronization health and status.
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const lastSyncTime = await getLastSyncTime();
  const ops = await getPendingOps().catch(() => []);
  const isOnline = await checkServerOnline().catch(() => false);
  return {
    lastSyncTime,
    pendingOpsCount: ops.length,
    isOnline
  };
}
