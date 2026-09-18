// ─── Nek Kadam: Offline Biometric Vector Math & Safeguards ───

export const EMBEDDING_DIMENSION = 128;
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.80; // Cosine similarity >= 0.80 for FaceNet 128D embeddings
export const DEFAULT_MARGIN_GAP = 0.08;           // Top match must beat 2nd match by >= 0.08

export interface ScoredMatch<T = any> {
  item: T;
  similarity: number; // 0.0 to 1.0 (Cosine similarity)
  distance: number;   // Euclidean distance
  confidencePercent: number;
}

export interface MatchEvaluationResult<T = any> {
  status: 'MATCH_CONFIRMED' | 'AMBIGUOUS_MATCH' | 'NO_MATCH';
  bestMatch: ScoredMatch<T> | null;
  secondBestMatch: ScoredMatch<T> | null;
  marginGap: number;
  reason: string;
}

/**
 * Normalizes a vector with L2 unit-norm:
 * v_i = v_i / ||v||_2
 * This guarantees vectors lie on the unit hypersphere for exact cosine similarity and Euclidean distance.
 */
export function normalizeVector(vec?: number[] | Float32Array | string | null): Float32Array {
  if (!vec) return new Float32Array(EMBEDDING_DIMENSION);

  let arr: Float32Array;
  if (vec instanceof Float32Array) {
    arr = vec;
  } else if (Array.isArray(vec)) {
    arr = new Float32Array(vec);
  } else if (typeof vec === 'string') {
    try {
      const parsed = JSON.parse(vec);
      arr = Array.isArray(parsed) ? new Float32Array(parsed) : new Float32Array(EMBEDDING_DIMENSION);
    } catch {
      return new Float32Array(EMBEDDING_DIMENSION);
    }
  } else {
    try {
      arr = new Float32Array(vec as any);
    } catch {
      return new Float32Array(EMBEDDING_DIMENSION);
    }
  }

  const len = arr.length;
  if (len === 0) return arr;

  let sumSq = 0;
  for (let i = 0; i < len; i++) {
    const val = arr[i];
    if (Number.isFinite(val)) {
      sumSq += val * val;
    }
  }
  const norm = Math.sqrt(sumSq);
  if (norm === 0 || !Number.isFinite(norm)) return new Float32Array(len);

  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const val = arr[i];
    out[i] = Number.isFinite(val) ? val / norm : 0;
  }
  return out;
}

/**
 * Computes Cosine Similarity between two L2-normalized vectors.
 * Range: -1.0 to 1.0 (identical vectors = 1.0).
 */
export function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return Math.max(-1, Math.min(1, dot));
}

/**
 * Computes Cosine Distance (1 - cosineSimilarity) between two vectors.
 * Range: 0.0 (identical) to 2.0 (opposite).
 */
export function cosineDistance(a: Float32Array | number[], b: Float32Array | number[]): number {
  return Math.max(0, 1 - cosineSimilarity(a, b));
}

/**
 * Computes Euclidean Distance between two vectors.
 */
