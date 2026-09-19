import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  savePatientPhoto,
  getPatientPhotos,
  getPatientPhotoBlob,
  getPatientPhotoUrl,
  deletePatientPhoto,
  deletePhotosForPatient,
  clearPhotoStoreForTesting,
  isQuotaExceededError
} from '../src/lib/photos/photoStore';
import { dbPromise, getPendingOps, fullDataSync } from '../src/lib/db';
import { syncDelta, DEFAULT_SYNC_TABLES } from '../src/lib/sync';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue({ uri: 'file:///data/photos/test.jpg' }),
    getUri: vi.fn().mockResolvedValue({ uri: 'file:///data/photos/test.jpg' }),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue({ data: 'mock-base64' }),
  },
  Directory: {
    Data: 'DATA',
  },
}));

/**
 * ============================================================================
 * Adversarial Challenger Suite: Zero-Sync & Data Isolation Guarantees
 * ============================================================================
 * 
 * Verifies non-negotiable guarantees:
 * 1. Write Side-Effects & Queue Isolation:
 *    - Photo saves/deletes NEVER touch `nk_pending_ops` or `sync_queue`.
 * 2. Data Isolation & Patient Table Purity:
 *    - Photo saves/deletes NEVER modify `patients` table rows with binaries,
 *      base64 strings, or filepaths.
 * 3. Sync Routines Zero-Sync Probing:
 *    - `syncDelta` and `fullDataSync` NEVER query, upload, or download photos.
 * 4. Deletion Blast Radius & Surgical Target:
 *    - `deletePatientPhoto` ONLY removes the targeted photo; patient records,
 *      visits, prescriptions, and peer photos remain 100% intact.
 */

