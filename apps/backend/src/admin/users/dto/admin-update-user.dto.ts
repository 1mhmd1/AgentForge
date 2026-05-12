import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Role, UserStatus } from '@prisma/client';

export class AdminUpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isSuspended?: boolean;
  @IsOptional() @IsString() planId?: string | null;
  @IsOptional() @IsInt() @Min(0) credits?: number;
}