export function euclideanDistance(a: Float32Array | number[], b: Float32Array | number[]): number {
  if (a.length !== b.length) return 999;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Averages multiple burst enrollment embeddings into a single consolidated vector.
 */
export function consolidateBurstEmbeddings(vectors: (Float32Array | number[] | string | null | undefined)[]): Float32Array {
  if (!vectors || vectors.length === 0) return new Float32Array(EMBEDDING_DIMENSION);

  const validNormalized: Float32Array[] = [];
  for (const v of vectors) {
    if (!v) continue;
    const normV = normalizeVector(v);
    if (normV.length > 0 && normV.some(x => x !== 0)) {
      validNormalized.push(normV);
    }
  }

  if (validNormalized.length === 0) return new Float32Array(EMBEDDING_DIMENSION);
  if (validNormalized.length === 1) return validNormalized[0];

  const dim = validNormalized[0].length;
  const sum = new Float32Array(dim);

  let count = 0;
  for (const v of validNormalized) {
    if (v.length === dim) {
      for (let i = 0; i < dim; i++) {
        sum[i] += v[i];
      }
      count++;
    }
  }

  if (count === 0) return new Float32Array(dim);

  for (let i = 0; i < dim; i++) {
    sum[i] /= count;
  }

  return normalizeVector(sum);
}

/**
 * Evaluates a query embedding against a list of candidates using two-tier thresholding:
 * 1. Primary confidence threshold (similarity >= 0.80)
 * 2. Margin gap test (top match must exceed second best by >= 0.08)
 */
export function evaluateBiometricMatch<T extends { embedding: number[] | Float32Array | string }>(
  queryEmbedding: Float32Array | number[] | string | null | undefined,
  candidates: T[],
  threshold = DEFAULT_CONFIDENCE_THRESHOLD,
  marginGap = DEFAULT_MARGIN_GAP
): MatchEvaluationResult<T> {
  if (!candidates || candidates.length === 0) {
    return {
      status: 'NO_MATCH',
      bestMatch: null,
      secondBestMatch: null,
      marginGap: 0,
      reason: 'No enrolled biometric profiles available.'
    };
  }

  const normalizedQuery = normalizeVector(queryEmbedding);
  if (normalizedQuery.length === 0 || !normalizedQuery.some(x => x !== 0)) {
    return {
      status: 'NO_MATCH',
      bestMatch: null,
      secondBestMatch: null,
      marginGap: 0,
      reason: 'Invalid or empty biometric query vector.'
    };
  }

  const validCandidates = candidates.filter(c => c && c.embedding);
  if (validCandidates.length === 0) {
    return {
      status: 'NO_MATCH',
      bestMatch: null,
      secondBestMatch: null,
      marginGap: 0,
      reason: 'No valid biometric embeddings found in candidate profiles.'
    };
  }

  const scored: ScoredMatch<T>[] = validCandidates.map(candidate => {
    const candidateVec = normalizeVector(candidate.embedding);
    const sim = cosineSimilarity(normalizedQuery, candidateVec);
    const dist = euclideanDistance(normalizedQuery, candidateVec);
    const pct = Math.max(0, Math.min(100, Math.round(sim * 100)));
    return {
      item: candidate,
      similarity: sim,
      distance: dist,
      confidencePercent: pct
    };
  });

  scored.sort((a, b) => b.similarity - a.similarity);

  const best = scored[0];
  // Determine second-best match from a DISTINCT individual (guards against false self-collisions when duplicate vectors exist)
  let second: ScoredMatch<T> | null = null;
  for (let i = 1; i < scored.length; i++) {
    const cand = scored[i].item as any;
    const bestItem = best.item as any;
    const candCard = String(cand.cardNumber || cand.card_number || '').trim();
    const bestCard = String(bestItem.cardNumber || bestItem.card_number || '').trim();
    const candPat = String(cand.patientId || cand.patient_id || '').trim();
    const bestPat = String(bestItem.patientId || bestItem.patient_id || '').trim();
    const candId = String(cand.id || '').trim();
    const bestId = String(bestItem.id || '').trim();

    const isSamePerson = Boolean(
      (candCard && bestCard && candCard === bestCard) ||
      (candPat && bestPat && candPat === bestPat) ||
      (candId && bestId && candId === bestId)
    );

    if (!isSamePerson) {
      second = scored[i];
      break;
    }
  }

  if (best.similarity < threshold) {
    return {
      status: 'NO_MATCH',
      bestMatch: best,
      secondBestMatch: second,
      marginGap: second ? best.similarity - second.similarity : 0,
      reason: `Best match score (${(best.similarity * 100).toFixed(1)}%) is below required threshold (${(threshold * 100).toFixed(1)}%).`
    };
  }

  if (second) {
    const gap = best.similarity - second.similarity;
    if (gap < marginGap) {
      return {
        status: 'AMBIGUOUS_MATCH',
        bestMatch: best,
        secondBestMatch: second,
        marginGap: gap,
        reason: `Ambiguous match: Top candidate only leads by ${(gap * 100).toFixed(1)}% (requires minimum ${(marginGap * 100).toFixed(1)}% separation).`
      };
    }
  }

  return {
    status: 'MATCH_CONFIRMED',
    bestMatch: best,
    secondBestMatch: second,
    marginGap: second ? best.similarity - second.similarity : 1.0,
    reason: `Confirmed match with ${(best.similarity * 100).toFixed(1)}% similarity.`
  };
}
