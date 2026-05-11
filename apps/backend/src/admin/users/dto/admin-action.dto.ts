import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminActionReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
