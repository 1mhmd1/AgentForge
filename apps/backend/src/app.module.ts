import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './prisma/prisma.module';
import { RunsModule } from './modules/runs/runs.module';
import { AiModule } from './modules/ai/ai.module';
import { UsersModule } from './modules/users/users.module';
import { StreamingModule } from './modules/streaming/streaming.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    RunsModule,
    AiModule,
    UsersModule,
    StreamingModule,
  ],
})
export class AppModule {}
