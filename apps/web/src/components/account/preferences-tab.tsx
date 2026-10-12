'use client';

import { useEffect, useState } from 'react';

import { NotificationMatrix } from '@/components/account/notification-matrix';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { SelectField } from '@/components/ui/select-field';
import { ApiError } from '@/lib/api/api-error';
import { getAccountPreferences, updateAccountPreferences } from '@/lib/api/account-client';
import type { AccountPreferences } from '@/lib/api/account-types';
import { notify } from '@/lib/notifications/notify';
import { useTranslation } from '@/lib/i18n/i18n-context';

export function PreferencesTab() {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<AccountPreferences | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [draft, setDraft] = useState<AccountPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    getAccountPreferences(controller.signal)
      .then((result) => {
        setPreferences(result.resource);
        setDraft(result.resource);
        setEtag(result.etag);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          caught instanceof ApiError && caught.statusCode === 401
            ? t('common.sessionExpired')
            : t('account.preferences.loadError'),
        );
      });

    return () => controller.abort();
  }, []);

  async function handleSave(): Promise<void> {
    if (!draft || !preferences) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await updateAccountPreferences(diff(preferences, draft), etag);

      setPreferences(result.resource);
      setDraft(result.resource);
      setEtag(result.etag);
      notify.success(t('account.preferences.saved'), { id: 'account-preferences-saved' });
      window.dispatchEvent(new Event('trackroster:preferences-changed'));
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.statusCode === 412
          ? t('account.preferences.conflict')
          : t('account.preferences.saveError'),
      );
    } finally {
      setSaving(false);
    }
  }

  if (error && !draft) {
    return <Alert tone="danger">{error}</Alert>;
  }

  if (!draft || !preferences) {
    return (
      <Card>
        <div className="flex animate-pulse flex-col gap-4" aria-busy="true">
          <div className="h-6 w-48 rounded bg-line-soft" />
          <div className="h-12 rounded-lg bg-line-soft" />
          <div className="h-12 rounded-lg bg-line-soft" />
        </div>
      </Card>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(preferences);

  return (
    <div className="flex flex-col gap-5">
      {/* Notification routing is a separate document from interface
          preferences and is saved independently. */}
      <NotificationMatrix />

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader title={t('account.preferences.interface')} />

          <div className="flex flex-col gap-4">
            <SelectField
              label={t('account.preferences.theme')}
              value={draft.theme}
              onChange={(event) =>
                setDraft({ ...draft, theme: event.target.value as AccountPreferences['theme'] })
              }
              options={[
                { value: 'system', label: t('account.preferences.system') },
                { value: 'light', label: t('account.preferences.light') },
                { value: 'dark', label: t('account.preferences.dark') },
              ]}
              disabled={saving}
            />

            <SelectField
              label={t('account.preferences.density')}
              value={draft.density}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  density: event.target.value as AccountPreferences['density'],
                })
              }
              options={[
                { value: 'comfortable', label: t('account.preferences.comfortable') },
                { value: 'compact', label: t('account.preferences.compact') },
              ]}
              disabled={saving}
            />

            <div className="flex flex-col gap-3 border-t border-line-soft pt-4">
              <p className="text-[14px] font-semibold text-ink">
                {t('account.preferences.accessibility')}
              </p>

              <Checkbox
                label={t('account.preferences.reduceMotion')}
                checked={draft.reducedMotion}
                onChange={(event) => setDraft({ ...draft, reducedMotion: event.target.checked })}
                disabled={saving}
              />

              <Checkbox
                label={t('account.preferences.increaseContrast')}
                checked={draft.highContrast}
                onChange={(event) => setDraft({ ...draft, highContrast: event.target.checked })}
                disabled={saving}
              />
            </div>

            {error ? <Alert tone="danger">{error}</Alert> : null}

            <Button fullWidth loading={saving} disabled={!dirty} onClick={() => void handleSave()}>
              {t('account.preferences.save')}
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title={t('account.preferences.contactSafety')} />
          <p className="text-[14px] leading-relaxed text-ink-soft">
            {t('account.preferences.contactSafetyBody')}
          </p>
        </Card>
      </div>
    </div>
  );
}

/* Send only the changed keys: PATCH merges, so a full body would rewrite
 * preferences another device may have just changed. */
function diff(current: AccountPreferences, next: AccountPreferences): Partial<AccountPreferences> {
  const changed: Partial<AccountPreferences> = {};

  if (next.theme !== current.theme) changed.theme = next.theme;
  if (next.density !== current.density) changed.density = next.density;
  if (next.reducedMotion !== current.reducedMotion) changed.reducedMotion = next.reducedMotion;
  if (next.highContrast !== current.highContrast) changed.highContrast = next.highContrast;

  return changed;
}
