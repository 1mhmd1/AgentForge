import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const cookieExtractor = (req: Request): string | null => {
  if (!req || !req.cookies) return null;
  return req.cookies['token'] ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private prisma: PrismaService) {
    const secret = config.get<string>('jwt.secret');
    if (!secret) {
      throw new Error('JWT_SECRET is missing');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub: string; email: string; role: Role }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true, isSuspended: true },
    });

    if (!user || !user.isActive || user.isSuspended) {
      throw new UnauthorizedException('User is not allowed to authenticate');
    }

    return { sub: user.id, email: user.email, role: user.role };
  }
}
