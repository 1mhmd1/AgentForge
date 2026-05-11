import { IsOptional, IsEnum } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(['ACTIVE', 'SUSPENDED', 'DISABLED'] as any)
  status?: 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
}
