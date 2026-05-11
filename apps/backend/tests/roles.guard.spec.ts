import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from '../src/auth/roles.guard';

function ctx(user: any | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

function reflector(roles: Role[] | null): Reflector {
  return {
    getAllAndOverride: () => roles,
  } as any;
}

describe('RolesGuard', () => {
  it('allows when no @Roles metadata is present', () => {
    const guard = new RolesGuard(reflector(null));
    expect(guard.canActivate(ctx({ role: Role.USER }))).toBe(true);
  });

  it('rejects unauthenticated request when roles required', () => {
    const guard = new RolesGuard(reflector([Role.ADMIN]));
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });

  it('SUPER_ADMIN passes any required role check', () => {
    const guard = new RolesGuard(reflector([Role.ADMIN]));
    expect(guard.canActivate(ctx({ role: Role.SUPER_ADMIN }))).toBe(true);
  });

  it('USER fails when ADMIN is required', () => {
    const guard = new RolesGuard(reflector([Role.ADMIN]));
    expect(() => guard.canActivate(ctx({ role: Role.USER }))).toThrow(ForbiddenException);
  });

  it('passes when role matches exactly', () => {
    const guard = new RolesGuard(reflector([Role.ADMIN, Role.USER]));
    expect(guard.canActivate(ctx({ role: Role.USER }))).toBe(true);
  });
});
