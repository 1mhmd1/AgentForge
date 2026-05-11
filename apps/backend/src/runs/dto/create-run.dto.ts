import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Domain } from '@prisma/client';

export class CreateRunDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  prompt!: string;

  @IsEnum(Domain, {
    message:
      'domain must be one of: website_builder, document, web_research, data_transform',
  })
  domain!: Domain;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  attachmentIds?: string[];
}
