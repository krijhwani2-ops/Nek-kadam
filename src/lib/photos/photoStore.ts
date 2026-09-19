// ─── Nek Kadam: Patient Profile Device-Local Multi-Photo Attachment Engine ───
// Zero-Sync: Photos are stored strictly on the local device, completely isolated
// from database sync, pending ops, and cloud replication routines.

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { dbPromise, cleanPatientId } from '../db';
import { optimizeImage } from './imageOptimizer';

export interface PatientPhoto {
  id: string;                  // Format: 'PHT-<uuid>'
  cardNumber: string;          // Normalized cleanPatientId (e.g. '1001')
  fileName: string;            // 'PHT-<uuid>.jpg'
  createdAt: string;           // ISO 8601 string
  sizeBytes: number;           // File size in bytes
  width: number;               // Pixel width (<= 2048)
  height: number;              // Pixel height (<= 2048)
  thumbnailDataUrl?: string;   // 200px JPEG thumbnail base64 data URL
  localUri?: string;           // Capacitor converted file URL or object URL
}

// In-memory cache for fast querying, synchronous fallbacks, and test execution
const inMemoryPhotoMetadata = new Map<string, PatientPhoto>();
const inMemoryPhotoBlobs = new Map<string, Blob>();

/**
 * Checks if an error is an IndexedDB or disk QuotaExceededError.
 */
export function isQuotaExceededError(err: any): boolean {
  if (!err) return false;
  return (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22 ||
    err.code === 1014 ||
    /quota|storage full|no space|enospc/i.test(String(err.message || err))
  );
}

/**
 * Generates a unique photo ID matching the pattern 'PHT-<uuid>'.
 */
export function generatePhotoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `PHT-${crypto.randomUUID()}`;
  }
  return `PHT-${'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  })}`;
}

/**
 * Converts a Blob to a raw base64 string for Capacitor Filesystem storage.
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = (reader.result as string) || '';
      const base64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to encode blob to base64'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Converts a base64 string back to a JPEG Blob.
 */
function base64ToBlob(base64: string, mimeType = 'image/jpeg'): Blob {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

/**
 * Saves a clinical photo attachment strictly to the local device.
 * Automatically resizes >2048px to 2048px, compresses to JPEG 0.82, generates 200px thumbnail,
 * strips EXIF metadata, and isolates from database sync.
 */
export async function savePatientPhoto(cardNumber: string, file: File | Blob): Promise<PatientPhoto> {
  const cleanNumber = cleanPatientId(cardNumber);
  if (!cleanNumber) {
    throw new Error('Valid patient card number is required to attach photos.');
  }

  // Optimize and strip EXIF
  const optimized = await optimizeImage(file);
  const id = generatePhotoId();
  const fileName = `${id}.jpg`;
  const createdAt = new Date().toISOString();

  const photo: PatientPhoto = {
    id,
    cardNumber: cleanNumber,
    fileName,
    createdAt,
    sizeBytes: optimized.fullSize,
    width: optimized.fullWidth,
    height: optimized.fullHeight,
    thumbnailDataUrl: optimized.thumbnailDataUrl,
  };

  try {
    const isNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();

    if (isNative) {
      // 1. Android / iOS Native: Capacitor Filesystem (Directory.Data/photos/)
      await Filesystem.mkdir({
        path: 'photos',
        directory: Directory.Data,
        recursive: true,
      }).catch(() => {});

      const base64Data = await blobToBase64(optimized.fullBlob);
      await Filesystem.writeFile({
        path: `photos/${fileName}`,
        data: base64Data,
        directory: Directory.Data,
      });

      const uriResult = await Filesystem.getUri({
        path: `photos/${fileName}`,
        directory: Directory.Data,
      });

      photo.localUri = Capacitor.convertFileSrc(uriResult.uri);
    } else {
      // 2. Web / Desktop Browser Fallback: IndexedDB Blob store
      const db = await dbPromise;
      if (db && db.objectStoreNames.contains('patient_photo_blobs')) {
        await db.put('patient_photo_blobs', optimized.fullBlob, id);
      }
    }

    // 3. Save metadata record directly to IndexedDB 'patient_photos' (Zero sync, NO db.from)
    const db = await dbPromise;
    if (db && db.objectStoreNames.contains('patient_photos')) {
      await db.put('patient_photos', photo);
    }

    // 4. Update in-memory caches
    inMemoryPhotoMetadata.set(id, photo);
    inMemoryPhotoBlobs.set(id, optimized.fullBlob);

    return photo;
  } catch (err: any) {
    // Quota safety handling
    if (isQuotaExceededError(err)) {
      // Attempt cleanup
      try {
        if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
          await Filesystem.deleteFile({ path: `photos/${fileName}`, directory: Directory.Data }).catch(() => {});
        }
      } catch {}
      throw new Error('Device storage is full. Please free up space on this device to save additional photos.');
    }
    throw err;
  }
}

