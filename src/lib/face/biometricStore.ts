// ─── Nek Kadam: Offline Biometric Store & Sync Integration ───

import { dbPromise, getPendingOps } from '../db';
import { createToken } from '../tokenService';
import { EMBEDDING_DIMENSION, normalizeVector } from './vectorMath';

export interface PatientBiometricRecord {
  id: string;              // BIO-<patient_id>-<timestamp>
  patientId: string;       // references patients.id or card_number
  cardNumber: string;      // denormalized for instant token creation
  patientName: string;     // denormalized for instant UI confirmation without joining
  gender?: string;
  age?: number;
  phone?: string;
  embedding: number[];     // 128-float array (L2 normalized)
  version: string;         // 'facenet-128-v1'
  qualityScore: number;    // 0.0 - 1.0 (lighting, sharpness)
  createdAt: string;
  updatedAt: string;
}

// In-memory cache for ultra-fast vector searching (<2ms across thousands of patients)
let inMemoryBiometricCache: PatientBiometricRecord[] | null = null;
let cacheTimestamp = 0;

/**
 * Ensures the biometric store is accessible in IndexedDB.
 * Falls back to 'keyval' store if DB schema hasn't upgraded yet, ensuring zero crash risk.
 */
async function getBiometricsStore(): Promise<{ useDedicatedStore: boolean }> {
  try {
    const db = await dbPromise;
    if (db.objectStoreNames.contains('patient_biometrics')) {
      return { useDedicatedStore: true };
    }
  } catch (e) {
    console.warn('[BIOMETRICS] Checking store error:', e);
  }
  return { useDedicatedStore: false };
}

/**
 * Loads all enrolled biometric records into memory for fast matching.
 */
export async function loadEnrolledBiometrics(forceRefresh = false): Promise<PatientBiometricRecord[]> {
  const now = Date.now();
  if (!forceRefresh && inMemoryBiometricCache && (now - cacheTimestamp < 30000)) {
    return inMemoryBiometricCache;
  }

  try {
    const db = await dbPromise;
    const { useDedicatedStore } = await getBiometricsStore();

    let rawRecords: any[] = [];
    if (useDedicatedStore) {
      rawRecords = await db.getAll('patient_biometrics');
    } else {
      rawRecords = (await db.get('keyval', 'nk_patient_biometrics')) || [];
    }

    const cleanedRecords: PatientBiometricRecord[] = (rawRecords || []).map((r: any) => {
      let emb = r.embedding;
      if (!emb && r.embedding_vector) {
        try {
          emb = typeof r.embedding_vector === 'string' ? JSON.parse(r.embedding_vector) : r.embedding_vector;
        } catch {}
      } else if (typeof emb === 'string') {
        try {
          emb = JSON.parse(emb);
        } catch {}
      }

      const normalizedEmb = emb ? Array.from(normalizeVector(emb)) : [];

      const cardNum = String(r.cardNumber || r.card_number || r.patientId || r.patient_id || '').trim();
      const patId = String(r.patientId || r.patient_id || r.cardNumber || r.card_number || '').trim();
      const patName = r.patientName || r.patient_name || 'Patient';

      return {
        id: r.id || `BIO-${cardNum}-${Date.now()}`,
        patientId: patId,
        cardNumber: cardNum,
        patientName: patName,
        gender: r.gender,
        age: r.age,
        phone: r.phone,
        embedding: normalizedEmb,
        version: r.version || 'facenet-128-v1',
        qualityScore: typeof r.qualityScore === 'number' ? r.qualityScore : 0.95,
        createdAt: r.createdAt || r.created_at || new Date().toISOString(),
        updatedAt: r.updatedAt || r.updated_at || new Date().toISOString()
      };
    }).filter(r => r.embedding.length > 0 && r.embedding.some(v => v !== 0));

    // Deduplicate by cardNumber or patientId, retaining the latest enrollment
    const dedupedMap = new Map<string, PatientBiometricRecord>();
    for (const r of cleanedRecords) {
      const key = r.cardNumber || r.patientId;
      const existing = dedupedMap.get(key);
      if (!existing) {
        dedupedMap.set(key, r);
      } else {
        const existingTime = new Date(existing.updatedAt || existing.createdAt).getTime();
        const currentTime = new Date(r.updatedAt || r.createdAt).getTime();
        if (currentTime >= existingTime) {
          dedupedMap.set(key, r);
        }
      }
    }
    const finalRecords = Array.from(dedupedMap.values());

    inMemoryBiometricCache = finalRecords;
    cacheTimestamp = now;
    console.log(`[BIOMETRICS] Loaded ${finalRecords.length} biometric records into in-memory vector index.`);
    return finalRecords;
  } catch (e) {
    console.error('[BIOMETRICS] Failed to load enrolled biometrics:', e);
    return inMemoryBiometricCache || [];
  }
}

