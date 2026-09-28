import type { MessageKey } from '@/lib/i18n/dictionary';
import { isAvailable, type FeatureKey } from '@/lib/readiness/feature-readiness';

import type { WorkspaceMode } from './workspace';

export type NavigationItemId =
  | 'overview'
  | 'work_queue'
  | 'map'
  | 'follow_ups'
  | 'logged_actions'
  | 'routes'
  | 'messages'
  | 'dashboard'
  | 'imports'
  | 'exports'
  | 'administration'
  | 'overrides'
  | 'team'
  | 'assignments'
  | 'campaigns'
  | 'reports'
  | 'collisions'
  | 'users'
  | 'search'
  | 'audit';

/** Icon is resolved by the shell so this module stays free of JSX. */
export type NavigationIconId =
  | 'today'
  | 'prospects'
  | 'map'
  | 'actions'
  | 'routes'
  | 'messages'
  | 'dashboard'
  | 'team'
  | 'assignments'
  | 'campaigns'
  | 'reports'
  | 'imports'
  | 'administration'
  | 'overrides'
  | 'collisions'
  | 'audit'
  | 'settings';

interface WorkspaceNavigationItemBase {
  id: NavigationItemId;

  /**
   * Message key, not a string.
   *
   * The sidebar is the most-read text in the product; leaving English here
   * would mean a French account sees a translated page under an English menu.
   */
  label: MessageKey;

  icon: NavigationIconId;

  /** Shown in the mobile bottom bar (max five, "More" occupies the fifth). */
  primary?: boolean;
}

export type WorkspaceNavigationItem = WorkspaceNavigationItemBase &
  (
    | {
        href: string;

        availability: 'ready';
      }
    | {
        href?: string;

        /*
         * A planned item renders without a link so it can never navigate to a
         * screen whose API contract is not implemented yet.
         */
        availability: 'planned';
      }
  );

const OVERVIEW: WorkspaceNavigationItem = {
  id: 'overview',
  label: 'nav.overview',
  icon: 'dashboard',
  href: '/',
  availability: 'ready',
  primary: true,
};

/**
 * Which audited capability family each screen depends on.
 *
 * Partial on purpose: an entry exists only where `docs/API_READINESS_AUDIT.md`
 * names the family, so this stays a mirror of the audit rather than a parallel
 * taxonomy that can drift from it. Screens with no entry are not annotated,
 * not silently approved.
 */
export const NAVIGATION_FEATURE: Partial<Record<NavigationItemId, FeatureKey>> = {
  overview: 'work_queue',
  work_queue: 'work_queue',
  map: 'prospect_reads',
  follow_ups: 'follow_ups',
  logged_actions: 'action_completion',
  messages: 'messaging',
  dashboard: 'manager_dashboard',
  team: 'manager_dashboard',
  campaigns: 'campaign_workspace_reads',
  assignments: 'assignments',
  collisions: 'reservations',
  overrides: 'overrides',
  imports: 'imports',
  exports: 'exports',
  users: 'membership_admin',
  search: 'search',
};

/**
 * A screen whose backend family the audit lists under "do not integrate" must
 * not be reachable, however complete the screen itself is. This is the control
 * that keeps that true as the audit is re-run, rather than relying on nobody
 * having built the screen yet.
 */
function isOfferable(item: WorkspaceNavigationItem): boolean {
  const feature = NAVIGATION_FEATURE[item.id];

  return feature === undefined || isAvailable(feature);
}

export function getNavigationForWorkspace(mode: WorkspaceMode): WorkspaceNavigationItem[] {
  return navigationFor(mode).filter(isOfferable);
}

