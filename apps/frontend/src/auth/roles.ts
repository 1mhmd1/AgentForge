import { AuthUser } from '../api/auth';

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'USER';

export function isAdmin(user: AuthUser | null | undefined): boolean {
  if (!user || !user.role) return false;
  return user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
}

export function isSuperAdmin(user: AuthUser | null | undefined): boolean {
  return !!user && user.role === 'SUPER_ADMIN';
}
