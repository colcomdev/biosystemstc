/**
 * Biometric Embedding & Cosine Similarity Evaluation Engine
 * Standards-compliant 512-dimensional vector computation (ArcFace / FaceNet representation)
 */

export const SIMILARITY_THRESHOLD = 0.85; // 85% minimum threshold for ACCESS GRANTED

/**
 * Calculates cosine similarity between two n-dimensional vectors (e.g. 512-dim)
 * Range: -1.0 to 1.0 (for facial embeddings typically 0.0 to 1.0)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  const rawScore = dotProduct / denominator;
  // Bound to 0.0 - 1.0
  return Math.max(0, Math.min(1, rawScore));
}

/**
 * Generates a normalized 512-dimensional float vector
 * If a seed string is provided, generates deterministic vectors for consistent testing
 */
export function generateSyntheticEmbedding(seedStr?: string, similarityDrift = 0): number[] {
  const DIM = 512;
  const vector: number[] = new Array(DIM);

  // Simple pseudo-random hash generator based on seed
  let seed = 1337;
  if (seedStr) {
    for (let i = 0; i < seedStr.length; i++) {
      seed = (seed * 31 + seedStr.charCodeAt(i)) & 0xffffffff;
    }
  }

  const lcg = () => {
    seed = (1664525 * seed + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 4294967296;
  };

  // Generate vector components with normal-like distribution (Box-Muller)
  for (let i = 0; i < DIM; i += 2) {
    const u1 = Math.max(1e-7, lcg());
    const u2 = lcg();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    const z1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);

    vector[i] = z0 + similarityDrift * (Math.random() - 0.5);
    if (i + 1 < DIM) {
      vector[i + 1] = z1 + similarityDrift * (Math.random() - 0.5);
    }
  }

  // Normalize to unit sphere (L2 norm = 1.0)
  let norm = 0;
  for (let i = 0; i < DIM; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);
  for (let i = 0; i < DIM; i++) {
    vector[i] = vector[i] / norm;
  }

  return vector;
}

/**
 * Generates a matched vector that achieves a targeted similarity score with a baseline vector
 */
export function generateMatchingVector(baseVector: number[], targetSimilarity: number): number[] {
  const DIM = baseVector.length;
  // Generate random orthogonal noise vector
  const noise = generateSyntheticEmbedding(Math.random().toString());

  // Gram-Schmidt orthogonalization against baseVector
  let dot = 0;
  for (let i = 0; i < DIM; i++) {
    dot += noise[i] * baseVector[i];
  }
  const orthogonal: number[] = new Array(DIM);
  let orthNorm = 0;
  for (let i = 0; i < DIM; i++) {
    orthogonal[i] = noise[i] - dot * baseVector[i];
    orthNorm += orthogonal[i] * orthogonal[i];
  }
  orthNorm = Math.sqrt(orthNorm);
  for (let i = 0; i < DIM; i++) {
    orthogonal[i] = orthogonal[i] / orthNorm;
  }

  // Blended vector = targetSimilarity * baseVector + sqrt(1 - targetSimilarity^2) * orthogonal
  const clampedTarget = Math.max(-1, Math.min(1, targetSimilarity));
  const orthoWeight = Math.sqrt(Math.max(0, 1 - clampedTarget * clampedTarget));

  const result: number[] = new Array(DIM);
  for (let i = 0; i < DIM; i++) {
    result[i] = clampedTarget * baseVector[i] + orthoWeight * orthogonal[i];
  }
  return result;
}
