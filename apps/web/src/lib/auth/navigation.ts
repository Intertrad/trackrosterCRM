import type { MessageKey } from '@/lib/i18n/dictionary';
import { isAvailable, type FeatureKey } from '@/lib/readiness/feature-readiness';

import type { WorkspaceMode } from './workspace';

export type NavigationItemId =
  | 'objectives'
  | 'territories'
  | 'security'
  | 'platform'
  | 'live'
  | 'organizations'
  | 'rules'
  | 'scripts'
  | 'workspace_tools'
  | 'overview'
  | 'referential'
  | 'work_queue'
  | 'map'
  | 'follow_ups'
  | 'logged_actions'
  | 'performance'
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
  | 'live'
  | 'rules'
  | 'activity'
  | 'today'
  | 'prospects'
  | 'map'
  | 'actions'
  | 'performance'
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
  group?: 'configuration' | 'tools' | 'operate' | 'control';
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
  referential: 'prospect_reads',
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
  const items = navigationFor(mode).filter(isOfferable);

  /* Keep the prospector shell focused on the daily operating flow. Workspace
   * tools remain reachable from the account menu instead of competing with
   * Prospects, Map, Follow-ups, History, Performance and Messages. */
  if (mode === 'prospector') return items;

  return [
    ...items,
    {
      id: 'workspace_tools',
      label: 'nav.workspaceTools',
      icon: 'settings',
      group: 'tools',
      href: '/workspace',
      availability: 'ready',
    },
  ];
}

