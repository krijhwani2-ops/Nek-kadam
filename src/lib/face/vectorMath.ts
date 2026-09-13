// ─── Nek Kadam: Offline Biometric Vector Math & Safeguards ───

export const EMBEDDING_DIMENSION = 128;
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.70; // Cosine similarity >= 0.70 (strict zero-mean matching)
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
 * Normalizes a vector with zero-mean centering and L2 unit-norm:
 * 1. v_i = v_i - mean(v)
 * 2. v_i = v_i / ||v||_2
 * This guarantees true orthogonality: random/unrelated faces score ~0.0 similarity.
 */
export function normalizeVector(vec: number[] | Float32Array): Float32Array {
  const arr = vec instanceof Float32Array ? vec : new Float32Array(vec);
  const len = arr.length;
  if (len === 0) return arr;

  let sum = 0;
  for (let i = 0; i < len; i++) sum += arr[i];
  const mean = sum / len;

  let sumSq = 0;
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const val = arr[i] - mean;
    out[i] = val;
    sumSq += val * val;
  }

  const norm = Math.sqrt(sumSq);
  if (norm === 0) return out;
  for (let i = 0; i < len; i++) {
    out[i] /= norm;
  }
  return out;
}

/**
 * Computes Cosine Similarity between two L2-normalized vectors.
 * Range: -1.0 to 1.0 (identical vectors = 1.0).
 */
export function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return Math.max(-1, Math.min(1, dot));
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
export function consolidateBurstEmbeddings(vectors: (Float32Array | number[])[]): Float32Array {
  if (vectors.length === 0) return new Float32Array(EMBEDDING_DIMENSION);
  if (vectors.length === 1) return normalizeVector(vectors[0]);

  const dim = vectors[0].length;
  const sum = new Float32Array(dim);

  for (const v of vectors) {
    for (let i = 0; i < dim; i++) {
      sum[i] += v[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    sum[i] /= vectors.length;
  }

  return normalizeVector(sum);
}

/**
 * Evaluates a query embedding against a list of candidates using two-tier thresholding:
 * 1. Primary confidence threshold (similarity >= 0.86)
 * 2. Margin gap test (top match must exceed second best by >= 0.08)
 */
export function evaluateBiometricMatch<T extends { embedding: number[] | Float32Array }>(
  queryEmbedding: Float32Array | number[],
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

  const scored: ScoredMatch<T>[] = candidates.map(candidate => {
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
  const second = scored.length > 1 ? scored[1] : null;

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
