/* Campaign detail already uses the campaign membership/status APIs and keeps
 * its own optimistic-concurrency checks. The director route preserves that
 * workflow under the director information architecture. */
export { default } from '@/app/(app)/manager/campaigns/[campaignId]/page';
