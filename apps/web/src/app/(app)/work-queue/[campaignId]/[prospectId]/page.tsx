'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Database, Globe, MapPin, Phone, Send, UserRound } from 'lucide-react';

import { CollisionBanner } from '@/components/prospector/collision-banner';
import { OverrideRequest } from '@/components/prospector/override-request';
import { LogOutcomeDrawer } from '@/components/prospector/log-outcome-drawer';
import { ProspectTimeline } from '@/components/prospector/prospect-timeline';
import { ConsentPanel } from '@/components/prospector/consent-panel';
import { ContactPanel } from '@/components/prospector/contact-panel';
import { ReservationPanel } from '@/components/prospector/reservation-panel';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, FieldRow } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';
import { listProspectFollowUps } from '@/lib/api/follow-up-client';
import type { ProspectFollowUp } from '@/lib/api/follow-up-types';
import {
  getProspectCollisionDecision,
  getProspectReservation,
  getWorkQueueProspectDetail,
} from '@/lib/api/work-queue-client';
import type {
  ProspectCollisionDecision,
  ProspectReservationState,
  WorkQueueProspectDetail,
} from '@/lib/api/work-queue-types';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/ui/cn';

type TabId = 'overview' | 'timeline' | 'actions' | 'data';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'actions', label: 'Actions' },
  { id: 'data', label: 'Data' },
];

