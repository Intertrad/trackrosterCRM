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

  const config: PoolConfig = {
    connectionString,
    connectionTimeoutMillis: 3000,
  };

  if (
    configured !== undefined ||
    (!isProduction && /(?:^|[?&])sslmode=require(?:&|$)/i.test(connectionString))
  ) {
    const parsed = new URL(connectionString);
    parsed.searchParams.delete('sslmode');
    parsed.searchParams.delete('uselibpqcompat');
    config.connectionString = parsed.toString();
    config.ssl = { rejectUnauthorized };
  }

  return new Pool(config);
}
