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

function validatePositiveInteger(config: Record<string, unknown>, key: string): void {
  const rawValue = requireString(config, key);

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Environment variable ${key} must be a positive integer`);
  }
}

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  requireString(config, 'DATABASE_URL');

  validateRedisUrl(config);

  validateJwtSecret(config, 'JWT_ACCESS_SECRET');

  validateJwtSecret(config, 'JWT_REFRESH_SECRET');

  validateJwtTtl(config, 'JWT_ACCESS_TTL');

  validateJwtTtl(config, 'JWT_REFRESH_TTL');

  validatePositiveInteger(config, 'PROSPECT_COOLING_OFF_MINUTES');
  for (const key of ['AUTH_RATE_LIMIT_IP', 'AUTH_RATE_LIMIT_ACCOUNT']) {
    if (config[key] !== undefined) validatePositiveInteger(config, key);
  }

  if (
    config.MFA_ENCRYPTION_KEY !== undefined &&
    (typeof config.MFA_ENCRYPTION_KEY !== 'string' ||
      !/^[0-9a-f]{64}$/i.test(config.MFA_ENCRYPTION_KEY))
  ) {
    throw new Error('MFA_ENCRYPTION_KEY must be a 32-byte hex key');
  }

  return config;
}