export default function ProspectDetailPage({
  params,
}: PageProps<'/work-queue/[campaignId]/[prospectId]'>) {
  const { campaignId, prospectId } = use(params);

  const { activeWorkspace } = useAuth();
  const teamId = activeWorkspace?.teamId ?? null;

  const [tab, setTab] = useState<TabId>('overview');
  const [detail, setDetail] = useState<WorkQueueProspectDetail | null>(null);
  const [collision, setCollision] = useState<ProspectCollisionDecision | null>(null);
  const [reservation, setReservation] = useState<ProspectReservationState | null>(null);
  const [followUps, setFollowUps] = useState<ProspectFollowUp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => setRefreshToken((token) => token + 1), []);

  useEffect(() => {
    if (!teamId) {
      return;
    }

    const controller = new AbortController();
    const request = { campaignId, prospectId, teamId };

    async function load(): Promise<void> {
      try {
        const [detailResult, collisionResult, reservationResult, followUpResult] =
          await Promise.all([
            getWorkQueueProspectDetail(request),
            getProspectCollisionDecision(request),
            getProspectReservation(request),
            listProspectFollowUps(request).catch(() => ({ items: [] })),
          ]);

        if (controller.signal.aborted) {
          return;
        }

        setDetail(detailResult);
        setCollision(collisionResult);
        setReservation(reservationResult);
        setFollowUps(followUpResult.items);
        setError(null);
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          caught instanceof ApiError && caught.statusCode === 404
            ? 'This prospect is not in your portfolio.'
            : 'We could not load this prospect. Please try again.',
        );
      }
    }

    void load();

    return () => controller.abort();
  }, [campaignId, prospectId, refreshToken, teamId]);

  const pendingFollowUps = useMemo(
    () => (followUps ?? []).filter((followUp) => followUp.status === 'pending'),
    [followUps],
  );

  if (!teamId) {
    return (
      <Alert tone="info" title="This view is scoped to a team.">
        Switch to a team workspace to open a prospect.
      </Alert>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="danger">{error}</Alert>

        <Link href="/work-queue" className="font-semibold text-brand hover:text-brand-hover">
          Back to my prospects
        </Link>
      </div>
    );
  }

  if (!detail) {
    return <DetailSkeleton />;
  }

  const establishment = detail.establishment;
  const address = [establishment.addressLine1, establishment.postalCode, establishment.city]
    .filter(Boolean)
    .join(', ');

  const blocked = collision?.decision === 'block';

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[14px]">
        <Link href="/work-queue" className="text-ink-muted hover:text-ink">
          My prospects
        </Link>

        <ChevronRight aria-hidden="true" className="size-4 text-line" />

        <span className="truncate font-semibold text-ink">{establishment.name}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[30px] leading-tight font-bold tracking-[-0.025em] text-navy sm:text-[34px]">
              {establishment.name}
            </h1>

            <Badge tone={establishment.status === 'active' ? 'success' : 'neutral'} dot>
              {capitalize(establishment.status)}
            </Badge>
          </div>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-ink-soft">
            {address ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden="true" className="size-4" />
                {address}
              </span>
            ) : null}

            <span className="inline-flex items-center gap-1.5">
              <UserRound aria-hidden="true" className="size-4" />
              Assigned to you · {detail.campaign.name}
            </span>
          </p>
        </div>

        <div className="flex shrink-0 gap-3">
          <Button
            disabled={blocked}
            title={blocked ? 'Contact is blocked for this prospect' : undefined}
            leadingIcon={<Send aria-hidden="true" className="size-[18px]" />}
            onClick={() => setDrawerOpen(true)}
          >
            Log action
          </Button>
        </div>
      </header>

      {collision ? (
        <div className="flex flex-col gap-3">
          <CollisionBanner decision={collision} />

          {/* A blocked prospector must have a way forward. The banner states
              the refusal; this raises the request that can lift it. */}
          {collision.decision === 'block' || collision.decision === 'require_override' ? (
            <OverrideRequest
              campaignId={campaignId}
              prospectId={prospectId}
              onRequested={refresh}
            />
          ) : null}
        </div>
      ) : null}

      <nav aria-label="Prospect sections" className="border-b border-line-soft">
        <ul className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((item) => (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={tab === item.id ? 'page' : undefined}
                className={cn(
                  'inline-block border-b-2 px-4 py-3 text-[15px] font-semibold transition-colors',
                  tab === item.id
                    ? 'border-brand text-brand'
                    : 'border-transparent text-ink-muted hover:text-ink',
                )}
              >
                {item.label}

                {item.id === 'actions' && pendingFollowUps.length > 0 ? (
                  <span className="ml-2 rounded-full bg-brand-tint px-1.5 py-0.5 text-[12px] font-bold text-brand">
                    {pendingFollowUps.length}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-5">
          {tab === 'overview' ? (
            <Card>
              <CardHeader title="Prospect information" />

              <dl className="divide-y divide-line-soft">
                <FieldRow label="Campaign">{detail.campaign.name}</FieldRow>

                <FieldRow label="Address">{address || '—'}</FieldRow>

                <FieldRow label="Phone">
                  {establishment.phone ? (
                    <a
                      href={`tel:${establishment.phone}`}
                      className="inline-flex items-center gap-1.5 text-brand hover:text-brand-hover"
                    >
                      <Phone aria-hidden="true" className="size-4" />
                      {establishment.phone}
                    </a>
                  ) : (
                    '—'
                  )}
                </FieldRow>

                <FieldRow label="Website">
                  {establishment.website ? (
                    <a
                      href={establishment.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1.5 text-brand hover:text-brand-hover"
                    >
                      <Globe aria-hidden="true" className="size-4" />
                      Open site
                    </a>
                  ) : (
                    '—'
                  )}
                </FieldRow>

                <FieldRow label="Country">{establishment.countryCode}</FieldRow>
              </dl>
            </Card>
          ) : null}

          {tab === 'timeline' ? (
            <Card>
              <CardHeader title="Activity history" />

              <ProspectTimeline
                campaignId={campaignId}
                prospectId={prospectId}
                teamId={teamId}
                refreshToken={refreshToken}
              />
            </Card>
          ) : null}

          {tab === 'actions' ? (
            <Card>
              <CardHeader title="Follow-ups" />

              {followUps === null ? (
                <div className="h-20 animate-pulse rounded-lg bg-line-soft" />
              ) : pendingFollowUps.length === 0 ? (
                <p className="py-6 text-center text-[15px] text-ink-muted">
                  No open follow-ups for this prospect.
                </p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {pendingFollowUps.map((followUp) => (
                    <li
                      key={followUp.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-soft px-4 py-3"
                    >
                      <span className="text-[15px] font-semibold text-navy">
                        Due {formatDateTime(followUp.dueAt)}
                      </span>

                      <Badge tone={followUp.ownership === 'team' ? 'brand' : 'neutral'}>
                        {followUp.ownership === 'team' ? 'Team' : 'You'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          {tab === 'data' ? <DataCompleteness detail={detail} /> : null}
        </div>

        <div className="flex flex-col gap-5">
          <ReservationPanel
            campaignId={campaignId}
            prospectId={prospectId}
            teamId={teamId}
            reservation={reservation}
            onChanged={refresh}
          />

          {/* Consent is keyed by establishment, not by the campaign prospect:
              a permission holds across every campaign that reaches them. */}
          <ConsentPanel establishmentId={detail.establishment.id} />

          {/* Who to actually speak to. Keyed by establishment for the same
              reason, and sits under consent so the permission is read first. */}
          <ContactPanel establishmentId={detail.establishment.id} />

          <Card>
            <CardHeader title="Assignment" />

            <dl className="divide-y divide-line-soft">
              <FieldRow label="Assigned to">You</FieldRow>
              <FieldRow label="Campaign">{detail.campaign.name}</FieldRow>
              <FieldRow label="Assigned on">
                {formatDateTime(detail.assignment.assignedAt)}
              </FieldRow>
            </dl>
          </Card>
        </div>
      </div>

      <LogOutcomeDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        campaignId={campaignId}
        prospectId={prospectId}
        establishmentName={establishment.name}
        reservation={reservation}
        onCompleted={refresh}
      />
    </div>
  );
}

function DataCompleteness({ detail }: { detail: WorkQueueProspectDetail }) {
  const fields = [
    { label: 'Address', filled: Boolean(detail.establishment.addressLine1) },
    { label: 'Postal code', filled: Boolean(detail.establishment.postalCode) },
    { label: 'City', filled: Boolean(detail.establishment.city) },
    { label: 'Phone', filled: Boolean(detail.establishment.phone) },
    { label: 'Website', filled: Boolean(detail.establishment.website) },
  ];

  const filled = fields.filter((field) => field.filled).length;
  const percent = Math.round((filled / fields.length) * 100);

  return (
    <Card>
      <CardHeader title="Data completeness" />

      <div className="flex items-center gap-4">
        <span className="text-[38px] leading-none font-bold text-navy tabular-nums">
          {percent}%
        </span>

        <span className="flex-1">
          <span
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Data completeness"
            className="block h-2.5 w-full overflow-hidden rounded-full bg-line-soft"
          >
            <span
              className="block h-full rounded-full bg-success transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </span>

          <span className="mt-2 block text-[14px] text-ink-muted">
            {filled} of {fields.length} key fields completed
          </span>
        </span>
      </div>

      {filled < fields.length ? (
        <div className="mt-5 rounded-lg border border-warning-border bg-warning-bg px-4 py-3">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-navy">
            <Database aria-hidden="true" className="size-4 text-warning" />
            Missing fields
          </p>

          <ul className="mt-1.5 list-disc pl-5 text-[14px] text-ink-soft">
            {fields
              .filter((field) => !field.filled)
              .map((field) => (
                <li key={field.label}>{field.label}</li>
              ))}
          </ul>
        </div>
      ) : null}

      {/* PATCH on establishments is admin-scoped, so a prospector sees the
          gaps but cannot edit master data from this screen. */}
      <p className="mt-4 text-[13px] text-ink-muted">
        Ask an administrator to correct master data — establishment records are not editable from a
        prospector workspace.
      </p>
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading prospect…</span>

      <div className="h-5 w-48 rounded bg-line-soft" />
      <div className="h-10 w-2/3 rounded bg-line-soft" />
      <div className="h-14 rounded-lg bg-line-soft" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="h-72 rounded-xl bg-line-soft" />
        <div className="h-72 rounded-xl bg-line-soft" />
      </div>
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