/**
 * Retrieves all photos for a given patient card number, sorted newest-first.
 * Supports unlimited photos with no artificial caps.
 */
export async function getPatientPhotos(cardNumber: string): Promise<PatientPhoto[]> {
  const cleanNumber = cleanPatientId(cardNumber);
  if (!cleanNumber) return [];

  const photoMap = new Map<string, PatientPhoto>();

  try {
    const db = await dbPromise;
    if (db && db.objectStoreNames.contains('patient_photos')) {
      let records: PatientPhoto[] = [];
      try {
        // Query via index if available
        const tx = db.transaction('patient_photos', 'readonly');
        const index = tx.store.index('by_cardNumber');
        records = await index.getAll(cleanNumber);
      } catch {
        // Fallback to getAll and filter
        const all = await db.getAll('patient_photos');
        records = (all || []).filter((p: PatientPhoto) => cleanPatientId(p.cardNumber) === cleanNumber);
      }

      for (const r of records) {
        if (r && r.id) photoMap.set(r.id, r);
      }
    }
  } catch (e) {
    console.warn('[PHOTO STORE] Reading patient photos from IndexedDB failed:', e);
  }

  // Merge with in-memory cache
  for (const [id, record] of inMemoryPhotoMetadata.entries()) {
    if (cleanPatientId(record.cardNumber) === cleanNumber) {
      photoMap.set(id, record);
    }
  }

  const result = Array.from(photoMap.values());
  // Sort newest-first (createdAt descending)
  result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return result;
}

/**
 * Retrieves the full resolution binary Blob for a specific photo.
 */
export async function getPatientPhotoBlob(photoId: string): Promise<Blob | null> {
  // Check memory cache first
  if (inMemoryPhotoBlobs.has(photoId)) {
    return inMemoryPhotoBlobs.get(photoId)!;
  }

  try {
    const isNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
    if (isNative) {
      const photo = inMemoryPhotoMetadata.get(photoId);
      const fileName = photo ? photo.fileName : `${photoId}.jpg`;
      const fileResult = await Filesystem.readFile({
        path: `photos/${fileName}`,
        directory: Directory.Data,
      });
      if (typeof fileResult.data === 'string') {
        const blob = base64ToBlob(fileResult.data, 'image/jpeg');
        inMemoryPhotoBlobs.set(photoId, blob);
        return blob;
      }
    } else {
      const db = await dbPromise;
      if (db && db.objectStoreNames.contains('patient_photo_blobs')) {
        const blob = await db.get('patient_photo_blobs', photoId);
        if (blob) {
          inMemoryPhotoBlobs.set(photoId, blob);
          return blob;
        }
      }
    }
  } catch (e) {
    console.warn('[PHOTO STORE] Failed to read photo blob for', photoId, e);
  }

  return null;
}

/**
 * Returns a displayable URL (local file URL, blob URL, or thumbnail fallback) for a photo.
 */
export async function getPatientPhotoUrl(photo: PatientPhoto): Promise<string> {
  if (photo.localUri) {
    return photo.localUri;
  }

  const blob = await getPatientPhotoBlob(photo.id);
  if (blob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(blob);
  }

  return photo.thumbnailDataUrl || '';
}

/**
 * Safely deletes a single photo attachment from the local device and metadata store.
 * Absolutely NEVER deletes or alters patient demographic, visit, or prescription data.
 */
export async function deletePatientPhoto(photoId: string, _cardNumber?: string): Promise<boolean> {
  // 1. Remove from memory caches
  const photo = inMemoryPhotoMetadata.get(photoId);
  inMemoryPhotoMetadata.delete(photoId);
  inMemoryPhotoBlobs.delete(photoId);

  try {
    const isNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
    const fileName = photo ? photo.fileName : `${photoId}.jpg`;

    if (isNative) {
      await Filesystem.deleteFile({
        path: `photos/${fileName}`,
        directory: Directory.Data,
      }).catch(() => {});
    } else {
      const db = await dbPromise;
      if (db && db.objectStoreNames.contains('patient_photo_blobs')) {
        await db.delete('patient_photo_blobs', photoId);
      }
    }

    const db = await dbPromise;
    if (db && db.objectStoreNames.contains('patient_photos')) {
      await db.delete('patient_photos', photoId);
    }

    return true;
  } catch (e) {
    console.error('[PHOTO STORE] Failed to delete photo', photoId, e);
    return false;
  }
}

/**
 * Deletes all local photo attachments for a patient.
 */
export async function deletePhotosForPatient(cardNumber: string): Promise<number> {
  const photos = await getPatientPhotos(cardNumber);
  let deletedCount = 0;
  for (const photo of photos) {
    const ok = await deletePatientPhoto(photo.id, cardNumber);
    if (ok) deletedCount++;
  }
  return deletedCount;
}

/**
 * Clears in-memory caches for testing.
 */
export function clearPhotoStoreForTesting(): void {
  inMemoryPhotoMetadata.clear();
  inMemoryPhotoBlobs.clear();
}
