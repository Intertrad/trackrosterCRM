'use client';

import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Gauge,
  ListTodo,
  LogOut,
  Map,
  Menu,
  MessageSquare,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ComponentType } from 'react';

import type { AuthenticatedUser, WorkspaceMode, WorkspaceOption } from '@/lib/auth-types';

import './Sidebar.css';

interface SidebarProps {
  user: AuthenticatedUser;
  availableWorkspaces: WorkspaceOption[];
  activeWorkspace: WorkspaceOption | null;
  onSelectWorkspace: (workspaceKey: string) => void;
  onLogout: () => Promise<void>;
}

interface NavigationItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  enabled: boolean;
}

const COMMON_OVERVIEW: NavigationItem = {
  href: '/',
  label: 'Overview',
  icon: Gauge,
  enabled: true,
};

const NAVIGATION_BY_MODE: Record<WorkspaceMode, NavigationItem[]> = {
  admin: [
    COMMON_OVERVIEW,
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: BarChart3,
      enabled: false,
    },
    {
      href: '/team',
      label: 'Administration',
      icon: Users,
      enabled: false,
    },
  ],

  director: [
    COMMON_OVERVIEW,
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: BarChart3,
      enabled: false,
    },
    {
      href: '/reports',
      label: 'Reports',
      icon: ClipboardList,
      enabled: false,
    },
  ],

  manager: [
    COMMON_OVERVIEW,
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: BarChart3,
      enabled: false,
    },
    {
      href: '/team',
      label: 'Team',
      icon: Users,
      enabled: false,
    },
    {
      href: '/assignments',
      label: 'Assignments',
      icon: BriefcaseBusiness,
      enabled: false,
    },
    {
      href: '/campaigns',
      label: 'Campaigns',
      icon: CalendarDays,
      enabled: false,
    },
    {
      href: '/reports',
      label: 'Reports',
      icon: ClipboardList,
      enabled: false,
    },
    {
      href: '/messages',
      label: 'Messages',
      icon: MessageSquare,
      enabled: false,
    },
  ],

  prospector: [
    COMMON_OVERVIEW,
    {
      href: '/work-queue',
      label: 'Work Queue',
      icon: ClipboardList,
      enabled: true,
    },
    {
      href: '/prospects',
      label: 'My Prospects',
      icon: Users,
      enabled: false,
    },
    {
      href: '/map',
      label: 'Map',
      icon: Map,
      enabled: false,
    },
    {
      href: '/actions',
      label: 'Actions',
      icon: ListTodo,
      enabled: false,
    },
    {
      href: '/messages',
      label: 'Messages',
      icon: MessageSquare,
      enabled: false,
    },
  ],

  observer: [COMMON_OVERVIEW],
};

function getInitials(userId: string): string {
  return userId.slice(0, 2).toUpperCase();
}

function formatWorkspaceLabel(workspace: WorkspaceOption): string {
  const roleLabels: Record<WorkspaceMode, string> = {
    admin: 'Client Admin',
    director: 'Director',
    manager: 'Manager',
    prospector: 'Prospector',
    observer: 'Observer',
  };

  const scopeId = workspace.teamId ?? workspace.organizationId;

  if (!scopeId) {
    return roleLabels[workspace.mode];
  }

  return `${roleLabels[workspace.mode]} · ${scopeId.slice(0, 8)}`;
}

export default function Sidebar({
  user,
  availableWorkspaces,
  activeWorkspace,
  onSelectWorkspace,
  onLogout,
}: SidebarProps) {
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  const burgerRef = useRef<HTMLButtonElement>(null);

  const mobileNavRef = useRef<HTMLDivElement>(null);

  const navigation = activeWorkspace ? NAVIGATION_BY_MODE[activeWorkspace.mode] : [COMMON_OVERVIEW];

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!mobileNavOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (
        mobileNavRef.current &&
        !mobileNavRef.current.contains(target) &&
        burgerRef.current &&
        !burgerRef.current.contains(target)
      ) {
        setMobileNavOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mobileNavOpen]);

  return (
    <nav className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setCollapsed((current) => !current)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <Link href="/" className="sidebar-logo">
        <Image src="/images/logo.png" alt="TrackRoster" width={38} height={38} priority />

        <p>TrackRoster</p>
      </Link>

      <button
        type="button"
        ref={burgerRef}
        className="sidebar-burger"
        onClick={() => setMobileNavOpen((current) => !current)}
        aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
      >
        <Menu size={22} />
      </button>

      {availableWorkspaces.length > 1 ? (
        <div className="sidebar-workspace">
          <label htmlFor="workspace-select">Workspace</label>

          <select
            id="workspace-select"
            value={activeWorkspace?.key ?? ''}
            onChange={(event) => onSelectWorkspace(event.target.value)}
          >
            {availableWorkspaces.map((workspace) => (
              <option key={workspace.key} value={workspace.key}>
                {formatWorkspaceLabel(workspace)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div
        ref={mobileNavRef}
        className={`sidebar-links${mobileNavOpen ? ' sidebar-links--open' : ''}`}
      >
        {navigation.map((item) => {
          const Icon = item.icon;

          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

          if (!item.enabled) {
            return (
              <div key={item.href} className="nav-link nav-link--disabled">
                <Icon size={18} />

                <span className="nav-label">{item.label}</span>

                <span className="nav-soon">Soon</span>

                <span className="nav-tooltip">{item.label}</span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileNavOpen(false)}
              className={isActive ? 'nav-link nav-link--active' : 'nav-link'}
            >
              <Icon size={18} />

              <span className="nav-label">{item.label}</span>

              <span className="nav-tooltip">{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="sidebar-user">
        <div className="sidebar-avatar">
          {getInitials(user.userId)}

          <span className="status-dot status-dot--active" />
        </div>

        <div className="sidebar-user-info">
          <p className="sidebar-user-name">TrackRoster user</p>

          <p className="sidebar-user-role">
            {activeWorkspace ? formatWorkspaceLabel(activeWorkspace) : 'Authenticated'}
          </p>
        </div>

        <div className="sidebar-user-actions" ref={menuRef}>
          <button
            type="button"
            className="sidebar-user-menu"
            onClick={() => setMenuOpen((current) => !current)}
            aria-label="User options"
          >
            <ChevronDown size={16} />
          </button>

          {menuOpen ? (
            <div className="user-dropdown">
              <button type="button" className="user-dropdown-item" onClick={() => void onLogout()}>
                <LogOut size={15} />
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
