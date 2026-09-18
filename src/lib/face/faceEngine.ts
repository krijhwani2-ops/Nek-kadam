// ─── Nek Kadam: Offline Face Recognition Engine ───
// Client-side offline face detection, feature extraction, and audio-haptic feedback.
// Powered by @vladmandic/face-api with 100% offline self-contained local models.

import * as faceapi from '@vladmandic/face-api';
import { EMBEDDING_DIMENSION, normalizeVector } from './vectorMath';

export interface FaceDetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  isRealFace?: boolean;
}

export interface FaceAnalysisResult {
  detected: boolean;
  box: FaceDetectionBox | null;
  embedding: Float32Array | null;
  quality: {
    brightness: number; // 0.0 - 1.0 (ideal ~0.4 - 0.7)
    isCentered: boolean;
    sizeRatio: number;  // Face box area relative to frame
    overallScore: number;
  };
  reason?: string;
}

// Play pleasant high-tech biometric confirmation chime
export function playBiometricMatchSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Two-tone harmony (C6 -> G6)
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.15, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    playTone(1046.50, 0, 0.12);     // C6
    playTone(1567.98, 0.08, 0.20);  // G6
  } catch (_e) {}
}

// Play alert tone for low confidence or ambiguous matches
export function playAmbiguityAlertSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.setValueAtTime(330, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (_e) {}
}

// Trigger haptic vibration on mobile APK
export function triggerBiometricHaptic() {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([30, 40, 50]);
    }
  } catch (_e) {}
}

// Memory cache for smooth bounding box tracking across frames
let lastBox: FaceDetectionBox | null = null;
let lastDetectedTime = 0;
let modelsLoadingPromise: Promise<boolean> | null = null;

/**
 * Resolves the offline local models path.
 * Works seamlessly in desktop browsers, subpath deployments, and Capacitor mobile APK.
 */
export function getModelPath(): string {
  if (typeof window !== 'undefined' && window.location) {
    try {
      const href = window.location.href;
      if (href && !href.startsWith('about:')) {
        return new URL('models/face', href).href;
      }
    } catch (_e) {}

    const origin = window.location.origin;
    if (origin && origin !== 'null') {
      const base = (import.meta as any).env?.BASE_URL || '/';
      const cleanBase = base.endsWith('/') ? base : `${base}/`;
      return `${origin}${cleanBase}models/face`;
    }
  }
  return '/models/face';
}

/**
 * Checks whether all required face detection & recognition models are loaded.
 */
export function areModelsLoaded(): boolean {
  return (
    faceapi.nets.tinyFaceDetector.isLoaded &&
    faceapi.nets.faceLandmark68TinyNet.isLoaded &&
    faceapi.nets.faceRecognitionNet.isLoaded
  );
}

/**
 * Loads model weights and neural network definitions from local project assets (100% offline).
 * Zero runtime external network requests or cloud API dependencies.
 */
