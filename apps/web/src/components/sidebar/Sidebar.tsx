'use client';

import { ChevronDown, ChevronLeft, ChevronRight, Gauge, LogOut, Menu } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import type { AuthenticatedUser } from '@/lib/auth-types';

import './Sidebar.css';

interface SidebarProps {
  user: AuthenticatedUser;
  onLogout: () => Promise<void>;
}

const navigation = [
  {
    href: '/',
    label: 'Overview',
    icon: Gauge,
  },
];

function getInitials(userId: string): string {
  return userId.slice(0, 2).toUpperCase();
}

export default function Sidebar({ user, onLogout }: SidebarProps) {
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);

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

      <div
        ref={mobileNavRef}
        className={`sidebar-links${mobileNavOpen ? ' sidebar-links--open' : ''}`}
      >
        {navigation.map((item) => {
          const Icon = item.icon;

          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

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

          <p className="sidebar-user-role">Authenticated</p>
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
