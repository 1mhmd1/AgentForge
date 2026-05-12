import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { resolve } from 'path';

import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SessionsModule } from './sessions/sessions.module';
import { RunsModule } from './runs/runs.module';
import { PlansModule } from './plans/plans.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { UsersAdminModule } from './admin/users/users.module';
import { MonitoringModule } from './admin/monitoring/monitoring.module';
import { AdminCreditsModule } from './admin/credits/admin-credits.module';

import { AuditModule } from './modules/audit/audit.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { AgentsModule } from './modules/agents/agents.module';
import { UsageModule } from './modules/usage/usage.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ApiKeysModule } from './modules/apikeys/apikeys.module';
import { CreditsModule } from './modules/credits/credits.module';
import { FilesModule } from './modules/files/files.module';
import { MemoryModule } from './modules/memory/memory.module';
import { HealthModule } from './modules/health/health.module';
import { ObservabilityModule } from './modules/observability/observability.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Monorepo .env lives two levels up from apps/backend (repo root).
      // Falling back to a local .env too so single-app deploys still work.
      envFilePath: [resolve(process.cwd(), '../../.env'), resolve(process.cwd(), '.env')],
      load: [() => ({ ...configuration() })],
    }),
    ThrottlerModule.forRootAsync({
      useFactory: () => [
        {
          ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10) * 1000,
          limit: parseInt(process.env.RATE_LIMIT_LIMIT || '120', 10),
        },
      ],
    }),

    // Global infrastructure (every module can inject these)
    PrismaModule,
    RedisModule,
    AuditModule,
    UsageModule,
    CreditsModule,
    FilesModule,
    MemoryModule,

    // Domain modules
    AuthModule,
    UsersModule,
    SessionsModule,
    RunsModule,
    AgentsModule,
    TemplatesModule,
    PlansModule,
    SubscriptionsModule,
    ApiKeysModule,

    // Admin / observability
    UsersAdminModule,
    MonitoringModule,
    AdminCreditsModule,
    AnalyticsModule,
    HealthModule,
    ObservabilityModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
