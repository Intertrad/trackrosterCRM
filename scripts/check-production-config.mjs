/* global URL, console */

import process from 'node:process';

const errors = [];

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) errors.push(`${name} is required`);
  return value;
}

function url(name, { protocols, https = false, allowCredentials = false } = {}) {
  const value = required(name);
  if (!value) return null;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    errors.push(`${name} must be a valid URL`);
    return null;
  }
  if (protocols && !protocols.includes(parsed.protocol)) {
    errors.push(`${name} must use ${protocols.join(' or ')}`);
  }
  if (https && parsed.protocol !== 'https:') {
    errors.push(`${name} must use HTTPS in production`);
  }
  if (!allowCredentials && (parsed.username || parsed.password)) {
    errors.push(`${name} must not include embedded credentials`);
  }
  return parsed;
}

function requireHttpsOriginList(name) {
  const raw = required(name);
  if (!raw) return;
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0 || origins.includes('*')) {
    errors.push(`${name} must contain explicit HTTPS origins`);
    return;
  }
  for (const origin of origins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      errors.push(`${name} contains an invalid origin`);
      continue;
    }
    if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      errors.push(`${name} must contain HTTPS origin roots only`);
    }
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      errors.push(`${name} must not contain localhost in production`);
    }
  }
}

function requireSecret(name, minimumLength) {
  const value = required(name);
  if (value && value.length < minimumLength) {
    errors.push(`${name} must be at least ${minimumLength} characters`);
  }
}

if (process.env.NODE_ENV !== 'production') {
  console.error('Production preflight requires NODE_ENV=production');
  process.exit(2);
}

const authOrigin = url('AUTH_PUBLIC_ORIGIN', { https: true });
if (authOrigin && !['trackroster.com', 'www.trackroster.com'].includes(authOrigin.hostname)) {
  errors.push('AUTH_PUBLIC_ORIGIN must use trackroster.com or www.trackroster.com');
}

const apiOrigin = url('TRACKROSTER_API_URL', { https: true });
if (apiOrigin && ['localhost', '127.0.0.1'].includes(apiOrigin.hostname)) {
  errors.push('TRACKROSTER_API_URL must not point to localhost in production');
}

const database = url('DATABASE_URL', {
  protocols: ['postgres:', 'postgresql:'],
  allowCredentials: true,
});
if (database && database.searchParams.get('sslmode') !== 'require') {
  errors.push('DATABASE_URL must set sslmode=require in production');
}

const redis = url('REDIS_URL', { protocols: ['rediss:'] });
if (redis && redis.protocol !== 'rediss:') {
  errors.push('REDIS_URL must use rediss:// in production');
}

requireHttpsOriginList('API_CORS_ORIGINS');
requireSecret('JWT_ACCESS_SECRET', 32);
requireSecret('JWT_REFRESH_SECRET', 32);
const mfaKey = required('MFA_ENCRYPTION_KEY');
if (mfaKey && !/^[0-9a-f]{64}$/i.test(mfaKey)) {
  errors.push('MFA_ENCRYPTION_KEY must be a 32-byte hex key');
}

const brevoKey = required('BREVO_API_KEY');
const sender = required('BREVO_SENDER_EMAIL');
if (!brevoKey || !sender) {
  errors.push('BREVO_API_KEY and BREVO_SENDER_EMAIL are required for production mail delivery');
} else if (!/^\S+@\S+\.\S+$/.test(sender)) {
  errors.push('BREVO_SENDER_EMAIL must be a valid email address');
}

for (const name of ['MAILPIT_URL', 'DEV_ADMIN_PASSWORD']) {
  if (process.env[name]?.trim()) errors.push(`${name} must not be set in production`);
}

const storageValues = ['R2_ENDPOINT', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'].map(
  (name) => [name, process.env[name]?.trim() ?? ''],
);
const configuredStorage = storageValues.some(([, value]) => value.length > 0);
if (configuredStorage) {
  const storageEndpoint = url('R2_ENDPOINT', { https: true });
  if (!storageEndpoint || storageEndpoint.protocol !== 'https:') {
    errors.push('R2_ENDPOINT must use HTTPS in production');
  }
  for (const [name, value] of storageValues.slice(1)) {
    if (!value) errors.push(`${name} is required when object storage is configured`);
  }
}

if (errors.length > 0) {
  console.error('Production configuration preflight failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Production configuration preflight passed.');
