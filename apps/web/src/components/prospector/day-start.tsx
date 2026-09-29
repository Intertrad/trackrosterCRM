'use client';
import Link from 'next/link';
import { createElement } from 'react';
import { ArrowRight, CalendarClock, MapPin, Phone, ShieldCheck, Check } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';
import type { ProspectorTodayResponse } from '@/lib/api/prospector-today-types';

export function DayStart({ today }: { today: ProspectorTodayResponse }) {
  const { language, locale } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const { completedToday, actionsLeft, overdue } = today.summary;
  const total = completedToday + actionsLeft;
  const next = today.priorities[0];
  const href = next ? `/work-queue/${next.campaignId}/${next.campaignProspectId}` : '/work-queue';
  return (
    <section className="space-y-4" aria-label={l('Plan your day', 'Organiser ma journée')}>
      <div className="rounded-2xl bg-navy px-[22px] py-5 text-white">
        <div className="flex flex-col justify-between gap-5 sm:flex-row">
          <div className="min-w-0 flex-1">
            <p className="text-[13.44px] text-white/75">
              {new Date(`${today.day.date}T12:00:00`).toLocaleDateString(locale, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}{' '}
              — {l('scheduled follow-ups', 'relances programmées')}
            </p>
            <h2 className="mt-1.5 text-[28px] leading-tight font-extrabold">
              {total
                ? l(
                    `${completedToday.toLocaleString(locale)} of ${total.toLocaleString(locale)} completed`,
                    `${completedToday.toLocaleString(locale)} sur ${total.toLocaleString(locale)} terminées`,
                  )
                : l('Ready for your next prospect', 'Prêt pour votre prochain prospect')}
            </h2>
            <p className="mt-2 text-sm text-white/80">
              {overdue
                ? l(
                    `${overdue} overdue. Start with your priorities below.`,
                    `${overdue} en retard. Commencez par les priorités ci-dessous.`,
                  )
                : l(
                    'Your assigned prospects and scheduled follow-ups, in one place.',
                    'Vos établissements attribués et vos relances programmées, au même endroit.',
                  )}
            </p>
          </div>
          {total > 0 && (
            <div
              className="hidden shrink-0 grid-cols-[repeat(8,20px)] gap-1 sm:grid"
              aria-hidden="true"
            >
              {Array.from({ length: Math.min(total, 56) }, (_, i) => (
                <span
                  key={i}
                  className={`flex size-5 items-center justify-center rounded ${i < Math.round((completedToday / total) * Math.min(total, 56)) ? 'bg-brand' : 'bg-white/85'}`}
                >
                  {i === Math.round((completedToday / total) * Math.min(total, 56)) - 1 && (
                    <Check className="size-4 text-lime" />
                  )}
                </span>
              ))}
            </div>
          )}
          <span
            className="sr-only"
            role="progressbar"
            aria-label={l('Follow-ups completed', 'Relances terminées')}
            aria-valuemin={0}
            aria-valuemax={Math.max(total, 1)}
            aria-valuenow={completedToday}
          />
        </div>
        <Link
          href={href}
          className="mt-4 inline-flex min-h-10 max-w-full items-center gap-2 rounded-[10px] bg-lime px-[18px] py-[11px] text-[14.4px] font-bold text-navy hover:brightness-105"
        >
          <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">
            {next
              ? l(`Next: ${next.establishment.name}`, `Prochain : ${next.establishment.name}`)
              : l('Open my portfolio', 'Ouvrir mon portefeuille')}
          </span>
        </Link>
        <p className="mt-3 flex items-start gap-2 text-xs text-white/75">
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          {l(
            'Opening a record does not reserve it. Check contact availability before starting.',
            'Ouvrir une fiche ne la réserve pas. Vérifiez la disponibilité avant de contacter l’établissement.',
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          {
            href: '/work-queue',
            icon: Phone,
            title: l('Calls and emails', 'Appels et e-mails'),
            body: l(
              'Open assigned prospects and record the outcome.',
              'Ouvrez les fiches attribuées et enregistrez le résultat.',
            ),
          },
          {
            href: '/routes/new',
            icon: MapPin,
            title: l('Field visits', 'Prospection terrain'),
            body: l(
              'Prepare a route from your available prospects.',
              'Préparez une tournée à partir de vos établissements disponibles.',
            ),
          },
          {
            href: '/follow-ups',
            icon: CalendarClock,
            title: l('Follow-ups', 'Relances'),
            body: l(
              'Review scheduled contacts and overdue actions.',
              'Consultez les contacts programmés et les actions en retard.',
            ),
          },
        ].map(({ href, icon, title }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 rounded-[10px] border border-line bg-surface px-4 py-2.5 text-sm transition-colors hover:border-brand"
          >
            {createElement(icon, {
              className: 'size-4 shrink-0 text-brand',
              'aria-hidden': true,
            })}
            <div>
              <h3 className="font-bold text-navy">{title}</h3>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
