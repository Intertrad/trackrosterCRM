import type { SelfAccessGrant } from './auth-types';

/** GET /me — identity plus the active membership's scope. */
export interface AccountProfile {
  identityId: string;
  email: string;
  membershipId: string;
  userId: string;
  tenantId: string;
  tenantName: string;
  displayName: string | null;
  phone: string | null;
  locale: string;
  timezone: string;

  /** Whether a second factor is enrolled. The factor itself stays server-side. */
  mfaEnabled?: boolean;
  grants: SelfAccessGrant[];
}

export interface AccountPreferences {
  theme: 'system' | 'light' | 'dark';
  density: 'comfortable' | 'compact';
  reducedMotion: boolean;
  highContrast: boolean;
}

/** GET /me/memberships — only active memberships are returned by the API. */
export interface AccountMembership {
  membershipId: string;
  tenantId: string;
  tenantName: string;
  displayName: string | null;
  current: boolean;
  roles: string[];
}

export interface AccountSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  absoluteExpiresAt: string;
  current: boolean;
}

export interface AccountSessionPage {
  items: AccountSession[];
  nextCursor: string | null;
}

/** A resource plus the validator needed to update it safely. */
export interface Versioned<T> {
  resource: T;
  etag: string | null;
}

export interface UpdateAccountInput {
  displayName?: string;
  phone?: string | null;
  locale?: string;
  timezone?: string;
}

export type UpdatePreferencesInput = Partial<AccountPreferences>;
