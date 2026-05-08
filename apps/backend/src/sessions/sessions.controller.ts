import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class SessionsController {
  constructor(private prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get('sessions/me')
  async mySessions(@Req() req: any) {
    const user = req.user as any;
    return this.prisma.session.findMany({
      where: { userId: user.sub },
      select: {
        id: true,
        userId: true,
        previousSessionId: true,
        expiresAt: true,
        lastSeenAt: true,
        createdAt: true,
        _count: { select: { runs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/sessions')
  async allSessions() {
    return this.prisma.session.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        previousSessionId: true,
        expiresAt: true,
        lastSeenAt: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
          },
        },
        _count: { select: { runs: true } },
      },
    });
  }
}
