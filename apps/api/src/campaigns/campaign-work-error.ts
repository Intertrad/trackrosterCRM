import { ConflictException } from '@nestjs/common';
function hasCode(error: unknown, code: string): boolean {
  let current = error;
  for (let i = 0; i < 6 && current && typeof current === 'object'; i++) {
    const item = current as { code?: string; cause?: unknown };
    if (item.code === code) return true;
    current = item.cause;
  }
  return false;
}
export const isCampaignClosedError = (error: unknown) => hasCode(error, 'TR001');
export const isProspectArchivedError = (error: unknown) => hasCode(error, 'TR002');
export function rethrowCampaignClosed(error: unknown): void {
  if (isProspectArchivedError(error))
    throw new ConflictException({
      code: 'PROSPECT_ARCHIVED',
      message: 'Prospect no longer accepts open work',
    });
  if (isCampaignClosedError(error))
    throw new ConflictException({
      code: 'CAMPAIGN_CLOSED',
      message: 'Campaign no longer accepts open work',
    });
}
