import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

const KEY_PREFIX = 'agf';
const PREFIX_RANDOM_CHARS = 8;

export interface CreatedKey {
  id: string;
  name: string;
  prefix: string;
  /** Plaintext key — returned ONCE, never persisted. */
  secret: string;
  expiresAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(private prisma: PrismaService) {}

  async create(
    userId: string,
    data: { name: string; expiresAt?: Date },
  ): Promise<CreatedKey> {
    const env = process.env.NODE_ENV === 'production' ? 'live' : 'test';
    const random = randomBytes(24).toString('base64url');
    const secret = `${KEY_PREFIX}_${env}_${random}`;
    const prefix = this.derivePrefix(secret);
    if (!prefix) throw new Error('Failed to derive API key prefix');
    const hash = await bcrypt.hash(secret, 10);

    const row = await this.prisma.apiKey.create({
      data: {
        userId,
        name: data.name,
        prefix,
        hash,
        expiresAt: data.expiresAt ?? null,
      },
    });

    return {
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      secret,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    };
  }

  list(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  async revoke(id: string, userId: string) {
    const key = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!key) throw new NotFoundException('API key not found');
    if (key.userId !== userId) {
      throw new ForbiddenException('Cannot revoke a key you do not own');
    }
    return this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Verifies an Authorization-header API key. Returns the API key row + its
   * owner when:
   *   - the prefix is well-formed
   *   - the bcrypt hash matches
   *   - the key is not revoked or expired
   *   - the owning user is active and not suspended
   *
   * Returns null on any failure. Never throws — `ApiKeyAuthGuard` translates
   * null into 401.
   */
  async verifyAndTouch(rawKey: string) {
    if (typeof rawKey !== 'string' || !rawKey.startsWith(`${KEY_PREFIX}_`)) {
      return null;
    }

    const prefix = this.derivePrefix(rawKey);
    if (!prefix) return null;

    const candidate = await this.prisma.apiKey.findUnique({
      where: { prefix },
      include: {
        user: {
          select: { id: true, email: true, role: true, isActive: true, isSuspended: true },
        },
      },
    });
    if (!candidate || candidate.revokedAt) return null;
    if (candidate.expiresAt && candidate.expiresAt.getTime() < Date.now()) return null;
    if (!candidate.user.isActive || candidate.user.isSuspended) return null;

    const ok = await bcrypt.compare(rawKey, candidate.hash);
    if (!ok) return null;

    // Best-effort lastUsedAt — failures here must not block authentication.
    await this.prisma.apiKey
      .update({ where: { id: candidate.id }, data: { lastUsedAt: new Date() } })
      .catch((err) =>
        this.logger.warn(`Could not bump lastUsedAt: ${(err as Error).message}`),
      );

    return candidate;
  }

  /**
   * Builds the "agf_<env>_<8 random chars>" prefix from a raw key. Parses the
   * env from the key itself (NOT from process.env) so a key created in one
   * environment still resolves correctly when used in another. Returns null
   * for malformed input.
   */
  private derivePrefix(rawKey: string): string | null {
    const parts = rawKey.split('_');
    if (parts.length < 3 || parts[0] !== KEY_PREFIX) return null;
    const env = parts[1];
    if (env !== 'live' && env !== 'test') return null;
    const random = parts.slice(2).join('_');
    if (random.length < PREFIX_RANDOM_CHARS) return null;
    return `${KEY_PREFIX}_${env}_${random.slice(0, PREFIX_RANDOM_CHARS)}`;
  }
}