function navigationFor(mode: WorkspaceMode): WorkspaceNavigationItem[] {
  switch (mode) {
    case 'admin':
      return [
        {
          id: 'administration',
          label: 'nav.overview',
          icon: 'administration',
          href: '/admin/overview',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'users',
          label: 'nav.users',
          icon: 'team',
          href: '/admin/users',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'imports',
          label: 'nav.imports',
          icon: 'imports',
          href: '/admin/imports',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'audit',
          label: 'nav.audit',
          icon: 'audit',
          href: '/admin/audit',
          availability: 'ready',
          primary: true,
        },
        /*
         * Bulk campaign enrolment sits under administration rather than the
         * manager workspace because that is where the authority is: the endpoint
         * is guarded by ClientAdminGuard, and an establishment outside every
         * campaign is only visible to a tenant-scoped grant.
         *
         * Not primary: the mobile bar holds four, and the four it holds are the
         * daily destinations. Enrolment is a setup step, so it lives under More.
         */
        {
          id: 'campaigns',
          label: 'nav.campaigns',
          icon: 'campaigns',
          href: '/admin/campaigns',
          availability: 'ready',
        },
        {
          id: 'dashboard',
          label: 'nav.dashboard',
          icon: 'dashboard',
          href: '/manager/overview',
          availability: 'ready',
        },
        { id: 'overrides', label: 'nav.overrides', icon: 'overrides', availability: 'planned' },
        {
          id: 'search',
          label: 'nav.search',
          icon: 'prospects',
          href: '/search',
          availability: 'ready',
        },
      ];

    case 'director':
      /*
       * A director's scope is organization-wide, and the reporting, approval
       * and export endpoints already resolve that scope server-side — so the
       * manager screens are correct for this role rather than needing
       * duplicates. Only the rollup is director-specific.
       */
      return [
        {
          id: 'overview',
          label: 'nav.overview',
          icon: 'dashboard',
          href: '/director/overview',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'dashboard',
          label: 'nav.dashboard',
          icon: 'team',
          href: '/manager/overview',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'reports',
          label: 'nav.reports',
          icon: 'reports',
          href: '/manager/reports',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'overrides',
          label: 'nav.approvals',
          icon: 'overrides',
          href: '/manager/approvals',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'exports',
          label: 'nav.exports',
          icon: 'imports',
          href: '/manager/exports',
          availability: 'ready',
        },
        {
          id: 'collisions',
          label: 'nav.collisions',
          icon: 'collisions',
          href: '/manager/collisions',
          availability: 'ready',
        },
        {
          id: 'search',
          label: 'nav.search',
          icon: 'prospects',
          href: '/search',
          availability: 'ready',
        },
      ];

    case 'manager':
      return [
        {
          id: 'overview',
          label: 'nav.overview',
          icon: 'dashboard',
          href: '/manager/overview',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'team',
          label: 'nav.team',
          icon: 'team',
          href: '/manager/team',
          availability: 'ready',
        },
        {
          id: 'campaigns',
          label: 'nav.campaigns',
          icon: 'campaigns',
          href: '/manager/campaigns',
          availability: 'ready',
        },
        {
          id: 'assignments',
          label: 'nav.assignments',
          icon: 'assignments',
          href: '/manager/assignments',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'collisions',
          label: 'nav.collisions',
          icon: 'collisions',
          href: '/manager/collisions',
          availability: 'ready',
        },
        {
          id: 'overrides',
          label: 'nav.approvals',
          icon: 'overrides',
          href: '/manager/approvals',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'reports',
          label: 'nav.reports',
          icon: 'reports',
          href: '/manager/reports',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'exports',
          label: 'nav.exports',
          icon: 'imports',
          href: '/manager/exports',
          availability: 'ready',
        },
        {
          id: 'messages',
          label: 'nav.messages',
          icon: 'messages',
          href: '/messages',
          availability: 'ready',
        },
        {
          id: 'search',
          label: 'nav.search',
          icon: 'prospects',
          href: '/search',
          availability: 'ready',
        },
      ];

    case 'prospector':
      return [
        {
          id: 'overview',
          label: 'nav.today',
          icon: 'today',
          href: '/',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'work_queue',
          label: 'nav.workQueue',
          icon: 'prospects',
          href: '/work-queue',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'map',
          label: 'nav.map',
          icon: 'map',
          href: '/map',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'follow_ups',
          label: 'nav.actions',
          icon: 'actions',
          href: '/follow-ups',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'messages',
          label: 'nav.messages',
          icon: 'messages',
          href: '/messages',
          availability: 'ready',
        },
      ];

    case 'observer':
      /*
       * Observer screens are added only once their read contracts are frozen;
       * the role has no write path by design.
       */
      return [
        OVERVIEW,
        { id: 'audit', label: 'nav.audit', icon: 'audit', availability: 'planned' },
      ];
  }
}

export function isNavigationItemActive(pathname: string, item: WorkspaceNavigationItem): boolean {
  if (item.availability === 'planned' || !item.href) {
    return false;
  }

  if (item.href === '/') {
    return pathname === '/';
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
