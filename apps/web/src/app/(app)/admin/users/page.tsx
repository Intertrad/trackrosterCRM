'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MailPlus, ShieldOff, UserCheck, Users } from 'lucide-react';

import { AdminGuard } from '@/components/admin/admin-guard';
import { InviteUserDrawer } from '@/components/admin/invite-user-drawer';
import { RolePermissionsEditor } from '@/components/admin/role-permissions-editor';
import { UserAccessDrawer } from '@/components/admin/user-access-drawer';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FilterSelect } from '@/components/ui/filter-select';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { StatTile } from '@/components/ui/stat-tile';
import { Tabs } from '@/components/ui/tabs';
import { ApiError } from '@/lib/api/api-error';
import { listMemberships, resendInvitation } from '@/lib/api/membership-client';
import {
  membershipInitials,
  membershipName,
  type MembershipStatus,
  type MembershipSummary,
} from '@/lib/api/membership-types';
import { roleLabel, TENANT_ROLES } from '@/lib/api/role-types';

/* The list is keyset-paginated upstream; one page covers every seeded tenant. */
const PAGE_SIZE = 100;

const TAB_IDS = ['users', 'roles', 'invitations'] as const;

type TabId = (typeof TAB_IDS)[number];

export default function UsersAndRolesPage() {
  return (
    <AdminGuard
      title="Users & roles"
      subtitle="Control workspace access by role, team and territory"
    >
      <Suspense fallback={<UsersSkeleton />}>
        <UsersAndRoles />
      </Suspense>
    </AdminGuard>
  );
}

