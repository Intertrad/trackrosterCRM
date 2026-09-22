import { ConflictException } from '@nestjs/common';
export function rethrowConsentBlock(error: unknown) {
  const e = error as { code?: string; cause?: { code?: string } };
  if (e?.code === 'PCC01' || e?.cause?.code === 'PCC01')
    throw new ConflictException({
      code: 'CONTACT_BLOCKED',
      message: 'Prospect opposition blocks this contact channel',
    });
}
