import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { PlanInterval, PlanTier } from '@prisma/client';

export class UpdatePlanDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsEnum(PlanTier) tier?: PlanTier;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @Type(() => Number) @IsInt() priceUSDCents?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) features?: string[];
  @IsOptional() @Type(() => Number) @IsInt() monthlyCredits?: number;
  @IsOptional() @Type(() => Number) @IsInt() maxConcurrentRuns?: number;
  @IsOptional() @Type(() => Number) @IsInt() maxStoredMB?: number;
  @IsOptional() @Type(() => Number) @IsInt() maxRunsPerDay?: number;
  @IsOptional() @Type(() => Number) @IsInt() priorityLevel?: number;
  @IsOptional() @IsBoolean() canUseCustomTemplates?: boolean;
  @IsOptional() @IsBoolean() canUseApi?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsEnum(PlanInterval) interval?: PlanInterval;
}