/**
 * Check if a specific patient has enrolled Face ID biometrics.
 */
export async function getPatientBiometric(patientIdOrCard: string | number): Promise<PatientBiometricRecord | null> {
  const clean = String(patientIdOrCard).trim();
  const list = await loadEnrolledBiometrics();
  return list.find(r => String(r.cardNumber).trim() === clean || String(r.patientId).trim() === clean) || null;
}

/**
 * Deletes a patient biometric enrollment locally.
 */
export async function deletePatientBiometric(patientIdOrCard: string | number): Promise<boolean> {
  try {
    const clean = String(patientIdOrCard).trim();
    const db = await dbPromise;
    const { useDedicatedStore } = await getBiometricsStore();

    if (useDedicatedStore) {
      const records: PatientBiometricRecord[] = await db.getAll('patient_biometrics');
      for (const r of records) {
        if (String(r.cardNumber).trim() === clean || String(r.patientId).trim() === clean) {
          await db.delete('patient_biometrics', r.id);
        }
      }
    }

    try {
      const existing: PatientBiometricRecord[] = (await db.get('keyval', 'nk_patient_biometrics')) || [];
      const filtered = existing.filter(r => String(r.cardNumber).trim() !== clean && String(r.patientId).trim() !== clean);
      await db.put('keyval', filtered, 'nk_patient_biometrics');
    } catch {}

    if (inMemoryBiometricCache) {
      inMemoryBiometricCache = inMemoryBiometricCache.filter(r => String(r.cardNumber).trim() !== clean && String(r.patientId).trim() !== clean);
    }
    return true;
  } catch (err) {
    console.error('[BIOMETRICS] Failed to delete biometric:', err);
    return false;
  }
}

/**
 * Clears all enrolled biometric profiles from IndexedDB and memory.
 */
export async function clearAllBiometrics(): Promise<boolean> {
  try {
    const db = await dbPromise;
    const { useDedicatedStore } = await getBiometricsStore();

    if (useDedicatedStore) {
      await db.clear('patient_biometrics');
    }
    await db.put('keyval', [], 'nk_patient_biometrics');
    inMemoryBiometricCache = [];
    cacheTimestamp = Date.now();
    console.log('[BIOMETRICS] All biometric profiles cleared.');
    return true;
  } catch (err) {
    console.error('[BIOMETRICS] Failed to clear biometrics:', err);
    return false;
  }
}

/**
 * Saves a new patient biometric enrollment locally and queues offline sync.
 */
