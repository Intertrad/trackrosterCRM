'use client';

import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, ExternalLink } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ApiError } from '@/lib/api/api-error';
import { listCampaigns } from '@/lib/api/campaign-client';
import { campaignStatusLabel, campaignStatusTone, type Campaign } from '@/lib/api/campaign-types';
import { getReport } from '@/lib/api/report-client';
import { useTranslation } from '@/lib/i18n/i18n-context';
import type {
  ActionsReport,
  ConversionsReport,
  CoverageReport,
  ReportEnvelope,
} from '@/lib/api/report-types';

interface CampaignSnapshot {
  campaign: Campaign;
  actions: ReportEnvelope<ActionsReport> | null;
  conversions: ReportEnvelope<ConversionsReport> | null;
  coverage: ReportEnvelope<CoverageReport> | null;
}

export default function DirectorCampaignsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<CampaignSnapshot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    const to = new Date();
    const from = new Date(to.getTime() - 90 * 86_400_000);
    const range = { from: from.toISOString(), to: to.toISOString() };
    try {
      const page = await listCampaigns({ limit: 100 }, signal);
      const snapshots = await Promise.all(
        page.items.map(async (campaign) => {
          const filters = { ...range, campaignId: campaign.id };
          const [actions, conversions, coverage] = await Promise.all([
            getReport<ActionsReport>('actions', filters, signal).catch(() => null),
            getReport<ConversionsReport>('conversions', filters, signal).catch(() => null),
            getReport<CoverageReport>('coverage', filters, signal).catch(() => null),
          ]);
          return { campaign, actions, conversions, coverage };
        }),
      );
      if (!signal?.aborted) {
        setRows(snapshots);
        setError(null);
      }
    } catch (caught) {
      if (!signal?.aborted)
        setError(
          caught instanceof ApiError && caught.statusCode === 403
            ? t('director.campaignAuthorityError')
            : t('director.loadCampaignsError'),
        );
    }
  }, []);

  useLiveRefresh(load);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('director.campaignPerformance')}
        subtitle={t('director.campaignSubtitle')}
        action={
          <Link
            href="/director/exports"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-bold text-ink hover:border-brand hover:text-brand"
          >
            <Download aria-hidden="true" className="size-4" /> {t('director.exportComparison')}
          </Link>
        }
      />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Card padding="none" className="overflow-hidden">
        <CardHeader title={t('director.detailedComparison')} />
        {rows === null ? (
          <div className="space-y-2 p-5" aria-busy="true">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-14 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px] text-ink-muted">
            {t('director.noCampaigns')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse">
              <thead>
                <tr className="border-b border-line-soft text-left text-[10px] font-bold uppercase tracking-[0.1em] text-ink-muted">
                  <th className="px-5 py-3">{t('director.campaign')}</th>
                  <th className="px-3 py-3">{t('director.status')}</th>
                  <th className="px-3 py-3">{t('director.prospects')}</th>
                  <th className="px-3 py-3">{t('director.actions')}</th>
                  <th className="px-3 py-3">{t('director.contacts')}</th>
                  <th className="px-3 py-3">{t('director.qualified')}</th>
                  <th className="px-3 py-3">{t('director.conversion')}</th>
                  <th className="px-3 py-3">{t('director.progress')}</th>
                  <th className="px-5 py-3 text-right">{t('common.open')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {rows.map(({ campaign, actions, conversions, coverage }) => (
                  <tr key={campaign.id}>
                    <td className="px-5 py-3.5">
                      <span className="block font-semibold text-navy">{campaign.name}</span>
                      <span className="text-[12px] text-ink-muted">
                        {campaign.description ?? t('director.noDescription')}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      <Badge tone={campaignStatusTone(campaign.status)} dot>
                        {campaignStatusLabel(campaign.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3.5 tabular-nums text-ink">
                      {coverage?.data.prospects ?? '—'}
                    </td>
                    <td className="px-3 py-3.5 tabular-nums text-ink">
                      {actions?.data.total ?? '—'}
                    </td>
                    <td className="px-3 py-3.5 tabular-nums text-ink">
                      {conversions?.data.contacted ?? '—'}
                    </td>
                    <td className="px-3 py-3.5 tabular-nums font-semibold text-navy">
                      {conversions?.data.qualified ?? '—'}
                    </td>
                    <td className="px-3 py-3.5 font-semibold text-brand">
                      {conversions ? `${conversions.data.conversionRate ?? '—'}%` : '—'}
                    </td>
                    <td className="px-3 py-3.5">
                      {coverage ? `${coverage.data.coverageRate ?? '—'}% coverage` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/director/campaigns/${campaign.id}`}
                        className="inline-flex items-center gap-1 text-[13px] font-bold text-brand hover:text-brand-hover"
                      >
                        {t('director.details')}{' '}
                        <ExternalLink aria-hidden="true" className="size-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Alert tone="info" title={t('director.progressNoticeTitle')}>
        {t('director.progressNoticeBody')}
      </Alert>
    </div>
  );
}
