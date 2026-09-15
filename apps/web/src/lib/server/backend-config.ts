const DEFAULT_BACKEND_URL = 'http://127.0.0.1:3001';

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getBackendBaseUrl(): string {
  const configuredUrl = process.env.TRACKROSTER_API_URL?.trim();

  if (configuredUrl) {
    return normalizeBaseUrl(configuredUrl);
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('TRACKROSTER_API_URL is required in production');
  }

  return DEFAULT_BACKEND_URL;
}
