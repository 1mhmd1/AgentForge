import {
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreditsService } from './credits.service';

@ApiTags('credits')
@ApiBearerAuth()
@Controller('credits')
@UseGuards(JwtAuthGuard)
export class CreditsController {
  constructor(private credits: CreditsService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Current credit balance + breakdown' })
  balance(@CurrentUser('sub') userId: string) {
    return this.credits.balance(userId);
  }

  @Get('entries')
  @ApiOperation({ summary: 'Paginated credit ledger entries' })
  entries(
    @CurrentUser('sub') userId: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.credits.listEntries(userId, {
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
    });
  }

  @Post('topup')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  @ApiOperation({
    summary: 'Top up credits (Stripe placeholder)',
    description: 'Returns 501 until billing module is wired up.',
  })
  topup() {
    throw new HttpException(
      {
        message: 'Topup endpoint is not implemented yet',
        errorCode: 'TOPUP_NOT_IMPLEMENTED',
      },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
