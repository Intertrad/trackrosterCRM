'use client';

import { useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Filter,
  ListChecks,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LinkButton } from '@/components/ui/link-button';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';
import type { ProspectorTodayResponse } from '@/lib/api/prospector-today-types';
import { cn } from '@/lib/ui/cn';

type FilterId = 'all' | 'overdue' | 'due_today';

export function DayStart({
  today,
  displayName,
  search,
  onSearchChange,
  filter,
  counts,
  onFilterChange,
  onRefresh,
  refreshing = false,
}: {
  today: ProspectorTodayResponse;
  displayName?: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  filter: FilterId;
  counts: { all: number; overdue: number; due_today: number };
  onFilterChange: (value: FilterId) => void;
  onRefresh: () => void;
  refreshing?: boolean;
}) {
  const { language, locale } = useTranslation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const l = (en: string, fr: string) => text(en, fr, language);
  const { toDo, followUps, meetings, overdue, actionsLeft, completedToday } = today.summary;
  const planned = Math.max(toDo + followUps + meetings, actionsLeft, today.priorities.length);
  const nextFollowUp = today.priorities.find((priority) => priority.category === 'follow_up');
  const meeting = today.priorities.find((priority) => priority.category === 'meeting');
  const dateLabel = new Date(`${today.day.date}T12:00:00`).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const firstName = (displayName ?? '').trim().split(/\s+/)[0] || l('there', 'à vous');

  return (
    <section aria-label={l('Plan your day', 'Organiser ma journée')} className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="relative max-w-[360px]">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted"
            />
            <label htmlFor="today-search" className="sr-only">
              {l('Search my assigned prospects', 'Rechercher mes établissements attribués')}
            </label>
            <input
              id="today-search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={l('Search my assigned prospects…', 'Rechercher mes établissements…')}
              className="h-10 w-full rounded-[9px] border border-line bg-surface pl-10 pr-3.5 text-[13px] text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </div>
          <div className="mt-5">
            <h1 className="text-[26px] font-extrabold tracking-[-0.03em] text-navy sm:text-[30px]">
              {getGreeting(l)}, {firstName}
            </h1>
            <p className="mt-1 text-[13px] text-ink-muted">
              {dateLabel} · {l('Team workspace', 'Équipe')} · {planned}{' '}
              {l('interactions planned', 'interactions prévues')}
            </p>
            <p className="sr-only">{l('scheduled follow-ups', 'relances programmées')}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full border border-brand-tint bg-brand-wash px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-brand sm:inline-flex">
            Prospector
          </span>
          <div className="relative">
            <Button
              variant="secondary"
              size="md"
              aria-expanded={filtersOpen}
              aria-haspopup="menu"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <Filter aria-hidden="true" className="size-3.5" />
              {l('Filters', 'Filtres')}
            </Button>
            {filtersOpen ? (
              <div
                role="menu"
                aria-label={l('Work list filters', 'Filtres de la liste')}
                className="absolute top-[calc(100%+8px)] right-0 z-20 min-w-[170px] rounded-xl border border-line bg-surface p-1.5 shadow-[0_12px_30px_rgba(5,18,74,0.14)]"
              >
                {(
                  [
                    ['all', l('Today', 'Aujourd’hui')],
                    ['overdue', l('Overdue', 'En retard')],
                    ['due_today', l('Priority', 'Priorité')],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={filter === value}
                    onClick={() => {
                      onFilterChange(value);
                      setFiltersOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[12px] font-semibold transition-colors ${
                      filter === value
                        ? 'bg-brand-wash text-brand'
                        : 'text-ink-soft hover:bg-surface-muted'
                    }`}
                  >
                    <span>{label}</span>
                    <span className="tabular-nums text-ink-muted">{counts[value]}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <Button
            variant="secondary"
            size="md"
            aria-label={l('Refresh today', 'Actualiser la journée')}
            title={l('Refresh today', 'Actualiser la journée')}
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              aria-hidden="true"
              className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`}
            />
          </Button>
          <LinkButton
            href="/work-queue"
            variant="primary"
            className="min-h-9 rounded-lg px-3.5 py-1.5 text-[13px]"
          >
            <ListChecks aria-hidden="true" className="size-4" />
            {l('Log action', 'Enregistrer une action')}
          </LinkButton>
        </div>
      </div>

      <DayProgressBanner
        dateLabel={dateLabel}
        completed={completedToday}
        total={Math.max(planned, completedToday + actionsLeft)}
        nextPriority={today.priorities[0] ?? null}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          tone="brand"
          icon={<ListChecks aria-hidden="true" className="size-4" />}
          value={toDo}
          label={l('To do today', 'À faire aujourd’hui')}
          detail={l(
            `${toDo} calls · ${meetings} visits · ${followUps} emails`,
            `${toDo} appels · ${meetings} visites · ${followUps} e-mails`,
          )}
        />
        <SummaryCard
          tone="neutral"
          icon={<CalendarDays aria-hidden="true" className="size-4" />}
          value={followUps}
          label={l('Follow-ups due', 'Relances dues')}
          detail={
            nextFollowUp
              ? `${l('Next at', 'Prochaine à')} ${formatTime(nextFollowUp.dueAt, today.day.timeZone)}`
              : l('No follow-ups due', 'Aucune relance due')
          }
        />
        <SummaryCard
          tone="success"
          icon={<Users aria-hidden="true" className="size-4" />}
          value={meetings}
          label={l('Meetings', 'Rendez-vous')}
          detail={
            meeting
              ? l('Scheduled today', 'Prévu aujourd’hui')
              : l('No meetings planned', 'Aucun rendez-vous prévu')
          }
        />
        <SummaryCard
          tone="danger"
          icon={<AlertTriangle aria-hidden="true" className="size-4" />}
          value={overdue}
          label={l('Overdue', 'En retard')}
          detail={
            overdue
              ? l(
                  `Oldest: ${overdue} day${overdue === 1 ? '' : 's'}`,
                  `Plus ancienne : ${overdue} jour${overdue === 1 ? '' : 's'}`,
                )
              : l('All caught up', 'Tout est à jour')
          }
        />
      </div>

      <div
        className="sr-only"
        role="progressbar"
        aria-label={l('Follow-ups completed', 'Relances terminées')}
        aria-valuemin={0}
        aria-valuemax={Math.max(planned, 1)}
        aria-valuenow={completedToday}
      >
        {completedToday} / {Math.max(planned, completedToday)}
      </div>
      <div className="sr-only" aria-live="polite">
        <Bell aria-hidden="true" /> {actionsLeft} {l('actions remaining', 'actions restantes')}
      </div>
    </section>
  );
}

function DayProgressBanner({
  dateLabel,
  completed,
  total,
  nextPriority,
}: {
  dateLabel: string;
  completed: number;
  total: number;
  nextPriority: ProspectorTodayResponse['priorities'][number] | null;
}) {
  const { language } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const safeTotal = Math.max(total, 0);
  const safeCompleted = Math.min(Math.max(completed, 0), safeTotal);
  const percentage = safeTotal > 0 ? Math.round((safeCompleted / safeTotal) * 100) : 0;
  const cellCount = Math.min(Math.max(safeTotal, 1), 50);
  const completedCells = Math.round((percentage / 100) * cellCount);
  const nextHref = nextPriority
    ? `/work-queue/${nextPriority.campaignId}/${nextPriority.campaignProspectId}`
    : '/work-queue';

  return (
    <section
      aria-label={l('Today progress', 'Progression du jour')}
      className="overflow-hidden rounded-2xl border border-navy-800 bg-navy px-4 py-4 text-white shadow-[0_8px_24px_rgba(5,18,74,0.14)] sm:px-5 sm:py-4"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.02em] text-brand-pale">
            {dateLabel} — {l('today session', 'session du jour')}
          </p>
          <p className="mt-1 text-[20px] font-extrabold tracking-[-0.02em] sm:text-[22px]">
            {safeCompleted} / {safeTotal} {l('actions completed', 'actions terminées')}
          </p>
          <p className="mt-1 text-[12px] text-ink-onDark-soft">
            {percentage === 100
              ? l('Everything planned is complete.', 'Tout ce qui était prévu est terminé.')
              : l('Keep moving through your assigned work.', 'Continuez vos actions attribuées.')}
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-3 sm:items-end">
          <div
            role="progressbar"
            aria-label={l('Actions completed today', 'Actions terminées aujourd’hui')}
            aria-valuemin={0}
            aria-valuemax={safeTotal}
            aria-valuenow={safeCompleted}
            className="grid w-full max-w-[260px] grid-cols-10 gap-1 sm:w-[260px]"
          >
            {Array.from({ length: cellCount }, (_, index) => (
              <span
                key={index}
                aria-hidden="true"
                className={cn(
                  'aspect-square rounded-[3px] border border-white/10',
                  index < completedCells ? 'bg-lime' : 'bg-white/20',
                )}
              />
            ))}
          </div>

          <LinkButton
            href={nextHref}
            variant="primary"
            className="min-h-9 w-full rounded-lg bg-lime px-3.5 py-1.5 text-[13px] text-navy hover:bg-lime-deep sm:w-auto"
          >
            <span className="max-w-[260px] truncate">
              {nextPriority
                ? `${l('Next', 'Prochaine')} : ${nextPriority.establishment.name}`
                : l('Open work queue', 'Ouvrir la file de travail')}
            </span>
          </LinkButton>
        </div>
      </div>
    </section>
  );
}

function SummaryCard({
  tone,
  icon,
  value,
  label,
  detail,
}: {
  tone: 'brand' | 'neutral' | 'success' | 'danger';
  icon: ReactNode;
  value: number;
  label: string;
  detail: string;
}) {
  const iconTone = {
    brand: 'bg-brand-tint text-brand',
    neutral: 'bg-surface-muted text-ink-soft',
    success: 'bg-success-bg text-success',
    danger: 'bg-danger-bg text-danger',
  }[tone];

  return (
    <div className="min-h-[96px] rounded-xl border border-line-soft bg-surface p-3.5 shadow-[0_3px_12px_rgba(5,18,74,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold text-ink-muted">{label}</p>
          <p className="mt-2 text-[26px] font-extrabold leading-none tracking-tight text-navy tabular-nums">
            {value}
          </p>
        </div>
        <span className={`flex size-8 items-center justify-center rounded-lg ${iconTone}`}>
          {icon}
        </span>
      </div>
      <p
        className={`mt-2 truncate text-[11.5px] ${tone === 'danger' && value > 0 ? 'font-semibold text-danger' : 'text-ink-muted'}`}
      >
        {detail}
      </p>
    </div>
  );
}

function getGreeting(l: (en: string, fr: string) => string): string {
  const hour = new Date().getHours();
  if (hour < 12) return l('Good morning', 'Bonjour');
  if (hour < 18) return l('Good afternoon', 'Bon après-midi');
  return l('Good evening', 'Bonsoir');
}

function formatTime(value: string, timeZone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(date);
}
