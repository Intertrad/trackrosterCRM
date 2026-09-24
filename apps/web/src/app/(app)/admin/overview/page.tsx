'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Building2,
  CircleAlert,
  Megaphone,
  TriangleAlert,
  Upload,
  Users,
} from 'lucide-react';

import { AdminGuard } from '@/components/admin/admin-guard';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { LinkButton } from '@/components/ui/link-button';
import { PageHeader } from '@/components/ui/page-header';
import { StatTile } from '@/components/ui/stat-tile';
import { getAdminDashboard } from '@/lib/api/admin-client';
import type { AdminDashboard } from '@/lib/api/admin-types';
import { ApiError } from '@/lib/api/api-error';
import { listAuditEvents } from '@/lib/api/audit-client';
import {
  auditActionLabel,
  auditResourceLabel,
  auditSeverity,
  type AuditEvent,
} from '@/lib/api/audit-types';
import { listMemberships } from '@/lib/api/membership-client';
import type { MembershipSummary } from '@/lib/api/membership-types';
import { roleLabel, TENANT_ROLES } from '@/lib/api/role-types';

/* One page is enough for every tenant seeded so far; truncation is disclosed. */
const MEMBERSHIP_PAGE_SIZE = 100;

export default function AdministrationOverviewPage() {
  return (
    <AdminGuard title="Administration overview" subtitle="Configure and protect this workspace">
      <AdministrationOverview />
    </AdminGuard>
  );
}

