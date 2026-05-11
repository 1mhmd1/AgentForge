import { z } from 'zod';

/**
 * Boot-time env schema. Required keys must exist or the process refuses to
 * start. Optional ones (Stripe, Qdrant, Redis) are surfaced via feature flags
 * checked at runtime.
 */
const Schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('3000').transform((v) => parseInt(v, 10)),

  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  CORS_ALLOWED_ORIGINS: z.string().optional(), // comma-separated

  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z
    .string()
    .url()
    .default('http://localhost:3000/api/auth/google/callback'),

  AI_SERVICE_URL: z.string().url().default('http://localhost:4000'),
  AI_SERVICE_TIMEOUT_MS: z
    .string()
    .default('120000')
    .transform((v) => parseInt(v, 10)),

  USE_REDIS: z.enum(['true', 'false']).default('false'),
  REDIS_URL: z.string().url().optional(),
  REDIS_PASSWORD: z.string().optional(),
  QDRANT_URL: z.string().url().optional(),
  QDRANT_API_KEY: z.string().optional(),

  STORAGE_ROOT: z.string().default('./storage'),
  MAX_UPLOAD_BYTES: z
    .string()
    .default(`${5 * 1024 * 1024}`)
    .transform((v) => parseInt(v, 10)),

  LLM_PRICE_INPUT_PER_1K: z
    .string()
    .default('0.5')
    .transform((v) => parseFloat(v)),
  LLM_PRICE_OUTPUT_PER_1K: z
    .string()
    .default('1.5')
    .transform((v) => parseFloat(v)),

  STRIPE_API_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  RATE_LIMIT_TTL: z
    .string()
    .default('60')
    .transform((v) => parseInt(v, 10)),
  RATE_LIMIT_LIMIT: z
    .string()
    .default('120')
    .transform((v) => parseInt(v, 10)),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type RawEnv = z.infer<typeof Schema>;

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  frontendUrl: string;
  corsOrigins: string[];
  database: { url: string };
  jwt: {
    secret: string;
    refreshSecret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
    enabled: boolean;
  };
  ai: { serviceUrl: string; timeoutMs: number };
  redis: { url: string | null; enabled: boolean };
  qdrant: { url: string | null; apiKey: string | null; enabled: boolean };
  storage: { root: string; maxUploadBytes: number };
  pricing: { inputPer1k: number; outputPer1k: number };
  stripe: { apiKey: string | null; webhookSecret: string | null; enabled: boolean };
  rateLimit: { ttl: number; limit: number };
  logLevel: RawEnv['LOG_LEVEL'];
}

export function loadConfig(): AppConfig {
  const parsed = Schema.safeParse(process.env);
  if (!parsed.success) {
    const fmt = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${fmt}`);
  }
  const env = parsed.data;

  const corsOrigins = (env.CORS_ALLOWED_ORIGINS ?? env.FRONTEND_URL)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    frontendUrl: env.FRONTEND_URL,
    corsOrigins,
    database: { url: env.DATABASE_URL },
    jwt: {
      secret: env.JWT_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      expiresIn: env.JWT_EXPIRES_IN,
      refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    },
    google: {
      clientId: env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? '',
      callbackUrl: env.GOOGLE_CALLBACK_URL,
      enabled: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    },
    ai: { serviceUrl: env.AI_SERVICE_URL, timeoutMs: env.AI_SERVICE_TIMEOUT_MS },
    redis: {
      url: env.REDIS_URL ?? null,
      enabled: env.USE_REDIS === 'true' && !!env.REDIS_URL,
    },
    qdrant: {
      url: env.QDRANT_URL ?? null,
      apiKey: env.QDRANT_API_KEY ?? null,
      enabled: !!env.QDRANT_URL,
    },
    storage: { root: env.STORAGE_ROOT, maxUploadBytes: env.MAX_UPLOAD_BYTES },
    pricing: {
      inputPer1k: env.LLM_PRICE_INPUT_PER_1K,
      outputPer1k: env.LLM_PRICE_OUTPUT_PER_1K,
    },
    stripe: {
      apiKey: env.STRIPE_API_KEY ?? null,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? null,
      enabled: !!env.STRIPE_API_KEY,
    },
    rateLimit: { ttl: env.RATE_LIMIT_TTL, limit: env.RATE_LIMIT_LIMIT },
    logLevel: env.LOG_LEVEL,
  };
}

export default loadConfig;
