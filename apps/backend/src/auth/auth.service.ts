import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { AuditService } from '../modules/audit/audit.service';
import { AuditAction } from '../modules/audit/audit.actions';
import { RefreshTokenService } from './refresh-token.service';

interface AuthContext {
  ip?: string;
  userAgent?: string;
}

export interface IssuedTokens {
  access_token: string;
  refresh_token: string;
  refresh_expires_at: Date;
  user: { id: string; email: string; role: Role };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
    private audit: AuditService,
    private refreshTokens: RefreshTokenService,
  ) {}

  async register(
    email: string,
    password: string,
    name: string | undefined,
    ctx: AuthContext = {},
  ): Promise<IssuedTokens> {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException({
        message: 'User already exists',
        errorCode: 'USER_EXISTS',
      });
    }
    const hash = await bcrypt.hash(password, 12);
    let user = await this.usersService.createUser({ email, name, passwordHash: hash });

    // Bootstrap: if the registering email matches ADMIN_EMAIL, promote to
    // SUPER_ADMIN immediately. Intended as a one-shot bootstrap for the first
    // admin in a fresh deployment — once promoted, prefer the admin console
    // (RolesGuard-protected) for further role changes.
    // process.env is populated by ConfigModule's envFilePath. ADMIN_EMAIL is
    // an optional bootstrap convenience, not part of the typed AppConfig.
    const adminEmail = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
    if (adminEmail && email.trim().toLowerCase() === adminEmail) {
      user = await this.usersService.setRole(user.id, Role.SUPER_ADMIN);
      this.logger.log(`Bootstrap promoted ${email} -> SUPER_ADMIN via ADMIN_EMAIL env`);
      await this.audit.log({
        action: AuditAction.ADMIN_USER_ROLE_CHANGE,
        userId: user.id,
        resource: 'USER',
        resourceId: user.id,
        metadata: { role: Role.SUPER_ADMIN, source: 'ADMIN_EMAIL_bootstrap' },
        ...ctx,
      });
    }

    await this.audit.log({
      action: AuditAction.AUTH_REGISTER,
      userId: user.id,
      resource: 'USER',
      resourceId: user.id,
      ...ctx,
    });
    return this.issueFor(user, ctx);
  }

  async validateUser(email: string, password: string, ctx: AuthContext = {}) {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.passwordHash) {
      await this.audit.log({
        action: AuditAction.AUTH_LOGIN_FAILED,
        success: false,
        metadata: { email },
        ...ctx,
      });
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        errorCode: 'INVALID_CREDENTIALS',
      });
    }

    if (!user.isActive || user.isSuspended) {
      await this.audit.log({
        action: AuditAction.AUTH_LOGIN_FAILED,
        userId: user.id,
        success: false,
        metadata: { reason: 'suspended_or_inactive' },
        ...ctx,
      });
      throw new UnauthorizedException({
        message: 'Account is not active',
        errorCode: 'ACCOUNT_DISABLED',
      });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await this.audit.log({
        action: AuditAction.AUTH_LOGIN_FAILED,
        userId: user.id,
        success: false,
        ...ctx,
      });
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        errorCode: 'INVALID_CREDENTIALS',
      });
    }
    return user;
  }

  async login(
    user: { id: string; email: string; role: Role },
    ctx: AuthContext = {},
  ): Promise<IssuedTokens> {
    await this.audit.log({ action: AuditAction.AUTH_LOGIN, userId: user.id, ...ctx });
    return this.issueFor(user, ctx);
  }

  async logout(userId: string, ctx: AuthContext = {}) {
    await this.refreshTokens.revokeAll(userId);
    await this.audit.log({ action: AuditAction.AUTH_LOGOUT, userId, ...ctx });
    return { message: 'Logged out' };
  }

  async refresh(rawRefreshToken: string, ctx: AuthContext = {}) {
    const result = await this.refreshTokens.rotate(rawRefreshToken, ctx);
    return {
      access_token: result.access,
      refresh_token: result.refresh.token,
      refresh_expires_at: result.refresh.expiresAt,
      user: result.user,
    };
  }

  async googleLogin(
    profile: { email: string; name: string; googleId: string },
    ctx: AuthContext = {},
  ): Promise<IssuedTokens> {
    let user = await this.usersService.findByGoogleId(profile.googleId);
    if (!user) {
      user = await this.usersService.findByEmail(profile.email);
      user = user
        ? await this.usersService.linkGoogleAccount(user.id, profile.googleId)
        : await this.usersService.createGoogleUser(profile);
    }
    await this.audit.log({ action: AuditAction.AUTH_GOOGLE, userId: user.id, ...ctx });
    return this.issueFor(user, ctx);
  }

  private async issueFor(
    user: { id: string; email: string; role: Role },
    ctx: AuthContext,
  ): Promise<IssuedTokens> {
    const access = this.jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.config.get<{ secret: string }>('jwt')?.secret,
        expiresIn:
          (this.config.get<{ expiresIn: string }>('jwt')?.expiresIn ?? '15m') as any,
      },
    );
    const refresh = await this.refreshTokens.issue(user.id, undefined, ctx);
    return {
      access_token: access,
      refresh_token: refresh.token,
      refresh_expires_at: refresh.expiresAt,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }
}
