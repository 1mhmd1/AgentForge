import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeysService } from './apikeys.service';

/**
 * Allows machine clients to call the API with a `Authorization: Bearer agf_...`
 * header instead of a JWT cookie. On success, populates `req.user` with the
 * key's owner identity.
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private apiKeys: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header = req.headers['authorization'] as string | undefined;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing API key');
    }

    const raw = header.slice('Bearer '.length).trim();
    const keyRow = await this.apiKeys.verifyAndTouch(raw);
    if (!keyRow) throw new UnauthorizedException('Invalid API key');

    req.user = {
      sub: keyRow.user.id,
      email: keyRow.user.email,
      role: keyRow.user.role,
      apiKeyId: keyRow.id,
    };
    return true;
  }
}
