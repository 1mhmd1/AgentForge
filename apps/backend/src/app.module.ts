import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SessionsModule } from './sessions/sessions.module';
import { PrismaModule } from './prisma/prisma.module';
import { RunsModule } from './runs/runs.module';
import { PlansModule } from './plans/plans.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { UsersAdminModule } from './admin/users/users.module';
import { MonitoringModule } from './admin/monitoring/monitoring.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    UsersModule,
    SessionsModule,
    PrismaModule,
    RunsModule,
    PlansModule,
    SubscriptionsModule,
    UsersAdminModule,
    MonitoringModule,
  ],
})
export class AppModule {}