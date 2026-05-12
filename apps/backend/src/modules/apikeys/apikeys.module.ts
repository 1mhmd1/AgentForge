import { Module } from '@nestjs/common';
import { ApiKeysService } from './apikeys.service';
import { ApiKeysController } from './apikeys.controller';
import { ApiKeyAuthGuard } from './apikey.guard';

@Module({
  providers: [ApiKeysService, ApiKeyAuthGuard],
  controllers: [ApiKeysController],
  exports: [ApiKeysService, ApiKeyAuthGuard],
})
export class ApiKeysModule {}
