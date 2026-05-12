import { createHash } from 'crypto';

/**
 * Lightweight, deterministic, zero-dependency text embedder.
 *
 * Real production deployments must swap this for a proper model (sentence-
 * transformers via the Python AI service, OpenAI embeddings, fastembed, …).
 * This implementation lets dev environments boot Qdrant queries without an
 * external embedding service.
 *
 * Algorithm: 384-dim vector built from a sliding hash over text bytes,
 * normalized. Stable across processes (uses sha256 buckets).
 */
export class HashEmbedder {
  readonly dim: number;
  constructor(dim = 384) {
    this.dim = dim;
  }

  embed(text: string): number[] {
    const buf = Buffer.alloc(this.dim, 0);
    const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
    for (const tok of tokens) {
      const h = createHash('sha256').update(tok).digest();
      for (let i = 0; i < h.length; i++) {
        buf[i % this.dim] = (buf[i % this.dim] + h[i]) & 0xff;
      }
    }
    const vec = Array.from(buf, (b) => b / 255 - 0.5);
    const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}
