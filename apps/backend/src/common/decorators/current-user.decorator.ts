import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  sub: string;
  email: string;
  role: string;
}

export const CurrentUser = createParamDecorator(
  (key: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | string => {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as AuthUser;
    if (!user) return undefined as any;
    return key ? (user[key] as any) : user;
  },
);
