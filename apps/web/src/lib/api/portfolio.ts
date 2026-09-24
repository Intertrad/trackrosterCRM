import { listWorkQueue } from './work-queue-client';
import type { WorkQueueItem } from './work-queue-types';

/**
 * A prospector's portfolio, loaded whole.
 *
 * `GET /work-queue` filters by campaign, stage and search but offers no
 * totals, no ordering and no "has a follow-up" predicate. A personal
 * portfolio is a bounded list, so the screen reads all of it once and then
 * counts, sorts and filters against the real set — rather than quoting
 * figures that only describe the page that happens to be loaded.
 */
const PAGE_SIZE = 100;

/** Beyond this the whole-portfolio premise stops holding; see `complete`. */
export const MAX_PORTFOLIO_PAGES = 20;

export interface Portfolio {
  items: WorkQueueItem[];

  /**
   * False when the portfolio outgrew the page cap.
   *
   * Every derived figure then describes what was read, not the whole
   * portfolio, and the screen has to say so instead of quoting a total it
   * cannot stand behind.
   */
  complete: boolean;
}

export async function loadPortfolio(teamId: string, signal?: AbortSignal): Promise<Portfolio> {
  const items: WorkQueueItem[] = [];

  let cursor: string | undefined;

  for (let page = 0; page < MAX_PORTFOLIO_PAGES; page += 1) {
    const response = await listWorkQueue({
      teamId,
      limit: PAGE_SIZE,
      ...(cursor ? { cursor } : {}),
      signal,
    });

    items.push(...response.items);

    if (!response.page.hasMore || !response.page.nextCursor) {
      return { items, complete: true };
    }

    cursor = response.page.nextCursor;
  }

  return { items, complete: false };
}

/* ------------------------------------------------------------------ */
/* Next step                                                           */
/* ------------------------------------------------------------------ */

export type NextStepTone = 'blocked' | 'due' | 'scheduled' | 'attention' | 'done' | 'neutral';

export type NextStepKind = 'blocked' | 'follow_up' | 'complete_data' | 'closed' | 'log_action';

export interface NextStep {
  kind: NextStepKind;
  label: string;
  tone: NextStepTone;
}

const DAY_MS = 86_400_000;

/**
 * What this prospect needs next, derived from what the API actually returns.
 *
 * Every branch rests on a fact in the payload — a collision the engine
 * recorded, a scheduled follow-up, a converted stage, a missing phone number.
 * Nothing here guesses at a sales motion the backend does not model.
 */
export function deriveNextStep(
  item: WorkQueueItem,
  blockedProspectIds: ReadonlySet<string>,
  now: number = Date.now(),
): NextStep {
  if (blockedProspectIds.has(item.campaignProspectId)) {
    return { kind: 'blocked', label: 'Blocked — cooldown', tone: 'blocked' };
  }

  if (item.lifecycleStage === 'converted') {
    return { kind: 'closed', label: 'Closed', tone: 'done' };
  }

  if (item.nextFollowUp) {
    const due = new Date(item.nextFollowUp.dueAt).getTime();

    if (Number.isFinite(due)) {
      if (due < now) {
        return { kind: 'follow_up', label: 'Follow-up overdue', tone: 'blocked' };
      }

      return isSameLocalDay(due, now)
        ? { kind: 'follow_up', label: 'Follow-up today', tone: 'due' }
        : {
            kind: 'follow_up',
            label: `Follow-up · ${formatDueStamp(due)}`,
            tone: 'scheduled',
          };
    }
  }

  if (!item.establishment.phone) {
    /* The row cannot be worked without a way to reach it, and that is a data
     * gap rather than a step in the pipeline. */
    return { kind: 'complete_data', label: 'Add contact person', tone: 'attention' };
  }

  return { kind: 'log_action', label: 'Log next action', tone: 'neutral' };
}

/* ------------------------------------------------------------------ */
/* Quick filters                                                       */
/* ------------------------------------------------------------------ */

export type QuickFilterId = 'all' | 'my_follow_ups' | 'to_contact' | 'due_this_week' | 'data_gaps';

export const QUICK_FILTERS: Array<{ id: QuickFilterId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'my_follow_ups', label: 'My follow-ups' },
  { id: 'to_contact', label: 'To contact' },
  /* Not "visits this week": a follow-up carries a due date and no channel, so
   * the screen cannot claim which ones are visits. */
  { id: 'due_this_week', label: 'Due this week' },
  { id: 'data_gaps', label: 'Data to complete' },
];

export function matchesQuickFilter(
  item: WorkQueueItem,
  filter: QuickFilterId,
  now: number = Date.now(),
): boolean {
  switch (filter) {
    case 'my_follow_ups':
      return item.nextFollowUp !== null;

    case 'to_contact':
      return item.lifecycleStage === 'to_contact';

    case 'due_this_week': {
      if (!item.nextFollowUp) {
        return false;
      }

      const due = new Date(item.nextFollowUp.dueAt).getTime();

      return Number.isFinite(due) && due >= now && due <= now + 7 * DAY_MS;
    }

    case 'data_gaps':
      return !item.establishment.phone || !item.establishment.addressLine1;

    case 'all':
      return true;
  }
}

/* ------------------------------------------------------------------ */
/* Sorting                                                             */
/* ------------------------------------------------------------------ */