export async function loadFaceModels(customPath?: string): Promise<boolean> {
  if (areModelsLoaded()) return true;
  if (modelsLoadingPromise) return modelsLoadingPromise;

  modelsLoadingPromise = (async () => {
    try {
      const tfAny = faceapi.tf as any;
      if (tfAny) {
        try {
          if (typeof window === 'undefined' || !(window as any).WebGLRenderingContext) {
            if (typeof tfAny.setBackend === 'function') {
              await tfAny.setBackend('cpu');
            }
          }
          if (typeof tfAny.ready === 'function') {
            await tfAny.ready();
          }
        } catch (backendErr) {
          console.warn('[FACE ENGINE] Default backend failed, falling back to CPU:', backendErr);
          try {
            if (typeof tfAny.setBackend === 'function') {
              await tfAny.setBackend('cpu');
              if (typeof tfAny.ready === 'function') {
                await tfAny.ready();
              }
            }
          } catch (_e) {}
        }
      }

      const rawCandidates = [
        customPath,
        getModelPath(),
        typeof window !== 'undefined' && window.location?.href ? new URL('models/face', window.location.href).href : undefined,
        '/models/face',
        'models/face',
        './models/face',
        'http://localhost/models/face',
        'capacitor://localhost/models/face',
        'https://localhost/models/face'
      ].filter(Boolean) as string[];

      const candidatePaths = Array.from(new Set(rawCandidates));

      let success = false;
      for (const path of candidatePaths) {
        try {
          if (!faceapi.nets.tinyFaceDetector.isLoaded) {
            await faceapi.nets.tinyFaceDetector.loadFromUri(path);
          }
          if (!faceapi.nets.faceLandmark68TinyNet.isLoaded) {
            await faceapi.nets.faceLandmark68TinyNet.loadFromUri(path);
          }
          if (!faceapi.nets.faceRecognitionNet.isLoaded) {
            await faceapi.nets.faceRecognitionNet.loadFromUri(path);
          }
          if (areModelsLoaded()) {
            console.log(`[FACE ENGINE] Biometric models loaded successfully from ${path}`);
            success = true;
            break;
          }
        } catch (_err) {
          // Try next candidate path
        }
      }

      if (!success) {
        console.warn('[FACE ENGINE] Could not load face models from candidate paths');
        modelsLoadingPromise = null;
        return false;
      }
      return true;
    } catch (fatalErr) {
      console.error('[FACE ENGINE] Unhandled error during model loading:', fatalErr);
      modelsLoadingPromise = null;
      return false;
    }
  })();

  return modelsLoadingPromise;
}

/**
 * Detects a face and extracts 128D facial descriptor using TinyFaceDetector.
 */
export async function detectFace(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>> | undefined> {
  if (!areModelsLoaded()) {
    const loaded = await loadFaceModels();
    if (!loaded) return undefined;
  }

  try {
    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 224,
      scoreThreshold: 0.45
    });

    const result = await faceapi
      .detectSingleFace(input, options)
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    return result;
  } catch (err) {
    console.warn('[FACE ENGINE] Face detection error:', err);
    return undefined;
  }
}

/**
 * Resets the temporal smoothing bounding box cache.
 */
export function resetFaceTrackingCache(): void {
  lastBox = null;
  lastDetectedTime = 0;
}

/**
 * Backwards-compatibility helper for detecting bounding box from canvas.
 */
export function detectFaceBox(
  ctx: CanvasRenderingContext2D,
  _width: number,
  _height: number
): FaceDetectionBox | null {
  if (lastBox && Date.now() - lastDetectedTime < 600) {
    return lastBox;
  }
  return null;
}

/**
 * Backwards-compatibility helper for extracting embedding from canvas.
 */
export function extractEmbeddingFromCanvas(
  _ctx: CanvasRenderingContext2D,
  _box: FaceDetectionBox
): Float32Array {
  const fallback = new Float32Array(EMBEDDING_DIMENSION);
  return normalizeVector(fallback);
}

/**
 * Analyzes video frame for presence of face, centering, exposure quality,
 * and extracts robust 128D deep facial embeddings using open-source face-api.
 */
