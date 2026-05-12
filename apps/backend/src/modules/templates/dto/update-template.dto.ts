import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Domain, TemplateStatus } from '@prisma/client';

export class UpdateTemplateDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsEnum(Domain) domain?: Domain;
  @IsOptional() @IsString() @MaxLength(8000) defaultPrompt?: string;
  @IsOptional() @IsObject() spec?: Record<string, unknown>;
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsEnum(TemplateStatus) status?: TemplateStatus;
}
