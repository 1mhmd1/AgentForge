import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Role } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FilesService } from './files.service';
import { promises as fs } from 'fs';

@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private files: FilesService) {}

  @Post()
  @ApiOperation({ summary: 'Upload an attachment' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.files.upload(userId, file);
  }

  @Get()
  @ApiOperation({ summary: 'List the caller’s attachments' })
  list(@CurrentUser('sub') userId: string) {
    return this.files.list(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Attachment metadata' })
  getOne(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; role: Role },
  ) {
    return this.files.findById(id, user);
  }

  @Get(':id/raw')
  @ApiOperation({ summary: 'Download the raw file body' })
  async raw(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; role: Role },
    @Res() res: Response,
  ) {
    const att = await this.files.findById(id, user);
    res.setHeader('Content-Type', att.mimetype);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(att.filename)}"`,
    );
    const data = await fs.readFile(att.storagePath);
    res.end(data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an attachment' })
  delete(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; role: Role },
  ) {
    return this.files.delete(id, user);
  }
}
