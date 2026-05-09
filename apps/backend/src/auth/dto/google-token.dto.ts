import { IsString } from 'class-validator';

/**
 * Used by SPA-style Google sign-in: client receives an ID token and POSTs it
 * to the backend, which verifies and exchanges it for our own JWT.
 */
export class GoogleTokenDto {
  @IsString()
  idToken!: string;
}
