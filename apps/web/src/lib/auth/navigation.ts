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

  label: string;

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
  label: 'Overview',
  icon: 'dashboard',
  href: '/',
  availability: 'ready',
  primary: true,
};

export function getNavigationForWorkspace(mode: WorkspaceMode): WorkspaceNavigationItem[] {
  switch (mode) {
    case 'admin':
      return [
        {
          id: 'administration',
          label: 'Overview',
          icon: 'administration',
          href: '/admin/overview',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'users',
          label: 'Users & roles',
          icon: 'team',
          href: '/admin/users',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'imports',
          label: 'Imports',
          icon: 'imports',
          href: '/admin/imports',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'audit',
          label: 'Audit',
          icon: 'audit',
          href: '/admin/audit',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'dashboard',
          label: 'Team overview',
          icon: 'dashboard',
          href: '/manager/overview',
          availability: 'ready',
        },
        { id: 'overrides', label: 'Overrides', icon: 'overrides', availability: 'planned' },
      ];

    case 'director':
      return [
        OVERVIEW,
        {
          id: 'dashboard',
          label: 'Team overview',
          icon: 'dashboard',
          href: '/manager/overview',
          availability: 'ready',
          primary: true,
        },
        { id: 'reports', label: 'Reports', icon: 'reports', availability: 'planned' },
        { id: 'overrides', label: 'Overrides', icon: 'overrides', availability: 'planned' },
      ];

    case 'manager':
      return [
        {
          id: 'overview',
          label: 'Overview',
          icon: 'dashboard',
          href: '/manager/overview',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'team',
          label: 'Team',
          icon: 'team',
          href: '/manager/team',
          availability: 'ready',
        },
        {
          id: 'campaigns',
          label: 'Campaigns',
          icon: 'campaigns',
          href: '/manager/campaigns',
          availability: 'ready',
        },
        {
          id: 'assignments',
          label: 'Assignments',
          icon: 'assignments',
          href: '/manager/assignments',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'collisions',
          label: 'Collision center',
          icon: 'collisions',
          href: '/manager/collisions',
          availability: 'ready',
        },
        {
          id: 'overrides',
          label: 'Approvals',
          icon: 'overrides',
          href: '/manager/approvals',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'reports',
          label: 'Reports',
          icon: 'reports',
          href: '/manager/reports',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'exports',
          label: 'Exports',
          icon: 'imports',
          href: '/manager/exports',
          availability: 'ready',
        },
        {
          id: 'messages',
          label: 'Messages',
          icon: 'messages',
          href: '/messages',
          availability: 'ready',
        },
      ];

    case 'prospector':
      return [
        {
          id: 'overview',
          label: 'Today',
          icon: 'today',
          href: '/',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'work_queue',
          label: 'My prospects',
          icon: 'prospects',
          href: '/work-queue',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'map',
          label: 'Map',
          icon: 'map',
          href: '/map',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'follow_ups',
          label: 'Actions',
          icon: 'actions',
          href: '/follow-ups',
          availability: 'ready',
          primary: true,
        },
        {
          id: 'routes',
          label: 'Routes',
          icon: 'routes',
          href: '/routes',
          availability: 'ready',
        },
        {
          id: 'logged_actions',
          label: 'Logged actions',
          icon: 'actions',
          href: '/actions',
          availability: 'ready',
        },
        {
          id: 'messages',
          label: 'Messages',
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
      return [OVERVIEW, { id: 'audit', label: 'Audit', icon: 'audit', availability: 'planned' }];
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
