import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Domain, Role } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AgentsService } from './agents.service';

@Controller()
export class AgentsController {
  constructor(private agents: AgentsService) {}

  // GET /agents -> the caller's agent runs
  @Get('agents')
  @UseGuards(JwtAuthGuard)
  list(
    @CurrentUser('sub') userId: string,
    @Query('domain') domain?: Domain,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.agents.listForUser(userId, {
      domain,
      status,
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
    });
  }

  @Get('agents/:id')
  @UseGuards(JwtAuthGuard)
  getOne(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; role: Role },
  ) {
    return this.agents.findById(id, user);
  }

  // GET /admin/agents -> full list
  @Get('admin/agents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  adminList(
    @Query('domain') domain?: Domain,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.agents.listAll({
      domain,
      status,
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
    });
  }
}
