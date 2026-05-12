import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemoryKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { HashEmbedder } from './embedder';
import { QdrantClient } from './qdrant.client';

const COLLECTION = 'agentforge_memory';
const EMBED_DIM = 384;

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);
  private readonly qdrant: QdrantClient;
  private readonly embedder = new HashEmbedder(EMBED_DIM);
  private bootstrapped = false;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const cfg = this.config.get<{ url: string | null; apiKey: string | null }>('qdrant');
    this.qdrant = new QdrantClient(cfg?.url ?? null, cfg?.apiKey ?? null);
  }

  isLive(): boolean {
    return this.qdrant.isLive();
  }

  /**
   * Idempotently ensure the per-user collection exists. Costs nothing when
   * Qdrant isn't configured.
   */
  private async ensureCollection() {
    if (this.bootstrapped || !this.qdrant.isLive()) return;
    await this.qdrant.ensureCollection(COLLECTION, EMBED_DIM);
    this.bootstrapped = true;
  }

  async recordSuccessfulRun(runId: string) {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      select: {
        id: true,
        userId: true,
        prompt: true,
        spec: true,
        domain: true,
      },
    });
    if (!run) return;

    const goal =
      (run.spec as any)?.goal ?? (run.spec as any)?.objective ?? '';
    const summary = `${run.prompt}\n${goal}`.trim();
    if (!summary) return;

    await this.upsert({
      userId: run.userId,
      runId: run.id,
      kind: MemoryKind.RUN_SUMMARY,
      text: summary,
      payload: { domain: run.domain, runId: run.id },
    });
  }

  async recordPrompt(userId: string, prompt: string) {
    await this.upsert({ userId, kind: MemoryKind.PROMPT, text: prompt, payload: {} });
  }

  async search(userId: string, query: string, limit = 10) {
    if (!this.qdrant.isLive()) {
      // No Qdrant — fall back to a `LIKE` search so /search still returns
      // something meaningful in dev.
      const items = await this.prisma.run.findMany({
        where: {
          userId,
          deletedAt: null,
          prompt: { contains: query, mode: 'insensitive' },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, prompt: true, createdAt: true, domain: true },
      });
      return {
        backend: 'fallback' as const,
        items: items.map((i) => ({
          runId: i.id,
          score: 0,
          domain: i.domain,
          preview: i.prompt.slice(0, 200),
        })),
      };
    }

    await this.ensureCollection();
    const vector = this.embedder.embed(query);
    const results = await this.qdrant.search(COLLECTION, vector, {
      limit,
      filter: { must: [{ key: 'userId', match: { value: userId } }] },
    });

    return {
      backend: 'qdrant' as const,
      items: results.map((r) => ({
        runId: (r.payload?.runId as string) ?? null,
        score: r.score,
        preview: (r.payload?.preview as string) ?? '',
        domain: r.payload?.domain ?? null,
      })),
    };
  }

  private async upsert(input: {
    userId: string;
    runId?: string;
    kind: MemoryKind;
    text: string;
    payload: Record<string, unknown>;
  }) {
    await this.ensureCollection();
    const vectorId = `${input.userId}_${input.runId ?? Date.now()}_${input.kind}`;

    if (this.qdrant.isLive()) {
      const vector = this.embedder.embed(input.text);
      await this.qdrant.upsert(COLLECTION, {
        id: vectorId,
        vector,
        payload: {
          userId: input.userId,
          runId: input.runId,
          kind: input.kind,
          preview: input.text.slice(0, 200),
          ...input.payload,
        },
      });
    }

    // Always persist the pointer so we can audit what was embedded.
    await this.prisma.memoryPoint.upsert({
      where: { collection_vectorId: { collection: COLLECTION, vectorId } },
      create: {
        userId: input.userId,
        runId: input.runId,
        kind: input.kind,
        collection: COLLECTION,
        vectorId,
        preview: input.text.slice(0, 200),
      },
      update: { preview: input.text.slice(0, 200) },
    });
  }
}
