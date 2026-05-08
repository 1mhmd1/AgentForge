import { PrismaClient, Role, Domain, Stage, RunStatus, AgentRunStatus, SubscriptionStatus, PlanInterval, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
  const userPasswordHash = await bcrypt.hash('User123!', 10);

  // Wipe demo data in dependency order so the seed is repeatable.
  await prisma.agentRun.deleteMany();
  await prisma.run.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.session.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      email: 'admin@agentforge.local',
      name: 'AgentForge Admin',
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      passwordHash: adminPasswordHash,
    },
  });

  const user = await prisma.user.create({
    data: {
      email: 'user@agentforge.local',
      name: 'AgentForge User',
      role: Role.USER,
      status: UserStatus.ACTIVE,
      passwordHash: userPasswordHash,
    },
  });

  const starterPlan = await prisma.plan.create({
    data: {
      name: 'Starter',
      slug: 'starter',
      description: 'Seed plan for functional testing',
      price: 19,
      currency: 'USD',
      interval: PlanInterval.MONTHLY,
      features: ['5 runs/day', '1 active agent', 'basic support'],
      maxRuns: 100,
      maxAgents: 1,
      active: true,
    },
  });

  const proPlan = await prisma.plan.create({
    data: {
      name: 'Pro',
      slug: 'pro',
      description: 'Higher limits for end-to-end API testing',
      price: 99,
      currency: 'USD',
      interval: PlanInterval.YEARLY,
      features: ['unlimited runs', '5 active agents', 'priority support'],
      maxRuns: 5000,
      maxAgents: 5,
      active: true,
    },
  });

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });

  const run = await prisma.run.create({
    data: {
      sessionId: session.id,
      userPrompt: 'Build a data transform workflow from a CSV file',
      stage: Stage.COMPLETED,
      status: RunStatus.COMPLETED,
      domain: Domain.DATA_TRANSFORM,
      spec: {
        goal: 'Transform CSV data into a normalized format',
        domain: 'data_transform',
        steps: ['load csv', 'normalize', 'export'],
        tools: ['pandas'],
        outputs: ['normalized csv'],
      },
      finalError: null,
    },
  });

  await prisma.agentRun.create({
    data: {
      runId: run.id,
      domain: Domain.DATA_TRANSFORM,
      status: AgentRunStatus.COMPLETED,
      spec: {
        goal: 'Transform CSV data into a normalized format',
      },
      result: {
        outputPath: '/tmp/agentforge/normalized.csv',
      },
      semanticScore: 0.95,
      isValid: true,
      repairAttempts: 0,
      logs: [{ event: 'success', message: 'Completed seed run' }],
      metadata: { seeded: true },
    },
  });

  await prisma.subscription.create({
    data: {
      userId: user.id,
      planId: starterPlan.id,
      status: SubscriptionStatus.ACTIVE,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });

  console.log('Seed complete');
  console.log({
    admin: { email: 'admin@agentforge.local', password: 'Admin123!' },
    user: { email: 'user@agentforge.local', password: 'User123!' },
    plans: [starterPlan.slug, proPlan.slug],
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
