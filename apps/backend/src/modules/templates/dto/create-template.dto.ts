import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Domain } from '@prisma/client';

export class CreateTemplateDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;

  @IsEnum(Domain)
  domain!: Domain;

  @IsString() @MaxLength(8000) defaultPrompt!: string;

  /**
   * Either `fromRunId` (derive spec from a successful run) OR `spec` (raw)
   * is required.
   */
  @IsOptional() @IsString() fromRunId?: string;

  @ValidateIf((o) => !o.fromRunId)
  @IsObject()
  spec?: Record<string, unknown>;

  @IsOptional() @IsBoolean() isPublic?: boolean;
}
