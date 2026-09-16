'use client';

import {
  BarChart3,
  Bell,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Upload,
  UsersRound,
  X,
} from 'lucide-react';

import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

type NavigationItem = {
  label: string;
  href?: string;
  icon: ComponentType<{
    className?: string;
    'aria-hidden'?: boolean;
  }>;
  soon?: boolean;
};

type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

const navigation: NavigationGroup[] = [
  {
    label: 'Workspace',
    items: [
      {
        label: 'Overview',
        href: '/',
        icon: LayoutDashboard,
      },
      {
        label: 'Work Queue',
        icon: ClipboardList,
        soon: true,
      },
      {
        label: 'Follow-ups',
        icon: Bell,
        soon: true,
      },
    ],
  },
  {
    label: 'Management',
    items: [
      {
        label: 'Manager Dashboard',
        icon: BarChart3,
        soon: true,
      },
      {
        label: 'Overrides',
        icon: ShieldCheck,
        soon: true,
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        label: 'Imports',
        icon: Upload,
        soon: true,
      },
      {
        label: 'Administration',
        icon: UsersRound,
        soon: true,
      },
    ],
  },
];

function TrackRosterMark() {
  return (
    <div
      aria-hidden="true"
      className="grid size-9 grid-cols-3 gap-0.75 rounded-lg bg-white/10 p-1.5"
    >
      <span className="rounded-xs bg-white" />
      <span className="rounded-xs bg-white/55" />
      <span className="rounded-xs bg-white/55" />
      <span className="rounded-xs bg-white/55" />
      <span className="rounded-xs bg-lime" />
      <span className="rounded-xs bg-white/55" />
      <span className="rounded-xs bg-white/55" />
      <span className="rounded-xs bg-white/55" />
      <span className="rounded-xs bg-white/55" />
    </div>
  );
}

function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation" className="flex flex-1 flex-col gap-7 px-4 py-6">
      {navigation.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
            {group.label}
          </p>

          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;

              if (!item.href || item.soon) {
                return (
                  <div
                    key={item.label}
                    aria-disabled="true"
                    className="flex h-11 cursor-not-allowed items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/45"
                  >
                    <Icon aria-hidden={true} className="size-4.5 shrink-0" />

                    <span className="min-w-0 flex-1 truncate">{item.label}</span>

                    {item.soon ? (
                      <span className="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">
                        Soon
                      </span>
                    ) : null}
                  </div>
                );
              }

              const isActive =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-white/12 text-white'
                      : 'text-white/70 hover:bg-white/[0.07] hover:text-white',
                  ].join(' ')}
                >
                  <Icon
                    aria-hidden={true}
                    className={['size-4.5 shrink-0', isActive ? 'text-lime' : ''].join(' ')}
                  />

                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-navy text-white">
      <div className="flex h-18 items-center gap-3 border-b border-white/10 px-6">
        <TrackRosterMark />

        <div>
          <p className="text-[17px] font-semibold tracking-tight">TrackRoster</p>
          <p className="text-[11px] text-white/45">Prospecting coordination</p>
        </div>
      </div>

      <SidebarNavigation onNavigate={onNavigate} />

      <div className="border-t border-white/10 p-4">
        <div className="rounded-xl bg-white/6 p-3">
          <p className="text-xs font-medium text-white/85">TrackRoster workspace</p>
          <p className="mt-1 text-[11px] leading-4 text-white/45">
            Authorization will be connected to backend access grants.
          </p>
        </div>
      </div>
    </div>
  );
}

type AppShellProps = Readonly<{
  children: ReactNode;
}>;

export function AppShell({ children }: AppShellProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-68 lg:block">
        <Sidebar />
      </aside>

      {mobileNavigationOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-navy/45 backdrop-blur-[1px]"
            onClick={() => setMobileNavigationOpen(false)}
          />

          <aside className="relative h-full w-[min(86vw,300px)] shadow-2xl">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileNavigationOpen(false)}
              className="absolute right-3 top-4 z-10 flex size-10 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <X aria-hidden="true" className="size-5" />
            </button>

            <Sidebar onNavigate={() => setMobileNavigationOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="min-h-screen lg:pl-68">
        <header className="sticky top-0 z-30 flex h-18 items-center border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={mobileNavigationOpen}
            onClick={() => setMobileNavigationOpen(true)}
            className="mr-3 flex size-10 items-center justify-center rounded-lg border border-border bg-surface text-foreground transition hover:bg-surface-secondary lg:hidden"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>

          <div className="min-w-0">
            <p className="text-xs font-medium text-text-muted">Workspace</p>

            <button
              type="button"
              className="mt-0.5 flex max-w-55 items-center gap-1 text-sm font-semibold text-foreground sm:max-w-none"
            >
              <span className="truncate">TrackRoster</span>
              <ChevronDown aria-hidden="true" className="size-4 text-text-muted" />
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              aria-label="Notifications"
              className="relative flex size-10 items-center justify-center rounded-lg text-text-secondary transition hover:bg-surface-secondary hover:text-foreground"
            >
              <Bell aria-hidden="true" className="size-5" />
            </button>

            <div className="ml-1 hidden h-8 w-px bg-border sm:block" />

            <button
              type="button"
              className="ml-1 flex items-center gap-3 rounded-lg p-1.5 transition hover:bg-surface-secondary"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
                TR
              </span>

              <span className="hidden text-left sm:block">
                <span className="block text-sm font-medium text-foreground">Account</span>
                <span className="block text-xs text-text-muted">Session pending</span>
              </span>

              <ChevronDown aria-hidden="true" className="hidden size-4 text-text-muted sm:block" />
            </button>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
