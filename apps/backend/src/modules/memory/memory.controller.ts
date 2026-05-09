import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MemoryService } from './memory.service';
import { SearchMemoryDto } from './dto/search-memory.dto';

@ApiTags('memory')
@ApiBearerAuth()
@Controller('memory')
@UseGuards(JwtAuthGuard)
export class MemoryController {
  constructor(private memory: MemoryService) {}

  @Post('search')
  @ApiOperation({
    summary: 'Semantic search over the user history',
    description:
      'Searches Qdrant when QDRANT_URL is configured, otherwise falls back to a SQL LIKE search.',
  })
  search(
    @CurrentUser('sub') userId: string,
    @Body() dto: SearchMemoryDto,
  ) {
    return this.memory.search(userId, dto.query, dto.limit);
  }
}
