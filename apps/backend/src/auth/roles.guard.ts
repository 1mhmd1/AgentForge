import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const user = req.user as { role?: Role } | undefined;

    if (!user?.role) {
      throw new ForbiddenException({
        message: 'Authentication required',
        errorCode: 'FORBIDDEN',
      });
    }

    // SUPER_ADMIN can do anything an ADMIN can.
    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException({
        message: 'Insufficient role',
        errorCode: 'INSUFFICIENT_ROLE',
        details: { required: requiredRoles, actual: user.role },
      });
    }

    return true;
  }
}
