import { Module } from '@nestjs/common';
import { UsersAdminController } from './users.controller';
import { UsersAdminService } from './users.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UsersAdminController],
  providers: [UsersAdminService],
})
export class UsersAdminModule {}