export type PortfolioSort = 'priority' | 'name' | 'recent';

export const SORT_LABELS: Record<PortfolioSort, string> = {
  priority: 'Priority',
  name: 'Name',
  recent: 'Recent activity',
};

/**
 * Priority order: what is late, then what is due, then what has never been
 * touched, then everything else oldest-contact-first.
 *
 * The API returns the queue by assignment date, which says nothing about
 * urgency — this is ordering the screen derives, over the whole portfolio.
 */
function priorityRank(item: WorkQueueItem, now: number): number {
  const due = item.nextFollowUp ? new Date(item.nextFollowUp.dueAt).getTime() : null;

  if (due !== null && Number.isFinite(due) && due < now) {
    return 0;
  }

  if (due !== null && Number.isFinite(due)) {
    return 1;
  }

  if (!item.latestActivity) {
    return 2;
  }

  return 3;
}

export function sortPortfolio(
  items: WorkQueueItem[],
  sort: PortfolioSort,
  now: number = Date.now(),
): WorkQueueItem[] {
  const sorted = [...items];

  if (sort === 'name') {
    return sorted.sort((a, b) => a.establishment.name.localeCompare(b.establishment.name));
  }

  if (sort === 'recent') {
    return sorted.sort((a, b) => activityTime(b) - activityTime(a));
  }

  return sorted.sort((a, b) => {
    const rank = priorityRank(a, now) - priorityRank(b, now);

    if (rank !== 0) {
      return rank;
    }

    const aDue = a.nextFollowUp ? new Date(a.nextFollowUp.dueAt).getTime() : Infinity;
    const bDue = b.nextFollowUp ? new Date(b.nextFollowUp.dueAt).getTime() : Infinity;

    if (aDue !== bDue) {
      return aDue - bDue;
    }

    /* Oldest contact first, so nothing quietly goes stale at the bottom. */
    return activityTime(a) - activityTime(b);
  });
}

function activityTime(item: WorkQueueItem): number {
  return item.latestActivity ? new Date(item.latestActivity.occurredAt).getTime() : 0;
}

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */

export interface PortfolioSummary {
  assigned: number;
  toContact: number;
  followUpsDue: number;
  blocked: number;
}

export function summarize(
  items: WorkQueueItem[],
  blockedProspectIds: ReadonlySet<string>,
  now: number = Date.now(),
): PortfolioSummary {
  let toContact = 0;
  let followUpsDue = 0;
  let blocked = 0;

  for (const item of items) {
    if (item.lifecycleStage === 'to_contact') {
      toContact += 1;
    }

    if (blockedProspectIds.has(item.campaignProspectId)) {
      blocked += 1;
    }

    if (item.nextFollowUp) {
      const due = new Date(item.nextFollowUp.dueAt).getTime();

      /* "Due" means actionable now — today or already late. */
      if (Number.isFinite(due) && due <= endOfLocalDay(now)) {
        followUpsDue += 1;
      }
    }
  }

  return { assigned: items.length, toContact, followUpsDue, blocked };
}

/** The distinct regions a portfolio covers, for the subtitle. */
export function regionSummary(items: WorkQueueItem[]): string | null {
  const codes = new Set<string>();

  for (const item of items) {
    /* The French postal code's first two digits are the département, which is
     * what a prospector means by "Region 54". */
    const code = item.establishment.postalCode?.trim().slice(0, 2);

    if (code && /^\d{2}$/.test(code)) {
      codes.add(code);
    }
  }

  if (codes.size === 0) {
    return null;
  }

  const sorted = [...codes].sort();

  return sorted.length === 1 ? `Region ${sorted[0]}` : `Regions ${sorted.join(', ')}`;
}

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

const ACTIVITY_LABELS: Record<string, string> = {
  call: 'Call',
  email: 'Email',
  message: 'Message',
  visit: 'Visit',
};

/** "Call · 3 days ago", or an em dash when nothing has happened yet. */
export function lastActionLabel(item: WorkQueueItem, now: number = Date.now()): string {
  if (!item.latestActivity) {
    return '—';
  }

  const type = ACTIVITY_LABELS[item.latestActivity.type] ?? item.latestActivity.type;

  return `${type} · ${relativeDays(new Date(item.latestActivity.occurredAt).getTime(), now)}`;
}

export function relativeDays(timestamp: number, now: number = Date.now()): string {
  if (!Number.isFinite(timestamp)) {
    return 'unknown';
  }

  const days = Math.round((startOfLocalDay(now) - startOfLocalDay(timestamp)) / DAY_MS);

  if (days <= 0) {
    return 'today';
  }

  if (days === 1) {
    return 'yesterday';
  }

  if (days < 30) {
    return `${days} days ago`;
  }

  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(
    new Date(timestamp),
  );
}

/** The postcode-and-city line under an establishment name. */
export function localityLabel(item: WorkQueueItem): string {
  return [item.establishment.postalCode, item.establishment.city]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ');
}

function formatDueStamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);

  date.setHours(0, 0, 0, 0);

  return date.getTime();
}

function endOfLocalDay(timestamp: number): number {
  return startOfLocalDay(timestamp) + DAY_MS - 1;
}

function isSameLocalDay(a: number, b: number): boolean {
  return startOfLocalDay(a) === startOfLocalDay(b);
}
