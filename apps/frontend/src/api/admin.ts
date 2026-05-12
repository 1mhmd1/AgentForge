import { client, unwrap } from './client';

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'USER';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'DELETED';

export interface AdminUserPlan {
  plan: { id: string; name: string; slug: string; tier: string } | null;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: Role;
  status: UserStatus;
  isActive: boolean;
  isSuspended: boolean;
  createdAt: string;
  updatedAt: string;
  userPlan?: AdminUserPlan | null;
  _count?: { sessions: number; runs: number; apiKeys: number };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}

export interface ListUsersQuery {
  page?: number;
  perPage?: number;
  q?: string;
  role?: Role;
  status?: UserStatus;
}

export async function listUsers(q: ListUsersQuery = {}): Promise<Paginated<AdminUser>> {
  return unwrap<Paginated<AdminUser>>(
    client.get('/admin/users', { params: q }),
  );
}

export async function updateUserRole(userId: string, role: Role): Promise<AdminUser> {
  return unwrap<AdminUser>(client.patch(`/admin/users/${userId}`, { role }));
}

export async function suspendUser(userId: string, reason?: string): Promise<AdminUser> {
  return unwrap<AdminUser>(client.post(`/admin/users/${userId}/suspend`, { reason }));
}

export async function unsuspendUser(userId: string, reason?: string): Promise<AdminUser> {
  return unwrap<AdminUser>(client.post(`/admin/users/${userId}/unsuspend`, { reason }));
}

export async function deleteUser(userId: string, reason?: string): Promise<{ message: string }> {
  return unwrap<{ message: string }>(
    client.delete(`/admin/users/${userId}`, { data: { reason } }),
  );
}

export interface CreditEntry {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  runId: string | null;
  metadata: unknown;
  createdAt: string;
}

export async function grantCredits(
  userId: string,
  amount: number,
  reason?: string,
): Promise<CreditEntry> {
  return unwrap<CreditEntry>(
    client.post(`/admin/users/${userId}/grant-credits`, { amount, reason }),
  );
}

export interface AnalyticsOverview {
  users: { total: number; active: number; suspended: number };
  sessions: { total: number };
  runs: {
    total: number;
    last24h: number;
    last30d: number;
    failedLast30d: number;
    failureRateLast30d: number;
  };
  quality: { avgValidationScore: number; avgSemanticScore: number };
  templates: { total: number };
  subscriptions: { active: number };
}

export async function analyticsOverview(): Promise<AnalyticsOverview> {
  return unwrap<AnalyticsOverview>(client.get('/admin/analytics/overview'));
}

export interface RunsAnalytics {
  windowDays: number;
  byStatus: { status: string; count: number }[];
  byDomain: { domain: string; count: number }[];
  perDay: { day: string; count: number }[];
}

export async function analyticsRuns(days = 30): Promise<RunsAnalytics> {
  return unwrap<RunsAnalytics>(client.get('/admin/analytics/runs', { params: { days } }));
}

export interface AuditLogEntry {
  id: string;
  action: string;
  userId: string | null;
  resource: string | null;
  resourceId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface ListAuditQuery {
  userId?: string;
  action?: string;
  resource?: string;
  page?: number;
  perPage?: number;
}

export async function listAuditLogs(q: ListAuditQuery = {}): Promise<Paginated<AuditLogEntry>> {
  return unwrap<Paginated<AuditLogEntry>>(
    client.get('/admin/audit-logs', { params: q }),
  );
}

export interface AdminRunRow {
  id: string;
  status: string;
  domain: string | null;
  prompt: string;
  createdAt: string;
  user?: { id: string; email: string } | null;
}

export async function listAdminRuns(params: { page?: number; perPage?: number; status?: string } = {}): Promise<Paginated<AdminRunRow>> {
  return unwrap<Paginated<AdminRunRow>>(client.get('/admin/runs', { params }));
}

export async function cancelAllActiveRuns(): Promise<{ cancelled: number }> {
  return unwrap<{ cancelled: number }>(client.post('/admin/runs/cancel-active'));
}
