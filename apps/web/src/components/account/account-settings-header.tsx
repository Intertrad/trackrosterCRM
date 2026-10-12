'use client';

import { PageHeader } from '@/components/ui/page-header';
import { type TabItem, Tabs } from '@/components/ui/tabs';
import { useTranslation } from '@/lib/i18n/i18n-context';

const TAB_HREFS = {
  profile: '/profile',
  security: '/profile?tab=security',
  notifications: '/profile?tab=notifications',
  sessions: '/profile?tab=sessions',
} as const;

export function AccountSettingsHeader({ activeTab }: { activeTab: keyof typeof TAB_HREFS }) {
  const { t } = useTranslation();

  const items: TabItem[] = [
    { id: 'profile', label: t('account.tab.profile'), href: TAB_HREFS.profile },
    { id: 'security', label: t('account.tab.security'), href: TAB_HREFS.security },
    { id: 'notifications', label: t('account.tab.notifications'), href: TAB_HREFS.notifications },
    { id: 'sessions', label: t('account.tab.sessions'), href: TAB_HREFS.sessions },
  ];

  return (
    <>
      <PageHeader title={t('account.settings')} subtitle={t('account.settingsSubtitle')} />
      <Tabs items={items} activeId={activeTab} label={t('account.settingsSections')} />
    </>
  );
}

export function AccountSettingsHint() {
  const { t } = useTranslation();

  return <>{t('account.navigationHint')}</>;
}
