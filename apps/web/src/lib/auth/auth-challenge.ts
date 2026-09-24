import type { LoginOutcome } from '@/lib/api/auth-types';

/*
 * Short-lived login challenges are handed between auth screens through
 * sessionStorage rather than the URL: a challenge token in a query string
 * would leak through browser history, the Referer header and server logs.
 *
 * These tokens expire in five minutes server-side and are single-use, so
 * sessionStorage is the correct trade-off — it is per-tab, cleared on close,
 * and never sent with a request automatically.
 */
const MFA_KEY = 'trackroster.auth.mfa_challenge';
const ENROLLMENT_KEY = 'trackroster.auth.mfa_enrollment';
const WORKSPACE_KEY = 'trackroster.auth.workspace_challenge';

export interface StoredMfaChallenge {
  challengeToken: string;
  expiresAt: number;
}

export interface StoredEnrollmentChallenge extends StoredMfaChallenge {
  setupKey: string;
  otpauthUri: string;
}

export interface StoredWorkspaceChallenge {
  selectionToken: string;
  expiresAt: number;
  memberships: Extract<LoginOutcome, { next: 'workspace' }>['memberships'];
}

function read<T extends { expiresAt: number }>(key: string): T | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as T;

    if (typeof parsed?.expiresAt !== 'number' || parsed.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(key);

      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private browsing can refuse storage; the screen falls back to sign-in. */
  }
}

function clear(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* Nothing to recover from. */
  }
}

function expiryFrom(expiresIn: number): number {
  return Date.now() + expiresIn * 1000;
}

export function storeChallenge(outcome: LoginOutcome): void {
  if (outcome.next === 'mfa') {
    write(MFA_KEY, {
      challengeToken: outcome.challengeToken,
      expiresAt: expiryFrom(outcome.expiresIn),
    } satisfies StoredMfaChallenge);

    return;
  }

  if (outcome.next === 'mfa_enrollment') {
    write(ENROLLMENT_KEY, {
      challengeToken: outcome.challengeToken,
      setupKey: outcome.setupKey,
      otpauthUri: outcome.otpauthUri,
      expiresAt: expiryFrom(outcome.expiresIn),
    } satisfies StoredEnrollmentChallenge);

    return;
  }

  if (outcome.next === 'workspace') {
    write(WORKSPACE_KEY, {
      selectionToken: outcome.selectionToken,
      expiresAt: expiryFrom(outcome.expiresIn),
      memberships: outcome.memberships,
    } satisfies StoredWorkspaceChallenge);
  }
}

export const readMfaChallenge = () => read<StoredMfaChallenge>(MFA_KEY);
export const readEnrollmentChallenge = () => read<StoredEnrollmentChallenge>(ENROLLMENT_KEY);
export const readWorkspaceChallenge = () => read<StoredWorkspaceChallenge>(WORKSPACE_KEY);

export function clearChallenges(): void {
  clear(MFA_KEY);
  clear(ENROLLMENT_KEY);
  clear(WORKSPACE_KEY);
}

/** Route a login outcome to the screen that can complete it. */
export function challengeRoute(outcome: LoginOutcome): string {
  switch (outcome.next) {
    case 'authenticated':
      return '/';
    case 'mfa':
      return '/mfa';
    case 'mfa_enrollment':
      return '/mfa/enrol';
    case 'workspace':
      return '/select-workspace';
  }
}