export async function savePatientBiometric(
  patient: {
    id: string;
    cardNumber: string;
    name: string;
    gender?: string;
    age?: number;
    phone?: string;
  },
  embeddingVector: Float32Array | number[] | string,
  qualityScore = 0.95
): Promise<PatientBiometricRecord> {
  const db = await dbPromise;
  const normalized = Array.from(normalizeVector(embeddingVector));
  const cardNum = String(patient.cardNumber || patient.id || '').trim();
  const patId = String(patient.id || patient.cardNumber || '').trim();

  const record: PatientBiometricRecord = {
    id: `BIO-${cardNum}-${Date.now()}`,
    patientId: patId,
    cardNumber: cardNum,
    patientName: patient.name || 'Unknown Patient',
    gender: patient.gender,
    age: patient.age,
    phone: patient.phone,
    embedding: normalized,
    version: 'facenet-128-v1',
    qualityScore,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const { useDedicatedStore } = await getBiometricsStore();

  if (useDedicatedStore) {
    try {
      const records: PatientBiometricRecord[] = await db.getAll('patient_biometrics');
      for (const r of records) {
        if (String(r.cardNumber).trim() === cardNum || String(r.patientId).trim() === patId) {
          await db.delete('patient_biometrics', r.id);
        }
      }
      await db.put('patient_biometrics', record);
    } catch (_e) {}
  }

  // Always keep keyval fallback store in parity
  try {
    const existing: PatientBiometricRecord[] = (await db.get('keyval', 'nk_patient_biometrics')) || [];
    const filtered = existing.filter(r => String(r.cardNumber).trim() !== cardNum && String(r.patientId).trim() !== patId);
    filtered.push(record);
    await db.put('keyval', filtered, 'nk_patient_biometrics');
  } catch (_e) {}

  // Update in-memory vector cache
  if (inMemoryBiometricCache) {
    inMemoryBiometricCache = inMemoryBiometricCache.filter(
      r => String(r.cardNumber).trim() !== cardNum && String(r.patientId).trim() !== patId
    );
    inMemoryBiometricCache.push(record);
  } else {
    inMemoryBiometricCache = [record];
  }
  cacheTimestamp = Date.now();

  // Queue operation for server sync
  try {
    const pendingOps = await getPendingOps();
    pendingOps.push({
      action: 'upsert',
      query: {
        table: 'patient_biometrics',
        data: {
          id: record.id,
          patient_id: record.patientId,
          card_number: record.cardNumber,
          patient_name: record.patientName,
          embedding_vector: JSON.stringify(record.embedding),
          quality_score: record.qualityScore,
          created_at: record.createdAt,
          updated_at: record.updatedAt
        }
      },
      timestamp: Date.now(),
      id: `SYNC-${Date.now()}`
    });
    await db.put('keyval', pendingOps, 'nk_pending_ops');
    console.log('[BIOMETRICS] Enrolled face profile queued for sync.');
  } catch (syncErr) {
    console.warn('[BIOMETRICS] Failed to queue pending sync op:', syncErr);
  }

  return record;
}

/**
 * Creates a token immediately even if the server is offline.
 * Works seamlessly with existing server token API or local IndexedDB queue.
 */
export async function issueOfflineToken(params: {
  patientId: string;
  patientName: string;
  cardNumber: string;
  userId?: string;
  priority?: 'NORMAL' | 'URGENT';
}): Promise<{ success: boolean; tokenNumber: number; tokenId: string; isOffline: boolean }> {
  const priority = params.priority || 'NORMAL';
  const todayKey = new Date().toISOString().split('T')[0];

  // 1. Try server via authenticated createToken first
  try {
    const tokenRes = await createToken({
      personId: params.cardNumber || params.patientId,
      personName: params.patientName,
      personCard: params.cardNumber,
      priority,
      userId: params.userId,
      departmentId: 'reception'
    });

    if (tokenRes && tokenRes.data) {
      return {
        success: true,
        tokenNumber: tokenRes.data.tokenNumber,
        tokenId: tokenRes.data.id,
        isOffline: false
      };
    }
  } catch (_netErr) {
    console.log('[TOKEN] Server unreachable, switching to OFFLINE token creation...');
  }

  // 2. Offline Fallback: Create Token in local IndexedDB
  try {
    const db = await dbPromise;

    // Get current offline token sequence for today
    const counterKey = `nk_token_counter_${todayKey}`;
    let currentCount = (await db.get('keyval', counterKey)) || 0;
    currentCount += 1;
    await db.put('keyval', currentCount, counterKey);

    const tokenId = `TOKEN-OFFLINE-${Date.now()}`;
    const tokenRecord = {
      id: tokenId,
      tokenNumber: currentCount,
      dateKey: todayKey,
      personId: params.cardNumber || params.patientId,
      personName: params.patientName,
      personCard: params.cardNumber,
      currentDepartmentId: 'reception',
      status: 'WAITING',
      priority,
      sourceDepartmentId: 'reception',
      sequenceIndex: currentCount,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Store in IndexedDB tokens store if exists
    if (db.objectStoreNames.contains('tokens')) {
      await db.put('tokens', tokenRecord);
    }

    // Queue for sync to server
    const pendingOps = await getPendingOps();
    pendingOps.push({
      action: 'insert',
      query: {
        table: 'tokens',
        data: tokenRecord
      },
      timestamp: Date.now(),
      id: `SYNC-${Date.now()}`
    });
    await db.put('keyval', pendingOps, 'nk_pending_ops');

    console.log(`[TOKEN] Generated offline token #${currentCount} for patient ${params.patientName}`);
    return {
      success: true,
      tokenNumber: currentCount,
      tokenId,
      isOffline: true
    };
  } catch (offlineErr) {
    console.error('[TOKEN] Offline token creation failed:', offlineErr);
    return {
      success: false,
      tokenNumber: 0,
      tokenId: '',
      isOffline: true
    };
  }
}
