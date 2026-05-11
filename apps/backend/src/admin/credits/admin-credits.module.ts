import { Module } from '@nestjs/common';
import { AdminCreditsController } from './admin-credits.controller';

@Module({ controllers: [AdminCreditsController] })
export class AdminCreditsModule {}
