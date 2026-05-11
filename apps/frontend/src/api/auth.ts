import { client, setAccessToken, unwrap } from './client';

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const data = await unwrap<AuthResponse>(
    client.post('/auth/login', { email, password }),
  );
  setAccessToken(data.token);
  return data;
}

export async function register(
  email: string,
  password: string,
  name?: string,
): Promise<AuthResponse> {
  const data = await unwrap<AuthResponse>(
    client.post('/auth/register', { email, password, name }),
  );
  setAccessToken(data.token);
  return data;
}

export async function logout(): Promise<void> {
  try {
    await client.post('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}

export async function refresh(): Promise<AuthResponse | null> {
  try {
    const data = await unwrap<AuthResponse>(client.post('/auth/refresh'));
    setAccessToken(data.token);
    return data;
  } catch {
    setAccessToken(null);
    return null;
  }
}

export interface MePayload {
  sub: string;
  email: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export async function me(): Promise<MePayload | null> {
  try {
    return await unwrap<MePayload>(client.get('/auth/me'));
  } catch {
    return null;
  }
}
