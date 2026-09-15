import type { AuthenticatedUser } from '@/lib/api/auth-types';

import { authenticatedBackendJson } from './authenticated-backend-json';

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  return authenticatedBackendJson<AuthenticatedUser>('/auth/me');
}