function UsersAndRoles() {
  const searchParams = useSearchParams();

  const tab = useMemo<TabId>(() => {
    const requested = searchParams.get('tab');

    return TAB_IDS.includes(requested as TabId) ? (requested as TabId) : 'users';
  }, [searchParams]);

  const [members, setMembers] = useState<MembershipSummary[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [selected, setSelected] = useState<MembershipSummary | null>(null);
  const [inviting, setInviting] = useState(false);

  const load = useCallback((signal?: AbortSignal): Promise<void> => {
    return listMemberships({ limit: PAGE_SIZE }, signal)
      .then((page) => {
        if (signal?.aborted) {
          return;
        }

        setMembers(page.items);
        setTruncated(page.nextCursor !== null);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (signal?.aborted) {
          return;
        }

        setMembers([]);
        setError(describeListError(caught));
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  /*
   * Role and status are filtered in the browser rather than re-queried. The
   * whole roster is already loaded, and the API's role filter matches a single
   * grant while a membership can hold several.
   */
  const visible = useMemo(() => {
    if (!members) {
      return [];
    }

    const query = search.trim().toLowerCase();

    return members.filter((member) => {
      if (roleFilter !== 'all' && !member.roles.includes(roleFilter)) {
        return false;
      }

      if (statusFilter !== 'all' && member.status !== statusFilter) {
        return false;
      }

      if (query === '') {
        return true;
      }

      return `${membershipName(member)} ${member.email}`.toLowerCase().includes(query);
    });
  }, [members, roleFilter, search, statusFilter]);

  const counts = useMemo(() => {
    const all = members ?? [];

    return {
      active: all.filter((member) => member.status === 'active').length,
      invited: all.filter((member) => member.status === 'invited').length,
      suspended: all.filter((member) => member.status === 'suspended').length,
      departed: all.filter((member) => member.status === 'departed').length,
    };
  }, [members]);

  const invitations = useMemo(
    () => (members ?? []).filter((member) => member.status === 'invited'),
    [members],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users & roles"
        subtitle="Control workspace access by role, team and territory"
        action={<Button onClick={() => setInviting(true)}>Invite users</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<UserCheck aria-hidden="true" className="size-5" />}
          tone="success"
          value={members === null ? null : counts.active}
          label="Active users"
        />

        <StatTile
          icon={<MailPlus aria-hidden="true" className="size-5" />}
          tone="brand"
          value={members === null ? null : counts.invited}
          label="Pending invites"
          delta="Invitations not yet accepted"
        />

        <StatTile
          icon={<ShieldOff aria-hidden="true" className="size-5" />}
          tone={counts.suspended > 0 ? 'danger' : 'neutral'}
          value={members === null ? null : counts.suspended}
          label="Suspended"
          delta="Temporarily blocked accounts"
        />

        <StatTile
          icon={<Users aria-hidden="true" className="size-5" />}
          tone="neutral"
          value={members === null ? null : counts.departed}
          label="Departed"
        />
      </div>

      <Tabs
        label="Users and roles sections"
        activeId={tab}
        items={[
          { id: 'users', label: 'Users', href: '/admin/users' },
          { id: 'roles', label: 'Role permissions', href: '/admin/users?tab=roles' },
          { id: 'invitations', label: 'Invitations', href: '/admin/users?tab=invitations' },
        ]}
      />

      {error ? (
        <Alert tone="danger" title="We could not load this workspace’s people.">
          {error}
        </Alert>
      ) : null}

      {tab === 'roles' ? (
        <Card>
          <RolePermissionsEditor />
        </Card>
      ) : tab === 'invitations' ? (
        <InvitationsTab
          invitations={invitations}
          loading={members === null}
          onChanged={() => void load()}
        />
      ) : (
        <Card>
          <div className="flex flex-col gap-4">
            <SearchInput
              label="Search users"
              placeholder="Search users, name or email…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <div className="flex flex-wrap items-end gap-3">
              <FilterSelect
                label="Role"
                value={roleFilter}
                options={[
                  { value: 'all', label: 'All' },
                  ...TENANT_ROLES.map((value) => ({ value, label: roleLabel(value) })),
                ]}
                onChange={setRoleFilter}
              />

              <FilterSelect
                label="Status"
                value={statusFilter}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'active', label: 'Active' },
                  { value: 'invited', label: 'Invited' },
                  { value: 'suspended', label: 'Suspended' },
                  { value: 'departed', label: 'Departed' },
                ]}
                onChange={setStatusFilter}
              />

              {search || roleFilter !== 'all' || statusFilter !== 'all' ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setRoleFilter('all');
                    setStatusFilter('all');
                  }}
                  className="pb-2 text-[14px] font-semibold text-brand hover:text-brand-hover"
                >
                  Reset filters
                </button>
              ) : null}
            </div>
          </div>

          {members === null ? (
            <div className="mt-5 flex flex-col gap-2" aria-busy="true">
              {[0, 1, 2, 3, 4].map((row) => (
                <div key={row} className="h-14 animate-pulse rounded-lg bg-line-soft" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-[15px] text-ink-muted">
              {members.length === 0
                ? 'This workspace has no memberships yet.'
                : 'No users match these filters.'}
            </p>
          ) : (
            <>
              <div className="mt-5 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[36rem] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line-soft">
                      <Th>User</Th>
                      <Th>Roles</Th>
                      <Th>Capacity</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>

                  <tbody>
                    {visible.map((member) => (
                      <tr
                        key={member.id}
                        onClick={() => setSelected(member)}
                        className="cursor-pointer border-b border-line-soft hover:bg-surface-muted"
                      >
                        <td className="px-3 py-3">
                          <UserCell member={member} />
                        </td>

                        <td className="px-3 py-3">
                          <span className="flex flex-wrap gap-1.5">
                            {member.roles.length === 0 ? (
                              <span className="text-[14px] text-ink-muted">—</span>
                            ) : (
                              member.roles.map((granted) => (
                                <Badge key={granted} tone="brand">
                                  {roleLabel(granted)}
                                </Badge>
                              ))
                            )}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-[14px] tabular-nums text-ink-muted">
                          {member.capacity ?? '—'}
                        </td>

                        <td className="px-3 py-3">
                          <StatusBadge status={member.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="mt-5 flex flex-col gap-2.5 md:hidden">
                {visible.map((member) => (
                  <li key={member.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(member)}
                      className="w-full rounded-xl border border-line-soft px-3.5 py-3 text-left hover:border-brand"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <UserCell member={member} />

                        <StatusBadge status={member.status} />
                      </span>

                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {member.roles.map((granted) => (
                          <Badge key={granted} tone="brand">
                            {roleLabel(granted)}
                          </Badge>
                        ))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <p className="mt-5 text-[13px] text-ink-muted">
                Showing {visible.length} of {members.length} memberships
                {truncated ? `; this workspace has more than ${PAGE_SIZE}.` : '.'}
              </p>
            </>
          )}
        </Card>
      )}

      <UserAccessDrawer
        member={selected}
        onClose={() => setSelected(null)}
        onChanged={() => void load()}
      />

      <InviteUserDrawer
        open={inviting}
        onClose={() => setInviting(false)}
        onInvited={() => void load()}
      />
    </div>
  );
}

function InvitationsTab({
  invitations,
  loading,
  onChanged,
}: {
  invitations: MembershipSummary[];
  loading: boolean;
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* Keyed per membership so a retry replays rather than re-invites. */
  const [keys] = useState(() => new Map<string, string>());

  function resend(member: MembershipSummary): void {
    const key = keys.get(member.id) ?? crypto.randomUUID();

    keys.set(member.id, key);

    setBusyId(member.id);
    setError(null);
    setNotice(null);

    resendInvitation(member.id, key)
      .then(() => {
        keys.delete(member.id);
        setNotice(`Invitation resent to ${member.email}.`);
        onChanged();
      })
      .catch((caught: unknown) => setError(describeListError(caught)))
      .finally(() => setBusyId(null));
  }

  return (
    <Card>
      {notice ? (
        <Alert tone="success" className="mb-4">
          {notice}
        </Alert>
      ) : null}

      {error ? (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-14 animate-pulse rounded-lg bg-line-soft" />
          ))}
        </div>
      ) : invitations.length === 0 ? (
        <p className="py-10 text-center text-[15px] text-ink-muted">
          There are no pending invitations.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft">
          {invitations.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <UserCell member={member} />
              </span>

              <span className="flex flex-wrap gap-1.5">
                {member.roles.map((granted) => (
                  <Badge key={granted} tone="brand">
                    {roleLabel(granted)}
                  </Badge>
                ))}
              </span>

              <Button
                variant="secondary"
                loading={busyId === member.id}
                onClick={() => resend(member)}
              >
                Resend
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function UserCell({ member }: { member: MembershipSummary }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[13px] font-bold text-brand"
      >
        {membershipInitials(member)}
      </span>

      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold text-navy">
          {membershipName(member)}
        </span>

        <span className="block truncate text-[12px] text-ink-muted">{member.email}</span>
      </span>
    </span>
  );
}

function StatusBadge({ status }: { status: MembershipStatus }) {
  if (status === 'active') {
    return <Badge tone="success">Active</Badge>;
  }

  if (status === 'suspended') {
    return <Badge tone="danger">Suspended</Badge>;
  }

  if (status === 'invited') {
    return <Badge tone="warning">Invited</Badge>;
  }

  return <Badge tone="neutral">Departed</Badge>;
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-3 pb-2 text-[13px] font-semibold text-ink-muted">
      {children}
    </th>
  );
}

function UsersSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="h-16 animate-pulse rounded-xl bg-line-soft" />

      <div className="h-72 animate-pulse rounded-xl bg-line-soft" />
    </div>
  );
}

function describeListError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 403) {
    return 'You are not authorized to manage this workspace’s people.';
  }

  return 'We could not reach TrackRoster. Please try again.';
}
