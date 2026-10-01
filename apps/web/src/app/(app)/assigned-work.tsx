'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, RefreshCw } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { ConfirmDialog } from '@/components/ui/dialog';
import { ProspectDetail } from '@/components/prospector/prospect-detail';
import { Suspense } from 'react';
import { LinkButton } from '@/components/ui/link-button';
import { LifecycleBadge } from '@/components/prospector/lifecycle-badge';
import { ApiError } from '@/lib/api/api-error';
import { listWorkQueue } from '@/lib/api/work-queue-client';
import type { ProspectorTodayResponse } from '@/lib/api/prospector-today-types';
import { getChannelLabelKey } from '@/components/prospector/action-channel-icon';
import type { WorkQueueItem } from '@/lib/api/work-queue-types';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';
import { classifyFollowUp } from '@/lib/follow-ups/due';
import { useLiveRefresh } from '@/lib/live/use-live-refresh';

const PAGE_SIZE = 25;
/** Today's bounded portfolio preview, refreshed without replacing visible rows during polling. */
export function AssignedWork({
  teamId,
  today,
  onRefresh,
  refreshing = false,
}: {
  teamId: string;
  today?: ProspectorTodayResponse;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const { language, locale, t } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const [items, setItems] = useState<WorkQueueItem[] | null>(null);
  const [selected, setSelected] = useState<{
    campaign: { id: string };
    campaignProspectId: string;
  } | null>(null);
  const [detailDirty, setDetailDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [view, setView] = useState<'pending' | 'completed' | 'all' | 'to_contact'>(
    today ? 'pending' : 'all',
  );
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const current = ++generation.current;
      if (view === 'pending' || view === 'completed') return;
      try {
        const page = await listWorkQueue({
          teamId,
          ...(view === 'to_contact' ? { lifecycleStage: 'to_contact' as const } : {}),
          limit: PAGE_SIZE,
          signal,
        });
        if (signal?.aborted || generation.current !== current) return;
        setItems(page.items);
        setTruncated(page.page.nextCursor !== null);
        setFailed(null);
      } catch (caught) {
        if (signal?.aborted || generation.current !== current) return;
        if (caught instanceof ApiError && caught.statusCode === 403) setItems(null);
        setFailed(
          caught instanceof ApiError && caught.statusCode === 403
            ? text(
                'You no longer have access to this team.',
                'Vous n’avez plus accès à cette équipe.',
                language,
              )
            : text(
                'Could not refresh your prospects. Retry to get current data.',
                'Impossible d’actualiser vos prospects. Réessayez pour obtenir les données à jour.',
                language,
              ),
        );
      }
    },
    [teamId, view, language],
  );
  useEffect(() => {
    const c = new AbortController();
    setItems(null);
    setFailed(null);
    void load(c.signal);
    return () => c.abort();
  }, [load, attempt]);
  useLiveRefresh(load, { scope: teamId + view });
  const dailyView = view === 'pending' || view === 'completed';
  const tasks =
    view === 'completed'
      ? (today?.completed ?? []).map((row) => ({
          ...row,
          name: row.establishmentName,
          at: row.completedAt,
          overdue: false,
        }))
      : (today?.priorities ?? []).map((row) => ({
          ...row,
          name: row.establishment.name,
          at: row.dueAt,
          overdue: row.isOverdue,
        }));
  const total = dailyView
    ? ((view === 'completed' ? today?.summary.completedToday : today?.summary.actionsLeft) ?? 0)
    : (items?.length ?? 0);
  const labels = {
    pending: l('To process', 'À traiter'),
    completed: l('Processed', 'Traité'),
    all: l('All', 'Tous'),
    to_contact: l('To contact', 'À contacter'),
  };
  return (
    <section className="space-y-2.5" aria-label={l('My prospects', 'Mes établissements')}>
      <header className="grid grid-cols-3 items-center gap-x-1 gap-y-3 py-3 sm:flex sm:flex-wrap sm:gap-3 lg:flex-nowrap">
        <div className="col-span-3 flex w-full shrink-0 items-center gap-2 lg:w-auto">
          <h2 className="text-xl font-bold text-navy">{l('My prospects', 'Mes établissements')}</h2>
          {(dailyView || items) && (
            <Badge tone="neutral">
              {total}
              {!dailyView && truncated ? '+' : ''}
            </Badge>
          )}
        </div>
        <div className="contents sm:flex sm:max-w-full sm:shrink-0 sm:gap-0.5 sm:rounded-[11px] sm:bg-surface-muted sm:p-[3px]">
          {(['pending', 'completed', 'all', 'to_contact'] as const).map((option) => (
            <Button
              key={option}
              size="md"
              variant="ghost"
              className={`${option === 'to_contact' ? 'col-start-1 justify-self-start whitespace-nowrap' : ''} ${view === option ? 'bg-white! text-navy shadow-sm hover:bg-white!' : 'bg-surface-muted! text-ink-muted hover:bg-line-soft!'}`}
              aria-pressed={view === option}
              onClick={() => setView(option)}
            >
              {labels[option]}
            </Button>
          ))}
        </div>
        <Button
          size="md"
          variant="secondary"
          className="col-span-2 col-start-2 row-start-3 justify-self-end sm:ml-auto"
          aria-label={l('Refresh today', 'Actualiser la journée')}
          loading={refreshing}
          onClick={() => {
            void load();
            onRefresh?.();
          }}
        >
          <RefreshCw aria-hidden="true" className="size-3.5" />
          {l('Refresh', 'Actualiser')}
        </Button>
      </header>
      {!dailyView && failed && (
        <div className="space-y-3 px-5 pb-4">
          <Alert tone="warning">{failed}</Alert>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            {l('Retry', 'Réessayer')}
          </Button>
        </div>
      )}
      {dailyView ? (
        <>
          <p className="text-sm text-ink-muted">
            {view === 'pending'
              ? l(
                  'Due today, including overdue tasks.',
                  'Tâches prévues aujourd’hui, y compris celles en retard.',
                )
              : l('Tasks completed today.', 'Tâches réalisées aujourd’hui.')}
          </p>
          {tasks.length === 0 ? (
            <p className="rounded-xl border border-line-soft bg-surface px-6 py-8 text-center text-ink-muted">
              {view === 'pending'
                ? l('No tasks left to process today.', 'Aucune tâche à traiter pour aujourd’hui.')
                : l(
                    'No tasks completed today yet.',
                    'Aucune tâche réalisée aujourd’hui pour le moment.',
                  )}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {tasks.map((task, index) => (
                <li key={task.id}>
                  <Link
                    href={`/work-queue/${task.campaignId}/${task.campaignProspectId}`}
                    onClick={(event) => {
                      if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
                        event.preventDefault();
                        setSelected({
                          campaign: { id: task.campaignId },
                          campaignProspectId: task.campaignProspectId,
                        });
                      }
                    }}
                    className="flex min-h-[66px] items-center gap-3.5 rounded-xl border border-line-soft bg-surface px-4 py-3.5 transition-colors hover:border-brand-pale hover:bg-brand-wash"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-sm font-bold text-brand">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block break-words text-[15.2px] font-bold text-navy">
                        {task.name}
                      </span>
                      <span className="mt-1 block text-sm text-ink-muted">
                        {view === 'completed'
                          ? l('Completed', 'Terminée')
                          : l('Scheduled', 'Prévue')}{' '}
                        ·{' '}
                        {new Intl.DateTimeFormat(locale ?? language, {
                          timeZone: today?.day.timeZone,
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(task.at))}
                        {task.channel ? ` · ${t(getChannelLabelKey(task.channel))}` : ''}
                      </span>
                    </div>
                    <Badge
                      tone={view === 'completed' ? 'success' : task.overdue ? 'danger' : 'neutral'}
                    >
                      {view === 'completed'
                        ? labels.completed
                        : task.overdue
                          ? l('Overdue', 'En retard')
                          : l('To do', 'À faire')}
                    </Badge>
                    <ArrowRight
                      aria-hidden="true"
                      className="hidden size-4 shrink-0 text-brand sm:block"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {total > tasks.length && (
            <p className="text-sm text-ink-muted">
              {l(
                `Showing ${tasks.length} of ${total} tasks.`,
                `${tasks.length} tâches affichées sur ${total}.`,
              )}
            </p>
          )}
        </>
      ) : items === null ? (
        !failed && (
          <div className="animate-pulse space-y-3 px-5 py-6" aria-busy="true">
            <span className="sr-only">
              {l('Loading your prospects', 'Chargement de vos établissements')}
            </span>
            {[0, 1, 2].map((n) => (
              <div key={n} className="h-12 rounded bg-surface-muted" />
            ))}
          </div>
        )
      ) : !items.length ? (
        <div className="border-t border-line-soft px-6 py-10 text-center">
          <Building2 className="mx-auto mb-3 size-8 text-ink-muted" aria-hidden="true" />
          <p className="font-semibold text-navy">
            {view === 'to_contact'
              ? l('No new prospects to contact', 'Aucun nouvel établissement à contacter')
              : l('No prospects assigned yet', 'Aucun établissement attribué pour le moment')}
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            {view === 'to_contact'
              ? l(
                  'Choose All to see your other assigned prospects.',
                  'Choisissez Tous pour retrouver vos autres établissements.',
                )
              : l(
                  'Your administrator assigns prospects from a campaign. They will appear here automatically.',
                  'Votre administrateur attribue les établissements depuis une campagne. Ils apparaîtront ici automatiquement.',
                )}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item, index) => (
            <li key={item.campaignProspectId}>
              <Link
                href={`/work-queue/${item.campaign.id}/${item.campaignProspectId}`}
                onClick={(event) => {
                  if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
                    event.preventDefault();
                    setSelected(item);
                  }
                }}
                className="flex min-h-[66px] items-center gap-3.5 rounded-xl border border-line-soft bg-surface px-4 py-3.5 transition-colors hover:border-brand-pale hover:bg-brand-wash"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand">
                  <span className="text-sm font-bold">{index + 1}</span>
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <span className="block break-words text-[15.2px] font-bold text-navy">
                      {item.establishment.name}
                    </span>
                    <span className="mt-0.5 block text-[13.44px] text-ink-muted">
                      {[
                        [item.establishment.postalCode, item.establishment.city]
                          .filter(Boolean)
                          .join(' '),
                        item.campaign.name,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <LifecycleBadge stage={item.lifecycleStage} />
                    {item.nextFollowUp && (
                      <span className="text-xs text-ink-muted">
                        <span
                          className={
                            classifyFollowUp({
                              dueAt: item.nextFollowUp.dueAt,
                              status: 'pending',
                            }) === 'overdue'
                              ? 'font-semibold text-danger'
                              : ''
                          }
                        >
                          {classifyFollowUp({
                            dueAt: item.nextFollowUp.dueAt,
                            status: 'pending',
                          }) === 'overdue'
                            ? l('Follow-up overdue since', 'Relance en retard depuis le')
                            : l('Follow-up due', 'Relance prévue le')}
                        </span>{' '}
                        {new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
                          new Date(item.nextFollowUp.dueAt),
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-brand" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <footer className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft py-3">
        <span className="text-sm text-ink-muted">
          {dailyView
            ? l('Today’s tasks', 'Tâches de la journée')
            : truncated
              ? l(
                  `Latest ${PAGE_SIZE} assignments shown`,
                  `${PAGE_SIZE} dernières attributions affichées`,
                )
              : l('Your assigned portfolio', 'Votre portefeuille attribué')}
        </span>
        <LinkButton href="/work-queue">{l('Open portfolio', 'Ouvrir le portefeuille')}</LinkButton>
      </footer>
      {selected && (
        <Drawer
          open
          title={l('Establishment', 'Fiche établissement')}
          width="prospect"
          onClose={() => (detailDirty ? setDiscard(true) : setSelected(null))}
        >
          <Suspense>
            <ProspectDetail
              campaignId={selected.campaign.id}
              prospectId={selected.campaignProspectId}
              embedded
              onDirtyChange={setDetailDirty}
            />
          </Suspense>
        </Drawer>
      )}
      <ConfirmDialog
        open={discard}
        title={l('Discard this draft?', 'Abandonner ce brouillon ?')}
        description={l(
          'Your unsaved contact-permission changes will be lost.',
          'Les modifications d’autorisation de contact non enregistrées seront perdues.',
        )}
        confirmLabel={l('Discard draft', 'Abandonner le brouillon')}
        onClose={() => setDiscard(false)}
        onConfirm={() => {
          setDiscard(false);
          setSelected(null);
          setDetailDirty(false);
        }}
      />
    </section>
  );
}
