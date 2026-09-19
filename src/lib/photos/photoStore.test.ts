import { describe, it, expect, beforeEach } from 'vitest';
import {
  savePatientPhoto,
  getPatientPhotos,
  getPatientPhotoBlob,
  getPatientPhotoUrl,
  deletePatientPhoto,
  generatePhotoId,
  isQuotaExceededError,
  clearPhotoStoreForTesting,
} from './photoStore';
import { calculateTargetDimensions } from './imageOptimizer';
import { DEFAULT_SYNC_TABLES } from '../sync';

describe('Photo Store & Image Optimization', () => {
  beforeEach(() => {
    clearPhotoStoreForTesting();
  });

  describe('1. Dimension Calculation & Aspect Ratio Preservation', () => {
    it('scales down landscape images exceeding 2048px preserving aspect ratio', () => {
      const { width, height } = calculateTargetDimensions(4000, 3000, 2048);
      expect(width).toBe(2048);
      expect(height).toBe(1536);
    });

    it('scales down portrait images exceeding 2048px preserving aspect ratio', () => {
      const { width, height } = calculateTargetDimensions(3000, 4000, 2048);
      expect(width).toBe(1536);
      expect(height).toBe(2048);
    });

    it('scales down square images exceeding 2048px', () => {
      const { width, height } = calculateTargetDimensions(3000, 3000, 2048);
      expect(width).toBe(2048);
      expect(height).toBe(2048);
    });

    it('does not upscale images smaller than max dimension', () => {
      const { width, height } = calculateTargetDimensions(1200, 800, 2048);
      expect(width).toBe(1200);
      expect(height).toBe(800);
    });

    it('calculates 200px thumbnail dimensions maintaining aspect ratio', () => {
      const landscapeThumb = calculateTargetDimensions(4000, 3000, 200);
      expect(landscapeThumb.width).toBe(200);
      expect(landscapeThumb.height).toBe(150);

      const portraitThumb = calculateTargetDimensions(3000, 4000, 200);
      expect(portraitThumb.width).toBe(150);
      expect(portraitThumb.height).toBe(200);

      const smallThumb = calculateTargetDimensions(100, 100, 200);
      expect(smallThumb.width).toBe(100);
      expect(smallThumb.height).toBe(100);
    });

    it('gracefully handles boundary inputs like 0 or negative dimensions', () => {
      const res = calculateTargetDimensions(0, -10, 2048);
      expect(res.width).toBeGreaterThanOrEqual(1);
      expect(res.height).toBeGreaterThanOrEqual(1);
    });
  });

  describe('2. Photo Identifier & Quota Error Detection', () => {
    it('generates unique photo IDs prefixed with PHT-', () => {
      const id1 = generatePhotoId();
      const id2 = generatePhotoId();

      expect(id1.startsWith('PHT-')).toBe(true);
      expect(id2.startsWith('PHT-')).toBe(true);
      expect(id1).not.toBe(id2);
    });

    it('identifies standard QuotaExceededError varieties', () => {
      expect(isQuotaExceededError({ name: 'QuotaExceededError' })).toBe(true);
      expect(isQuotaExceededError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
      expect(isQuotaExceededError({ code: 22 })).toBe(true);
      expect(isQuotaExceededError({ code: 1014 })).toBe(true);
      expect(isQuotaExceededError(new Error('Storage quota exceeded'))).toBe(true);
      expect(isQuotaExceededError(new Error('no space left on device: enospc'))).toBe(true);
      expect(isQuotaExceededError(new Error('Network connection timeout'))).toBe(false);
      expect(isQuotaExceededError(null)).toBe(false);
      expect(isQuotaExceededError(undefined)).toBe(false);
    });
  });

  describe('3. Photo Store Save, List, Get, Delete Operations', () => {
    it('saves a photo for a patient with valid metadata and binary blob', async () => {
      const sampleBlob = new Blob(['sample-image-data'], { type: 'image/jpeg' });
      const photo = await savePatientPhoto('1001', sampleBlob);

      expect(photo.id).toMatch(/^PHT-/);
      expect(photo.cardNumber).toBe('1001');
      expect(photo.fileName).toBe(`${photo.id}.jpg`);
      expect(photo.sizeBytes).toBeGreaterThan(0);
      expect(typeof photo.createdAt).toBe('string');
      expect(photo.width).toBeGreaterThan(0);
      expect(photo.height).toBeGreaterThan(0);

      const photos = await getPatientPhotos('1001');
      expect(photos.length).toBe(1);
      expect(photos[0].id).toBe(photo.id);
    });

    it('supports unlimited photos without arbitrary count limits', async () => {
      const sampleBlob = new Blob(['dummy-binary'], { type: 'image/jpeg' });

      // Save 25 photos
      for (let i = 0; i < 25; i++) {
        await savePatientPhoto('1001', sampleBlob);
      }

      const photos = await getPatientPhotos('1001');
      expect(photos.length).toBe(25);
    });

    it('sorts photos newest-first (createdAt descending)', async () => {
      const blob1 = new Blob(['photo-1'], { type: 'image/jpeg' });
      const blob2 = new Blob(['photo-2'], { type: 'image/jpeg' });

      const p1 = await savePatientPhoto('1001', blob1);
      // Small artificial delay to guarantee distinct timestamps
      await new Promise((r) => setTimeout(r, 10));
      const p2 = await savePatientPhoto('1001', blob2);

      const photos = await getPatientPhotos('1001');
      expect(photos.length).toBe(2);
      expect(photos[0].id).toBe(p2.id); // Newest first
      expect(photos[1].id).toBe(p1.id);
    });

    it('retrieves binary blob and url for saved photo', async () => {
      const sampleBlob = new Blob(['my-clinical-photo-payload'], { type: 'image/jpeg' });
      const photo = await savePatientPhoto('1001', sampleBlob);

      const retrievedBlob = await getPatientPhotoBlob(photo.id);
      expect(retrievedBlob).not.toBeNull();

      const url = await getPatientPhotoUrl(photo);
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);

      const nonExistentBlob = await getPatientPhotoBlob('PHT-does-not-exist');
      expect(nonExistentBlob).toBeNull();
    });

    it('safely deletes single photo without affecting other photos', async () => {
      const blob = new Blob(['clinical-snap'], { type: 'image/jpeg' });
      const p1 = await savePatientPhoto('1001', blob);
      const p2 = await savePatientPhoto('1001', blob);
      const p3 = await savePatientPhoto('1001', blob);

      let photos = await getPatientPhotos('1001');
      expect(photos.length).toBe(3);

      const deleted = await deletePatientPhoto(p2.id, '1001');
      expect(deleted).toBe(true);

      photos = await getPatientPhotos('1001');
      expect(photos.length).toBe(2);
      expect(photos.some((p) => p.id === p2.id)).toBe(false);
      expect(photos.some((p) => p.id === p1.id)).toBe(true);
      expect(photos.some((p) => p.id === p3.id)).toBe(true);
    });
  });

  describe('4. Multi-Patient Isolation & ID Normalization', () => {
    it('strictly isolates photos between different patients', async () => {
      const blob = new Blob(['image'], { type: 'image/jpeg' });

      const pA1 = await savePatientPhoto('1001', blob);
      const pA2 = await savePatientPhoto('1001', blob);
      const pB1 = await savePatientPhoto('1002', blob);

      const photosA = await getPatientPhotos('1001');
      const photosB = await getPatientPhotos('1002');

      expect(photosA.length).toBe(2);
      expect(photosB.length).toBe(1);

      expect(photosA.map((p) => p.id)).toEqual(expect.arrayContaining([pA1.id, pA2.id]));
      expect(photosB[0].id).toBe(pB1.id);

      // Delete Patient A's photo
      await deletePatientPhoto(pA1.id, '1001');
      const photosAAfter = await getPatientPhotos('1001');
      const photosBAfter = await getPatientPhotos('1002');

      expect(photosAAfter.length).toBe(1);
      expect(photosBAfter.length).toBe(1);
      expect(photosBAfter[0].id).toBe(pB1.id);
    });

    it('normalizes card number with .0 suffix seamlessly', async () => {
      const blob = new Blob(['image'], { type: 'image/jpeg' });

      // Save using '1005.0'
      const photo = await savePatientPhoto('1005.0', blob);
      expect(photo.cardNumber).toBe('1005');

      // Query using '1005'
      const photosClean = await getPatientPhotos('1005');
      expect(photosClean.length).toBe(1);
      expect(photosClean[0].id).toBe(photo.id);

      // Query using '1005.0'
      const photosSuffix = await getPatientPhotos('1005.0');
      expect(photosSuffix.length).toBe(1);
      expect(photosSuffix[0].id).toBe(photo.id);
    });
  });

  describe('5. Zero-Sync Isolation Verification', () => {
    it('omits patient_photos and patient_photo_blobs from DEFAULT_SYNC_TABLES', () => {
      expect(DEFAULT_SYNC_TABLES).not.toContain('patient_photos');
      expect(DEFAULT_SYNC_TABLES).not.toContain('patient_photo_blobs');
      expect(DEFAULT_SYNC_TABLES).not.toContain('photos');
    });

    it('throws when attempting to save photo without patient card number', async () => {
      const blob = new Blob(['test'], { type: 'image/jpeg' });
      await expect(savePatientPhoto('', blob)).rejects.toThrow(
        /Valid patient card number is required/i
      );
    });
  });
});
