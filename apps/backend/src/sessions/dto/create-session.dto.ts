import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  /**
   * Optional override; if omitted the service uses the default TTL (30 days).
   */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;
}
