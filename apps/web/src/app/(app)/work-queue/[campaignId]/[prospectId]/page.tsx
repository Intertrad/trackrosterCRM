'use client';

import {
  ArrowLeft,
  Building2,
  CalendarClock,
  Clock3,
  ExternalLink,
  Globe2,
  History,
  Mail,
  MapPin,
  MapPinned,
  MessageSquare,
  Phone,
  PhoneCall,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '@/lib/api/api-error';
import { getWorkQueueProspectDetail, listProspectTimeline } from '@/lib/api/work-queue-client';
import type {
  ProspectTimelineActivityItem,
  ProspectTimelineActivityType,
  WorkQueueProspectDetail,
} from '@/lib/api/work-queue-types';
import { useAuth } from '@/lib/auth/auth-context';

import styles from './page.module.css';

const TIMELINE_PAGE_SIZE = 25;

function getRouteParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0] ?? null;
  }

  return null;
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

function formatAddress(detail: WorkQueueProspectDetail): string | null {
  const parts = [
    detail.establishment.addressLine1,
    detail.establishment.postalCode,
    detail.establishment.city,
    detail.establishment.countryCode,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return parts.length > 0 ? parts.join(', ') : null;
}

function getSafeWebsite(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function getDetailErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 404) {
      return 'This prospect is no longer available in your active Work Queue.';
    }

    if (error.statusCode === 403) {
      return 'You no longer have access to this Prospector workspace.';
    }

    if (error.statusCode === 401) {
      return 'Your TrackRoster session has expired. Refresh the page to restore your session.';
    }

    if (error.messages.length > 0) {
      return error.messages.join(', ');
    }
  }

  return 'TrackRoster could not load this prospect. Please try again.';
}

function getTimelineErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 404) {
      return 'This prospect is no longer available in your active Work Queue.';
    }

    if (error.statusCode === 403) {
      return 'You no longer have access to this Prospector workspace.';
    }

    if (error.statusCode === 401) {
      return 'Your TrackRoster session has expired. Refresh the page to restore your session.';
    }

    if (error.messages.length > 0) {
      return error.messages.join(', ');
    }
  }

  return 'TrackRoster could not load the activity timeline. Please try again.';
}

function getActivityLabel(activityType: ProspectTimelineActivityType): string {
  switch (activityType) {
    case 'call':
      return 'Call';

    case 'email':
      return 'Email';

    case 'message':
      return 'Message';

    case 'visit':
      return 'Visit';
  }
}

function ActivityIcon({ activityType }: { activityType: ProspectTimelineActivityType }) {
  switch (activityType) {
    case 'call':
      return <PhoneCall size={18} strokeWidth={1.9} aria-hidden="true" />;

    case 'email':
      return <Mail size={18} strokeWidth={1.9} aria-hidden="true" />;

    case 'message':
      return <MessageSquare size={18} strokeWidth={1.9} aria-hidden="true" />;

    case 'visit':
      return <MapPinned size={18} strokeWidth={1.9} aria-hidden="true" />;
  }
}

function mergeTimelineItems(
  currentItems: ProspectTimelineActivityItem[],
  nextItems: ProspectTimelineActivityItem[],
): ProspectTimelineActivityItem[] {
  const itemsById = new Map<string, ProspectTimelineActivityItem>();

  for (const item of currentItems) {
    itemsById.set(item.id, item);
  }

  for (const item of nextItems) {
    itemsById.set(item.id, item);
  }

  return [...itemsById.values()];
}

