import { describe, expect, it } from 'vitest';

import { OrganizationCoordinationPolicyRepository } from './organization-coordination-policy.repository.js';

describe('OrganizationCoordinationPolicyRepository', () => {
  const database = {} as ConstructorParameters<typeof OrganizationCoordinationPolicyRepository>[0];

  const repository = new OrganizationCoordinationPolicyRepository(database);

  const lowerId = '11111111-1111-4111-8111-111111111111';

  const higherId = '99999999-9999-4999-8999-999999999999';

  it('keeps an already canonical organization pair', () => {
    expect(repository.canonicalizePair(lowerId, higherId)).toEqual({
      organizationAId: lowerId,

      organizationBId: higherId,
    });
  });

  it('reverses a non-canonical organization pair', () => {
    expect(repository.canonicalizePair(higherId, lowerId)).toEqual({
      organizationAId: lowerId,

      organizationBId: higherId,
    });
  });

  it('rejects a same-organization pair', () => {
    expect(() => repository.canonicalizePair(lowerId, lowerId)).toThrow(
      'Coordination policy requires two distinct organizations',
    );
  });
});
