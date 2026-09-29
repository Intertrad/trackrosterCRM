/*
 * The backend enforces length only (min 12, max 128) on POST /auth/password/reset.
 * The extra composition rules below are advisory strength guidance drawn from the
 * approved design; they shape the meter but must never block a password the
 * server would accept, or the UI would invent a policy the API does not have.
 *
 * When GET /settings/security exposes a tenant password policy, replace
 * ADVISORY_RULES with the fetched policy rather than hard-coding it here.
 */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

export interface PasswordRule {
  id: string;
  label: string;
  enforced: boolean;
  test: (value: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: 'length',
    label: `At least ${MIN_PASSWORD_LENGTH} characters`,
    enforced: true,
    test: (value) => value.length >= MIN_PASSWORD_LENGTH,
  },
  {
    id: 'uppercase',
    label: 'One uppercase letter',
    enforced: false,
    test: (value) => /[A-Z]/.test(value),
  },
  {
    id: 'number',
    label: 'One number',
    enforced: false,
    test: (value) => /\d/.test(value),
  },
  {
    id: 'special',
    label: 'One special character',
    enforced: false,
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
];

export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordAssessment {
  satisfied: Set<string>;
  acceptable: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  strength: PasswordStrength;
}

const STRENGTH_BY_SCORE: Record<PasswordAssessment['score'], PasswordStrength> = {
  0: 'weak',
  1: 'weak',
  2: 'fair',
  3: 'good',
  4: 'strong',
};

export function assessPassword(value: string): PasswordAssessment {
  const satisfied = new Set(
    PASSWORD_RULES.filter((rule) => rule.test(value)).map((rule) => rule.id),
  );

  /* Only the server-enforced rules gate submission. */
  const acceptable =
    PASSWORD_RULES.filter((rule) => rule.enforced).every((rule) => satisfied.has(rule.id)) &&
    value.length <= MAX_PASSWORD_LENGTH;

  /*
   * A password the API would reject can still satisfy several advisory
   * rules. Reporting it as "good" would invite the user to submit something
   * that cannot succeed, so an unacceptable password is always weak.
   */
  const score = (
    acceptable ? Math.min(4, satisfied.size) : Math.min(1, satisfied.size)
  ) as PasswordAssessment['score'];

  return {
    satisfied,
    acceptable,
    score,
    strength: STRENGTH_BY_SCORE[score],
  };
}
