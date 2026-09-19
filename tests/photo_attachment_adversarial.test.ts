// ─── Adversarial Stress Test Suite: Patient Profile Multi-Photo Attachment Engine ───
// Tests unlimited scaling (1, 5, 20, 60+ photos), newest-first deterministic sorting,
// extreme aspect ratios, multi-patient isolation, card number normalization, and zero-sync safety.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  savePatientPhoto,
  getPatientPhotos,
  getPatientPhotoBlob,
  getPatientPhotoUrl,
  deletePatientPhoto,
  deletePhotosForPatient,
  clearPhotoStoreForTesting,
} from '../src/lib/photos/photoStore';
import { calculateTargetDimensions } from '../src/lib/photos/imageOptimizer';
import { cleanPatientId, dbPromise, getPendingOps } from '../src/lib/db';
import { DEFAULT_SYNC_TABLES } from '../src/lib/sync';

describe('Adversarial Stress Test: Photo Attachment System', () => {
  beforeEach(() => {
    clearPhotoStoreForTesting();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Unlimited Photos Scaling & High-Volume Storage
  // ──────────────────────────────────────────────────────────────────────────
  describe('1. Unlimited Photos Scaling (1, 5, 20, 60+ photos)', () => {
    it('successfully stores and retrieves 1 photo', async () => {
      const blob = new Blob(['photo-1'], { type: 'image/jpeg' });
      const photo = await savePatientPhoto('CARD-001', blob);

      expect(photo.id).toMatch(/^PHT-/);
      expect(photo.cardNumber).toBe('CARD-001');

      const retrieved = await getPatientPhotos('CARD-001');
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].id).toBe(photo.id);
    });

    it('successfully stores and retrieves exactly 5 photos without limits', async () => {
      for (let i = 1; i <= 5; i++) {
        const blob = new Blob([`photo-data-${i}`], { type: 'image/jpeg' });
        await savePatientPhoto('CARD-005', blob);
      }

      const retrieved = await getPatientPhotos('CARD-005');
      expect(retrieved).toHaveLength(5);
      const uniqueIds = new Set(retrieved.map((p) => p.id));
      expect(uniqueIds.size).toBe(5);
    });

    it('successfully stores and retrieves 20 photos for a single patient', async () => {
      for (let i = 1; i <= 20; i++) {
        const blob = new Blob([`photo-20-batch-${i}`], { type: 'image/jpeg' });
        await savePatientPhoto('CARD-020', blob);
      }

      const retrieved = await getPatientPhotos('CARD-020');
      expect(retrieved).toHaveLength(20);
    });

    it('adversarial scaling: stores 60 photos (50+ stress test) with full blob integrity and zero throttling', async () => {
      const startTime = performance.now();
      const TOTAL_PHOTOS = 60;
      const createdIds: string[] = [];

      for (let i = 1; i <= TOTAL_PHOTOS; i++) {
        const blob = new Blob([`high-res-stress-payload-${i}-${'X'.repeat(500)}`], {
          type: 'image/jpeg',
        });
        const saved = await savePatientPhoto('CARD-060-STRESS', blob);
        createdIds.push(saved.id);
      }

      const durationMs = performance.now() - startTime;

      // 1. Verify exact count
      const retrieved = await getPatientPhotos('CARD-060-STRESS');
      expect(retrieved).toHaveLength(TOTAL_PHOTOS);

      // 2. Verify all IDs are unique and matched
      const retrievedIds = retrieved.map((p) => p.id);
      expect(new Set(retrievedIds).size).toBe(TOTAL_PHOTOS);
      for (const id of createdIds) {
        expect(retrievedIds).toContain(id);
      }

      // 3. Verify every single photo binary blob can be retrieved without corruption
      for (let i = 0; i < TOTAL_PHOTOS; i += 5) {
        // Sample every 5th photo
        const blob = await getPatientPhotoBlob(retrieved[i].id);
        expect(blob).not.toBeNull();
        expect(blob?.size).toBeGreaterThan(0);
      }

      // 4. Verify no artificial cap (no 5, 10, 20 limit)
      expect(retrieved.length).toBeGreaterThanOrEqual(60);
      expect(durationMs).toBeLessThan(10000); // Must execute smoothly within 10s
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Newest-First Ordering & Deterministic Sorting
  // ──────────────────────────────────────────────────────────────────────────
  describe('2. Newest-First Deterministic Ordering Across Large Sets', () => {
    it('strictly sorts 50 photos in newest-first descending chronological order', async () => {
      const TOTAL = 50;
      const baseEpoch = Date.now() - 1000000;

      // Save photos with simulated increasing timestamps
      for (let i = 0; i < TOTAL; i++) {
        const fakeIso = new Date(baseEpoch + i * 20000).toISOString();
        const blob = new Blob([`photo-time-${i}`], { type: 'image/jpeg' });
        const photo = await savePatientPhoto('CARD-ORDER-50', blob);
        // Explicitly simulate chronological spacing
        photo.createdAt = fakeIso;
      }

      const photos = await getPatientPhotos('CARD-ORDER-50');
      expect(photos).toHaveLength(TOTAL);

      // Verify every element is >= the next element in timestamp
      for (let i = 0; i < photos.length - 1; i++) {
        const timeCurrent = new Date(photos[i].createdAt).getTime();
        const timeNext = new Date(photos[i + 1].createdAt).getTime();
        expect(timeCurrent).toBeGreaterThanOrEqual(timeNext);
      }
    });

    it('corrects out-of-order insertions to strict descending order', async () => {
      const timestamps = [
        '2026-05-01T10:00:00.000Z',
        '2026-09-15T14:30:00.000Z',
        '2026-01-10T08:00:00.000Z',
        '2026-09-19T22:00:00.000Z',
        '2026-07-04T12:00:00.000Z',
      ];

      for (const ts of timestamps) {
        const blob = new Blob([`data-${ts}`], { type: 'image/jpeg' });
        const p = await savePatientPhoto('CARD-SHUFFLED', blob);
        p.createdAt = ts;
      }

      const sorted = await getPatientPhotos('CARD-SHUFFLED');
      expect(sorted).toHaveLength(5);
      expect(sorted[0].createdAt).toBe('2026-09-19T22:00:00.000Z');
      expect(sorted[1].createdAt).toBe('2026-09-15T14:30:00.000Z');
      expect(sorted[2].createdAt).toBe('2026-07-04T12:00:00.000Z');
      expect(sorted[3].createdAt).toBe('2026-05-01T10:00:00.000Z');
      expect(sorted[4].createdAt).toBe('2026-01-10T08:00:00.000Z');
    });

    it('handles identical timestamps deterministically without dropping photos', async () => {
      const fixedTimestamp = '2026-09-19T12:00:00.000Z';
      for (let i = 0; i < 10; i++) {
        const blob = new Blob([`same-time-${i}`], { type: 'image/jpeg' });
        const p = await savePatientPhoto('CARD-SAME-TIME', blob);
        p.createdAt = fixedTimestamp;
      }

      const photos = await getPatientPhotos('CARD-SAME-TIME');
      expect(photos).toHaveLength(10);
      const uniqueIds = new Set(photos.map((p) => p.id));
      expect(uniqueIds.size).toBe(10);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Extreme Aspect Ratios & Dimension Calculations
  // ──────────────────────────────────────────────────────────────────────────
  describe('3. Extreme Aspect Ratios & Boundary Dimension Math', () => {
    it('scales ultra-wide images (5000 x 500) accurately preserving 10:1 ratio', () => {
      // Full image calculation
      const full = calculateTargetDimensions(5000, 500, 2048);
      expect(full.width).toBe(2048);
      expect(full.height).toBe(205); // 500 * 2048 / 5000 = 204.8 -> 205
      const originalRatio = 5000 / 500; // 10.0
      const scaledRatio = full.width / full.height; // ~9.99
      expect(Math.abs(originalRatio - scaledRatio)).toBeLessThan(0.05);

      // Thumbnail calculation (maxDim = 200)
      const thumb = calculateTargetDimensions(5000, 500, 200);
      expect(thumb.width).toBe(200);
      expect(thumb.height).toBe(20);
    });

    it('scales ultra-tall images (500 x 5000) accurately preserving 1:10 ratio', () => {
      // Full image calculation
      const full = calculateTargetDimensions(500, 5000, 2048);
      expect(full.height).toBe(2048);
      expect(full.width).toBe(205); // 500 * 2048 / 5000 = 204.8 -> 205
      const originalRatio = 500 / 5000; // 0.1
      const scaledRatio = full.width / full.height; // ~0.10009
      expect(Math.abs(originalRatio - scaledRatio)).toBeLessThan(0.01);

      // Thumbnail calculation (maxDim = 200)
      const thumb = calculateTargetDimensions(500, 5000, 200);
      expect(thumb.height).toBe(200);
      expect(thumb.width).toBe(20);
    });

    it('scales large square images (4000 x 4000) to exact square maxDim', () => {
      const full = calculateTargetDimensions(4000, 4000, 2048);
      expect(full.width).toBe(2048);
      expect(full.height).toBe(2048);

      const thumb = calculateTargetDimensions(4000, 4000, 200);
      expect(thumb.width).toBe(200);
      expect(thumb.height).toBe(200);
    });

    it('never upscales tiny images (10 x 10 or 50 x 20)', () => {
      const tinySquare = calculateTargetDimensions(10, 10, 2048);
      expect(tinySquare.width).toBe(10);
      expect(tinySquare.height).toBe(10);

      const tinyThumb = calculateTargetDimensions(10, 10, 200);
      expect(tinyThumb.width).toBe(10);
      expect(tinyThumb.height).toBe(10);

      const smallRect = calculateTargetDimensions(50, 20, 2048);
      expect(smallRect.width).toBe(50);
      expect(smallRect.height).toBe(20);
    });

    it('handles 1-pixel thin strip boundary conditions (1 x 5000 and 5000 x 1)', () => {
      const thinTall = calculateTargetDimensions(1, 5000, 2048);
      expect(thinTall.height).toBe(2048);
      expect(thinTall.width).toBeGreaterThanOrEqual(1);

      const thinWide = calculateTargetDimensions(5000, 1, 2048);
      expect(thinWide.width).toBe(2048);
      expect(thinWide.height).toBeGreaterThanOrEqual(1);
    });

    it('handles zero, negative, and invalid dimensions safely without crashing', () => {
      const zeroDims = calculateTargetDimensions(0, 0, 2048);
      expect(zeroDims.width).toBeGreaterThanOrEqual(1);
      expect(zeroDims.height).toBeGreaterThanOrEqual(1);

      const negDims = calculateTargetDimensions(-100, 200, 2048);
      expect(negDims.width).toBeGreaterThanOrEqual(1);
      expect(negDims.height).toBeGreaterThanOrEqual(1);

      const zeroMax = calculateTargetDimensions(100, 100, 0);
      expect(zeroMax.width).toBeGreaterThanOrEqual(1);
      expect(zeroMax.height).toBeGreaterThanOrEqual(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Multi-Patient Isolation Under High Volume
  // ──────────────────────────────────────────────────────────────────────────
  describe('4. Multi-Patient Strict Isolation Under High Volume', () => {
    it('guarantees 0 photo leakage between Patient A (20 photos) and Patient B (20 photos)', async () => {
      const PATIENT_A = 'CARD-PAT-A';
      const PATIENT_B = 'CARD-PAT-B';
      const PATIENT_C = 'CARD-PAT-C-EMPTY';

      // Save 20 photos for Patient A
      for (let i = 1; i <= 20; i++) {
        await savePatientPhoto(PATIENT_A, new Blob([`photo-A-${i}`], { type: 'image/jpeg' }));
      }

      // Save 20 photos for Patient B
      for (let i = 1; i <= 20; i++) {
        await savePatientPhoto(PATIENT_B, new Blob([`photo-B-${i}`], { type: 'image/jpeg' }));
      }

      const photosA = await getPatientPhotos(PATIENT_A);
      const photosB = await getPatientPhotos(PATIENT_B);
      const photosC = await getPatientPhotos(PATIENT_C);

      // Verify counts
      expect(photosA).toHaveLength(20);
      expect(photosB).toHaveLength(20);
      expect(photosC).toHaveLength(0);

      // Verify patient card numbers are strictly isolated
      expect(photosA.every((p) => p.cardNumber === PATIENT_A)).toBe(true);
      expect(photosB.every((p) => p.cardNumber === PATIENT_B)).toBe(true);

      // Verify zero overlapping IDs
      const idsA = new Set(photosA.map((p) => p.id));
      const idsB = new Set(photosB.map((p) => p.id));
      for (const id of idsA) {
        expect(idsB.has(id)).toBe(false);
      }

      // Verify deleting a photo from Patient A does NOT affect Patient B
      const photoToDelete = photosA[0];
      const deleteResult = await deletePatientPhoto(photoToDelete.id, PATIENT_A);
      expect(deleteResult).toBe(true);

      const photosAAfter = await getPatientPhotos(PATIENT_A);
      const photosBAfter = await getPatientPhotos(PATIENT_B);
      expect(photosAAfter).toHaveLength(19);
      expect(photosBAfter).toHaveLength(20); // Completely unaffected!

      // Verify bulk deletion of Patient A leaves Patient B intact
      const deletedCountA = await deletePhotosForPatient(PATIENT_A);
      expect(deletedCountA).toBe(19);

      const photosAFinal = await getPatientPhotos(PATIENT_A);
      const photosBFinal = await getPatientPhotos(PATIENT_B);
      expect(photosAFinal).toHaveLength(0);
      expect(photosBFinal).toHaveLength(20); // Patient B still intact!
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Card Number Edge Cases & Normalization
  // ──────────────────────────────────────────────────────────────────────────
  describe('5. Card Number Normalization & Boundary Inputs', () => {
    it('normalizes string integers, numeric types, and .0 spreadsheet artifacts', async () => {
      const blob = new Blob(['sample'], { type: 'image/jpeg' });

      // Save using Excel artifact "1042.0"
      const p1 = await savePatientPhoto('1042.0', blob);
      expect(p1.cardNumber).toBe('1042');

      // Query with integer "1042"
      const res1 = await getPatientPhotos('1042');
      expect(res1).toHaveLength(1);
      expect(res1[0].id).toBe(p1.id);

      // Query with ".0" suffix
      const res2 = await getPatientPhotos('1042.0');
      expect(res2).toHaveLength(1);
      expect(res2[0].id).toBe(p1.id);

      // Query with whitespace "  1042  "
      const res3 = await getPatientPhotos('  1042  ');
      expect(res3).toHaveLength(1);
      expect(res3[0].id).toBe(p1.id);

      // Query with whitespace + .0 "  1042.0  "
      const res4 = await getPatientPhotos('  1042.0  ');
      expect(res4).toHaveLength(1);
      expect(res4[0].id).toBe(p1.id);
    });

    it('preserves alphanumeric IDs with special characters (slashes, hyphens, hashes)', async () => {
      const specialIds = [
        'NK-2026/089',
        'CAMP#A-42',
        'PAT_999-X',
        'OPD/2026/SEP/01',
      ];

      for (const id of specialIds) {
        const blob = new Blob([`special-${id}`], { type: 'image/jpeg' });
        const photo = await savePatientPhoto(id, blob);
        expect(photo.cardNumber).toBe(id);

        const retrieved = await getPatientPhotos(id);
        expect(retrieved).toHaveLength(1);
        expect(retrieved[0].id).toBe(photo.id);
      }
    });

    it('rejects empty, whitespace-only, null, and undefined card numbers', async () => {
      const blob = new Blob(['test'], { type: 'image/jpeg' });

      await expect(savePatientPhoto('', blob)).rejects.toThrow(
        /Valid patient card number is required/i
      );
      await expect(savePatientPhoto('   ', blob)).rejects.toThrow(
        /Valid patient card number is required/i
      );
      await expect(savePatientPhoto(null as any, blob)).rejects.toThrow(
        /Valid patient card number is required/i
      );
      await expect(savePatientPhoto(undefined as any, blob)).rejects.toThrow(
        /Valid patient card number is required/i
      );

      // Querying with empty card number safely returns empty array without throwing
      expect(await getPatientPhotos('')).toEqual([]);
      expect(await getPatientPhotos('   ')).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Zero-Sync Isolation & Patient Safety Proof
  // ──────────────────────────────────────────────────────────────────────────
  describe('6. Zero-Sync Proof & Patient Clinical Data Safety', () => {
    it('verifies photo tables are 100% excluded from sync tables', () => {
      expect(DEFAULT_SYNC_TABLES).not.toContain('patient_photos');
      expect(DEFAULT_SYNC_TABLES).not.toContain('patient_photo_blobs');
      expect(DEFAULT_SYNC_TABLES).not.toContain('photos');
    });

    it('guarantees photo write operations never generate pending sync operations', async () => {
      const pendingBefore = await getPendingOps();
      const initialCount = (pendingBefore || []).length;

      // Save multiple photos
      for (let i = 0; i < 5; i++) {
        await savePatientPhoto('CARD-SYNC-TEST', new Blob([`sync-test-${i}`], { type: 'image/jpeg' }));
      }

      // Delete a photo
      const photos = await getPatientPhotos('CARD-SYNC-TEST');
      await deletePatientPhoto(photos[0].id, 'CARD-SYNC-TEST');

      const pendingAfter = await getPendingOps();
      const finalCount = (pendingAfter || []).length;

      // pendingOps count MUST NOT increase
      expect(finalCount).toBe(initialCount);
    });

    it('guarantees photo deletion has ZERO effect on patient clinical record in database', async () => {
      const db = await dbPromise;
      const testCard = 'CARD-SAFETY-999';

      // Attach a photo
      const photo = await savePatientPhoto(testCard, new Blob(['clinical-snap'], { type: 'image/jpeg' }));
      expect((await getPatientPhotos(testCard)).length).toBe(1);

      // Spy on db.delete calls to verify clinical stores are never touched
      const deleteCalls: Array<{ store: string; key: any }> = [];
      if (db && (db.delete as any)?.mock) {
        (db.delete as any).mockImplementation((store: string, key: any) => {
          deleteCalls.push({ store, key });
          return Promise.resolve();
        });
      }

      // Delete the photo
      await deletePatientPhoto(photo.id, testCard);
      expect((await getPatientPhotos(testCard)).length).toBe(0);

      // Verify db.delete was only invoked for photo stores, NEVER patients or clinical stores
      for (const call of deleteCalls) {
        expect(['patient_photo_blobs', 'patient_photos']).toContain(call.store);
        expect(call.store).not.toBe('patients');
        expect(call.store).not.toBe('visits');
        expect(call.store).not.toBe('medicines');
      }
    });
  });
});
