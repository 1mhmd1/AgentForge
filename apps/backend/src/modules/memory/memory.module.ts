import { Global, Module } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { MemoryController } from './memory.controller';

@Global()
@Module({
  providers: [MemoryService],
  controllers: [MemoryController],
  exports: [MemoryService],
})
export class MemoryModule {}