export async function analyzeVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): Promise<FaceAnalysisResult> {
  if (!canvas) {
    return {
      detected: false,
      box: null,
      embedding: null,
      quality: { brightness: 0, isCentered: false, sizeRatio: 0, overallScore: 0 },
      reason: 'Inference canvas unavailable'
    };
  }

  if (!video || !video.videoWidth || !video.videoHeight || video.videoWidth <= 0 || video.videoHeight <= 0 || (typeof video.readyState === 'number' && video.readyState < 2)) {
    return {
      detected: false,
      box: null,
      embedding: null,
      quality: { brightness: 0, isCentered: false, sizeRatio: 0, overallScore: 0 },
      reason: 'Camera stream initializing...'
    };
  }

  const width = canvas.width = 320;
  const height = canvas.height = 240;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  let avgBrightness = 0.5;
  if (ctx) {
    try {
      ctx.drawImage(video, 0, 0, width, height);
      const frameSample = ctx.getImageData(0, 0, width, height).data;
      let totalBrightness = 0;
      for (let i = 0; i < frameSample.length; i += 16) {
        totalBrightness += (frameSample[i] + frameSample[i + 1] + frameSample[i + 2]) / 3;
      }
      avgBrightness = (totalBrightness / (frameSample.length / 16)) / 255.0;
    } catch (_e) {}
  }

  if (avgBrightness < 0.06) {
    return {
      detected: false,
      box: null,
      embedding: null,
      quality: { brightness: avgBrightness, isCentered: false, sizeRatio: 0, overallScore: 0.1 },
      reason: 'Lighting too dark. Please face the light source.'
    };
  }

  if (!areModelsLoaded()) {
    const loaded = await loadFaceModels();
    if (!loaded) {
      return {
        detected: false,
        box: null,
        embedding: null,
        quality: { brightness: avgBrightness, isCentered: false, sizeRatio: 0, overallScore: 0.2 },
        reason: 'Initializing biometric AI models...'
      };
    }
  }

  try {
    const input = canvas || video;
    const detection = await detectFace(input);

    if (detection && detection.descriptor) {
      // Deep 128D FaceNet biometric descriptor normalized to unit hypersphere
      const embedding = normalizeVector(detection.descriptor);
      const hasValidEmbedding = embedding.length === EMBEDDING_DIMENSION && embedding.some(v => v !== 0);

      if (!hasValidEmbedding) {
        return {
          detected: false,
          box: null,
          embedding: null,
          quality: { brightness: avgBrightness, isCentered: false, sizeRatio: 0, overallScore: 0.3 },
          reason: 'Align face clearly inside oval frame'
        };
      }

      const rawBox = detection.detection.box;
      const targetW = Math.round(rawBox.width);
      const targetH = Math.round(rawBox.height);
      const targetX = Math.max(0, Math.min(width - targetW, Math.round(rawBox.x)));
      const targetY = Math.max(0, Math.min(height - targetH, Math.round(rawBox.y)));

      let newBox: FaceDetectionBox = {
        x: targetX,
        y: targetY,
        width: targetW,
        height: targetH,
        confidence: detection.detection.score,
        isRealFace: true
      };

      // Temporal smoothing across consecutive frames
      if (lastBox && Date.now() - lastDetectedTime < 600) {
        newBox.x = Math.round(lastBox.x * 0.4 + newBox.x * 0.6);
        newBox.y = Math.round(lastBox.y * 0.4 + newBox.y * 0.6);
        newBox.width = Math.round(lastBox.width * 0.4 + newBox.width * 0.6);
        newBox.height = Math.round(lastBox.height * 0.4 + newBox.height * 0.6);
      }
      lastBox = newBox;
      lastDetectedTime = Date.now();

      const sizeRatio = (newBox.width * newBox.height) / (width * height);
      const faceCenterX = newBox.x + newBox.width / 2;
      const faceCenterY = newBox.y + newBox.height / 2;
      const isCentered = Math.abs(faceCenterX - width / 2) < width * 0.35 &&
                         Math.abs(faceCenterY - height / 2) < height * 0.35;
      const overallScore = Math.min(1.0, newBox.confidence * 0.75 + (isCentered ? 0.15 : 0) + avgBrightness * 0.10);

      let reason = 'Face Locked';
      if (!isCentered) {
        reason = 'Center face in oval frame';
      } else if (sizeRatio < 0.06) {
        reason = 'Move slightly closer';
      } else if (sizeRatio > 0.70) {
        reason = 'Move back slightly';
      }

      return {
        detected: true,
        box: newBox,
        embedding,
        quality: {
          brightness: avgBrightness,
          isCentered,
          sizeRatio,
          overallScore
        },
        reason
      };
    }
  } catch (err) {
    console.warn('[FACE ENGINE] Detection error in frame:', err);
  }

  // Smooth decay: track last known box if recent without emitting false embeddings
  if (lastBox && Date.now() - lastDetectedTime < 300) {
    const sizeRatio = (lastBox.width * lastBox.height) / (width * height);
    return {
      detected: false,
      box: lastBox,
      embedding: null,
      quality: {
        brightness: avgBrightness,
        isCentered: true,
        sizeRatio,
        overallScore: 0.5
      },
      reason: 'Tracking face...'
    };
  }

  return {
    detected: false,
    box: null,
    embedding: null,
    quality: {
      brightness: avgBrightness,
      isCentered: false,
      sizeRatio: 0,
      overallScore: 0
    },
    reason: 'Align face inside oval frame'
  };
}
