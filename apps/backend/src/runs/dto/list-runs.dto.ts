import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import { Domain, RunStatus } from '@prisma/client';

export class ListRunsDto {
  @IsOptional() @IsEnum(Domain) domain?: Domain;
  @IsOptional() @IsEnum(RunStatus) status?: RunStatus;
  @IsOptional() @Type(() => Date) @IsDate() from?: Date;
  @IsOptional() @Type(() => Date) @IsDate() to?: Date;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) perPage?: number;
}
