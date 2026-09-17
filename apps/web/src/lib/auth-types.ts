export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';
