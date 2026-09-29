'use client';
import { useCallback, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { ActionHistoryDrawer } from '@/components/prospector/action-history-drawer';
import { ActionChannelIcon } from '@/components/prospector/action-channel-icon';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { SelectField } from '@/components/ui/select-field';
import { SearchInput } from '@/components/ui/search-input';
import { listActions } from '@/lib/api/action-client';
import {
  toActionChannel,
  type ActionLifecycleStatus,
  type ActionRecord,
} from '@/lib/api/action-types';
import { useAuth } from '@/lib/auth/auth-context';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { useLivePages } from '@/lib/live/use-live-pages';
import { text } from '@/lib/workspace/copy';
const statuses = {
  planned: ['Planned', 'Planifiée'],
  due: ['Due', 'À effectuer'],
  overdue: ['Overdue', 'En retard'],
  in_progress: ['In progress', 'En cours'],
  completed: ['Completed', 'Terminée'],
  cancelled: ['Cancelled', 'Annulée'],
} as const;
export default function ActionsPage() {
  const { activeWorkspace } = useAuth();
  const { language, locale } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const admin = activeWorkspace?.mode !== 'prospector';
  const [status, setStatus] = useState<ActionLifecycleStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ActionRecord | null>(null);
  const read = useCallback(
    (cursor: string | undefined, signal: AbortSignal) =>
      listActions({ limit: 100, cursor, ...(status === 'all' ? {} : { status }) }, signal),
    [status],
  );
  const { rows, cursor, error, busy, load, loadMore } = useLivePages(read);
  const visible =
    rows?.filter((a) =>
      `${a.subject} ${a.establishment.name} ${a.actor.displayName} ${a.organization?.name}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
    ) ?? [];
  const statusLabel = (a: ActionRecord) => {
    const pair = statuses[a.status];
    return pair ? l(pair[0], pair[1]) : a.status;
  };
  return (
    <div className="space-y-5">
      <PageHeader
        title={admin ? l('Activity', 'Activité') : l('History', 'Historique')}
        subtitle={
          admin
            ? l(
                'Recorded work across your authorized teams.',
                'Les actions enregistrées par vos équipes, dans votre périmètre autorisé.',
              )
            : l(
                'Your contacts, outcomes and reports.',
                'Vos contacts, résultats et comptes rendus.',
              )
        }
        action={
          <Button variant="secondary" disabled={busy} onClick={() => void load()}>
            <RefreshCw className="size-4" />
            {l('Refresh', 'Actualiser')}
          </Button>
        }
      />
      {error && (
        <Alert tone="danger">
          {l(
            'Unable to refresh activity. Retry to see current records.',
            'Impossible d’actualiser l’activité. Réessayez pour obtenir les données à jour.',
          )}
        </Alert>
      )}
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <SearchInput
          className="flex-1"
          label={l('Search loaded actions', 'Rechercher dans les actions affichées')}
          placeholder={l(
            'Establishment, prospector, company…',
            'Établissement, prospecteur, entreprise…',
          )}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
        <SelectField
          label={l('Status', 'État')}
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          options={[
            { value: 'all', label: l('All statuses', 'Tous les états') },
            { value: 'planned', label: l('Planned', 'Planifiées') },
            { value: 'started', label: l('In progress', 'En cours') },
            { value: 'completed', label: l('Completed', 'Terminées') },
            { value: 'cancelled', label: l('Cancelled', 'Annulées') },
          ]}
        />
      </Card>
      {!admin ? (
        <div className="space-y-2">
          {rows === null && !error && (
            <div className="h-48 animate-pulse rounded-xl bg-line-soft" aria-busy="true" />
          )}
          {rows !== null && !visible.length && (
            <Card>
              <p className="py-3 text-sm text-ink-muted">
                {l('No actions to display', 'Aucune action à afficher')}
              </p>
            </Card>
          )}
          {visible.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelected(a)}
              className="flex w-full flex-wrap items-start gap-x-5 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3 text-left hover:border-brand"
            >
              <span className="w-28 shrink-0 text-xs text-ink-muted">
                {a.completedAt || a.dueAt
                  ? new Date((a.completedAt ?? a.dueAt)!).toLocaleString(locale, {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
              </span>
              <span className="min-w-0 flex-1 basis-40">
                <span className="block text-sm font-bold">{a.establishment.name ?? a.subject}</span>
                <span className="mt-0.5 block text-xs text-ink-muted">{a.subject}</span>
                <span className="text-xs text-ink-muted">{a.campaign.name}</span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <ActionChannelIcon channel={toActionChannel(a.type)} />
                <span className="rounded-full bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand">
                  {statusLabel(a)}
                </span>
              </span>
            </button>
          ))}
          <div className="flex items-center justify-between py-3 text-xs text-ink-muted">
            <span>
              {visible.length} {l('shown', 'affichées')}
            </span>
            {cursor && (
              <Button variant="secondary" loading={busy} onClick={loadMore}>
                {l('Load more', 'Charger la suite')}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <Card padding="none">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line-soft bg-surface-muted/60 text-xs text-ink-muted">
                <tr>
                  {[
                    l('Establishment / action', 'Établissement / action'),
                    l('Prospector', 'Prospecteur'),
                    l('Company', 'Entreprise'),
                    l('Channel', 'Canal'),
                    l('Status', 'État'),
                    l('Date', 'Date'),
                  ].map((h) => (
                    <th key={h} className="px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-line-soft last:border-0 hover:bg-brand-wash"
                  >
                    <td className="max-w-72 px-4 py-4">
                      <button
                        className="text-left font-semibold text-navy hover:text-brand"
                        onClick={() => setSelected(a)}
                      >
                        {a.establishment.name ?? a.subject}
                      </button>
                      <p className="mt-1 text-xs text-ink-muted">{a.subject}</p>
                    </td>
                    <td className="px-4">{a.actor.displayName ?? '—'}</td>
                    <td className="px-4">{a.organization?.name ?? '—'}</td>
                    <td className="px-4">
                      <ActionChannelIcon channel={toActionChannel(a.type)} />
                    </td>
                    <td className="px-4">
                      <span
                        className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${a.status === 'completed' ? 'bg-success-bg text-success' : a.status === 'overdue' ? 'bg-danger-bg text-danger' : 'bg-brand-tint text-brand'}`}
                      >
                        {statusLabel(a)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 text-xs text-ink-muted">
                      {a.completedAt || a.dueAt
                        ? new Date((a.completedAt ?? a.dueAt)!).toLocaleDateString(locale)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows === null && !error ? (
            <div className="h-48 animate-pulse bg-surface-muted" aria-busy="true" />
          ) : (
            rows !== null &&
            !visible.length && (
              <div className="py-14 text-center">
                <History className="mx-auto mb-3 size-7 text-ink-muted" />
                <p className="font-semibold">
                  {l('No actions to display', 'Aucune action à afficher')}
                </p>
                <p className="mt-2 text-sm text-ink-muted">
                  {l(
                    'Recorded contacts will appear here.',
                    'Les contacts enregistrés apparaîtront ici.',
                  )}
                </p>
              </div>
            )
          )}
          <footer className="flex items-center justify-between border-t border-line-soft px-4 py-3 text-xs text-ink-muted">
            <span>
              {visible.length} {l('shown', 'affichées')}
            </span>
            {cursor && (
              <Button variant="secondary" loading={busy} onClick={loadMore}>
                {l('Load more', 'Charger la suite')}
              </Button>
            )}
          </footer>
        </Card>
      )}
      <ActionHistoryDrawer
        actionId={selected?.id ?? null}
        status={selected?.status ?? null}
        onClose={() => setSelected(null)}
        onChanged={() => void load()}
      />
    </div>
  );
}
