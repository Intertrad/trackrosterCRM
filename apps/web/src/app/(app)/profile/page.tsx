import type { Metadata } from 'next';

import {
  AccountSettingsHeader,
  AccountSettingsHint,
} from '@/components/account/account-settings-header';
import { PreferencesTab } from '@/components/account/preferences-tab';
import { ProfileTab } from '@/components/account/profile-tab';
import { SecurityTab } from '@/components/account/security-tab';
import { SessionsTab } from '@/components/account/sessions-tab';

export const metadata: Metadata = {
  title: 'Account settings',
  description: 'Manage your identity, security, and workspace access.',
};

const TAB_IDS = ['profile', 'security', 'notifications', 'sessions'] as const;

type TabId = (typeof TAB_IDS)[number];

function resolveTab(value: string | string[] | undefined): TabId {
  return TAB_IDS.includes(value as TabId) ? (value as TabId) : 'profile';
}

export default async function AccountSettingsPage({ searchParams }: PageProps<'/profile'>) {
  const { tab } = await searchParams;

  const activeTab = resolveTab(tab);

  return (
    <div className="flex flex-col gap-6">
      <AccountSettingsHeader activeTab={activeTab} />

      {activeTab === 'profile' ? <ProfileTab /> : null}
      {activeTab === 'security' ? <SecurityTab /> : null}
      {activeTab === 'notifications' ? <PreferencesTab /> : null}
      {activeTab === 'sessions' ? <SessionsTab /> : null}

      <p className="rounded-lg border border-info-border bg-info-bg px-4 py-3 text-[14px] text-ink-soft">
        <AccountSettingsHint />
      </p>
    </div>
  );
}
