'use client';

import { useEffect, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ApiError } from '@/lib/api/api-error';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
} from '@/lib/api/notification-preference-client';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  categoryDescription,
  categoryLabel,
  channelLabel,
  isChannelEnabled,
  isChannelRequired,
  setChannel,
  type NotificationPreferences,
} from '@/lib/api/notification-preference-types';

/**
 * Per-category notification channels.
 *
 * `PUT /notification-preferences` replaces the whole document rather than
 * merging, so the full matrix is always sent — posting a partial one would
 * silently reset every category the user did not touch.
 *
 * An unset channel reads as enabled, matching the backend's treatment of a
 * missing entry as "not opted out". Rendering it as off would tell the user
 * they had already declined notifications they never declined.
 */
export function NotificationMatrix() {
  const [saved, setSaved] = useState<NotificationPreferences | null>(null);
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getNotificationPreferences(controller.signal)
      .then((preferences) => {
        if (controller.signal.aborted) {
          return;
        }

        setSaved(preferences);
        setDraft(preferences);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setSaved({});
        setDraft({});

        if (caught instanceof ApiError && caught.statusCode !== 404) {
          setError('We could not load your notification preferences.');
        }
      });

    return () => controller.abort();
  }, []);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  function save(): void {
    if (!draft) {
      return;
    }

    /* Send every category explicitly so the replace cannot drop one. */
    const complete: NotificationPreferences = {};

    for (const category of NOTIFICATION_CATEGORIES) {
      complete[category] = Object.fromEntries(
        NOTIFICATION_CHANNELS.map((channel) => [
          channel,
          isChannelEnabled(draft, category, channel),
        ]),
      );
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    saveNotificationPreferences(complete)
      .then((result) => {
        setSaved(result);
        setDraft(result);
        setNotice('Notification preferences saved.');
      })
      .catch(() => setError('We could not save your preferences. Please try again.'))
      .finally(() => setBusy(false));
  }

  return (
    <Card>
      <CardHeader title="What we notify you about" />

      {notice ? (
        <Alert tone="success" className="mb-4">
          {notice}
        </Alert>
      ) : null}

      {error ? (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      ) : null}

      {draft === null ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="h-14 animate-pulse rounded-lg bg-line-soft" />
          ))}
        </div>
      ) : (
        <>
          {/* Table above sm, stacked cards below — three checkboxes per row
              do not survive a phone width as a table. */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[34rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line-soft">
                  <th scope="col" className="pb-2 text-[13px] font-semibold text-ink-muted">
                    Event
                  </th>

                  {NOTIFICATION_CHANNELS.map((channel) => (
                    <th
                      key={channel}
                      scope="col"
                      className="px-3 pb-2 text-[13px] font-semibold text-ink-muted"
                    >
                      {channelLabel(channel)}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {NOTIFICATION_CATEGORIES.map((category) => (
                  <tr key={category} className="border-b border-line-soft">
                    <td className="py-3 pr-4">
                      <span className="block text-[15px] font-semibold text-navy">
                        {categoryLabel(category)}
                      </span>

                      <span className="block text-[13px] text-ink-muted">
                        {categoryDescription(category)}
                      </span>
                    </td>

                    {NOTIFICATION_CHANNELS.map((channel) => (
                      <td key={channel} className="px-3 py-3">
                        <Checkbox
                          label={`${channelLabel(channel)} for ${categoryLabel(category)}`}
                          className="sr-only-label"
                          checked={isChannelEnabled(draft, category, channel)}
                          disabled={busy || isChannelRequired(category, channel)}
                          onChange={(event) =>
                            setDraft(setChannel(draft, category, channel, event.target.checked))
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-4 sm:hidden">
            {NOTIFICATION_CATEGORIES.map((category) => (
              <li key={category} className="rounded-xl border border-line-soft px-3.5 py-3">
                <p className="text-[15px] font-semibold text-navy">{categoryLabel(category)}</p>

                <p className="text-[13px] text-ink-muted">{categoryDescription(category)}</p>

                <div className="mt-3 flex flex-wrap gap-4">
                  {NOTIFICATION_CHANNELS.map((channel) => (
                    <Checkbox
                      key={channel}
                      label={channelLabel(channel)}
                      checked={isChannelEnabled(draft, category, channel)}
                      disabled={busy || isChannelRequired(category, channel)}
                      onChange={(event) =>
                        setDraft(setChannel(draft, category, channel, event.target.checked))
                      }
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button loading={busy} disabled={!dirty} onClick={save}>
              Save preferences
            </Button>

            <Button variant="secondary" disabled={!dirty || busy} onClick={() => setDraft(saved)}>
              Discard changes
            </Button>
          </div>

          <p className="mt-4 text-[13px] text-ink-muted">
            A channel you have never set stays on. Critical collision alerts always stay in the
            in-app inbox. Push also needs a registered device.
          </p>
        </>
      )}
    </Card>
  );
}