function AdministrationOverview() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [members, setMembers] = useState<MembershipSummary[] | null>(null);
  const [membersTruncated, setMembersTruncated] = useState(false);
  const [activity, setActivity] = useState<AuditEvent[] | null>(null);
  const [activityDenied, setActivityDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getAdminDashboard(controller.signal)
      .then(setDashboard)
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setError(describeAdminError(caught));
        }
      });

    listMemberships({ limit: MEMBERSHIP_PAGE_SIZE }, controller.signal)
      .then((page) => {
        setMembers(page.items);
        setMembersTruncated(page.nextCursor !== null);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setMembers([]);
        }
      });

    /*
     * Audit access is a separate grant from tenant administration, so a
     * denial here is expected rather than an error for the whole page.
     */
    listAuditEvents({ limit: 6 }, controller.signal)
      .then((page) => setActivity(page.items))
      .catch((caught: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setActivity([]);
        setActivityDenied(caught instanceof ApiError && isAuditDenial(caught));
      });

    return () => controller.abort();
  }, []);

  const metrics = dashboard?.metrics ?? null;

  const attention = useMemo(() => buildAttention(metrics), [metrics]);

  const adoption = useMemo(() => buildAdoption(members), [members]);

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Administration overview" />

        <Alert tone="danger" title="We could not load the administration overview.">
          {error}
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Administration overview"
        subtitle="Configure and protect this workspace"
        action={
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/admin/imports" variant="secondary">
              Start import
            </LinkButton>

            <LinkButton href="/admin/users">Invite users</LinkButton>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<Users aria-hidden="true" className="size-5" />}
          tone="success"
          value={metrics?.activeMembers ?? null}
          label="Active users"
          delta={metrics ? `${metrics.sessionsLast30Days} sessions in 30 days` : undefined}
        />

        <StatTile
          icon={<Building2 aria-hidden="true" className="size-5" />}
          tone="brand"
          value={metrics?.activeOrganizations ?? null}
          label="Organizations"
          delta={metrics ? `${metrics.activeTeams} active teams` : undefined}
        />

        <StatTile
          icon={<Megaphone aria-hidden="true" className="size-5" />}
          tone="brand"
          value={metrics?.activeCampaigns ?? null}
          label="Active campaigns"
        />

        <StatTile
          icon={<Upload aria-hidden="true" className="size-5" />}
          tone={metrics && metrics.importsAwaitingCommit > 0 ? 'warning' : 'neutral'}
          value={metrics?.importsAwaitingCommit ?? null}
          label="Imports awaiting commit"
          delta="Validated but not yet applied"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] xl:items-start">
        <ConfigurationAreas />

        <Card>
          <CardHeader title="Attention required" />

          {attention.length === 0 ? (
            <p className="py-6 text-center text-[15px] text-ink-muted">
              {metrics ? 'Nothing needs attention right now.' : 'Loading…'}
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {attention.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-xl border border-line-soft px-3.5 py-3 transition-colors hover:border-brand hover:bg-brand-tint/40"
                  >
                    <span
                      aria-hidden="true"
                      className={
                        item.tone === 'danger'
                          ? 'flex size-9 shrink-0 items-center justify-center rounded-full bg-danger-bg text-danger'
                          : 'flex size-9 shrink-0 items-center justify-center rounded-full bg-warning-bg text-warning'
                      }
                    >
                      {item.tone === 'danger' ? (
                        <CircleAlert className="size-5" />
                      ) : (
                        <TriangleAlert className="size-5" />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold text-navy">
                        {item.count} {item.title}
                      </span>

                      <span className="block truncate text-[13px] text-ink-muted">
                        {item.description}
                      </span>
                    </span>

                    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-line" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] xl:items-start">
        <Card>
          <CardHeader
            title="Recent administration activity"
            action={
              <Link
                href="/admin/audit"
                className="text-[14px] font-semibold text-brand hover:text-brand-hover"
              >
                Open audit
              </Link>
            }
          />

          {activityDenied ? (
            <Alert tone="info" title="Audit access is granted separately.">
              Your workspace can administer this tenant but does not hold audit access, so the
              activity log is not shown here.
            </Alert>
          ) : activity === null ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="h-11 animate-pulse rounded-lg bg-line-soft" />
              ))}
            </div>
          ) : activity.length === 0 ? (
            <p className="py-6 text-center text-[15px] text-ink-muted">
              No administration activity has been recorded yet.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line-soft">
              {activity.map((event) => (
                <li key={event.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                  <span className="w-40 shrink-0 text-[13px] text-ink-muted">
                    {formatTimestamp(event.occurredAt)}
                  </span>

                  <span className="min-w-0 flex-1 text-[14px] font-semibold text-navy">
                    {auditActionLabel(event.action)}
                  </span>

                  <Badge tone={auditSeverity(event.action) === 'warning' ? 'warning' : 'neutral'}>
                    {auditResourceLabel(event.resourceType)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Members by role" />

          {members === null ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-10 animate-pulse rounded-lg bg-line-soft" />
              ))}
            </div>
          ) : adoption.total === 0 ? (
            <p className="py-6 text-center text-[15px] text-ink-muted">
              No memberships to summarise.
            </p>
          ) : (
            <ul className="flex flex-col gap-3.5">
              {adoption.rows.map((row) => (
                <li key={row.role}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[14px] font-semibold text-navy">
                      {roleLabel(row.role)}
                    </span>

                    <span className="text-[13px] tabular-nums text-ink-muted">
                      {row.count} / {adoption.total}
                    </span>
                  </div>

                  <div
                    className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted"
                    role="img"
                    aria-label={`${roleLabel(row.role)}: ${row.count} of ${adoption.total} members`}
                  >
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.round((row.count / adoption.total) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {membersTruncated ? (
            <p className="mt-4 text-[13px] text-ink-muted">
              Counted from the first {MEMBERSHIP_PAGE_SIZE} memberships; this workspace has more.
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

/*
 * The design shows a readiness table with a status, owner and last-updated
 * date per module. No endpoint reports any of those three, so this card links
 * to the areas that exist instead of asserting a state nothing measures.
 */
function ConfigurationAreas() {
  const areas: Array<{
    id: string;
    title: string;
    description: string;
    href?: string;
  }> = [
    {
      id: 'identity',
      title: 'Identity & access',
      description: 'Users, roles, scopes and invitations',
      href: '/admin/users',
    },
    {
      id: 'imports',
      title: 'Prospect data',
      description: 'Import, map, de-duplicate and commit prospect records',
      href: '/admin/imports',
    },
    {
      id: 'audit',
      title: 'Audit',
      description: 'Sensitive changes and security-relevant activity',
      href: '/admin/audit',
    },
    {
      id: 'territories',
      title: 'Territory structure',
      description: 'Regions, territories and boundaries',
    },
    {
      id: 'collisions',
      title: 'Collision policy',
      description: 'Rules, exceptions and override handling',
    },
    {
      id: 'integrations',
      title: 'Integrations',
      description: 'External systems and scheduled synchronisation',
    },
  ];

  return (
    <Card>
      <CardHeader title="Configuration areas" />

      <ul className="flex flex-col divide-y divide-line-soft">
        {areas.map((area) => (
          <li key={area.id} className="flex flex-wrap items-center gap-3 py-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold text-navy">{area.title}</span>

              <span className="block text-[13px] text-ink-muted">{area.description}</span>
            </span>

            {area.href ? (
              <LinkButton href={area.href} variant="secondary">
                Manage
              </LinkButton>
            ) : (
              <Badge tone="neutral">Not available yet</Badge>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

interface AttentionItem {
  id: string;
  count: number;
  title: string;
  description: string;
  href: string;
  tone: 'danger' | 'warning';
}

function buildAttention(metrics: AdminDashboard['metrics'] | null): AttentionItem[] {
  if (!metrics) {
    return [];
  }

  const items: AttentionItem[] = [
    {
      id: 'imports',
      count: metrics.importsAwaitingCommit,
      title: 'imports awaiting commit',
      description: 'Validated files that have not been applied',
      href: '/admin/imports',
      tone: 'warning',
    },
    {
      id: 'exports',
      count: metrics.failedExports,
      title: 'failed exports',
      description: 'Export jobs that did not complete',
      href: '/admin/audit?stream=exports',
      tone: 'danger',
    },
    {
      id: 'coordinates',
      count: metrics.prospectsMissingCoordinates,
      title: 'prospects without coordinates',
      description: 'These cannot appear on the map or in routes',
      href: '/admin/imports',
      tone: 'warning',
    },
    {
      id: 'phone',
      count: metrics.prospectsMissingPhone,
      title: 'prospects without a phone number',
      description: 'Limits the channels a prospector can use',
      href: '/admin/imports',
      tone: 'warning',
    },
  ];

  return items.filter((item) => item.count > 0);
}

function buildAdoption(members: MembershipSummary[] | null): {
  total: number;
  rows: Array<{ role: string; count: number }>;
} {
  if (!members || members.length === 0) {
    return { total: 0, rows: [] };
  }

  const counts = new Map<string, number>();

  for (const member of members) {
    /* A membership can hold several grants; it is counted under each role. */
    for (const role of member.roles) {
      counts.set(role, (counts.get(role) ?? 0) + 1);
    }
  }

  const rows = TENANT_ROLES.map((role) => ({ role: role as string, count: counts.get(role) ?? 0 }))
    .concat(
      [...counts.keys()]
        .filter((role) => !(TENANT_ROLES as readonly string[]).includes(role))
        .map((role) => ({ role, count: counts.get(role) ?? 0 })),
    )
    .filter((row) => row.count > 0)
    .sort((left, right) => right.count - left.count);

  return { total: members.length, rows };
}

function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* The audit controller answers a missing grant with 400, not 403. */
function isAuditDenial(error: ApiError): boolean {
  return (
    error.statusCode === 403 ||
    (error.statusCode === 400 && error.messages.some((message) => /audit access/i.test(message)))
  );
}

function describeAdminError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 403) {
    return 'You are not authorized to administer this workspace.';
  }

  return 'We could not reach TrackRoster. Please try again.';
}