export default function WorkQueueProspectDetailPage() {
  const params = useParams<{
    campaignId: string;
    prospectId: string;
  }>();

  const { activeWorkspace } = useAuth();

  const campaignId = getRouteParam(params.campaignId);

  const prospectId = getRouteParam(params.prospectId);

  /*
   * Keep the detail page aligned with the exact same
   * workspace semantics as the Work Queue list.
   *
   * UI workspace selection is not authorization.
   * Nest still validates the durable Prospector/team grant.
   */
  const teamId =
    activeWorkspace?.mode === 'prospector' && activeWorkspace.scopeType === 'team'
      ? activeWorkspace.teamId
      : null;

  const [detail, setDetail] = useState<WorkQueueProspectDetail | null>(null);

  const [timelineItems, setTimelineItems] = useState<ProspectTimelineActivityItem[]>([]);

  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [loadingDetail, setLoadingDetail] = useState(false);

  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const [loadingMoreTimeline, setLoadingMoreTimeline] = useState(false);

  const [detailError, setDetailError] = useState<string | null>(null);

  const [timelineError, setTimelineError] = useState<string | null>(null);

  const [timelinePaginationError, setTimelinePaginationError] = useState<string | null>(null);

  /*
   * Protect the screen from stale responses after:
   *
   * - workspace changes
   * - refresh
   * - route changes
   * - component unmount
   */
  const requestSequence = useRef(0);

  const loadTimeline = useCallback(
    async ({
      requestId,
      append,
      cursor,
    }: {
      requestId: number;
      append: boolean;
      cursor?: string;
    }): Promise<void> => {
      if (!campaignId || !prospectId || !teamId) {
        return;
      }

      if (append) {
        setLoadingMoreTimeline(true);
        setTimelinePaginationError(null);
      } else {
        setLoadingTimeline(true);
        setTimelineError(null);
        setTimelinePaginationError(null);
        setTimelineItems([]);
        setNextCursor(null);
      }

      try {
        const response = await listProspectTimeline({
          campaignId,

          prospectId,

          teamId,

          limit: TIMELINE_PAGE_SIZE,

          ...(cursor
            ? {
                cursor,
              }
            : {}),
        });

        if (requestId !== requestSequence.current) {
          return;
        }

        if (append) {
          setTimelineItems((currentItems) => mergeTimelineItems(currentItems, response.items));
        } else {
          setTimelineItems(response.items);
        }

        setNextCursor(response.nextCursor);
      } catch (error) {
        if (requestId !== requestSequence.current) {
          return;
        }

        const message = getTimelineErrorMessage(error);

        if (append) {
          setTimelinePaginationError(message);
        } else {
          setTimelineItems([]);
          setNextCursor(null);
          setTimelineError(message);
        }
      } finally {
        if (requestId === requestSequence.current) {
          if (append) {
            setLoadingMoreTimeline(false);
          } else {
            setLoadingTimeline(false);
          }
        }
      }
    },
    [campaignId, prospectId, teamId],
  );

  const loadProspect = useCallback(async (): Promise<void> => {
    if (!campaignId || !prospectId || !teamId) {
      requestSequence.current += 1;

      setDetail(null);
      setTimelineItems([]);
      setNextCursor(null);

      setDetailError(null);
      setTimelineError(null);
      setTimelinePaginationError(null);

      setLoadingDetail(false);
      setLoadingTimeline(false);
      setLoadingMoreTimeline(false);

      return;
    }

    const requestId = ++requestSequence.current;

    setLoadingDetail(true);

    setDetail(null);
    setTimelineItems([]);
    setNextCursor(null);

    setDetailError(null);
    setTimelineError(null);
    setTimelinePaginationError(null);

    try {
      const response = await getWorkQueueProspectDetail({
        campaignId,

        prospectId,

        teamId,
      });

      if (requestId !== requestSequence.current) {
        return;
      }

      setDetail(response);
      setLoadingDetail(false);

      /*
       * Timeline failure is intentionally independent from
       * Prospect Detail failure. The establishment information
       * remains useful even when timeline retrieval fails.
       */
      await loadTimeline({
        requestId,
        append: false,
      });
    } catch (error) {
      if (requestId !== requestSequence.current) {
        return;
      }

      setDetail(null);
      setTimelineItems([]);
      setNextCursor(null);

      setDetailError(getDetailErrorMessage(error));
    } finally {
      if (requestId === requestSequence.current) {
        setLoadingDetail(false);
      }
    }
  }, [campaignId, prospectId, teamId, loadTimeline]);

  useEffect(() => {
    void loadProspect();

    return () => {
      requestSequence.current += 1;
    };
  }, [loadProspect]);

  const address = useMemo(() => {
    return detail ? formatAddress(detail) : null;
  }, [detail]);

  const website = useMemo(() => {
    return detail ? getSafeWebsite(detail.establishment.website) : null;
  }, [detail]);

  function handleLoadOlderActivity(): void {
    if (!nextCursor || loadingTimeline || loadingMoreTimeline) {
      return;
    }

    void loadTimeline({
      requestId: requestSequence.current,

      append: true,

      cursor: nextCursor,
    });
  }

  if (!teamId) {
    return (
      <main className={styles.page}>
        <section
          className={styles.unavailableCard}
          aria-labelledby="prospect-workspace-required-title"
        >
          <div className={styles.unavailableIcon}>
            <ShieldAlert size={24} strokeWidth={1.8} aria-hidden="true" />
          </div>

          <p className={styles.eyebrow}>Prospector workspace required</p>

          <h1 id="prospect-workspace-required-title">
            Prospect Detail is not available in this workspace.
          </h1>

          <p className={styles.unavailableMessage}>
            Select a Prospector team workspace to view active assigned prospects.
          </p>

          <Link href="/work-queue" className={styles.backButtonCentered}>
            <ArrowLeft size={17} strokeWidth={1.9} aria-hidden="true" />
            Back to Work Queue
          </Link>
        </section>
      </main>
    );
  }

  if (!campaignId || !prospectId) {
    return (
      <main className={styles.page}>
        <section className={styles.errorCard} role="alert">
          <div className={styles.errorIcon}>
            <ShieldAlert size={22} strokeWidth={1.8} aria-hidden="true" />
          </div>

          <div>
            <h1>Invalid prospect route</h1>

            <p>TrackRoster could not determine which prospect to load.</p>

            <Link href="/work-queue" className={styles.inlineBackLink}>
              Back to Work Queue
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <Link href="/work-queue" className={styles.backLink}>
          <ArrowLeft size={17} strokeWidth={1.9} aria-hidden="true" />
          Work Queue
        </Link>

        <button
          type="button"
          className={styles.refreshButton}
          onClick={() => {
            void loadProspect();
          }}
          disabled={loadingDetail || loadingTimeline || loadingMoreTimeline}
        >
          <RefreshCw size={17} strokeWidth={1.9} aria-hidden="true" />

          {loadingDetail ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {loadingDetail ? (
        <section className={styles.loadingCard} role="status" aria-live="polite">
          <div className={styles.spinner} />

          <div>
            <h1>Loading prospect</h1>

            <p>TrackRoster is retrieving the current assignment and establishment details.</p>
          </div>
        </section>
      ) : null}

      {!loadingDetail && detailError ? (
        <section className={styles.errorCard} role="alert" aria-live="assertive">
          <div className={styles.errorIcon}>
            <ShieldAlert size={22} strokeWidth={1.8} aria-hidden="true" />
          </div>

          <div className={styles.errorContent}>
            <h1>Prospect unavailable</h1>

            <p>{detailError}</p>

            <div className={styles.errorActions}>
              <button
                type="button"
                onClick={() => {
                  void loadProspect();
                }}
              >
                Try again
              </button>

              <Link href="/work-queue">Back to Work Queue</Link>
            </div>
          </div>
        </section>
      ) : null}

      {!loadingDetail && !detailError && detail ? (
        <>
          <header className={styles.hero}>
            <div className={styles.heroIcon}>
              <Building2 size={28} strokeWidth={1.7} aria-hidden="true" />
            </div>

            <div className={styles.heroContent}>
              <div className={styles.heroTitleRow}>
                <div>
                  <p className={styles.eyebrow}>Prospect</p>

                  <h1>{detail.establishment.name}</h1>
                </div>

                <span className={styles.statusBadge}>Assigned</span>
              </div>

              <p className={styles.campaignName}>{detail.campaign.name}</p>
            </div>
          </header>

          <div className={styles.contentGrid}>
            <section className={styles.infoCard} aria-labelledby="prospect-information-title">
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionEyebrow}>Current assignment</p>

                  <h2 id="prospect-information-title">Prospect information</h2>
                </div>
              </div>

              <div className={styles.detailList}>
                {address ? (
                  <div className={styles.detailRow}>
                    <div className={styles.detailIcon}>
                      <MapPin size={18} strokeWidth={1.9} aria-hidden="true" />
                    </div>

                    <div>
                      <span className={styles.detailLabel}>Address</span>

                      <span className={styles.detailValue}>{address}</span>
                    </div>
                  </div>
                ) : null}

                {detail.establishment.phone ? (
                  <div className={styles.detailRow}>
                    <div className={styles.detailIcon}>
                      <Phone size={18} strokeWidth={1.9} aria-hidden="true" />
                    </div>

                    <div>
                      <span className={styles.detailLabel}>Phone</span>

                      <span className={styles.detailValue}>{detail.establishment.phone}</span>
                    </div>
                  </div>
                ) : null}

                {website ? (
                  <div className={styles.detailRow}>
                    <div className={styles.detailIcon}>
                      <Globe2 size={18} strokeWidth={1.9} aria-hidden="true" />
                    </div>

                    <div>
                      <span className={styles.detailLabel}>Website</span>

                      <a
                        href={website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.websiteLink}
                      >
                        {detail.establishment.website}

                        <ExternalLink size={14} strokeWidth={1.9} aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                ) : null}

                <div className={styles.detailRow}>
                  <div className={styles.detailIcon}>
                    <CalendarClock size={18} strokeWidth={1.9} aria-hidden="true" />
                  </div>

                  <div>
                    <span className={styles.detailLabel}>Assigned</span>

                    <time className={styles.detailValue} dateTime={detail.assignment.assignedAt}>
                      {formatDateTime(detail.assignment.assignedAt)}
                    </time>
                  </div>
                </div>

                <div className={styles.detailRow}>
                  <div className={styles.detailIcon}>
                    <Building2 size={18} strokeWidth={1.9} aria-hidden="true" />
                  </div>

                  <div>
                    <span className={styles.detailLabel}>Campaign</span>

                    <span className={styles.detailValue}>{detail.campaign.name}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className={styles.timelineCard} aria-labelledby="activity-timeline-title">
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionEyebrow}>History</p>

                  <h2 id="activity-timeline-title">Activity timeline</h2>
                </div>

                <History size={21} strokeWidth={1.8} aria-hidden="true" />
              </div>

              {loadingTimeline ? (
                <div className={styles.timelineLoading} role="status" aria-live="polite">
                  <div className={styles.spinner} />

                  <span>Loading activity history…</span>
                </div>
              ) : null}

              {!loadingTimeline && timelineError ? (
                <div className={styles.timelineError} role="alert">
                  <ShieldAlert size={20} strokeWidth={1.8} aria-hidden="true" />

                  <div>
                    <strong>Timeline unavailable</strong>

                    <p>{timelineError}</p>

                    <button
                      type="button"
                      onClick={() => {
                        void loadTimeline({
                          requestId: requestSequence.current,
                          append: false,
                        });
                      }}
                    >
                      Try again
                    </button>
                  </div>
                </div>
              ) : null}

              {!loadingTimeline && !timelineError && timelineItems.length === 0 ? (
                <div className={styles.emptyTimeline}>
                  <Clock3 size={25} strokeWidth={1.7} aria-hidden="true" />

                  <h3>No activity yet</h3>

                  <p>
                    Calls, emails, messages and visits recorded for this prospect will appear here.
                  </p>
                </div>
              ) : null}

              {!loadingTimeline && !timelineError && timelineItems.length > 0 ? (
                <div className={styles.timelineList}>
                  {timelineItems.map((activity) => (
                    <article key={activity.id} className={styles.timelineItem}>
                      <div className={styles.timelineIcon}>
                        <ActivityIcon activityType={activity.activityType} />
                      </div>

                      <div className={styles.timelineItemContent}>
                        <div className={styles.timelineItemHeader}>
                          <h3>{getActivityLabel(activity.activityType)}</h3>

                          <time dateTime={activity.occurredAt}>
                            {formatDateTime(activity.occurredAt)}
                          </time>
                        </div>

                        <p>Prospecting activity recorded in TrackRoster.</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}

              {timelinePaginationError ? (
                <div className={styles.paginationError} role="alert">
                  <span>{timelinePaginationError}</span>

                  <button
                    type="button"
                    onClick={handleLoadOlderActivity}
                    disabled={loadingMoreTimeline}
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {!loadingTimeline && !timelineError && nextCursor ? (
                <div className={styles.pagination}>
                  <button
                    type="button"
                    className={styles.loadMoreButton}
                    onClick={handleLoadOlderActivity}
                    disabled={loadingMoreTimeline}
                  >
                    {loadingMoreTimeline ? (
                      <>
                        <span className={styles.smallSpinner} aria-hidden="true" />
                        Loading older activity…
                      </>
                    ) : (
                      'Load older activity'
                    )}
                  </button>
                </div>
              ) : null}

              {!loadingTimeline && !timelineError && timelineItems.length > 0 && !nextCursor ? (
                <p className={styles.endOfTimeline}>
                  You have reached the beginning of this prospect&apos;s recorded activity.
                </p>
              ) : null}
            </section>
          </div>
        </>
      ) : null}
    </main>
  );
}
