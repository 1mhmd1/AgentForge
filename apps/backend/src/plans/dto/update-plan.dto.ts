import { Type } from 'class-transformer';
import { IsBoolean, IsArray, IsNumber, IsOptional, IsString, IsEnum } from 'class-validator';
import { PlanInterval } from '@prisma/client';

export class UpdatePlanDto {
	@IsOptional()
	@IsString()
	name?: string;

	@IsOptional()
	@IsString()
	slug?: string;

	@IsOptional()
	@IsString()
	description?: string;

	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	price?: number;

	@IsOptional()
	@IsString()
	currency?: string;

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	features?: string[];

	@IsOptional()
	@IsNumber()
	maxRuns?: number;

	@IsOptional()
	@IsNumber()
	maxAgents?: number;

	@IsOptional()
	@IsBoolean()
	active?: boolean;

	@IsOptional()
	@IsEnum(PlanInterval)
	interval?: PlanInterval;
}