function navigationFor(mode: WorkspaceMode): WorkspaceNavigationItem[] {
  switch (mode) {
    case 'admin':
      return [
        {
          id: 'administration',
          label: 'nav.overview',
          icon: 'dashboard',
          href: '/admin/overview',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'live',
          label: 'nav.live',
          icon: 'live',
          href: '/admin/live',
          availability: 'ready',
        },
        {
          id: 'referential',
          label: 'nav.referential',
          icon: 'prospects',
          href: '/admin/prospects',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'users',
          label: 'nav.team',
          icon: 'team',
          href: '/admin/users',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'logged_actions',
          label: 'nav.activity',
          icon: 'activity',
          href: '/actions',
          availability: 'ready',
        },
        {
          id: 'messages',
          label: 'nav.messages',
          icon: 'messages',
          href: '/messages',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'scripts',
          label: 'nav.scripts',
          icon: 'reports',
          href: '/admin/scripts',
          availability: 'ready',
          group: 'configuration',
        },
        {
          id: 'organizations',
          label: 'nav.organizations',
          icon: 'campaigns',
          href: '/admin/organizations',
          availability: 'ready',
          group: 'configuration',
        },
        {
          id: 'rules',
          label: 'nav.rules',
          icon: 'rules',
          href: '/admin/settings',
          availability: 'ready',
          group: 'configuration',
        },
        {
          id: 'imports',
          label: 'nav.imports',
          icon: 'imports',
          href: '/admin/imports',
          availability: 'ready',
          group: 'configuration',
        },
        {
          id: 'audit',
          label: 'nav.audit',
          icon: 'audit',
          href: '/admin/audit',
          availability: 'ready',
          group: 'configuration',
        },
        {
          id: 'campaigns',
          label: 'nav.campaigns',
          icon: 'campaigns',
          href: '/admin/campaigns',
          availability: 'ready',
          group: 'tools',
        },
        {
          id: 'overrides',
          label: 'nav.overrides',
          icon: 'overrides',
          href: '/manager/approvals',
          availability: 'ready',
          group: 'tools',
        },
        {
          id: 'reports',
          label: 'nav.reports',
          icon: 'reports',
          href: '/manager/reports',
          availability: 'ready',
          group: 'tools',
        },
      ];

    case 'director':
      /* The director shell mirrors the executive reporting workspace. Each
       * route below has a director-specific page so the role never lands on a
       * manager-only navigation surface. */
      return [
        {
          id: 'overview',
          label: 'nav.executiveDashboard',
          icon: 'dashboard',
          href: '/director/overview',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'reports',
          label: 'nav.reports',
          icon: 'reports',
          href: '/director/reports',
          availability: 'ready',
        },
        {
          id: 'campaigns',
          label: 'nav.campaigns',
          icon: 'campaigns',
          href: '/director/campaigns',
          availability: 'ready',
        },
        {
          id: 'territories',
          label: 'nav.territories',
          icon: 'map',
          href: '/director/territories',
          availability: 'ready',
        },
        {
          id: 'performance',
          label: 'nav.teamPerformance',
          icon: 'performance',
          href: '/director/performance',
          availability: 'ready',
        },
        {
          id: 'exports',
          label: 'nav.exports',
          icon: 'imports',
          href: '/director/exports',
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
          group: 'operate',
        },
        {
          id: 'objectives',
          label: 'nav.objectives',
          icon: 'assignments',
          href: '/manager/objectives',
          availability: 'ready',
          group: 'tools',
        },
        {
          id: 'referential',
          label: 'nav.prospects',
          icon: 'prospects',
          href: '/work-queue',
          availability: 'ready',
          group: 'operate',
        },
        {
          id: 'team',
          label: 'nav.team',
          icon: 'team',
          href: '/manager/team',
          availability: 'ready',
          group: 'operate',
        },
        {
          id: 'campaigns',
          label: 'nav.campaigns',
          icon: 'campaigns',
          href: '/manager/campaigns',
          availability: 'ready',
          group: 'operate',
        },
        {
          id: 'assignments',
          label: 'nav.assignments',
          icon: 'assignments',
          href: '/manager/assignments',
          availability: 'ready',
          primary: true,
          group: 'operate',
        },
        {
          id: 'territories',
          label: 'nav.territories',
          icon: 'map',
          href: '/manager/territories',
          availability: 'ready',
          group: 'operate',
        },
        {
          id: 'overrides',
          label: 'nav.approvals',
          icon: 'overrides',
          href: '/manager/approvals',
          availability: 'ready',
          primary: true,
          group: 'control',
        },
        {
          id: 'reports',
          label: 'nav.reports',
          icon: 'reports',
          href: '/manager/reports',
          availability: 'ready',
          primary: true,
          group: 'control',
        },
        {
          id: 'messages',
          label: 'nav.messages',
          icon: 'messages',
          href: '/messages',
          availability: 'ready',
          group: 'control',
        },
        {
          id: 'collisions',
          label: 'nav.collisions',
          icon: 'collisions',
          href: '/manager/collisions',
          availability: 'ready',
          group: 'tools',
        },
        {
          id: 'exports',
          label: 'nav.exports',
          icon: 'imports',
          href: '/manager/exports',
          availability: 'ready',
          group: 'tools',
        },
        {
          id: 'search',
          label: 'nav.search',
          icon: 'prospects',
          href: '/search',
          availability: 'ready',
          group: 'tools',
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
          label: 'nav.prospects',
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
          label: 'nav.followUps',
          icon: 'today',
          href: '/follow-ups',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'logged_actions',
          label: 'nav.actionsHistory',
          icon: 'actions',
          href: '/actions',
          availability: 'ready',
        },
        {
          id: 'performance',
          label: 'nav.performance',
          icon: 'performance',
          href: '/performance',
          availability: 'ready',
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
        { ...OVERVIEW, href: '/observer/overview' },
        {
          id: 'audit',
          label: 'nav.audit',
          icon: 'audit',
          href: '/observer/audit',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'security',
          label: 'nav.security',
          icon: 'overrides',
          href: '/observer/security',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'assignments',
          label: 'nav.assignments',
          icon: 'assignments',
          href: '/observer/assignments',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'exports',
          label: 'nav.exports',
          icon: 'imports',
          href: '/observer/exports',
          availability: 'ready',
        },
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

export function getPlatformNavigation(): WorkspaceNavigationItem[] {
  return [
    {
      id: 'overview',
      label: 'nav.overview',
      icon: 'dashboard',
      href: '/platform/overview',
      availability: 'ready',
      primary: true,
    },
    {
      id: 'organizations',
      label: 'nav.tenants',
      icon: 'campaigns',
      href: '/platform/tenants',
      availability: 'ready',
      primary: true,
    },
    {
      id: 'users',
      label: 'nav.platformAccess',
      icon: 'team',
      href: '/platform/access',
      availability: 'ready',
      primary: true,
    },
    {
      id: 'live',
      label: 'nav.serviceHealth',
      icon: 'live',
      href: '/platform/health',
      availability: 'ready',
      primary: true,
    },
  ];
}

export function getRoleHome(mode: WorkspaceMode | undefined, platformAdmin = false): string {
  if (!mode && platformAdmin) return '/platform/overview';
  if (mode === 'prospector' || !mode) return '/';
  return `/${mode}/overview`;
}

/**
 * Keep browser navigation inside the viewer's active workspace.
 *
 * API authorization remains the security boundary, but rendering a different
 * role's route after a pasted URL is confusing and can expose UI chrome that
 * the viewer cannot use. The route families mirror the server's role scope:
 * administrators can inspect every tenant workspace, directors can inspect
 * manager reporting, and managers/observers stay within their own surfaces.
 */
export function isRouteAllowedForWorkspace(
  pathname: string,
  mode: WorkspaceMode | undefined,
  platformAdmin = false,
): boolean {
  const segment = pathname.split('/')[1] ?? '';

  if (segment === 'platform') return platformAdmin;
  if (segment === 'admin') return mode === 'admin' || platformAdmin;
  if (segment === 'director') return mode === 'admin' || mode === 'director' || platformAdmin;
  if (segment === 'manager') {
    return mode === 'admin' || mode === 'director' || mode === 'manager' || platformAdmin;
  }
  if (segment === 'observer')
    return mode === 'admin' || mode === 'director' || mode === 'observer' || platformAdmin;

  return true;
}