describe('Challenger 2 Empirical Adversarial Probe: Zero-Sync & Data Isolation', () => {
  // In-memory virtual database stores for full simulation
  let mockStores: Record<string, Map<string, any>>;
  let putSpy: any;
  let deleteSpy: any;

  beforeEach(async () => {
    clearPhotoStoreForTesting();
    vi.restoreAllMocks();

    mockStores = {
      patients: new Map(),
      visits: new Map(),
      keyval: new Map(),
      sync_queue: new Map(),
      patient_photos: new Map(),
      patient_photo_blobs: new Map(),
    };

    const db = await dbPromise;

    // Attach in-memory store simulation to the mocked idb instance
    putSpy = vi.spyOn(db, 'put').mockImplementation(async (storeName: string, val: any, key?: any) => {
      if (!mockStores[storeName]) mockStores[storeName] = new Map();
      const effectiveKey = key ?? (val && typeof val === 'object' ? (val.id || val.card_number || val.code) : undefined);
      mockStores[storeName].set(String(effectiveKey), val);
      return effectiveKey;
    });
    putSpy.mockClear();

    deleteSpy = vi.spyOn(db, 'delete').mockImplementation(async (storeName: string, key: any) => {
      if (mockStores[storeName]) {
        mockStores[storeName].delete(String(key));
      }
      return undefined;
    });
    deleteSpy.mockClear();

    vi.spyOn(db, 'get').mockImplementation(async (storeName: string, key: any) => {
      if (mockStores[storeName]) {
        return mockStores[storeName].get(String(key)) || null;
      }
      return null;
    });

    vi.spyOn(db, 'getAll').mockImplementation(async (storeName: string) => {
      if (mockStores[storeName]) {
        return Array.from(mockStores[storeName].values());
      }
      return [];
    });
  });

  afterEach(() => {
    clearPhotoStoreForTesting();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 1. PROBE WRITE SIDE-EFFECTS & QUEUE ISOLATION
  // ==========================================================================
  describe('1. Write Side-Effects & Queue Isolation Probing', () => {
    it('PROBE-W1: saving photos never writes to nk_pending_ops or sync_queue', async () => {
      // Pre-seed an existing pending operation to ensure existing ops are preserved
      const initialPendingOp = {
        action: 'insert',
        query: { table: 'patients', data: { card_number: '9999', name: 'Existing Pending Patient' } },
        timestamp: Date.now() - 10000,
        id: 'op-pre-existing-1',
      };
      mockStores['keyval'].set('nk_pending_ops', [initialPendingOp]);

      // Save 5 photos for patient 1001
      const sampleBlob = new Blob(['dummy-image-data-payload-12345'], { type: 'image/jpeg' });
      for (let i = 0; i < 5; i++) {
        await savePatientPhoto('1001', sampleBlob);
      }

      // Verify nk_pending_ops in keyval store
      const pendingOps = await getPendingOps();
      expect(pendingOps).toHaveLength(1);
      expect(pendingOps[0].id).toBe('op-pre-existing-1');

      // Check all puts directed to keyval
      const keyvalPuts = putSpy.mock.calls.filter((c: any[]) => c[0] === 'keyval');
      for (const call of keyvalPuts) {
        expect(call[2]).not.toBe('nk_pending_ops');
      }

      // Verify sync_queue store remains completely empty
      const syncQueueEntries = Array.from(mockStores['sync_queue'].values());
      expect(syncQueueEntries).toHaveLength(0);

      const syncQueuePuts = putSpy.mock.calls.filter((c: any[]) => c[0] === 'sync_queue');
      expect(syncQueuePuts).toHaveLength(0);
    });

    it('PROBE-W2: stress-testing 20 rapid photo saves causes zero queue pollution', async () => {
      mockStores['keyval'].set('nk_pending_ops', []);

      const sampleBlob = new Blob(['stress-test-pixel-data'], { type: 'image/jpeg' });
      const savePromises = [];
      for (let i = 0; i < 20; i++) {
        savePromises.push(savePatientPhoto('1001', sampleBlob));
      }
      const savedPhotos = await Promise.all(savePromises);

      expect(savedPhotos).toHaveLength(20);

      // Verify nk_pending_ops is still empty
      const pendingOps = await getPendingOps();
      expect(pendingOps).toHaveLength(0);

      // Verify sync_queue is still empty
      expect(mockStores['sync_queue'].size).toBe(0);

      // Verify puts were strictly to patient_photos and patient_photo_blobs
      const writtenStores = new Set(putSpy.mock.calls.map((c: any[]) => c[0]));
      expect(writtenStores.has('patient_photos')).toBe(true);
      expect(writtenStores.has('patient_photo_blobs')).toBe(true);
      expect(writtenStores.has('patients')).toBe(false);
      expect(writtenStores.has('sync_queue')).toBe(false);
    });

    it('PROBE-W3: native Capacitor Filesystem mode writes zero pending ops or sync_queue entries', async () => {
      // Mock Capacitor native platform
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
      vi.spyOn(Capacitor, 'convertFileSrc').mockImplementation((uri) => `http://localhost/_capacitor_file_${uri}`);

      (Filesystem.mkdir as any).mockClear();
      (Filesystem.writeFile as any).mockClear();
      (Filesystem.getUri as any).mockClear();

      mockStores['keyval'].set('nk_pending_ops', []);

      const sampleBlob = new Blob(['native-camera-blob'], { type: 'image/jpeg' });
      const saved = await savePatientPhoto('1002', sampleBlob);

      expect(saved.localUri).toBe('http://localhost/_capacitor_file_file:///data/photos/test.jpg');
      expect(Filesystem.writeFile).toHaveBeenCalledTimes(1);

      // Verify no pending ops or sync_queue written
      const pendingOps = await getPendingOps();
      expect(pendingOps).toHaveLength(0);
      expect(mockStores['sync_queue'].size).toBe(0);

      // Metadata saved to patient_photos, but binary blob bypassed IndexedDB (went to Filesystem)
      const blobPuts = putSpy.mock.calls.filter((c: any[]) => c[0] === 'patient_photo_blobs');
      expect(blobPuts).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 2. PROBE PATIENT DEMOGRAPHIC & CLINICAL RECORD PURITY
  // ==========================================================================
  describe('2. Patient Table Purity & Data Isolation Probing', () => {
    it('PROBE-D1: saving photos NEVER alters patients table rows or injects photo binaries', async () => {
      const originalPatient = {
        id: 'pat-1001',
        card_number: '1001',
        name: 'Ramesh Kumar',
        age: 48,
        gender: 'Male',
        phone: '9876543210',
        village: 'Kalyanpur',
        created_at: '2026-09-10T08:00:00.000Z',
        updated_at: '2026-09-10T08:00:00.000Z',
      };
      mockStores['patients'].set('pat-1001', { ...originalPatient });

      const sampleBlob = new Blob(['image-binary-stream'], { type: 'image/jpeg' });
      for (let i = 0; i < 3; i++) {
        await savePatientPhoto('1001', sampleBlob);
      }

      // Verify patient record in patients table is 100% identical
      const storedPatient = mockStores['patients'].get('pat-1001');
      expect(storedPatient).toEqual(originalPatient);

      // Exhaustively check all keys for zero photo contamination
      const patientKeys = Object.keys(storedPatient);
      for (const key of patientKeys) {
        expect(key).not.toMatch(/photo|image|blob|attachment|file|thumb/i);
        const val = storedPatient[key];
        if (typeof val === 'string') {
          expect(val).not.toContain('data:image');
          expect(val).not.toContain('PHT-');
          expect(val).not.toContain('.jpg');
        }
      }

      // Verify putSpy was NEVER called with 'patients'
      const patientPuts = putSpy.mock.calls.filter((c: any[]) => c[0] === 'patients');
      expect(patientPuts).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 3. PROBE SYNC ROUTINES: ZERO-SYNC ADVERSARIAL VERIFICATION
  // ==========================================================================
  describe('3. Sync Routines Zero-Sync Adversarial Probing (syncDelta & fullDataSync)', () => {
    it('PROBE-S1: DEFAULT_SYNC_TABLES strictly excludes patient_photos and patient_photo_blobs', () => {
      expect(DEFAULT_SYNC_TABLES).not.toContain('patient_photos');
      expect(DEFAULT_SYNC_TABLES).not.toContain('patient_photo_blobs');
      expect(DEFAULT_SYNC_TABLES).not.toContain('photos');
      expect(DEFAULT_SYNC_TABLES).not.toContain('patient_photos_blobs');
    });

    it('PROBE-S2: syncDelta payload strictly excludes photo tables and transmits zero photo data', async () => {
      // Save local photos
      const sampleBlob = new Blob(['local-photo-secret'], { type: 'image/jpeg' });
      await savePatientPhoto('1001', sampleBlob);

      let deltaRequestBody: any = null;
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init?: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/api/health')) {
          return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
        }
        if (urlStr.includes('/api/sync/delta')) {
          deltaRequestBody = JSON.parse(init?.body || '{}');
          return new Response(
            JSON.stringify({
              serverTime: '2026-09-19T18:00:00.000Z',
              deltas: {
                patients: [],
                visits: [],
              },
            }),
            { status: 200 }
          );
        }
        return new Response('Not found', { status: 404 });
      });

      const result = await syncDelta();
      expect(result.success).toBe(true);

      // Verify request payload to /api/sync/delta
      expect(deltaRequestBody).not.toBeNull();
      expect(deltaRequestBody.tables).toBeDefined();
      expect(deltaRequestBody.tables).not.toContain('patient_photos');
      expect(deltaRequestBody.tables).not.toContain('patient_photo_blobs');

      // Verify payload string contains zero photo IDs or filenames
      const rawBody = JSON.stringify(deltaRequestBody);
      expect(rawBody).not.toContain('PHT-');
      expect(rawBody).not.toContain('patient_photos');
      expect(rawBody).not.toContain('local-photo-secret');

      fetchSpy.mockRestore();
    });

    it('PROBE-S3: hostile server response injecting patient_photos deltas does NOT overwrite local photo store', async () => {
      // Save legitimate local photo
      const sampleBlob = new Blob(['authentic-local-photo'], { type: 'image/jpeg' });
      const localPhoto = await savePatientPhoto('1001', sampleBlob);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/api/health')) {
          return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
        }
        if (urlStr.includes('/api/sync/delta')) {
          return new Response(
            JSON.stringify({
              serverTime: '2026-09-19T18:00:00.000Z',
              deltas: {
                // Hostile/malicious injection attempt
                patient_photos: [
                  {
                    id: localPhoto.id,
                    cardNumber: '1001',
                    fileName: 'MALICIOUS_OVERWRITE.jpg',
                    createdAt: '2099-01-01T00:00:00.000Z',
                  },
                ],
              },
            }),
            { status: 200 }
          );
        }
        return new Response('Not found', { status: 404 });
      });

      await syncDelta();

      // Verify local photo store was NOT altered by the malicious remote delta
      const photos = await getPatientPhotos('1001');
      expect(photos).toHaveLength(1);
      expect(photos[0].id).toBe(localPhoto.id);
      expect(photos[0].fileName).toBe(localPhoto.fileName);
      expect(photos[0].fileName).not.toBe('MALICIOUS_OVERWRITE.jpg');

      fetchSpy.mockRestore();
    });

    it('PROBE-S4: fullDataSync NEVER queries or pulls patient_photos or patient_photo_blobs', async () => {
      // Save local photos
      const sampleBlob = new Blob(['local-photo-data'], { type: 'image/jpeg' });
      await savePatientPhoto('1001', sampleBlob);

      const queriedTables: string[] = [];
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init?: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/api/health')) {
          return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
        }
        if (urlStr.includes('/rpc/query') || urlStr.includes('/query')) {
          const body = JSON.parse(init?.body || '{}');
          if (body.table) {
            queriedTables.push(body.table);
          }
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      const syncRes = await fullDataSync();
      expect(syncRes.success).toBe(true);

      // Verify all tables queried during fullDataSync
      expect(queriedTables.length).toBeGreaterThan(0);
      expect(queriedTables).not.toContain('patient_photos');
      expect(queriedTables).not.toContain('patient_photo_blobs');
      expect(queriedTables).not.toContain('photos');

      fetchSpy.mockRestore();
    });
  });

  // ==========================================================================
  // 4. PROBE DELETION BLAST RADIUS & SURGICAL TARGET VERIFICATION
  // ==========================================================================
  describe('4. Deletion Blast Radius & Surgical Target Probing', () => {
    it('PROBE-DEL1: deletePatientPhoto only removes the targeted photo and leaves patient demographic & clinical records intact', async () => {
      // 1. Seed patient demographics
      const patient = {
        id: 'pat-1001',
        card_number: '1001',
        name: 'Sunita Sharma',
        age: 32,
        gender: 'Female',
        phone: '9988776655',
        village: 'Bhatinda',
      };
      mockStores['patients'].set('pat-1001', { ...patient });

      // 2. Seed clinical visit & prescription
      const visit = {
        id: 'vis-5001',
        patient_id: 'pat-1001',
        card_number: '1001',
        doctor_name: 'Dr. Mehta',
        symptoms: 'Fever, cough',
        diagnosis: 'URTI',
        created_at: '2026-09-18T10:00:00.000Z',
      };
      mockStores['visits'].set('vis-5001', { ...visit });

      // 3. Attach 3 photos for patient 1001
      const blobA = new Blob(['photo-A-bytes'], { type: 'image/jpeg' });
      const blobB = new Blob(['photo-B-bytes'], { type: 'image/jpeg' });
      const blobC = new Blob(['photo-C-bytes'], { type: 'image/jpeg' });

      const photoA = await savePatientPhoto('1001', blobA);
      await new Promise((r) => setTimeout(r, 10));
      const photoB = await savePatientPhoto('1001', blobB);
      await new Promise((r) => setTimeout(r, 10));
      const photoC = await savePatientPhoto('1001', blobC);

      const beforeDeletePhotos = await getPatientPhotos('1001');
      expect(beforeDeletePhotos).toHaveLength(3);

      // 4. Delete photo B specifically
      const deleteResult = await deletePatientPhoto(photoB.id, '1001');
      expect(deleteResult).toBe(true);

      // 5. Verify Photo B was removed from stores
      expect(mockStores['patient_photos'].has(photoB.id)).toBe(false);
      expect(mockStores['patient_photo_blobs'].has(photoB.id)).toBe(false);

      // 6. Verify Photo A and Photo C remain 100% intact
      const afterDeletePhotos = await getPatientPhotos('1001');
      expect(afterDeletePhotos).toHaveLength(2);
      expect(afterDeletePhotos.map((p) => p.id)).toEqual(expect.arrayContaining([photoA.id, photoC.id]));
      expect(afterDeletePhotos.some((p) => p.id === photoB.id)).toBe(false);

      // 7. Verify Patient Demographics in 'patients' store is 100% intact
      const patientAfter = mockStores['patients'].get('pat-1001');
      expect(patientAfter).toEqual(patient);

      // 8. Verify Clinical Visits in 'visits' store is 100% intact
      const visitAfter = mockStores['visits'].get('vis-5001');
      expect(visitAfter).toEqual(visit);

      // 9. Verify NO delete operations were queued in nk_pending_ops or sync_queue
      const pendingOps = await getPendingOps();
      expect(pendingOps).toHaveLength(0);
      expect(mockStores['sync_queue'].size).toBe(0);

      // 10. Verify deleteSpy was NEVER called on 'patients' or 'visits'
      const deletedStores = deleteSpy.mock.calls.map((c: any[]) => c[0]);
      expect(deletedStores).not.toContain('patients');
      expect(deletedStores).not.toContain('visits');
    });

    it('PROBE-DEL2: multi-patient cross-deletion isolation: deleting Patient A photos leaves Patient B untouched', async () => {
      const patientA = { id: 'pat-A', card_number: '1001', name: 'Patient A' };
      const patientB = { id: 'pat-B', card_number: '1002', name: 'Patient B' };
      mockStores['patients'].set('pat-A', patientA);
      mockStores['patients'].set('pat-B', patientB);

      const blob = new Blob(['photo-sample'], { type: 'image/jpeg' });
      const photoA1 = await savePatientPhoto('1001', blob);
      const photoA2 = await savePatientPhoto('1001', blob);
      const photoB1 = await savePatientPhoto('1002', blob);
      const photoB2 = await savePatientPhoto('1002', blob);

      // Delete all photos for Patient A
      const deletedCount = await deletePhotosForPatient('1001');
      expect(deletedCount).toBe(2);

      // Patient A has 0 photos
      const photosA = await getPatientPhotos('1001');
      expect(photosA).toHaveLength(0);

      // Patient B STILL HAS 2 photos
      const photosB = await getPatientPhotos('1002');
      expect(photosB).toHaveLength(2);
      expect(photosB.map((p) => p.id)).toEqual(expect.arrayContaining([photoB1.id, photoB2.id]));

      // Both patient records remain 100% intact in patients store
      expect(mockStores['patients'].get('pat-A')).toEqual(patientA);
      expect(mockStores['patients'].get('pat-B')).toEqual(patientB);
    });

    it('PROBE-DEL3: deleting non-existent photo ID is safe, non-crashing, and leaves all stores intact', async () => {
      const patient = { id: 'pat-1001', card_number: '1001', name: 'Safe Patient' };
      mockStores['patients'].set('pat-1001', patient);

      const blob = new Blob(['photo'], { type: 'image/jpeg' });
      const existingPhoto = await savePatientPhoto('1001', blob);

      // Attempt to delete non-existent photo ID
      const result = await deletePatientPhoto('PHT-00000000-0000-0000-0000-000000000000', '1001');
      expect(result).toBe(true); // Graceful deletion pass

      // Existing photo still present
      const photos = await getPatientPhotos('1001');
      expect(photos).toHaveLength(1);
      expect(photos[0].id).toBe(existingPhoto.id);

      // Patient record untouched
      expect(mockStores['patients'].get('pat-1001')).toEqual(patient);
    });
  });

  // ==========================================================================
  // 5. PROBE QUOTA ERROR SAFETY & ZERO DAMAGE
  // ==========================================================================
  describe('5. Quota Exceeded Safety & Error Boundary Probing', () => {
    it('PROBE-Q1: simulated disk quota error fails cleanly without corrupting patient records or queueing ops', async () => {
      const patient = { id: 'pat-1001', card_number: '1001', name: 'Quota Patient' };
      mockStores['patients'].set('pat-1001', patient);

      // Force put to throw QuotaExceededError
      putSpy.mockImplementation(async (storeName: string) => {
        if (storeName === 'patient_photos' || storeName === 'patient_photo_blobs') {
          const quotaErr = new Error('The quota has been exceeded.');
          quotaErr.name = 'QuotaExceededError';
          throw quotaErr;
        }
        return undefined;
      });

      const blob = new Blob(['huge-photo-attempt'], { type: 'image/jpeg' });
      await expect(savePatientPhoto('1001', blob)).rejects.toThrow(
        /Device storage is full/i
      );

      // Verify no pending ops queued
      const pendingOps = await getPendingOps();
      expect(pendingOps).toHaveLength(0);

      // Verify patient record untouched
      expect(mockStores['patients'].get('pat-1001')).toEqual(patient);
    });
  });
});
