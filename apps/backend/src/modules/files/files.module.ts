import { Global, Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';

@Global()
@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: parseInt(process.env.MAX_UPLOAD_BYTES || `${5 * 1024 * 1024}`, 10),
      },
    }),
  ],
  providers: [FilesService],
  controllers: [FilesController],
  exports: [FilesService],
})
export class FilesModule {}
