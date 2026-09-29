'use client';
import { use } from 'react';
import { ProspectDetail } from '@/components/prospector/prospect-detail';
export default function Page({ params }: PageProps<'/work-queue/[campaignId]/[prospectId]'>) {
  const { campaignId, prospectId } = use(params);
  return <ProspectDetail campaignId={campaignId} prospectId={prospectId} />;
}
