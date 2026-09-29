'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, History, UserCheck } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LinkButton } from '@/components/ui/link-button';
import { ApiError } from '@/lib/api/api-error';
import { listProspectCampaignMemberships } from '@/lib/api/prospect-client';
import type { ProspectCampaignMembership } from '@/lib/api/prospect-types';

/*
 * The operational context of a shared establishment.
 *
 * Loaded on its own, not with the master record, for two reasons. It must not be
 * able to take the establishment down — a record that reads fine should read fine
 * — and it is the only part of this page whose contract is new, so it is the part
 * most likely to fail first.
 *
 * Each membership is its own row because each is a different organization working
 * the same establishment. Collapsing them into one status would erase the
 * multi-entity model this product is built on: OFTI and GFTIJ both holding one
 * establishment is normal, and the reservation layer is what settles the clash.
 */
export function CampaignContext({
  prospectId,
  onMemberships,
}: {
  prospectId: string;
  /*
   * Reported upward so the activity history can use the same memberships rather
   * than fetching them again. This section keeps its own loading, error and retry;
   * only the result is shared.
   */
  onMemberships?: (memberships: ProspectCampaignMembership[]) => void;
}) {
  const [items, setItems] = useState<ProspectCampaignMembership[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setItems(null);
      setFailed(null);

      try {
        const page = await listProspectCampaignMemberships(prospectId, signal);

        if (!signal?.aborted) {
          setItems(page.items);
          onMemberships?.(page.items);
        }
      } catch (caught) {
        if (signal?.aborted) {
          return;
        }

        setFailed(
          caught instanceof ApiError && caught.statusCode === 403
            ? 'You do not have access to this establishment&rsquo;s campaigns.'
            : 'Unable to load prospecting context.',
        );
      }
    },
    [onMemberships, prospectId],
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load, attempt]);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-[19px] font-bold tracking-[-0.015em] text-navy">Prospecting context</h2>

        {items ? <Badge tone="neutral">{items.length}</Badge> : null}
      </div>

      {failed ? (
        <div className="flex flex-col items-start gap-3">
          <Alert tone="warning">{failed}</Alert>

          <Button variant="secondary" onClick={() => setAttempt((count) => count + 1)}>
            Retry
          </Button>
        </div>
      ) : items === null ? (
        /* A section skeleton: the record above it is already readable. */
        <div className="flex animate-pulse flex-col gap-3" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading the prospecting context</span>

          <div className="h-20 rounded-lg bg-surface-muted" />
          <div className="h-20 rounded-lg bg-surface-muted" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-[14px] text-ink-muted">
          This establishment has not yet been enrolled in a campaign.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((membership) => (
            <MembershipRow key={membership.campaignProspectId} membership={membership} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function MembershipRow({ membership }: { membership: ProspectCampaignMembership }) {
  const excluded = membership.membership.status === 'excluded';

  return (
    <li className="rounded-lg border border-line-soft p-4">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {/* The entity working it, which is the first thing a reader needs. */}
        <span className="text-[15px] font-bold text-navy">{membership.organization.name}</span>

        <span className="text-[14px] text-ink">{membership.campaign.name}</span>

        <Badge tone={membership.campaign.status === 'active' ? 'success' : 'neutral'}>
          {membership.campaign.status}
        </Badge>

        {/*
         * An exclusion was somebody's decision, so it is shown rather than
         * filtered — bulk enrolment deliberately leaves it in place.
         */}
        {excluded ? <Badge tone="warning">excluded</Badge> : null}

        <Badge tone="neutral">{membership.membership.lifecycleStage.replace(/_/g, ' ')}</Badge>
      </div>

      <dl className="flex flex-col gap-1.5 text-[14px]">
        <Row icon={<UserCheck aria-hidden="true" className="size-4" />} label="Assigned to">
          {membership.assignment
            ? [
                membership.assignment.assignedUserName ??
                  (membership.assignment.assignedUserId ? 'A team member' : 'The team'),
                membership.assignment.teamName,
              ]
                .filter(Boolean)
                .join(' · ')
            : null}
        </Row>

        <Row icon={<History aria-hidden="true" className="size-4" />} label="Last action">
          {membership.latestActivity
            ? `${membership.latestActivity.type} · ${formatDay(membership.latestActivity.occurredAt)}`
            : null}
        </Row>

        <Row icon={<CalendarClock aria-hidden="true" className="size-4" />} label="Next follow-up">
          {membership.nextFollowUp
            ? `${formatDay(membership.nextFollowUp.dueAt)} · ${membership.nextFollowUp.category.replace(/_/g, ' ')}`
            : null}
        </Row>
      </dl>

      {/*
       * Read-only here. Dispatch stays in the assignment workspace rather than
       * being duplicated onto the establishment record.
       */}
      <LinkButton
        href={`/manager/assignments?campaignId=${encodeURIComponent(membership.campaign.id)}`}
        variant="secondary"
        className="mt-3"
      >
        Open assignment workspace
      </LinkButton>
    </li>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: string | null;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="mt-0.5 shrink-0 text-ink-muted">{icon}</span>
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      {/* Stated rather than blank: a blank row reads as a failed load. */}
      <dd className="min-w-0 truncate font-medium text-ink">{children ?? 'Not yet'}</dd>
    </div>
  );
}

/* Day precision is what an operational reader needs; the exact time is noise. */
function formatDay(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
