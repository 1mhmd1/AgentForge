import { Module } from '@nestjs/common';
import { UsersAdminController } from './users.controller';
import { UsersAdminService } from './users.service';

@Module({
  controllers: [UsersAdminController],
  providers: [UsersAdminService],
  exports: [UsersAdminService],
})
export class UsersAdminModule {}
