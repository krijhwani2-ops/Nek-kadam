import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as faceapi from '@vladmandic/face-api';
import {
  EMBEDDING_DIMENSION,
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_MARGIN_GAP,
  normalizeVector,
  cosineSimilarity,
  cosineDistance,
  euclideanDistance,
  consolidateBurstEmbeddings,
  evaluateBiometricMatch
} from './vectorMath';
import {
  getModelPath,
  areModelsLoaded,
  loadFaceModels,
  detectFaceBox,
  extractEmbeddingFromCanvas,
  analyzeVideoFrame,
  resetFaceTrackingCache,
  playBiometricMatchSound,
  playAmbiguityAlertSound,
  triggerBiometricHaptic
} from './faceEngine';
import {
  loadEnrolledBiometrics,
  savePatientBiometric,
  getPatientBiometric,
  deletePatientBiometric,
  issueOfflineToken
} from './biometricStore';

describe('faceapi import and model integrity', () => {
  it('loads faceapi module and exports expected neural nets', () => {
    expect(faceapi).toBeDefined();
    expect(faceapi.nets).toBeDefined();
    expect(faceapi.nets.tinyFaceDetector).toBeDefined();
    expect(faceapi.nets.ssdMobilenetv1).toBeDefined();
    expect(faceapi.nets.faceLandmark68TinyNet).toBeDefined();
    expect(faceapi.nets.faceRecognitionNet).toBeDefined();
  });

  it('can mock fetch to load local model weights from public/models/face in tests', async () => {
    const modelsDir = path.resolve(__dirname, '../../../public/models/face');
    expect(fs.existsSync(modelsDir)).toBe(true);
    expect(fs.existsSync(path.join(modelsDir, 'tiny_face_detector_model-weights_manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(modelsDir, 'tiny_face_detector_model.bin'))).toBe(true);

    const customFetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      const filename = path.basename(urlStr.split('?')[0]);
      const filePath = path.join(modelsDir, filename);
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        return {
          ok: true,
          status: 200,
          json: async () => JSON.parse(buffer.toString('utf8')),
          arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
          text: async () => buffer.toString('utf8')
        } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = customFetch;
    faceapi.env.monkeyPatch({ fetch: customFetch as any });

    try {
      await (faceapi.tf as any).setBackend('cpu');
      await (faceapi.tf as any).ready();
      await faceapi.nets.tinyFaceDetector.loadFromUri('http://localhost/models/face');
      await faceapi.nets.faceLandmark68TinyNet.loadFromUri('http://localhost/models/face');
      await faceapi.nets.faceRecognitionNet.loadFromUri('http://localhost/models/face');
      expect(faceapi.nets.tinyFaceDetector.isLoaded).toBe(true);
      expect(faceapi.nets.faceLandmark68TinyNet.isLoaded).toBe(true);
      expect(faceapi.nets.faceRecognitionNet.isLoaded).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Biometric Vector Math & Safeguards', () => {
  it('normalizes arbitrary vectors to canonical L2 unit norm', () => {
    const raw = [3, 4, 0, 0];
    const normalized = normalizeVector(raw);
    expect(normalized.length).toBe(4);
    // Norm should be sqrt(3^2 + 4^2) = 5 -> [0.6, 0.8, 0, 0]
    expect(normalized[0]).toBeCloseTo(0.6, 4);
    expect(normalized[1]).toBeCloseTo(0.8, 4);

    let normSq = 0;
    for (let i = 0; i < normalized.length; i++) normSq += normalized[i] * normalized[i];
    expect(Math.sqrt(normSq)).toBeCloseTo(1.0, 5);
  });

  it('handles zero vectors safely without producing NaN', () => {
    const zeros = new Float32Array(EMBEDDING_DIMENSION);
    const result = normalizeVector(zeros);
    expect(result.length).toBe(EMBEDDING_DIMENSION);
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBe(0);
      expect(Number.isNaN(result[i])).toBe(false);
    }
  });

  it('calculates accurate cosine similarity and cosine distance', () => {
    const vecA = normalizeVector([1, 0, 0]);
    const vecB = normalizeVector([1, 0, 0]);
    const vecC = normalizeVector([0, 1, 0]);
    const vecD = normalizeVector([-1, 0, 0]);

    // Identical
    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0, 5);
    expect(cosineDistance(vecA, vecB)).toBeCloseTo(0.0, 5);

    // Orthogonal
    expect(cosineSimilarity(vecA, vecC)).toBeCloseTo(0.0, 5);
    expect(cosineDistance(vecA, vecC)).toBeCloseTo(1.0, 5);

    // Opposite
    expect(cosineSimilarity(vecA, vecD)).toBeCloseTo(-1.0, 5);
    expect(cosineDistance(vecA, vecD)).toBeCloseTo(2.0, 5);
  });

  it('computes Euclidean distance correctly', () => {
    const p1 = [0, 0];
    const p2 = [3, 4];
    expect(euclideanDistance(p1, p2)).toBeCloseTo(5.0, 5);
    expect(euclideanDistance(p1, p1)).toBe(0);
  });

  it('consolidates multi-burst vectors into a normalized master vector', () => {
    const shot1 = new Float32Array(EMBEDDING_DIMENSION);
    const shot2 = new Float32Array(EMBEDDING_DIMENSION);
    const shot3 = new Float32Array(EMBEDDING_DIMENSION);
    shot1[0] = 1;
    shot2[0] = 0.9; shot2[1] = 0.1;
    shot3[0] = 0.95; shot3[1] = 0.05;

    const consolidated = consolidateBurstEmbeddings([shot1, shot2, shot3]);
    expect(consolidated.length).toBe(EMBEDDING_DIMENSION);

    let sumSq = 0;
    for (let i = 0; i < consolidated.length; i++) sumSq += consolidated[i] * consolidated[i];
    expect(Math.sqrt(sumSq)).toBeCloseTo(1.0, 4);
    expect(consolidated[0]).toBeGreaterThan(0.9);
  });

  it('evaluates biometric matches with strict two-tier safety margins', () => {
    const enrolledUserA = {
      id: 'patient-1',
      patientName: 'Ramesh Kumar',
      embedding: normalizeVector([1, 0, 0, 0])
    };
    const enrolledUserB = {
      id: 'patient-2',
      patientName: 'Suresh Kumar',
      embedding: normalizeVector([0, 1, 0, 0])
    };

    // Case 1: Exact / strong match to Ramesh (similarity 1.0, second best 0.0 -> gap 1.0 >= 0.08)
    const queryA = normalizeVector([1, 0, 0, 0]);
    const matchA = evaluateBiometricMatch(queryA, [enrolledUserA, enrolledUserB]);
    expect(matchA.status).toBe('MATCH_CONFIRMED');
    expect(matchA.bestMatch?.item.id).toBe('patient-1');
    expect(matchA.marginGap).toBeGreaterThanOrEqual(0.08);

    // Case 2: Ambiguous match — candidate A and candidate B are very close (twin / lookalike scenario)
    const twin1 = {
      id: 'twin-1',
      patientName: 'Twin 1',
      embedding: normalizeVector([0.9, 0.1, 0, 0])
    };
    const twin2 = {
      id: 'twin-2',
      patientName: 'Twin 2',
      embedding: normalizeVector([0.88, 0.12, 0, 0])
    };
    const queryTwin = normalizeVector([0.92, 0.08, 0, 0]);
    const matchTwin = evaluateBiometricMatch(queryTwin, [twin1, twin2]);
    expect(matchTwin.status).toBe('AMBIGUOUS_MATCH');
    expect(matchTwin.bestMatch).toBeDefined();
    expect(matchTwin.secondBestMatch).toBeDefined();
    expect(matchTwin.marginGap).toBeLessThan(0.08);
    expect(matchTwin.reason).toContain('Ambiguous match');

    // Case 3: No match (unregistered individual with low similarity)
    const queryStranger = normalizeVector([0, 0, 1, 0]);
    const matchStranger = evaluateBiometricMatch(queryStranger, [enrolledUserA, enrolledUserB]);
    expect(matchStranger.status).toBe('NO_MATCH');

    // Case 4: Empty candidate database
    const matchEmpty = evaluateBiometricMatch(queryA, []);
    expect(matchEmpty.status).toBe('NO_MATCH');

    // Case 5: Candidates with stringified JSON or missing embeddings
    const stringifiedCandidate = {
      id: 'patient-json',
      patientName: 'JSON User',
      embedding: JSON.stringify([1, 0, 0, 0])
    };
    const matchJSON = evaluateBiometricMatch(queryA, [stringifiedCandidate]);
    expect(matchJSON.status).toBe('MATCH_CONFIRMED');
    expect(matchJSON.bestMatch?.item.id).toBe('patient-json');

    // Case 6: Query vector is empty or null
    const matchNullQuery = evaluateBiometricMatch(null, [enrolledUserA]);
    expect(matchNullQuery.status).toBe('NO_MATCH');
    expect(matchNullQuery.reason).toContain('Invalid or empty');
  });

  it('safely handles null, undefined, stringified, and non-finite vectors in normalizeVector', () => {
    const fromNull = normalizeVector(null);
    expect(fromNull.length).toBe(EMBEDDING_DIMENSION);
    expect(fromNull[0]).toBe(0);

    const fromUndefined = normalizeVector(undefined);
    expect(fromUndefined.length).toBe(EMBEDDING_DIMENSION);

    const fromString = normalizeVector('[3, 4, 0, 0]');
    expect(fromString.length).toBe(4);
    expect(fromString[0]).toBeCloseTo(0.6, 4);
    expect(fromString[1]).toBeCloseTo(0.8, 4);

    const fromBadString = normalizeVector('invalid json');
    expect(fromBadString.length).toBe(EMBEDDING_DIMENSION);

    const fromNaN = normalizeVector([NaN, Infinity, 3, 4]);
    expect(fromNaN.length).toBe(4);
    expect(Number.isFinite(fromNaN[0])).toBe(true);
  });

  it('safely handles edge cases in consolidateBurstEmbeddings', () => {
    // Empty array
    const emptyConsolidated = consolidateBurstEmbeddings([]);
    expect(emptyConsolidated.length).toBe(EMBEDDING_DIMENSION);

    // Single array
    const single = consolidateBurstEmbeddings([[3, 4]]);
    expect(single[0]).toBeCloseTo(0.6, 4);

    // Array with null or empty entries
    const withNulls = consolidateBurstEmbeddings([null as any, [1, 0], undefined as any]);
    expect(withNulls[0]).toBeCloseTo(1.0, 4);
  });

  it('prevents self-collision ambiguity when multiple records exist for the same individual', () => {
    const enrollment1 = {
      id: 'BIO-1001-1',
      cardNumber: '1001',
      patientName: 'Ramesh Kumar',
      embedding: normalizeVector([1, 0, 0, 0])
    };
    const enrollment2 = {
      id: 'BIO-1001-2',
      cardNumber: '1001',
      patientName: 'Ramesh Kumar',
      embedding: normalizeVector([0.98, 0.02, 0, 0])
    };

    // Query is identical to enrollment 1
    const query = normalizeVector([1, 0, 0, 0]);
    // Both records match > 0.80 and gap between them is < 0.08, but they belong to the SAME individual
    const match = evaluateBiometricMatch(query, [enrollment1, enrollment2]);
    expect(match.status).toBe('MATCH_CONFIRMED');
    expect(match.bestMatch?.item.cardNumber).toBe('1001');
    expect(match.secondBestMatch).toBeNull();
  });
});

describe('Face Engine and Offline Model Loading', () => {
  it('resolves model path correctly for offline execution', () => {
    const modelPath = getModelPath();
    expect(modelPath).toContain('/models/face');
  });

  it('provides safe fallbacks for legacy sync helpers', () => {
    const dummyCtx = {} as CanvasRenderingContext2D;
    const box = detectFaceBox(dummyCtx, 320, 240);
    expect(box).toBeNull();

    const emb = extractEmbeddingFromCanvas(dummyCtx, { x: 0, y: 0, width: 50, height: 50, confidence: 1 });
    expect(emb.length).toBe(EMBEDDING_DIMENSION);
  });

  it('safely invokes audio and haptic feedback stubs in test environment', () => {
    expect(() => playBiometricMatchSound()).not.toThrow();
    expect(() => playAmbiguityAlertSound()).not.toThrow();
    expect(() => triggerBiometricHaptic()).not.toThrow();
  });

  it('handles invalid or zero-dimension video streams in analyzeVideoFrame', async () => {
    const dummyVideo = { videoWidth: 0, videoHeight: 0 } as HTMLVideoElement;
    const dummyCanvas = document.createElement('canvas');

    const result = await analyzeVideoFrame(dummyVideo, dummyCanvas);
    expect(result.detected).toBe(false);
    expect(result.box).toBeNull();
    expect(result.embedding).toBeNull();
    expect(result.reason).toBe('Camera stream initializing...');
  });

  it('handles null or undefined canvas gracefully without throwing in analyzeVideoFrame', async () => {
    const dummyVideo = { videoWidth: 640, videoHeight: 480, readyState: 4 } as HTMLVideoElement;
    const result = await analyzeVideoFrame(dummyVideo, null as any);
    expect(result.detected).toBe(false);
    expect(result.box).toBeNull();
    expect(result.embedding).toBeNull();
    expect(result.reason).toContain('unavailable');
  });

  it('resets face tracking cache correctly', () => {
    resetFaceTrackingCache();
    const dummyCtx = {} as CanvasRenderingContext2D;
    expect(detectFaceBox(dummyCtx, 320, 240)).toBeNull();
  });

  it('loads offline models from project assets using local weights', async () => {
    const modelsDir = path.resolve(__dirname, '../../../public/models/face');
    expect(fs.existsSync(modelsDir)).toBe(true);
    expect(fs.existsSync(path.join(modelsDir, 'tiny_face_detector_model-weights_manifest.json'))).toBe(true);

    const customFetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      const filename = path.basename(urlStr.split('?')[0]);
      const filePath = path.join(modelsDir, filename);
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        return {
          ok: true,
          status: 200,
          json: async () => JSON.parse(buffer.toString('utf8')),
          arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
          text: async () => buffer.toString('utf8')
        } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = customFetch;
    faceapi.env.monkeyPatch({ fetch: customFetch as any });

    try {
      const loaded = await loadFaceModels('http://localhost/models/face');
      expect(loaded).toBe(true);
      expect(areModelsLoaded()).toBe(true);
      expect(faceapi.nets.tinyFaceDetector.isLoaded).toBe(true);
      expect(faceapi.nets.faceLandmark68TinyNet.isLoaded).toBe(true);
      expect(faceapi.nets.faceRecognitionNet.isLoaded).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('correctly resolves model path in Capacitor or subpath web environments', () => {
    const originalLocation = window.location;
    try {
      // Test 1: Subpath deployment
      delete (window as any).location;
      (window as any).location = new URL('https://clinic.org/subpath/index.html');
      expect(getModelPath()).toContain('/subpath/models/face');

      // Test 2: Capacitor APK http://localhost
      (window as any).location = new URL('http://localhost/index.html');
      expect(getModelPath()).toContain('http://localhost/models/face');
    } finally {
      (window as any).location = originalLocation;
    }
  });
});

describe('Biometric Store & Sync Integration', () => {
  it('saves and loads enrolled patient biometrics with clean vector normalization', async () => {
    const testPatient = {
      id: 'P-TEST-1',
      cardNumber: '9901',
      name: 'Anjali Sharma',
      gender: 'Female',
      age: 32,
      phone: '9876543210'
    };

    const rawEmbedding = new Float32Array(EMBEDDING_DIMENSION);
    rawEmbedding[0] = 5;
    rawEmbedding[1] = 12;

    const saved = await savePatientBiometric(testPatient, rawEmbedding, 0.96);
    expect(saved.id).toContain('BIO-9901');
    expect(saved.cardNumber).toBe('9901');
    expect(saved.embedding.length).toBe(EMBEDDING_DIMENSION);
    // Norm of [5, 12] is 13 -> 5/13 ≈ 0.3846
    expect(saved.embedding[0]).toBeCloseTo(5 / 13, 3);
    expect(saved.embedding[1]).toBeCloseTo(12 / 13, 3);

    const fetched = await getPatientBiometric('9901');
    expect(fetched).not.toBeNull();
    expect(fetched?.patientName).toBe('Anjali Sharma');

    // Clean up
    const deleted = await deletePatientBiometric('9901');
    expect(deleted).toBe(true);
  });

  it('handles offline token generation when server is unreachable', async () => {
    const tokenResult = await issueOfflineToken({
      patientId: 'P-TEST-99',
      patientName: 'Offline User',
      cardNumber: '8888',
      priority: 'NORMAL'
    });

    expect(tokenResult.success).toBe(true);
    expect(tokenResult.tokenNumber).toBeGreaterThan(0);
    expect(tokenResult.tokenId).toBeDefined();
  });

  it('deduplicates multiple enrollments for the same patient in loadEnrolledBiometrics', async () => {
    const testPatient = {
      id: 'P-DEDUP-1',
      cardNumber: '7701',
      name: 'Dedup User',
      gender: 'Male',
      age: 40,
      phone: '9876543211'
    };

    const emb1 = new Float32Array(EMBEDDING_DIMENSION);
    emb1[0] = 1;
    const emb2 = new Float32Array(EMBEDDING_DIMENSION);
    emb2[1] = 1;

    // Save twice (simulating re-enrollment or duplicate updates)
    await savePatientBiometric(testPatient, emb1, 0.95);
    await savePatientBiometric(testPatient, emb2, 0.98);

    const loaded = await loadEnrolledBiometrics();
    const matches = loaded.filter(p => p.cardNumber === '7701');
    expect(matches.length).toBe(1);
    expect(matches[0].embedding[1]).toBeCloseTo(1.0, 3);

    // Clean up
    await deletePatientBiometric('7701');
  });
});
