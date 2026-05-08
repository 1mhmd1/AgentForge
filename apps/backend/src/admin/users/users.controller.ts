import { Controller, Get, Query, UseGuards, Patch, Param, Body, ValidationPipe } from '@nestjs/common';
import { UsersAdminService } from './users.service';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('admin/users')
export class UsersAdminController {
  constructor(private svc: UsersAdminService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  async list(@Query(new ValidationPipe({ transform: true, whitelist: true })) q: PaginationQueryDto) {
    const page = q.page || 1;
    const perPage = q.perPage || 20;
    return this.svc.listUsers(page, perPage, q.q);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    if (dto.role) return this.svc.updateUserRole(id, dto.role);
    if (dto.status) return this.svc.updateUserStatus(id, dto.status);
    return {};
  }
}
