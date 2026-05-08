import { IsString, IsOptional } from 'class-validator';

export class CreateRunDto {
  @IsString()
  prompt!: string;

  @IsString()
  sessionId!: string;

  @IsOptional()
  @IsString()
  domain?: string;
}
