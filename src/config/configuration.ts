/**
 * Central typed configuration. Loaded once via @nestjs/config.
 * Every value is sourced from the environment with a sane dev default.
 */
export interface AppConfig {
  env: string;
  port: number;
  apiPrefix: string;
  databaseUrl: string;
  analyticsDatabaseUrl?: string;
  redis: { host: string; port: number; password?: string };
  cache: { defaultTtl: number; dashboardTtl: number };
  minio: {
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    bucket: string;
    presignExpiry: number;
  };
  mail: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    password?: string;
    from: string;
    attachMaxBytes: number;
  };
  retention: { defaultDays: number; cleanupCron: string };
  company: { name: string; logoPath?: string };
}

const toInt = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== '' ? n : fallback;
};

const toBool = (v: string | undefined, fallback = false): boolean =>
  v === undefined ? fallback : v === 'true' || v === '1';

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: toInt(process.env.PORT, 3000),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  databaseUrl: process.env.DATABASE_URL ?? '',
  analyticsDatabaseUrl: process.env.ANALYTICS_DATABASE_URL || undefined,
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: toInt(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  cache: {
    defaultTtl: toInt(process.env.CACHE_DEFAULT_TTL, 300),
    dashboardTtl: toInt(process.env.DASHBOARD_CACHE_TTL, 60),
  },
  minio: {
    endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: toInt(process.env.MINIO_PORT, 9000),
    useSSL: toBool(process.env.MINIO_USE_SSL, false),
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    bucket: process.env.MINIO_BUCKET ?? 'reports',
    presignExpiry: toInt(process.env.MINIO_PRESIGN_EXPIRY, 3600),
  },
  mail: {
    host: process.env.SMTP_HOST ?? 'localhost',
    port: toInt(process.env.SMTP_PORT, 1025),
    secure: toBool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || undefined,
    password: process.env.SMTP_PASSWORD || undefined,
    from: process.env.MAIL_FROM ?? 'Reports <no-reply@reports.local>',
    attachMaxBytes: toInt(process.env.MAIL_ATTACH_MAX_BYTES, 10 * 1024 * 1024),
  },
  retention: {
    defaultDays: toInt(process.env.DEFAULT_RETENTION_DAYS, 90),
    cleanupCron: process.env.CLEANUP_CRON ?? '0 3 * * *',
  },
  company: {
    name: process.env.COMPANY_NAME ?? 'Acme Analytics',
    logoPath: process.env.COMPANY_LOGO_PATH || undefined,
  },
});
