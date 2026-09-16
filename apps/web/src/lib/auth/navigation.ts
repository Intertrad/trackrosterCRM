import type { WorkspaceMode } from './workspace';

export type NavigationItemId =
  | 'overview'
  | 'work_queue'
  | 'follow_ups'
  | 'dashboard'
  | 'imports'
  | 'administration'
  | 'overrides';

export interface WorkspaceNavigationItem {
  id: NavigationItemId;

  label: string;

  href: string;

  availability: 'ready' | 'planned';
}

const OVERVIEW: WorkspaceNavigationItem = {
  id: 'overview',
  label: 'Overview',
  href: '/',
  availability: 'ready',
};

export function getNavigationForWorkspace(mode: WorkspaceMode): WorkspaceNavigationItem[] {
  switch (mode) {
    case 'admin':
      return [
        OVERVIEW,
        {
          id: 'dashboard',
          label: 'Manager Dashboard',
          href: '/dashboard',
          availability: 'planned',
        },
        {
          id: 'imports',
          label: 'Imports',
          href: '/imports',
          availability: 'planned',
        },
        {
          id: 'administration',
          label: 'Administration',
          href: '/admin',
          availability: 'planned',
        },
        {
          id: 'overrides',
          label: 'Overrides',
          href: '/overrides',
          availability: 'planned',
        },
      ];

    case 'director':
      return [
        OVERVIEW,
        {
          id: 'dashboard',
          label: 'Manager Dashboard',
          href: '/dashboard',
          availability: 'planned',
        },
        {
          id: 'overrides',
          label: 'Overrides',
          href: '/overrides',
          availability: 'planned',
        },
      ];

    case 'manager':
      return [
        OVERVIEW,
        {
          id: 'dashboard',
          label: 'Manager Dashboard',
          href: '/dashboard',
          availability: 'planned',
        },
        {
          id: 'overrides',
          label: 'Overrides',
          href: '/overrides',
          availability: 'planned',
        },
      ];

    case 'prospector':
      return [
        OVERVIEW,
        {
          id: 'work_queue',
          label: 'Work Queue',
          href: '/work-queue',
          availability: 'ready',
        },
        {
          id: 'follow_ups',
          label: 'Follow-ups',
          href: '/follow-ups',
          availability: 'planned',
        },
      ];

    case 'observer':
      /*
       * Observer-specific application screens will
       * be added only after their read contracts are
       * explicitly frozen.
       */
      return [OVERVIEW];
  }
}

export function isNavigationItemActive(pathname: string, item: WorkspaceNavigationItem): boolean {
  if (item.href === '/') {
    return pathname === '/';
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
