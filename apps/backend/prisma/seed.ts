import {
  AgentRunStatus,
  Domain,
  PlanInterval,
  PlanTier,
  PrismaClient,
  Role,
  RunStatus,
  TemplateStatus,
  UsageType,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash('Admin123!', 12);
  const userPasswordHash = await bcrypt.hash('User123!', 12);

  // Wipe demo data in dependency order so the seed is repeatable.
  await prisma.creditEntry.deleteMany();
  await prisma.usageLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.adminAction.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.attachmentRef.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.memoryPoint.deleteMany();
  await prisma.agentRun.deleteMany();
  await prisma.run.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.userPlan.deleteMany();
  await prisma.session.deleteMany();
  await prisma.template.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.plan.deleteMany();

  // ─── Plans ────────────────────────────────────────────
  const freePlan = await prisma.plan.create({
    data: {
      name: 'Free',
      slug: 'free',
      tier: PlanTier.FREE,
      description: 'Try AgentForge with limited usage',
      priceUSDCents: 0,
      currency: 'USD',
      interval: PlanInterval.MONTHLY,
      features: ['25 runs/month', '1 concurrent run', 'community templates'],
      monthlyCredits: 2500,
      maxConcurrentRuns: 1,
      maxStoredMB: 50,
      maxRunsPerDay: 5,
      priorityLevel: 0,
      canUseCustomTemplates: false,
      canUseApi: false,
      active: true,
    },
  });

  const proPlan = await prisma.plan.create({
    data: {
      name: 'Pro',
      slug: 'pro',
      tier: PlanTier.PRO,
      description: 'For serious automation builders',
      priceUSDCents: 4900,
      currency: 'USD',
      interval: PlanInterval.MONTHLY,
      features: ['1000 runs/month', '5 concurrent runs', 'custom templates', 'API access'],
      monthlyCredits: 100000,
      maxConcurrentRuns: 5,
      maxStoredMB: 1024,
      maxRunsPerDay: 50,
      priorityLevel: 5,
      canUseCustomTemplates: true,
      canUseApi: true,
      active: true,
    },
  });

  const enterprisePlan = await prisma.plan.create({
    data: {
      name: 'Enterprise',
      slug: 'enterprise',
      tier: PlanTier.ENTERPRISE,
      description: 'Unlimited execution with priority support',
      priceUSDCents: 49900,
      currency: 'USD',
      interval: PlanInterval.YEARLY,
      features: ['unlimited runs', '50 concurrent runs', 'priority queue', 'SLA'],
      monthlyCredits: 10_000_000,
      maxConcurrentRuns: 50,
      maxStoredMB: 51200,
      maxRunsPerDay: 1000,
      priorityLevel: 10,
      canUseCustomTemplates: true,
      canUseApi: true,
      active: true,
    },
  });

  // ─── Users ────────────────────────────────────────────
  const admin = await prisma.user.create({
    data: {
      email: 'admin@agentforge.local',
      name: 'AgentForge Admin',
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      isActive: true,
      isSuspended: false,
      passwordHash: adminPasswordHash,
    },
  });

  const user = await prisma.user.create({
    data: {
      email: 'user@agentforge.local',
      name: 'AgentForge User',
      role: Role.USER,
      status: UserStatus.ACTIVE,
      isActive: true,
      isSuspended: false,
      passwordHash: userPasswordHash,
    },
  });

  // ─── UserPlan ─────────────────────────────────────────
  await prisma.userPlan.create({
    data: {
      userId: admin.id,
      planId: enterprisePlan.id,
      renewsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.userPlan.create({
    data: {
      userId: user.id,
      planId: freePlan.id,
      renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // Bootstrap a starting balance via the credit ledger.
  await prisma.creditEntry.create({
    data: {
      userId: user.id,
      amount: freePlan.monthlyCredits,
      reason: 'PLAN_RENEWAL',
      metadata: { seeded: true },
    },
  });

  // ─── Session + Run + AgentRun ─────────────────────────
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      title: 'Initial workspace',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });

  const startedAt = new Date(Date.now() - 60_000);
  const completedAt = new Date();
  const run = await prisma.run.create({
    data: {
      userId: user.id,
      sessionId: session.id,
      prompt: 'Build a data transform workflow from a CSV file',
      domain: Domain.data_transform,
      status: RunStatus.COMPLETED,
      currentStage: 'VALIDATOR',
      startedAt,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      buildDurationSec: (completedAt.getTime() - startedAt.getTime()) / 1000,
      validationStatus: 'passed',
      validationScore: 92,
      totalTokens: 1500,
      promptTokens: 1000,
      completionTokens: 500,
      spec: {
        goal: 'Transform CSV data into a normalized format',
        domain: 'data_transform',
        steps: ['load csv', 'normalize', 'export'],
        tools: ['pandas'],
        outputs: ['normalized csv'],
      },
      runAudit: {
        total_tokens: 1500,
        prompt_tokens: 1000,
        completion_tokens: 500,
        agents_executed: ['step_1', 'step_2'],
        provider_usage: { groq: 2 },
        per_agent_tokens: {},
        failed_step: null,
      },
      validationReport: {
        validation_status: 'passed',
        syntax_valid: true,
        file_valid: true,
        execution_valid: true,
        audit_valid: true,
        score: 92,
        errors: [],
        warnings: [],
      },
      generatedCode: '# generated by seed\nprint("hello, AgentForge")',
      outputPath: '/tmp/agentforge/normalized.py',
      finalError: null,
    },
  });

  await prisma.agentRun.create({
    data: {
      runId: run.id,
      domain: Domain.data_transform,
      status: AgentRunStatus.COMPLETED,
      spec: { goal: 'Transform CSV data into a normalized format' },
      result: { score: 92 },
      semanticScore: 0.95,
      validationScore: 0.92,
      isValid: true,
      repairAttempts: 0,
      logs: [{ event: 'success', message: 'Completed seed run' }],
      metadata: { seeded: true },
    },
  });

  // ─── Template ─────────────────────────────────────────
  await prisma.template.create({
    data: {
      domain: Domain.data_transform,
      name: 'CSV Normalizer',
      description: 'Loads a CSV, normalizes columns, exports a new CSV.',
      defaultPrompt: 'Normalize the columns of {{input_path}} and export to {{output_path}}',
      spec: { goal: 'Normalize CSV', domain: 'data_transform' },
      embeddingId: null,
      usageCount: 1,
      successRate: 1,
      isPublic: true,
      status: TemplateStatus.APPROVED,
      userId: admin.id,
    },
  });

  // ─── Usage log + Credit debit (LLM_USAGE) ─────────────
  await prisma.usageLog.create({
    data: {
      userId: user.id,
      runId: run.id,
      type: UsageType.RUN,
      tokensInput: 1000,
      tokensOutput: 500,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      filesGenerated: 1,
      storageBytes: 2048,
      creditsConsumed: 125,
      metadata: { domain: 'data_transform' },
    },
  });

  await prisma.creditEntry.create({
    data: {
      userId: user.id,
      runId: run.id,
      amount: -125,
      reason: 'LLM_USAGE',
      metadata: {
        promptTokens: 1000,
        completionTokens: 500,
      },
    },
  });

  console.log('Seed complete');
  console.log({
    admin: { email: 'admin@agentforge.local', password: 'Admin123!' },
    user: { email: 'user@agentforge.local', password: 'User123!' },
    plans: [freePlan.slug, proPlan.slug, enterprisePlan.slug],
    sessionId: session.id,
    runId: run.id,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
