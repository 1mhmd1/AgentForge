import { ConfigService } from '@nestjs/config';
import { CreditsService } from '../src/modules/credits/credits.service';

describe('CreditsService.debitForRun', () => {
  function build() {
    const created: any[] = [];
    const prisma = {
      creditEntry: {
        create: jest.fn(({ data }: any) => {
          created.push(data);
          return Promise.resolve(data);
        }),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    } as any;
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'pricing') return { inputPer1k: 0.5, outputPer1k: 1.5 };
        return undefined;
      }),
    } as unknown as ConfigService;
    return { prisma, config, created };
  }

  it('writes a CreditEntry with negative amount derived from real token totals', async () => {
    const { prisma, config, created } = build();
    const svc = new CreditsService(prisma, config);
    await svc.debitForRun('user_1', 'run_1', {
      promptTokens: 1000, // $0.50
      completionTokens: 500, // $0.75
    });

    expect(created).toHaveLength(1);
    expect(created[0].userId).toBe('user_1');
    expect(created[0].runId).toBe('run_1');
    expect(created[0].reason).toBe('LLM_USAGE');
    // total $1.25 → 125 cents → -125
    expect(created[0].amount).toBe(-125);
    expect(created[0].metadata).toMatchObject({
      promptTokens: 1000,
      completionTokens: 500,
    });
  });

  it('skips when there is no consumption', async () => {
    const { prisma, config } = build();
    const svc = new CreditsService(prisma, config);
    const result = await svc.debitForRun('user_1', 'run_1', {
      promptTokens: 0,
      completionTokens: 0,
    });
    expect(result).toBeNull();
    expect(prisma.creditEntry.create).not.toHaveBeenCalled();
  });
});
