'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mail, MapPin, MessageSquare, Phone } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FilterSelect } from '@/components/ui/filter-select';
import { LinkButton } from '@/components/ui/link-button';
import { ApiError } from '@/lib/api/api-error';
import { listActions } from '@/lib/api/action-client';
import { OUTCOME_LABELS, type ActionRecord, type ActionType } from '@/lib/api/action-types';
import type { MembershipSummary } from '@/lib/api/membership-types';
import { listCampaigns } from '@/lib/api/campaign-client';
import type { Campaign } from '@/lib/api/campaign-types';

/*
 * What the team actually did.
 *
 * The dashboard beside this answers "how are we doing" from server aggregates; this
 * answers "what happened", one row per action, and the two are deliberately
 * different sources. Nothing here computes a total from the rows it fetched — a page
 * of fifty actions is not a count of the work, and presenting it as one would be the
 * kind of number a manager makes decisions on and should not.
 *
 * Authorization is the API's: `GET /actions` filters by the same per-campaign-prospect
 * read scope the rest of the product uses, so a team manager sees their team's work, a
 * director their organization's, and an administrator the tenant's. This component
 * sends no parameter that could widen that.
 *
 * It is not a second A07. That answers "what happened to this establishment"; this
 * answers "what is the team doing", and links across rather than repeating it.
 */

/* One screenful. Deeper history belongs to the establishment's own timeline. */
const PAGE_SIZE = 25;

const CHANNEL_ICON: Partial<Record<ActionType, typeof Phone>> = {
  call: Phone,
  email: Mail,
  message: MessageSquare,
  visit: MapPin,
};

export function RecentActivity({ members }: { members: MembershipSummary[] }) {
  const [items, setItems] = useState<ActionRecord[] | null>(null);

  /*
   * For the filter only. `GET /campaigns` is scope-filtered upstream, so this offers
   * the caller's own campaigns and nothing wider; failing to load it costs the filter,
   * not the feed.
   */
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    listCampaigns({ limit: 100, sort: 'name' }, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) {
          setCampaigns(page.items);
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, []);
  const [campaignId, setCampaignId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setItems(null);
      setFailed(null);

      try {
        /*
         * Both filters are query parameters, so narrowing asks the server rather
         * than sieving a page that was already truncated.
         */
        const page = await listActions(
          {
            limit: PAGE_SIZE,
            status: 'completed',
            ...(campaignId ? { campaignId } : {}),
            ...(memberId ? { assigneeMembershipId: memberId } : {}),
          },
          signal,
        );

        if (!signal?.aborted) {
          setItems(page.items);
        }
      } catch (caught) {
        if (signal?.aborted) {
          return;
        }

        setFailed(
          caught instanceof ApiError && caught.statusCode === 403
            ? 'You do not have access to this activity.'
            : 'We could not load recent activity.',
        );
      }
    },
    [campaignId, memberId],
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load, attempt]);

  return (
    <Card className="p-0 sm:p-0">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6">
        <h2 className="text-[19px] font-bold tracking-[-0.015em] text-navy">Recent activity</h2>

        {items ? <Badge tone="neutral">{items.length}</Badge> : null}

        {/*
         * A refresh rather than a socket. A manager reads this a few times a day, and
         * refetching on demand is the whole requirement for the beta.
         */}
        <Button
          variant="secondary"
          className="ml-auto"
          onClick={() => setAttempt((count) => count + 1)}
        >
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2.5 px-5 pb-4 sm:px-6">
        <FilterSelect
          label="Campaign"
          value={campaignId}
          onChange={setCampaignId}
          options={[
            { value: '', label: 'All campaigns' },
            ...campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name })),
          ]}
        />

        <FilterSelect
          label="Prospector"
          value={memberId}
          onChange={setMemberId}
          options={[
            { value: '', label: 'Everyone' },
            ...members.map((member) => ({
              value: member.id,
              label: member.displayName ?? member.email,
            })),
          ]}
        />
      </div>

      {failed ? (
        <div className="flex flex-col items-start gap-3 px-5 pb-5 sm:px-6">
          <Alert tone="warning">{failed}</Alert>

          <Button variant="secondary" onClick={() => setAttempt((count) => count + 1)}>
            Retry
          </Button>
        </div>
      ) : items === null ? (
        <div
          className="animate-pulse divide-y divide-line-soft border-t border-line-soft"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="sr-only">Loading recent activity</span>

          {[0, 1, 2].map((row) => (
            <div key={row} className="px-5 py-4 sm:px-6">
              <div className="h-4 w-1/2 rounded bg-surface-muted" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="px-6 py-12 text-center text-[15px] text-ink-muted">
          {/* An empty filter and an empty period are different statements. */}
          {campaignId || memberId
            ? 'No activity matches these filters.'
            : 'No activity has been recorded yet.'}
        </p>
      ) : (
        <ul className="divide-y divide-line-soft border-t border-line-soft">
          {items.map((action) => (
            <ActivityRow key={action.id} action={action} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ActivityRow({ action }: { action: ActionRecord }) {
  const Icon = CHANNEL_ICON[action.type];

  return (
    <li className="flex flex-wrap items-start gap-3 px-5 py-3 sm:px-6">
      <span className="mt-0.5 shrink-0 text-ink-muted">
        {Icon ? <Icon aria-hidden="true" className="size-4" /> : null}
      </span>

      <div className="min-w-0 flex-1">
        {/*
         * Who did it, from the projected relation rather than from the subject —
         * which is presentation text and would be the wrong thing to read.
         */}
        <span className="block truncate text-[15px] font-semibold text-navy">
          {action.actor.displayName ?? 'Unnamed prospector'}
        </span>

        <span className="block truncate text-[14px] text-ink">
          {action.establishment.name ?? action.establishment.id}
        </span>

        <span className="block truncate text-[13px] text-ink-muted">
          {[action.organization?.name, action.campaign.name].filter(Boolean).join(' · ')}
        </span>
      </div>

      {/* Channel and outcome in words, not by colour. */}
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[13px] text-ink-muted capitalize">{action.type}</span>

        {action.outcomeCode ? (
          <Badge tone="neutral">{OUTCOME_LABELS[action.outcomeCode] ?? action.outcomeCode}</Badge>
        ) : null}
      </span>

      <span className="shrink-0 text-[13px] text-ink-muted">
        {action.completedAt ? formatMoment(action.completedAt) : '—'}
      </span>

      {/* Across to the establishment's own record, never a second history here. */}
      <LinkButton
        href={`/admin/prospects/${action.establishment.id}`}
        variant="secondary"
        className="shrink-0"
      >
        Open
      </LinkButton>
    </li>
  );
}

function formatMoment(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
