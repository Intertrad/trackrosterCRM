import { Pool, type PoolConfig } from 'pg';

/**
 * Build a PostgreSQL pool for integration tests using the same explicit SSL
 * policy as the Nest database provider. The opt-out is intentionally limited
 * to non-production test runs; production must use a trusted CA chain.
 */
export function createIntegrationPool(connectionString: string): Pool {
  const configured = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED;
  const isProduction = process.env.NODE_ENV?.toLowerCase() === 'production';
  if (isProduction && configured?.toLowerCase() === 'false') {
    throw new Error('DATABASE_SSL_REJECT_UNAUTHORIZED=false is not allowed in production');
  }
  const rejectUnauthorized = configured
    ? configured.toLowerCase() !== 'false'
    : !(!isProduction && /(?:^|[?&])sslmode=require(?:&|$)/i.test(connectionString));
  const explicitlyDisablesTls = /(?:^|[?&])sslmode=disable(?:&|$)/i.test(connectionString);

  const config: PoolConfig = {
    connectionString,
    // The application pool (max 8) and the fixture pool share the same
    // Supabase session pool during integration tests. Keep this pool small so
    // the combined test process stays below the provider's pool_size limit.
    max: boundedIntegrationPoolMax(process.env.INTEGRATION_DATABASE_POOL_MAX),
    connectionTimeoutMillis: 3000,
  };

  if (
    !explicitlyDisablesTls &&
    (configured !== undefined ||
      (!isProduction && /(?:^|[?&])sslmode=require(?:&|$)/i.test(connectionString)))
  ) {
    const parsed = new URL(connectionString);
    parsed.searchParams.delete('sslmode');
    parsed.searchParams.delete('uselibpqcompat');
    config.connectionString = parsed.toString();
    config.ssl = { rejectUnauthorized };
  }

  return new Pool(config);
}

function boundedIntegrationPoolMax(value: string | undefined): number {
  if (value === undefined) return 2;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) {
    throw new Error('INTEGRATION_DATABASE_POOL_MAX must be an integer between 1 and 4');
  }
  return parsed;
}
