import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PlanInterval, PlanTier } from '@prisma/client';

export class CreatePlanDto {
  @IsString() name!: string;
  @IsString() slug!: string;
  @IsOptional() @IsEnum(PlanTier) tier?: PlanTier;
  @IsOptional() @IsString() description?: string;

  // Canonical pricing (cents) — replaces the legacy `price` float.
  @Type(() => Number) @IsInt() @Min(0) priceUSDCents!: number;

  @IsOptional() @IsString() currency?: string = 'USD';

  @IsArray() @IsString({ each: true }) features!: string[];

  @Type(() => Number) @IsInt() @Min(0) monthlyCredits!: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxConcurrentRuns?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxStoredMB?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxRunsPerDay?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priorityLevel?: number;

  @IsOptional() @IsBoolean() canUseCustomTemplates?: boolean;
  @IsOptional() @IsBoolean() canUseApi?: boolean;
  @IsOptional() @IsBoolean() active?: boolean = true;
  @IsOptional() @IsEnum(PlanInterval) interval?: PlanInterval = PlanInterval.MONTHLY;
}
