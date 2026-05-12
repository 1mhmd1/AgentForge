import { Domain, RunStatus } from '@prisma/client';
import { RunsService } from '../src/runs/runs.service';

/**
 * Unit tests for the run lifecycle. Prisma is mocked — see schema-level
 * integration tests (testcontainers) for full DB exercise.
 */
function makePrisma() {
  const tables: any = {
    run: { rows: [] as any[] },
    agentRun: { rows: [] as any[] },
    attachmentRef: { rows: [] as any[] },
  };

  const prisma: any = {
    run: {
      create: jest.fn(({ data }: any) => {
        const row = {
          id: `run_${tables.run.rows.length + 1}`,
          createdAt: new Date(),
          startedAt: new Date(Date.now() - 5000),
          status: data.status ?? RunStatus.STARTED,
          ...data,
          deletedAt: null,
        };
        tables.run.rows.push(row);
        return Promise.resolve(row);
      }),
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve(tables.run.rows.find((r: any) => r.id === where.id) ?? null),
      ),
      findFirst: jest.fn(({ where }: any) => {
        const match = tables.run.rows.find(
          (r: any) =>
            r.userId === where?.userId &&
            r.idempotencyKey === where?.idempotencyKey,
        );
        return Promise.resolve(match ?? null);
      }),
      update: jest.fn(({ where, data }: any) => {
        const row = tables.run.rows.find((r: any) => r.id === where.id);
        Object.assign(row, data);
        return Promise.resolve(row);
      }),
      count: jest.fn(() => Promise.resolve(0)),
    },
    agentRun: {
      create: jest.fn(({ data }: any) => {
        const row = {
          id: `agent_${tables.agentRun.rows.length + 1}`,
          createdAt: new Date(),
          ...data,
        };
        tables.agentRun.rows.push(row);
        return Promise.resolve(row);
      }),
      update: jest.fn(({ where, data }: any) => {
        const row = tables.agentRun.rows.find((r: any) => r.runId === where.runId);
        Object.assign(row, data);
        return Promise.resolve(row);
      }),
    },
    attachmentRef: {
      createMany: jest.fn(({ data }: any) => {
        tables.attachmentRef.rows.push(...data);
        return Promise.resolve({ count: data.length });
      }),
    },
    attachment: {
      // Used by createRun to verify attachment ownership.
      count: jest.fn(({ where }: any) =>
        Promise.resolve((where?.id?.in ?? []).length),
      ),
    },
    $transaction: jest.fn((arg: any) => {
      if (typeof arg === 'function') return arg(prisma);
      return Promise.all(arg);
    }),
  };
  return { prisma, tables };
}

// Stub SessionsService (only assertWritable is consumed by RunsService).
const stubSessions = { assertWritable: jest.fn().mockResolvedValue(undefined) } as any;
const newSvc = (prisma: any) => new RunsService(prisma, stubSessions);

describe('RunsService.createRun', () => {
  it('creates Run + AgentRun in STARTED state', async () => {
    const { prisma, tables } = makePrisma();
    const svc = newSvc(prisma);
    const run = await svc.createRun({
      userId: 'u1',
      prompt: 'Build a thing',
      domain: Domain.web_research,
    });

    expect(run.status).toBe(RunStatus.STARTED);
    expect(tables.run.rows).toHaveLength(1);
    expect(tables.agentRun.rows).toHaveLength(1);
    expect(tables.agentRun.rows[0].runId).toBe(run.id);
  });

  it('returns the existing run when idempotency key matches within window', async () => {
    const { prisma, tables } = makePrisma();
    const svc = newSvc(prisma);
    const first = await svc.createRun({
      userId: 'u1',
      prompt: 'X',
      domain: Domain.web_research,
      idempotencyKey: 'key-A',
    });
    const second = await svc.createRun({
      userId: 'u1',
      prompt: 'X',
      domain: Domain.web_research,
      idempotencyKey: 'key-A',
    });
    expect(second.id).toBe(first.id);
    expect(tables.run.rows).toHaveLength(1);
  });

  it('writes attachment refs when provided', async () => {
    const { prisma, tables } = makePrisma();
    const svc = newSvc(prisma);
    await svc.createRun({
      userId: 'u1',
      prompt: 'X',
      domain: Domain.web_research,
      attachmentIds: ['a1', 'a2'],
    });
    expect(tables.attachmentRef.rows).toEqual([
      expect.objectContaining({ attachmentId: 'a1' }),
      expect.objectContaining({ attachmentId: 'a2' }),
    ]);
  });
});

describe('RunsService.markSuccess', () => {
  it('persists generated code, audit, validation report and totals', async () => {
    const { prisma, tables } = makePrisma();
    const svc = newSvc(prisma);
    const run = await svc.createRun({
      userId: 'u1',
      prompt: 'X',
      domain: Domain.web_research,
    });
    await svc.markSuccess(run.id, {
      generatedCode: 'print(1)',
      outputPath: '/tmp/x.py',
      runAudit: { total_tokens: 1500, prompt_tokens: 1000, completion_tokens: 500 },
      validationReport: { score: 92, errors: [], warnings: [] },
      validationStatus: 'passed',
      validationScore: 92,
      buildDurationSec: 4.5,
    });

    const updated = tables.run.rows[0];
    expect(updated.status).toBe(RunStatus.COMPLETED);
    expect(updated.generatedCode).toBe('print(1)');
    expect(updated.totalTokens).toBe(1500);
    expect(updated.validationScore).toBe(92);
    expect(updated.validationStatus).toBe('passed');
    expect(updated.completedAt).toBeInstanceOf(Date);

    const ag = tables.agentRun.rows[0];
    expect(ag.status).toBe('COMPLETED');
    expect(ag.isValid).toBe(true);
  });
});

describe('RunsService.markInterrupted', () => {
  it('flips active runs to INTERRUPTED with synthetic finalError', async () => {
    const { prisma, tables } = makePrisma();
    const svc = newSvc(prisma);
    const run = await svc.createRun({
      userId: 'u1',
      prompt: 'X',
      domain: Domain.web_research,
    });
    await svc.markInterrupted(run.id);
    const updated = tables.run.rows[0];
    expect(updated.status).toBe(RunStatus.INTERRUPTED);
    expect(updated.finalError).toBe('ai_service_disconnected');
    expect(updated.interruptedAt).toBeInstanceOf(Date);
  });

  it('leaves terminal runs untouched', async () => {
    const { prisma, tables } = makePrisma();
    const svc = newSvc(prisma);
    const run = await svc.createRun({
      userId: 'u1',
      prompt: 'X',
      domain: Domain.web_research,
    });
    await svc.markFailed(run.id, { finalError: 'oops' });
    const beforeStatus = tables.run.rows[0].status;
    await svc.markInterrupted(run.id);
    expect(tables.run.rows[0].status).toBe(beforeStatus); // unchanged
  });
});
