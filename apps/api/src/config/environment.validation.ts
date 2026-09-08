const MINIMUM_JWT_SECRET_LENGTH = 32;

const JWT_TTL_PATTERN = /^\d+(s|m|h|d)$/;

function requireString(config: Record<string, unknown>, key: string): string {
  const value = config[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Environment variable ${key} is required`);
  }

  return value.trim();
}

function validateJwtSecret(config: Record<string, unknown>, key: string): void {
  const secret = requireString(config, key);

  if (secret.length < MINIMUM_JWT_SECRET_LENGTH) {
    throw new Error(
      `Environment variable ${key} must be at least ${MINIMUM_JWT_SECRET_LENGTH} characters`,
    );
  }
}

function validateJwtTtl(config: Record<string, unknown>, key: string): void {
  const ttl = requireString(config, key);

  if (!JWT_TTL_PATTERN.test(ttl)) {
    throw new Error(`Environment variable ${key} must use a duration such as 15m, 1h, or 7d`);
  }
}

function validateRedisUrl(config: Record<string, unknown>): void {
  const redisUrl = requireString(config, 'REDIS_URL');

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(redisUrl);
  } catch {
    throw new Error('Environment variable REDIS_URL must be a valid Redis URL');
  }

  if (parsedUrl.protocol !== 'redis:' && parsedUrl.protocol !== 'rediss:') {
    throw new Error('Environment variable REDIS_URL must use redis:// or rediss://');
  }
}

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  requireString(config, 'DATABASE_URL');

  validateRedisUrl(config);

  validateJwtSecret(config, 'JWT_ACCESS_SECRET');

  validateJwtSecret(config, 'JWT_REFRESH_SECRET');

  validateJwtTtl(config, 'JWT_ACCESS_TTL');

  validateJwtTtl(config, 'JWT_REFRESH_TTL');

  return config;
}
