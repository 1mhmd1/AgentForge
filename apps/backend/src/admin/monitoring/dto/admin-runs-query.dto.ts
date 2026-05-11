import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Domain, RunStatus } from '@prisma/client';

export class AdminRunsQueryDto {
  @IsOptional() @IsEnum(Domain) domain?: Domain;
  @IsOptional() @IsEnum(RunStatus) status?: RunStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) perPage?: number;
}
