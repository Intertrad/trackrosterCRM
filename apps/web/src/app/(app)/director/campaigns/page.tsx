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
            ? 'You do not hold director campaign authority for this scope.'
            : 'We could not load campaigns.',
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
        title="Campaign Performance"
        subtitle="Comparative activity and conversion · last 90 days"
        action={
          <Link
            href="/director/exports"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-bold text-ink hover:border-brand hover:text-brand"
          >
            <Download aria-hidden="true" className="size-4" /> Export comparison
          </Link>
        }
      />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Card padding="none" className="overflow-hidden">
        <CardHeader title="Detailed comparison" />
        {rows === null ? (
          <div className="space-y-2 p-5" aria-busy="true">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-14 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px] text-ink-muted">
            No campaigns in the authorised scope.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse">
              <thead>
                <tr className="border-b border-line-soft text-left text-[10px] font-bold uppercase tracking-[0.1em] text-ink-muted">
                  <th className="px-5 py-3">Campaign</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Prospects</th>
                  <th className="px-3 py-3">Actions</th>
                  <th className="px-3 py-3">Contacts</th>
                  <th className="px-3 py-3">Qualified</th>
                  <th className="px-3 py-3">Conversion</th>
                  <th className="px-3 py-3">Progress</th>
                  <th className="px-5 py-3 text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {rows.map(({ campaign, actions, conversions, coverage }) => (
                  <tr key={campaign.id}>
                    <td className="px-5 py-3.5">
                      <span className="block font-semibold text-navy">{campaign.name}</span>
                      <span className="text-[12px] text-ink-muted">
                        {campaign.description ?? 'No description'}
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
                        Details <ExternalLink aria-hidden="true" className="size-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Alert
        tone="info"
        title="Progress targets and remaining prospects are not returned by the API."
      >
        The table uses live campaign, actions, conversions and coverage reports. A dedicated
        campaign-comparison endpoint is still needed for the grouped chart, target progress and
        remaining counts shown in the reference.
      </Alert>
    </div>
  );
}
