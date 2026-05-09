import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class InstantiateTemplateDto {
  /**
   * Optional override prompt — if absent, falls back to the template's
   * `defaultPrompt`, with `{{variable}}` placeholders substituted from
   * `variables`.
   */
  @IsOptional() @IsString() @MaxLength(8000) prompt?: string;

  @IsOptional() @IsObject() variables?: Record<string, string>;

  @IsOptional() @IsString() sessionId?: string;
}
