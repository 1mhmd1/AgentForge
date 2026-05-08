import { IsOptional, IsString } from 'class-validator';

export class AdminRunsQueryDto {
  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
