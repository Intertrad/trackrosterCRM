'use client';
import { useCallback, useEffect, useState } from 'react';
import { resolvePeriod, type ManagerPeriod } from '@/components/manager/manager-filters';
import { browserJson } from '@/lib/api/browser-json';
import { useAuth } from '@/lib/auth/auth-context';
import { useLiveRefresh } from '@/lib/live/use-live-refresh';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';
import { Card, CardHeader } from './card';
import { Button } from './button';
export type ActivityRow = {
  date: string;
  channel: string;
  status: 'completed' | 'pending' | 'overdue' | 'cancelled';
  outcome: string | null;
  count: number;
};
export type ActivityData = {
  generatedAt: string;
  timeZone: string;
  range: { from: string; to: string };
  items: ActivityRow[];
};
const colors: Record<string, string> = {
  call: '#0f59fa',
  email: '#3978ee',
  message: '#6598f5',
  visit: '#1544a7',
  task: '#86b1f5',
  note: '#b2ccf8',
};
const reds: Record<string, string> = {
  visit: '#7f1d1d',
  call: '#b91c1c',
  email: '#dc2626',
  message: '#ef4444',
  task: '#f87171',
  note: '#fca5a5',
};
const channelOrder = ['visit', 'call', 'email', 'message', 'task', 'note'];
export function activityColor(channel: string, status: string) {
  return status === 'completed' ? (colors[channel] ?? '#3978ee') : (reds[channel] ?? '#dc2626');
}
export function activitySegments(rows: ActivityRow[]) {
  const channels = [...new Set(rows.map((row) => row.channel))].sort(
    (a, b) =>
      (channelOrder.indexOf(a) < 0 ? 99 : channelOrder.indexOf(a)) -
        (channelOrder.indexOf(b) < 0 ? 99 : channelOrder.indexOf(b)) || a.localeCompare(b),
  );
  return [
    ...channels.map((channel) => ({ channel, status: 'completed' as const })),
    ...channels.flatMap((channel) =>
      (['overdue', 'cancelled', 'pending'] as const).map((status) => ({ channel, status })),
    ),
  ]
    .map((group) => ({
      ...group,
      count: rows
        .filter((row) => row.channel === group.channel && row.status === group.status)
        .reduce((sum, row) => sum + row.count, 0),
    }))
    .filter((group) => group.count > 0);
}
export function activityTotals(rows: ActivityRow[]) {
  return {
    total: rows.reduce((sum, row) => sum + row.count, 0),
    completed: rows
      .filter((row) => row.status === 'completed')
      .reduce((sum, row) => sum + row.count, 0),
  };
}
export function ActivityCharts({
  range,
  period,
  days,
  mode = 'both',
}: {
  range?: { from: string; to: string };
  period?: ManagerPeriod;
  days?: string;
  mode?: 'both' | 'channels' | 'time';
}) {
  const { language, locale } = useTranslation();
  const { activeWorkspace } = useAuth();
  const l = (en: string, fr: string) => text(en, fr, language);
  const [localDays, setLocalDays] = useState('30');
  const [data, setData] = useState<ActivityData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<string | null>(null);
  const teamId = activeWorkspace?.teamId;
  const organizationId = activeWorkspace?.organizationId;
  const from = range?.from;
  const to = range?.to;
  const selectedDays = days ?? localDays;
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const rollingRange = period ? resolvePeriod(period) : undefined;
        const end = rollingRange?.to ?? to ?? new Date().toISOString();
        const start =
          rollingRange?.from ??
          from ??
          new Date(Date.parse(end) - Number(selectedDays) * 86400000).toISOString();
        const params = new URLSearchParams({ from: start, to: end });
        if (teamId) params.set('teamId', teamId);
        if (organizationId) params.set('organizationId', organizationId);
        const result = await browserJson<ActivityData>(`/api/dashboard/activity?${params}`, {
          signal,
          cache: 'no-store',
        });
        if (!signal?.aborted) {
          setData(result);
          setError(false);
        }
      } catch {
        if (!signal?.aborted) {
          setError(true);
          setData(null);
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [from, to, period, selectedDays, teamId, organizationId],
  );
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setLoading(true);
    setHover(null);
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  useLiveRefresh(load, {
    scope: `${from}:${to}:${period}:${selectedDays}:${teamId}:${organizationId}`,
  });
  const rows = data?.items ?? [];
  const totals = activityTotals(rows);
  const channelNames: Record<string, string> = {
    call: l('Calls', 'Appels'),
    email: l('Emails', 'E-mails'),
    message: l('Messages', 'Messages'),
    visit: l('Visits', 'Visites'),
    task: l('Tasks', 'Tâches'),
    note: l('Notes', 'Notes'),
  };
  const statuses = {
    completed: l('Completed', 'Complétées'),
    pending: l('Pending', 'En attente'),
    overdue: l('Overdue', 'En retard'),
    cancelled: l('Cancelled', 'Annulées'),
  };
  const groups = activitySegments(rows);
  const channels = [...new Set(groups.map((row) => row.channel))].sort(
    (a, b) =>
      (channelOrder.indexOf(a) < 0 ? 99 : channelOrder.indexOf(a)) -
        (channelOrder.indexOf(b) < 0 ? 99 : channelOrder.indexOf(b)) || a.localeCompare(b),
  );
  const color = activityColor;
  const tooltip = (selected: ActivityRow[]) => (
    <div role="status" className="mt-3 rounded-lg border border-line bg-surface-muted p-3 text-xs">
      <p className="mb-2 font-bold">
        {hover?.startsWith('day:') ? hover.slice(4) : channelNames[hover?.slice(8) ?? '']}
      </p>
      <ul className="space-y-1">
        {[...new Set(selected.map((row) => row.channel))].map((channel) => {
          const subset = selected.filter((row) => row.channel === channel);
          const count = activityTotals(subset);
          return (
            <li key={channel}>
              <strong>
                {channelNames[channel] ?? channel} : {count.completed} / {count.total}
              </strong>
              <p>
                {Object.entries(statuses)
                  .map(
                    ([status, label]) =>
                      `${label} : ${subset.filter((row) => row.status === status).reduce((sum, row) => sum + row.count, 0)}`,
                  )
                  .join(' · ')}
              </p>
              {Object.entries(
                subset.reduce<Record<string, number>>((counts, row) => {
                  if (row.outcome) counts[row.outcome] = (counts[row.outcome] ?? 0) + row.count;
                  return counts;
                }, {}),
              ).map(([outcome, count]) => (
                <span key={outcome} className="mr-2">
                  {{
                    contacted: l('Contact made', 'Contact établi'),
                    no_answer: l('No answer', 'Sans réponse'),
                    not_interested: l('Not interested', 'Pas intéressé'),
                    do_not_contact: l('Do not contact', 'Ne pas contacter'),
                    interested: l('Interested', 'Intéressé'),
                    qualified: l('Qualified', 'Qualifié'),
                    converted: l('Converted', 'Converti'),
                    completed: l('Completed', 'Terminé'),
                  }[outcome] ?? outcome.replaceAll('_', ' ')}{' '}
                  : {count}
                </span>
              ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
  const status = loading ? (
    <p className="py-8 text-sm text-ink-muted">
      {l('Loading activity…', 'Chargement de l’activité…')}
    </p>
  ) : error ? (
    <div className="py-6 text-sm text-danger">
      <p>{l('Activity is unavailable.', 'L’activité est indisponible.')}</p>
      <Button variant="secondary" onClick={() => void load()}>
        {l('Retry', 'Réessayer')}
      </Button>
    </div>
  ) : !rows.length ? (
    <p className="py-8 text-sm text-ink-muted">
      {l('No missions in this period.', 'Aucune mission sur cette période.')}
    </p>
  ) : null;
  let offset = 0;
  const dates = data
    ? (() => {
        const dateInZone = (value: string) =>
          new Date(value).toLocaleDateString('en-CA', { timeZone: data.timeZone });
        const start = Date.parse(`${dateInZone(data.range.from)}T00:00:00Z`);
        const end = Date.parse(`${dateInZone(data.range.to)}T00:00:00Z`);
        return Array.from(
          { length: Math.min(367, Math.max(1, Math.floor((end - start) / 86400000) + 1)) },
          (_, index) => new Date(start + index * 86400000).toISOString().slice(0, 10),
        );
      })()
    : [];
  const max = Math.max(
    1,
    ...dates.map((date) => activityTotals(rows.filter((row) => row.date === date)).total),
  );
  return (
    <div
      className={
        mode === 'both'
          ? 'grid gap-5 xl:col-span-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]'
          : 'min-w-0'
      }
    >
      {!range && !period && !days ? (
        <label className="flex items-center gap-2 text-sm xl:col-span-2">
          {l('Period', 'Période')}
          <select
            aria-label={l('Activity period', 'Période de l’activité')}
            value={localDays}
            onChange={(event) => setLocalDays(event.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-2"
          >
            {['7', '30', '90'].map((value) => (
              <option key={value} value={value}>
                {value} {l('days', 'jours')}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {mode !== 'channels' ? (
        <Card className="min-w-0">
          <CardHeader title={l('Activity over time', 'Activité dans le temps')} />
          <p className="mb-3 text-xs text-ink-muted">
            {data
              ? `${new Date(data.range.from).toLocaleDateString(locale)} — ${new Date(data.range.to).toLocaleDateString(locale)} · ${data.timeZone}`
              : ''}
          </p>
          {status ?? (
            <>
              <div
                className="flex h-48 items-end gap-1 overflow-x-auto"
                onMouseLeave={() => setHover(null)}
              >
                {dates.map((date, index) => {
                  const subset = rows.filter((row) => row.date === date);
                  return (
                    <button
                      type="button"
                      key={date}
                      aria-label={`${date}: ${activityTotals(subset).completed} / ${activityTotals(subset).total}`}
                      onMouseEnter={() => setHover(`day:${date}`)}
                      onFocus={() => setHover(`day:${date}`)}
                      onBlur={() => setHover(null)}
                      onClick={() => setHover(`day:${date}`)}
                      className="flex h-full min-w-3 flex-1 cursor-pointer flex-col justify-end outline-brand"
                    >
                      <span
                        className="flex w-full flex-col-reverse overflow-hidden rounded-t"
                        style={{ height: `${(activityTotals(subset).total / max) * 85}%` }}
                      >
                        {activitySegments(subset).map((row, i) => (
                          <span
                            key={i}
                            style={{
                              minHeight: 1,
                              flex: row.count,
                              backgroundColor: color(row.channel, row.status),
                              opacity: 1,
                            }}
                          />
                        ))}
                      </span>
                      <span className="mt-1 h-6 text-[9px] text-ink-muted">
                        {index % Math.max(1, Math.ceil(dates.length / 7)) === 0
                          ? date.slice(5)
                          : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
              {hover?.startsWith('day:')
                ? tooltip(rows.filter((row) => row.date === hover.slice(4)))
                : null}
            </>
          )}
        </Card>
      ) : null}
      {mode !== 'time' ? (
        <Card className="min-w-0">
          <CardHeader title={l('Activity by channel', 'Activité par canal')} />
          {status ?? (
            <>
              <div className="flex flex-wrap items-center gap-5">
                <div className="relative size-44 shrink-0">
                  <svg
                    viewBox="0 0 180 180"
                    className="size-full"
                    role="group"
                    aria-label={l('Activity distribution', 'Répartition de l’activité')}
                  >
                    {groups.map((row) => {
                      const length = (row.count / totals.total) * 402.124;
                      const start = offset;
                      offset += length;
                      const channelTotal = activityTotals(
                        rows.filter((item) => item.channel === row.channel),
                      );
                      const label = `${channelNames[row.channel] ?? row.channel} · ${statuses[row.status]} : ${channelTotal.completed} / ${channelTotal.total}`;
                      return (
                        <circle
                          key={`${row.channel}:${row.status}`}
                          cx="90"
                          cy="90"
                          r="64"
                          fill="none"
                          stroke={color(row.channel, row.status)}
                          strokeWidth="30"
                          strokeOpacity={1}
                          strokeDasharray={`${length} ${402.124 - length}`}
                          strokeDashoffset={-start}
                          transform="rotate(-90 90 90)"
                          tabIndex={0}
                          role="img"
                          aria-label={label}
                          onMouseEnter={() => setHover(`channel:${row.channel}`)}
                          onMouseLeave={() => setHover(null)}
                          onFocus={() => setHover(`channel:${row.channel}`)}
                          onBlur={() => setHover(null)}
                          onClick={() => setHover(`channel:${row.channel}`)}
                          className="cursor-pointer outline-brand"
                        >
                          <title>{label}</title>
                        </circle>
                      );
                    })}
                  </svg>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <strong className="text-2xl text-navy">{totals.completed}</strong>
                    <span className="text-xs text-ink-muted">{l('completed', 'complétées')}</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mb-3 text-sm font-bold">
                    {l('Total missions', 'Total des missions')} : {totals.total}
                  </p>
                  <ul className="space-y-2 text-xs">
                    {channels.map((channel) => {
                      const count = activityTotals(rows.filter((row) => row.channel === channel));
                      return (
                        <li
                          key={channel}
                          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: colors[channel] ?? '#3978ee' }}
                            />
                            {channelNames[channel] ?? channel}
                          </span>
                          <strong>
                            {count.completed} / {count.total}
                          </strong>
                          <span
                            className="w-full text-[11px]"
                            style={{ color: reds[channel] ?? '#dc2626' }}
                          >
                            {l('Overdue', 'En retard')} :{' '}
                            {rows
                              .filter((row) => row.channel === channel && row.status === 'overdue')
                              .reduce((sum, row) => sum + row.count, 0)}
                            {' · '}
                            {l('Cancelled', 'Annulées')} :{' '}
                            {rows
                              .filter(
                                (row) => row.channel === channel && row.status === 'cancelled',
                              )
                              .reduce((sum, row) => sum + row.count, 0)}
                          </span>
                        </li>
                      );
                    })}
                    <li className="text-red-600">
                      {l('Overdue', 'En retard')} :{' '}
                      {rows
                        .filter((row) => row.status === 'overdue')
                        .reduce((sum, row) => sum + row.count, 0)}
                      {' · '}
                      {l('Cancelled', 'Annulées')} :{' '}
                      {rows
                        .filter((row) => row.status === 'cancelled')
                        .reduce((sum, row) => sum + row.count, 0)}
                      {' · '}
                      {l('Pending', 'En attente')} :{' '}
                      {rows
                        .filter((row) => row.status === 'pending')
                        .reduce((sum, row) => sum + row.count, 0)}
                    </li>
                  </ul>
                </div>
              </div>
              {hover?.startsWith('channel:')
                ? tooltip(rows.filter((row) => row.channel === hover.slice(8)))
                : null}
            </>
          )}
        </Card>
      ) : null}
    </div>
  );
}
