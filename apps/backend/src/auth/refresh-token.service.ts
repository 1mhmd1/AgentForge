import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RefreshIssued {
  token: string; // plaintext, returned ONCE
  expiresAt: Date;
}

/**
 * Refresh tokens are persisted as `<lookupHmac>:<bcryptHash>` inside the
 * `hashedToken` column.
 *
 *   lookupHmac = HMAC-SHA256(JWT_REFRESH_SECRET, plaintext)  ← deterministic,
 *                                                              cheap, indexed
 *   bcryptHash = bcrypt(plaintext, 10)                       ← slow, secure,
 *                                                              prevents brute
 *                                                              force from a
 *                                                              DB dump
 *
 * The lookup HMAC is a server-side secret, NOT a hash of a user secret with
 * a known salt — a leaked DB still leaves the attacker bcrypt-comparing one
 * row at a time, AND they can't recover the original token.
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async issue(
    userId: string,
    parentId?: string,
    ctx: { ip?: string; userAgent?: string } = {},
  ): Promise<RefreshIssued> {
    const raw = randomBytes(48).toString('base64url');
    const stored = await this.encode(raw);

    const ttlDays = this.parseTtlDays(
      this.config.get<{ refreshExpiresIn: string }>('jwt')?.refreshExpiresIn ?? '30d',
    );
    const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        hashedToken: stored,
        parentId,
        expiresAt,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
    });

    return { token: raw, expiresAt };
  }

  /**
   * Verify a refresh token and rotate it. On detected reuse (token already
   * revoked) we revoke every active token for the user — the canonical
   * defence against stolen refresh tokens.
   */
  async rotate(
    rawToken: string,
    ctx: { ip?: string; userAgent?: string } = {},
  ): Promise<{
    user: { id: string; email: string; role: Role };
    refresh: RefreshIssued;
    access: string;
  }> {
    const lookup = this.lookupHmac(rawToken);
    const candidate = await this.prisma.refreshToken.findFirst({
      where: { hashedToken: { startsWith: `${lookup}:` } },
    });
    if (!candidate) {
      throw new UnauthorizedException({
        message: 'Invalid refresh token',
        errorCode: 'INVALID_REFRESH',
      });
    }

    const bcryptPart = candidate.hashedToken.slice(lookup.length + 1);
    const ok = await bcrypt.compare(rawToken, bcryptPart);
    if (!ok) {
      throw new UnauthorizedException({
        message: 'Invalid refresh token',
        errorCode: 'INVALID_REFRESH',
      });
    }

    if (candidate.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({
        message: 'Refresh token expired',
        errorCode: 'REFRESH_EXPIRED',
      });
    }

    if (candidate.revokedAt) {
      // Reuse detected — burn the chain.
      await this.prisma.refreshToken.updateMany({
        where: { userId: candidate.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException({
        message: 'Refresh token reuse detected',
        errorCode: 'REFRESH_REUSE',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: candidate.userId },
      select: { id: true, email: true, role: true, isActive: true, isSuspended: true },
    });
    if (!user || !user.isActive || user.isSuspended) {
      throw new UnauthorizedException({
        message: 'Account is not active',
        errorCode: 'ACCOUNT_DISABLED',
      });
    }

    // Mark this one revoked, mint a successor.
    await this.prisma.refreshToken.update({
      where: { id: candidate.id },
      data: { revokedAt: new Date() },
    });
    const next = await this.issue(user.id, candidate.id, ctx);

    const access = this.jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.config.get<{ secret: string }>('jwt')?.secret,
        expiresIn:
          (this.config.get<{ expiresIn: string }>('jwt')?.expiresIn ?? '15m') as any,
      },
    );

    return {
      user: { id: user.id, email: user.email, role: user.role },
      refresh: next,
      access,
    };
  }

  async revokeAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ─── helpers ───────────────────────────────────────────
  private lookupHmac(raw: string): string {
    const secret =
      this.config.get<{ refreshSecret: string }>('jwt')?.refreshSecret ?? '';
    return createHmac('sha256', secret).update(raw).digest('hex');
  }

  private async encode(raw: string): Promise<string> {
    const lookup = this.lookupHmac(raw);
    const bcryptHash = await bcrypt.hash(raw, 10);
    return `${lookup}:${bcryptHash}`;
  }

  // Exposed so tests can build a `hashedToken` column without bcrypting.
  static encodeForTest(raw: string, refreshSecret: string, bcryptHash: string) {
    const lookup = createHmac('sha256', refreshSecret).update(raw).digest('hex');
    return `${lookup}:${bcryptHash}`;
  }

  private parseTtlDays(value: string): number {
    const match = /^(\d+)([dhm])$/.exec(value.trim());
    if (!match) return 30;
    const n = parseInt(match[1], 10);
    if (match[2] === 'd') return n;
    if (match[2] === 'h') return n / 24;
    if (match[2] === 'm') return n / (60 * 24);
    return 30;
  }

  // Constant-time compare helper — kept here in case it's needed by callers
  // elsewhere; not currently used because bcrypt.compare is already CT.
  static safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }
}
