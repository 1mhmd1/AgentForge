import { ExecutionContext, HttpException } from '@nestjs/common';
import { ConcurrencyGuard } from '../src/runs/concurrency.guard';

function ctx(user: any): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => ({}),
    }),
  } as any;
}

describe('ConcurrencyGuard', () => {
  it('passes through unauthenticated requests (JwtAuthGuard handles them)', async () => {
    const prisma: any = { userPlan: { findUnique: jest.fn() } };
    const runs: any = { countActiveForUser: jest.fn() };
    const guard = new ConcurrencyGuard(prisma, runs);
    expect(await guard.canActivate(ctx(undefined))).toBe(true);
    expect(runs.countActiveForUser).not.toHaveBeenCalled();
  });

  it('uses the user plan cap when present', async () => {
    const prisma: any = {
      userPlan: {
        findUnique: jest.fn().mockResolvedValue({ plan: { maxConcurrentRuns: 3 } }),
      },
    };
    const runs: any = { countActiveForUser: jest.fn().mockResolvedValue(2) };
    const guard = new ConcurrencyGuard(prisma, runs);
    expect(await guard.canActivate(ctx({ sub: 'u1' }))).toBe(true);
  });

  it('throws 429 when active runs >= cap', async () => {
    const prisma: any = {
      userPlan: {
        findUnique: jest.fn().mockResolvedValue({ plan: { maxConcurrentRuns: 1 } }),
      },
    };
    const runs: any = { countActiveForUser: jest.fn().mockResolvedValue(1) };
    const guard = new ConcurrencyGuard(prisma, runs);
    await expect(guard.canActivate(ctx({ sub: 'u1' }))).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('falls back to a sane default cap of 1 when no plan is assigned', async () => {
    const prisma: any = { userPlan: { findUnique: jest.fn().mockResolvedValue(null) } };
    const runs: any = { countActiveForUser: jest.fn().mockResolvedValue(0) };
    const guard = new ConcurrencyGuard(prisma, runs);
    expect(await guard.canActivate(ctx({ sub: 'u1' }))).toBe(true);
  });
});
