import { rethrowCampaignClosed } from '../campaigns/campaign-work-error.js';
import { ConflictException } from '@nestjs/common';
export function rethrowConsentBlock(error: unknown) {
  rethrowCampaignClosed(error);
  const e = error as { code?: string; cause?: { code?: string } };
  if (e?.code === 'PAA01' || e?.cause?.code === 'PAA01')
    throw new ConflictException({ code: 'ASSIGNMENT_PAUSED', message: 'Assignment is paused' });
  if (e?.code === 'PCC01' || e?.cause?.code === 'PCC01')
    throw new ConflictException({
      code: 'CONTACT_BLOCKED',
      message: 'Prospect opposition blocks this contact channel',
    });
}
