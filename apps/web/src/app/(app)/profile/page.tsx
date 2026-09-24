import type { Metadata } from 'next';

import { PreferencesTab } from '@/components/account/preferences-tab';
import { ProfileTab } from '@/components/account/profile-tab';
import { SecurityTab } from '@/components/account/security-tab';
import { SessionsTab } from '@/components/account/sessions-tab';
import { PageHeader } from '@/components/ui/page-header';
import { type TabItem, Tabs } from '@/components/ui/tabs';

export const metadata: Metadata = {
  title: 'Account settings',
  description: 'Manage your identity, security, and workspace access.',
};

const TAB_IDS = ['profile', 'security', 'notifications', 'sessions'] as const;

type TabId = (typeof TAB_IDS)[number];

const TABS: TabItem[] = [
  { id: 'profile', label: 'Profile', href: '/profile' },
  { id: 'security', label: 'Security', href: '/profile?tab=security' },
  { id: 'notifications', label: 'Notifications', href: '/profile?tab=notifications' },
  { id: 'sessions', label: 'Sessions', href: '/profile?tab=sessions' },
];

function resolveTab(value: string | string[] | undefined): TabId {
  return TAB_IDS.includes(value as TabId) ? (value as TabId) : 'profile';
}

export default async function AccountSettingsPage({ searchParams }: PageProps<'/profile'>) {
  const { tab } = await searchParams;

  const activeTab = resolveTab(tab);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Account settings"
        subtitle="Manage your identity, security, and workspace access."
      />

      <Tabs items={TABS} activeId={activeTab} label="Account settings sections" />

      {activeTab === 'profile' ? <ProfileTab /> : null}
      {activeTab === 'security' ? <SecurityTab /> : null}
      {activeTab === 'notifications' ? <PreferencesTab /> : null}
      {activeTab === 'sessions' ? <SessionsTab /> : null}

      <p className="rounded-lg border border-info-border bg-info-bg px-4 py-3 text-[14px] text-ink-soft">
        Your navigation and available settings adapt to the active workspace role.
      </p>
    </div>
  );
}
