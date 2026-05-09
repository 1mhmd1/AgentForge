import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpgradeSubscriptionDto {
  @IsString()
  planId!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  successUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  cancelUrl?: string;
}
