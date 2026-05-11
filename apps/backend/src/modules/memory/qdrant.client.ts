import { Logger } from '@nestjs/common';

export interface QdrantPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface QdrantSearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

/**
 * Minimal Qdrant HTTP wrapper. Falls back to a no-op implementation when
 * QDRANT_URL is not configured — keeps dev environments bootable.
 *
 * The official @qdrant/js-client-rest is not added as a hard dependency to
 * avoid pinning the dev environment's Node version. When the official client
 * is wired in, swap the `fetch` calls below for client methods.
 */
export class QdrantClient {
  private readonly logger = new Logger(QdrantClient.name);

  constructor(
    private readonly baseUrl: string | null,
    private readonly apiKey: string | null,
  ) {}

  isLive(): boolean {
    return !!this.baseUrl;
  }

  async ensureCollection(name: string, vectorSize = 384): Promise<void> {
    if (!this.baseUrl) return;
    try {
      await fetch(`${this.baseUrl}/collections/${name}`, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify({
          vectors: { size: vectorSize, distance: 'Cosine' },
        }),
      });
    } catch (err) {
      this.logger.warn(`Could not ensure collection ${name}: ${(err as Error).message}`);
    }
  }

  async upsert(collection: string, point: QdrantPoint): Promise<void> {
    if (!this.baseUrl) return;
    await fetch(`${this.baseUrl}/collections/${collection}/points`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify({ points: [point] }),
    });
  }

  async search(
    collection: string,
    vector: number[],
    opts: { limit?: number; filter?: Record<string, unknown> } = {},
  ): Promise<QdrantSearchResult[]> {
    if (!this.baseUrl) return [];
    const res = await fetch(`${this.baseUrl}/collections/${collection}/points/search`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        vector,
        limit: opts.limit ?? 10,
        filter: opts.filter,
        with_payload: true,
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { result?: QdrantSearchResult[] };
    return data.result ?? [];
  }

  private headers() {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) h['api-key'] = this.apiKey;
    return h;
  }
}
