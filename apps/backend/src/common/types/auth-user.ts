import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface RequestWithUser extends Express.Request {
  user: JwtPayload;
}
