import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RunsService } from './runs.service';

@Controller('runs')
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Post()
  async create(@Body() body: { prompt: string }) {
    return this.runsService.create(body.prompt);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.runsService.findOne(id);
  }
}
