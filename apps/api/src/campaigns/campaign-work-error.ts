import { ConflictException } from '@nestjs/common';
export function isCampaignClosedError(error: unknown): boolean {
  let current = error;
  for (let i = 0; i < 6 && current && typeof current === 'object'; i++) {
    const item = current as { code?: string; cause?: unknown };
    if (item.code === 'TR001') return true;
    current = item.cause;
  }
  return false;
}
export function rethrowCampaignClosed(error: unknown): void {
  if (isCampaignClosedError(error))
    throw new ConflictException({
      code: 'CAMPAIGN_CLOSED',
      message: 'Campaign no longer accepts open work',
    });
}
