import { describe, expect, it } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { isCampaignClosedError, rethrowCampaignClosed } from './campaign-work-error.js';
describe('Campaign database conflict translation', () => {
  it('recognizes wrapped database conflicts without disclosing SQL', () => {
    const error = { cause: { code: 'TR001', message: 'private SQL payload' } };
    expect(isCampaignClosedError(error)).toBe(true);
    try {
      rethrowCampaignClosed(error);
      throw new Error('Expected conflict');
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictException);
      expect((e as ConflictException).getStatus()).toBe(409);
      expect(JSON.stringify((e as ConflictException).getResponse())).not.toContain('private SQL');
    }
  });
  it('does not misclassify unrelated errors or loop on cyclic causes', () => {
    const error: { cause?: unknown; code: string } = { code: '23505' };
    error.cause = error;
    expect(isCampaignClosedError(error)).toBe(false);
    expect(() => rethrowCampaignClosed(error)).not.toThrow();
  });
});
