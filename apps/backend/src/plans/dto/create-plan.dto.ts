import { Type } from 'class-transformer';
import { IsString, IsNumber, IsOptional, IsBoolean, IsArray, IsEnum, Min } from 'class-validator';
import { PlanInterval } from '@prisma/client';

export class CreatePlanDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  currency?: string = 'USD';

  @IsArray()
  @IsString({ each: true })
  features!: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxRuns?: number = 100;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxAgents?: number = 5;

  @IsOptional()
  @IsBoolean()
  active?: boolean = true;

  @IsOptional()
  @IsEnum(PlanInterval)
  interval?: PlanInterval = PlanInterval.MONTHLY;
}
