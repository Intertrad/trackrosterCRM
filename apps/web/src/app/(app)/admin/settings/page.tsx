'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminGuard } from '@/components/admin/admin-guard';
import { Tabs } from '@/components/ui/tabs';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { useAuth } from '@/lib/auth/auth-context';
import { getAccountProfile, updateAccountProfile } from '@/lib/api/account-client';
import { text } from '@/lib/workspace/copy';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { browserJson } from '@/lib/api/browser-json';
import { browserResource } from '@/lib/api/browser-resource';
import { CalendarClock, Info, LockKeyhole, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import {
  listCoordinationPolicies,
  createCoordinationPolicy,
  updateCoordinationPolicy,
  type CoordinationPolicy,
} from '@/lib/api/organization-coordination-client';
const sections = [
  ['reservation-rules', 'Contact reservations', 'Réservations de contact'],
  ['objectives', 'Objectives', 'Objectifs'],
  ['workspace-settings', 'Workspace', 'Espace de travail'],
];
export default function Page() {
  return (
    <AdminGuard title="Règles et réglages">
      <Suspense>
        <Settings />
      </Suspense>
    </AdminGuard>
  );
}
function Settings() {
  const { language } = useTranslation();
  const id = useSearchParams().get('section') ?? 'reservation-rules';
  const section = sections.find((s) => s[0] === id) ?? sections[0]!;
  if (section[0] === 'reservation-rules') return <ReservationSettings language={language} />;
  if (section[0] === 'objectives') return <ObjectivesSettings language={language} />;
  return <WorkspaceSettings language={language} />;
}

function SettingsHeader({ language, activeId }: { language: string; activeId: string }) {
  return (
    <header className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">
          {text('Administration', 'Administration', language)}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-navy sm:text-[35px]">
          {text('Rules and settings', 'Règles et réglages', language)}
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-6 text-ink-muted">
          {text(
            'Anti-collision rules, session objectives and prospector permissions.',
            'Toutes les règles anti-collision, les objectifs de session et les droits des prospecteurs.',
            language,
          )}
        </p>
      </div>
      <div className="-mx-1 overflow-x-auto pb-1">
        <Tabs
          label={text('Settings sections', 'Sections des réglages', language)}
          activeId={activeId}
          items={sections.map(([key, en, fr]) => ({
            id: key!,
            label: text(en!, fr!, language),
            href: `/admin/settings?section=${key}`,
          }))}
        />
      </div>
    </header>
  );
}

type Organization = { id: string; name: string; shortName?: string | null; color?: string | null };
type ReservationRule = {
  id: string;
  etag?: string;
  durationMinutes: number;
  cooldownMinutes: number;
  maxHoldMinutes: number;
  allowHeartbeat: boolean;
  allowExtension: boolean;
  allowManagerOverride: boolean;
};

const DEFAULT_RESERVATION_RULE: ReservationRule = {
  id: '',
  durationMinutes: 20,
  cooldownMinutes: 60,
  maxHoldMinutes: 120,
  allowHeartbeat: true,
  allowExtension: true,
  allowManagerOverride: true,
};

function ReservationSettings({ language }: { language: string }) {
  const l = (en: string, fr: string) => text(en, fr, language) ?? en;
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [policies, setPolicies] = useState<CoordinationPolicy[]>([]);
  const [rule, setRule] = useState<ReservationRule | null>(null);
  const [matrix, setMatrix] = useState<Record<string, number>>({});
  const [policyMatrix, setPolicyMatrix] = useState<Record<string, CoordinationPolicy['policy']>>(
    {},
  );
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mirrorDirections, setMirrorDirections] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const [orgPage, policyRows, rulePage] = await Promise.all([
        browserJson<{ items: Organization[] }>('/api/organizations?limit=100', {
          cache: 'no-store',
        }),
        listCoordinationPolicies(),
        browserJson<{ items: ReservationRule[] }>('/api/workspace/reservation-rules?limit=100', {
          cache: 'no-store',
        }),
      ]);
      setOrganizations(orgPage.items ?? []);
      setPolicies(policyRows);
      setRule({
        ...DEFAULT_RESERVATION_RULE,
        ...(rulePage.items?.find((item) => item.id) ?? {}),
      });
      const next: Record<string, number> = {};
      const nextPolicies: Record<string, CoordinationPolicy['policy']> = {};
      for (const a of orgPage.items ?? [])
        for (const b of orgPage.items ?? [])
          next[`${a.id}:${b.id}`] =
            a.id === b.id ? (rulePage.items?.[0]?.durationMinutes ?? 30) : 7;
      for (const a of orgPage.items ?? [])
        for (const b of orgPage.items ?? [])
          nextPolicies[`${a.id}:${b.id}`] = a.id === b.id ? 'shared' : 'coordinated';
      for (const p of policyRows) {
        const days = p.policy === 'delayed' ? Math.ceil((p.delayMinutes ?? 10080) / 1440) : 7;
        next[`${p.organizationAId}:${p.organizationBId}`] = p.policy === 'independent' ? 0 : days;
        nextPolicies[`${p.organizationAId}:${p.organizationBId}`] = p.policy;
        next[`${p.organizationBId}:${p.organizationAId}`] = p.policy === 'independent' ? 0 : days;
        nextPolicies[`${p.organizationBId}:${p.organizationAId}`] = p.policy;
      }
      setMatrix(next);
      setPolicyMatrix(nextPolicies);
      setError(false);
      setSaveError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const setCell = (a: string, b: string, value: number) =>
    setMatrix((current) => ({ ...current, [`${a}:${b}`]: value }));
  const setPolicy = (a: string, b: string, policy: CoordinationPolicy['policy']) => {
    setPolicyMatrix((current) => ({
      ...current,
      [`${a}:${b}`]: policy,
      ...(mirrorDirections ? { [`${b}:${a}`]: policy } : {}),
    }));
    if (policy === 'independent') {
      setCell(a, b, 0);
      if (mirrorDirections) setCell(b, a, 0);
    } else if (policy === 'delayed') {
      setCell(a, b, Math.max(1, matrix[`${a}:${b}`] ?? 30));
      if (mirrorDirections) setCell(b, a, Math.max(1, matrix[`${b}:${a}`] ?? 30));
    } else {
      setCell(a, b, 7);
      if (mirrorDirections) setCell(b, a, 7);
    }
  };
  const applyPreset = (sameCompany: number, otherCompany: number) => {
    const next: Record<string, number> = {};
    const nextPolicies: Record<string, CoordinationPolicy['policy']> = {};
    for (const a of organizations)
      for (const b of organizations) {
        next[`${a.id}:${b.id}`] = a.id === b.id ? sameCompany : otherCompany;
        nextPolicies[`${a.id}:${b.id}`] = a.id === b.id ? 'delayed' : 'coordinated';
      }
    setMatrix(next);
    setPolicyMatrix(nextPolicies);
    setSaved(false);
  };
  const save = async () => {
    if (!rule || saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      const existing = new Map(
        policies.map((p) => {
          const key =
            p.organizationAId < p.organizationBId
              ? `${p.organizationAId}:${p.organizationBId}`
              : `${p.organizationBId}:${p.organizationAId}`;
          return [key, p] as const;
        }),
      );
      for (let i = 0; i < organizations.length; i++)
        for (let j = i + 1; j < organizations.length; j++) {
          const a = organizations[i]!,
            b = organizations[j]!;
          const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
          const days = matrix[`${a.id}:${b.id}`] ?? 7;
          const policy = policyMatrix[`${a.id}:${b.id}`] ?? 'coordinated';
          const current = existing.get(key);
          const input = {
            policy,
            delayMinutes: policy === 'delayed' ? days * 1440 : null,
          };
          if (current) await updateCoordinationPolicy(current.id, input);
          else if (policy !== 'shared')
            await createCoordinationPolicy({
              organizationAId: a.id,
              organizationBId: b.id,
              ...input,
            });
        }
      const rulePayload = {
        durationMinutes: rule.durationMinutes,
        cooldownMinutes: rule.cooldownMinutes,
        maxHoldMinutes: rule.maxHoldMinutes,
        allowHeartbeat: rule.allowHeartbeat,
        allowExtension: rule.allowExtension,
        allowManagerOverride: rule.allowManagerOverride,
      };
      const ruleResponse = await browserJson<ReservationRule>(
        rule.id
          ? `/api/workspace/reservation-rules/${encodeURIComponent(rule.id)}`
          : '/api/workspace/reservation-rules',
        {
          method: rule.id ? 'PATCH' : 'POST',
          headers: {
            'content-type': 'application/json',
            'idempotency-key': crypto.randomUUID(),
            ...(rule.id && rule.etag ? { 'if-match': rule.etag } : {}),
          },
          body: JSON.stringify(rulePayload),
        },
      );
      setRule(ruleResponse);
      setSaved(true);
      await load();
    } catch {
      setSaveError(true);
      setError(true);
    } finally {
      setSaving(false);
    }
  };
  const policyMeta: Record<CoordinationPolicy['policy'], { label: string; tone: string }> = {
    shared: {
      label: l('Shared', 'Partagé'),
      tone: 'border-success-border bg-success-bg text-success',
    },
    coordinated: {
      label: l('Coordinated', 'Coordonné'),
      tone: 'border-warning-border bg-warning-bg text-warning',
    },
    delayed: {
      label: l('Deferred', 'Différé'),
      tone: 'border-info-border bg-info-bg text-info',
    },
    independent: {
      label: l('Independent', 'Indépendant'),
      tone: 'border-line bg-surface-muted text-ink-soft',
    },
  };
  return (
    <div className="space-y-6 pb-4">
      <SettingsHeader language={language} activeId="reservation-rules" />
      {error && (
        <Alert tone="danger" className="flex flex-wrap items-center justify-between gap-3">
          {saveError
            ? l(
                'Unable to save settings. Please try again.',
                'Impossible d’enregistrer les réglages. Réessayez.',
              )
            : l('Unable to load settings.', 'Impossible de charger les réglages.')}{' '}
          <button className="underline" onClick={() => void load()}>
            {l('Retry', 'Réessayer')}
          </button>
        </Alert>
      )}
      <Card className="overflow-hidden border-line/80 shadow-[0_18px_50px_rgba(9,31,105,0.07)]">
        <CardHeader
          title={l('Reservation locks', 'Verrous de réservation')}
          action={<LockKeyhole className="size-5 text-brand" aria-hidden="true" />}
        />
        <p className="mb-5 max-w-3xl text-sm leading-6 text-ink-muted">
          {l(
            'A lock holds an establishment while a prospector is working on it, then expires on its own.',
            'Un verrou protège un établissement pendant le travail du prospecteur, puis expire automatiquement.',
          )}
        </p>
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface-muted/40 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-navy">
              <Phone className="size-4 text-brand" aria-hidden="true" /> {l('Call', 'Appel')}
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
              <input
                aria-label={l(
                  'Call lock duration in minutes',
                  'Durée du verrou d’appel en minutes',
                )}
                type="number"
                min={1}
                max={240}
                value={rule?.durationMinutes ?? 20}
                onChange={(event) => {
                  setRule((current) =>
                    current
                      ? {
                          ...current,
                          durationMinutes: Math.max(1, Number(event.target.value) || 1),
                        }
                      : current,
                  );
                  setSaved(false);
                }}
                className="w-20 rounded-lg border border-line bg-surface px-3 py-2 text-center font-bold text-navy outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              {l('minutes', 'minutes')}
            </div>
          </div>
          <div className="rounded-xl border border-line bg-surface-muted/40 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-navy">
              <MapPin className="size-4 text-brand" aria-hidden="true" />{' '}
              {l('Field visit', 'Visite terrain')}
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
              <CalendarClock className="size-4" aria-hidden="true" />
              {l('The booked time slot', 'Le créneau réservé')}
            </div>
          </div>
          <div className="rounded-xl border border-line bg-surface-muted/40 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-navy">
              <Mail className="size-4 text-brand" aria-hidden="true" />{' '}
              {l('Letter and e-mail', 'Courrier et e-mail')}
            </div>
            <p className="mt-3 text-sm text-ink-muted">
              {l('No lock — logged as sent', 'Aucun verrou — enregistré comme envoyé')}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3">
            <input
              className="mt-0.5 size-4 accent-brand"
              type="checkbox"
              checked={rule?.allowHeartbeat ?? true}
              onChange={(event) => {
                setRule((current) =>
                  current ? { ...current, allowHeartbeat: event.target.checked } : current,
                );
                setSaved(false);
              }}
            />
            <span>
              <strong className="block text-sm text-navy">
                {l(
                  'Hold the lock while the call screen is open',
                  'Garder le verrou pendant l’appel',
                )}
              </strong>
              <span className="text-xs text-ink-muted">
                {l(
                  'Prevents a long call from expiring mid-conversation.',
                  'Évite qu’un long appel expire en cours de conversation.',
                )}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3">
            <input
              className="mt-0.5 size-4 accent-brand"
              type="checkbox"
              checked={rule?.allowExtension ?? true}
              onChange={(event) => {
                setRule((current) =>
                  current ? { ...current, allowExtension: event.target.checked } : current,
                );
                setSaved(false);
              }}
            />
            <span>
              <strong className="block text-sm text-navy">
                {l('Allow an extension request', 'Autoriser une demande de prolongation')}
              </strong>
              <span className="text-xs text-ink-muted">
                {l(
                  'Every extension is recorded in the audit log.',
                  'Chaque prolongation est inscrite dans le journal d’audit.',
                )}
              </span>
            </span>
          </label>
        </div>
      </Card>

      <Card className="overflow-hidden border-line/80 shadow-[0_18px_50px_rgba(9,31,105,0.07)]">
        <CardHeader
          title={l(
            'Delay before another company may contact the same establishment',
            'Délai avant qu’une autre entreprise contacte le même établissement',
          )}
          action={
            <label className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
              <input
                type="checkbox"
                className="size-4 accent-brand"
                checked={mirrorDirections}
                onChange={(event) => setMirrorDirections(event.target.checked)}
              />
              {l('Mirror both directions', 'Miroir dans les deux sens')}
            </label>
          }
        />
        <p className="mb-5 max-w-3xl text-sm leading-6 text-ink-muted">
          {l(
            'Read a row as “after this company has made contact”, and a column as “this company may contact next”.',
            'Ligne = entreprise ayant contacté ; colonne = entreprise pouvant contacter ensuite.',
          )}
        </p>
        {loading ? (
          <div
            className="grid gap-3 py-6"
            aria-label={l('Loading settings', 'Chargement des réglages')}
          >
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="h-14 animate-pulse rounded-xl bg-surface-muted" />
            ))}
          </div>
        ) : organizations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-surface-muted px-5 py-10 text-center text-sm text-ink-muted">
            {l(
              'Add an organization to configure contact delays.',
              'Ajoutez une entreprise pour configurer les délais de contact.',
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface-muted/40 p-2">
            <table className="min-w-[850px] border-separate border-spacing-1.5 text-center text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-44 bg-surface-muted p-3 text-left text-xs font-bold uppercase tracking-wide text-ink-muted">
                    {l('Then may contact →', 'Puis peut contacter →')}
                  </th>
                  {organizations.map((org) => (
                    <th
                      key={org.id}
                      className="min-w-32 rounded-xl border border-line bg-surface px-3 py-3 text-xs font-bold text-navy"
                    >
                      {org.shortName ?? org.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {organizations.map((row) => (
                  <tr key={row.id}>
                    <th className="sticky left-0 z-[1] min-w-44 rounded-xl border border-line bg-surface px-3 py-3 text-left text-xs font-bold text-navy">
                      <span
                        className="mr-2 inline-block size-2 rounded-full"
                        style={{ backgroundColor: row.color ?? '#155eef' }}
                      />
                      {row.shortName ?? row.name}
                    </th>
                    {organizations.map((col) => {
                      const key = `${row.id}:${col.id}`;
                      const policy =
                        policyMatrix[key] ?? (row.id === col.id ? 'shared' : 'coordinated');
                      const meta = policyMeta[policy];
                      const days =
                        matrix[key] ?? (row.id === col.id ? (rule?.durationMinutes ?? 20) : 7);
                      return (
                        <td key={col.id} className={`rounded-xl border p-2 align-top ${meta.tone}`}>
                          <div className="mb-1 flex items-center justify-between gap-1 text-[10px] font-extrabold uppercase tracking-wide">
                            <span>
                              {row.id === col.id
                                ? l('Same company', 'Même entreprise')
                                : meta.label}
                            </span>
                            {row.id === col.id ? (
                              <LockKeyhole className="size-3" aria-hidden="true" />
                            ) : null}
                          </div>
                          {row.id === col.id ? (
                            <div className="text-left text-sm font-extrabold text-navy">
                              {days}{' '}
                              <span className="text-xs font-medium text-ink-muted">
                                {l('days', 'jours')}
                              </span>
                            </div>
                          ) : (
                            <select
                              aria-label={`${row.name} to ${col.name}`}
                              value={policy}
                              onChange={(event) => {
                                setPolicy(
                                  row.id,
                                  col.id,
                                  event.target.value as CoordinationPolicy['policy'],
                                );
                                setSaved(false);
                              }}
                              className="w-full bg-transparent text-left text-xs font-bold text-navy outline-none"
                            >
                              <option value="shared">{l('Shared', 'Partagé')}</option>
                              <option value="coordinated">
                                {l('Coordinated · 7 days', 'Coordonné · 7 jours')}
                              </option>
                              <option value="delayed">
                                {l('Deferred · custom delay', 'Différé · délai personnalisé')}
                              </option>
                              <option value="independent">{l('Independent', 'Indépendant')}</option>
                            </select>
                          )}
                          {row.id !== col.id && policy === 'delayed' ? (
                            <label className="mt-1 flex items-center gap-1 text-[11px] text-ink-muted">
                              <input
                                type="number"
                                min={1}
                                max={365}
                                value={days}
                                aria-label={`${row.name} to ${col.name} delay in days`}
                                onChange={(event) => {
                                  setCell(
                                    row.id,
                                    col.id,
                                    Math.max(1, Math.min(365, Number(event.target.value) || 1)),
                                  );
                                  setSaved(false);
                                }}
                                className="w-12 rounded border border-current/20 bg-surface/70 px-1 py-0.5 text-center font-bold text-ink"
                              />
                              {l('days', 'jours')}
                            </label>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
            {l('Apply a preset', 'Appliquer un modèle')}
          </span>
          <button
            type="button"
            onClick={() => applyPreset(30, 7)}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand"
          >
            {l(
              'Standard — 30 d same company, 7 d across',
              'Standard — 30 j même entreprise, 7 j entre entreprises',
            )}
          </button>
          <button
            type="button"
            onClick={() => applyPreset(30, 14)}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand"
          >
            {l('Careful — 30 / 14', 'Prudent — 30 / 14')}
          </button>
          <button
            type="button"
            onClick={() => applyPreset(45, 30)}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand"
          >
            {l('Institutional — 45 / 30', 'Institutionnel — 45 / 30')}
          </button>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-4 text-xs text-ink-muted">
          {(
            Object.entries(policyMeta) as [
              CoordinationPolicy['policy'],
              { label: string; tone: string },
            ][]
          ).map(([key, meta]) => (
            <span key={key} className="inline-flex items-center gap-2">
              <span className={`size-2 rounded-full ${meta.tone.split(' ')[1]}`} />
              {meta.label}
            </span>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden border-line/80 shadow-[0_18px_50px_rgba(9,31,105,0.07)]">
        <CardHeader
          title={l('Exceptions', 'Exceptions')}
          action={<ShieldCheck className="size-5 text-brand" aria-hidden="true" />}
        />
        <p className="mb-5 text-sm text-ink-muted">
          {l(
            'When a rule blocks a prospector, these settings decide what they can ask for.',
            'Lorsqu’une règle bloque un prospecteur, ces réglages déterminent ce qu’il peut demander.',
          )}
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface-muted/40 p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-brand"
                checked={rule?.allowManagerOverride ?? true}
                onChange={(event) => {
                  setRule((current) =>
                    current ? { ...current, allowManagerOverride: event.target.checked } : current,
                  );
                  setSaved(false);
                }}
              />
              <span>
                <strong className="block text-sm text-navy">
                  {l('A manager may override a block', 'Un manager peut déroger à un blocage')}
                </strong>
                <span className="text-xs text-ink-muted">
                  {l(
                    'The prospector sends a request; the manager decides.',
                    'Le prospecteur envoie une demande ; le manager décide.',
                  )}
                </span>
              </span>
            </label>
            <div className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
              <span>{l('Override valid for', 'Dérogation valable')}</span>
              <span className="rounded-lg border border-line bg-surface px-3 py-1.5 font-semibold text-navy">
                24 {l('hours', 'heures')}
              </span>
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
              <LockKeyhole className="size-3" aria-hidden="true" />
              {l(
                'A written reason is always required and kept in the audit log.',
                'Un motif écrit est toujours requis et conservé dans le journal d’audit.',
              )}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface-muted/40 p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-brand"
                checked={rule?.allowExtension ?? true}
                onChange={(event) => {
                  setRule((current) =>
                    current ? { ...current, allowExtension: event.target.checked } : current,
                  );
                  setSaved(false);
                }}
              />
              <span>
                <strong className="block text-sm text-navy">
                  {l(
                    'A prospector may extend their own lock',
                    'Un prospecteur peut prolonger son propre verrou',
                  )}
                </strong>
                <span className="text-xs text-ink-muted">
                  {l(
                    'Useful when a call runs long or a visit is delayed.',
                    'Utile lorsqu’un appel se prolonge ou qu’une visite est retardée.',
                  )}
                </span>
              </span>
            </label>
            <div className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
              <span>{l('At most', 'Au maximum')}</span>
              <span className="rounded-lg border border-line bg-surface px-3 py-1.5 font-semibold text-navy">
                {l('once per action', 'une fois par action')}
              </span>
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
              <Info className="size-3" aria-hidden="true" />
              {l(
                'An expired lock with no summary alerts the manager.',
                'Un verrou expiré sans résumé alerte le manager.',
              )}
            </p>
          </div>
        </div>
      </Card>
      <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <span
          className={`text-sm ${saved ? 'font-semibold text-success' : 'text-ink-muted'}`}
          role="status"
        >
          {saved
            ? l('Everything is saved.', 'Tout est enregistré.')
            : l(
                'Changes apply to future contact lists.',
                'Les changements s’appliquent aux prochaines listes.',
              )}
        </span>
        <Button loading={saving} disabled={loading || !rule} onClick={() => void save()}>
          {saving
            ? l('Saving…', 'Enregistrement…')
            : l('Save settings', 'Enregistrer les réglages')}
        </Button>
      </div>
    </div>
  );
}

type Objective = {
  id: string;
  organizationId: string;
  name: string;
  metric: string;
  target: number;
  startsAt: string;
  endsAt: string;
  progress?: { actual?: number; status?: string };
};

function ObjectivesSettings({ language }: { language: string }) {
  const l = (en: string, fr: string) => text(en, fr, language) ?? en;
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [form, setForm] = useState({
    organizationId: '',
    name: '',
    metric: 'completed_actions',
    target: '12',
    startsAt: new Date().toISOString().slice(0, 10),
    endsAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const [orgs, rows] = await Promise.all([
        browserJson<{ items: Organization[] }>('/api/organizations?limit=100', {
          cache: 'no-store',
        }),
        browserJson<{ items: Objective[] }>('/api/workspace/objectives?limit=100', {
          cache: 'no-store',
        }),
      ]);
      setOrganizations(orgs.items ?? []);
      setObjectives(rows.items ?? []);
      setForm((current) => ({
        ...current,
        organizationId: current.organizationId || orgs.items?.[0]?.id || '',
      }));
      setError(false);
      setSaveError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const create = async () => {
    if (saving || !form.organizationId || !form.name.trim()) return;
    setSaving(true);
    setSaveError(false);
    try {
      await browserJson('/api/workspace/objectives', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({
          organizationId: form.organizationId,
          name: form.name.trim(),
          metric: form.metric,
          target: Number(form.target),
          startsAt: new Date(`${form.startsAt}T00:00:00.000Z`).toISOString(),
          endsAt: new Date(`${form.endsAt}T23:59:59.000Z`).toISOString(),
        }),
      });
      setForm((current) => ({ ...current, name: '' }));
      setSaved(true);
      await load();
    } catch {
      setSaveError(true);
      setError(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6">
      <SettingsHeader language={language} activeId="objectives" />
      {error && (
        <Alert tone="danger" className="flex flex-wrap items-center justify-between gap-3">
          {saveError
            ? l(
                'Unable to save objective. Please try again.',
                'Impossible d’enregistrer l’objectif. Réessayez.',
              )
            : l('Unable to load objectives.', 'Impossible de charger les objectifs.')}
          <button className="underline" onClick={() => void load()}>
            {l('Retry', 'Réessayer')}
          </button>
        </Alert>
      )}
      <Card>
        <CardHeader
          title={l('What one prospector is expected to do', 'Ce qu’un prospecteur doit accomplir')}
        />
        <p className="mb-5 text-sm leading-6 text-ink-muted">
          {l(
            'Targets guide the My day view and manager dashboards. They are targets, not limits.',
            'Les objectifs alimentent Ma journée et les tableaux de bord manager. Ce sont des cibles, pas des limites.',
          )}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ['Actions logged per working day', 'Actions enregistrées par jour ouvré', '12'],
              ['Useful contacts per day', 'Contacts utiles par jour', '4'],
              ['Meetings per week', 'Rendez-vous par semaine', '2'],
            ] as const
          ).map(([en, fr, value]) => (
            <div key={en} className="rounded-xl border border-line p-4">
              <span className="block text-sm font-semibold text-ink">{l(en, fr)}</span>
              <span className="mt-2 block text-2xl font-extrabold text-navy">{value}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardHeader title={l('Create a measurable objective', 'Créer un objectif mesurable')} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-semibold text-ink sm:col-span-2 lg:col-span-1">
            {l('Organization', 'Entreprise')}
            <select
              className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2.5"
              value={form.organizationId}
              onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
            >
              <option value="">{l('Choose organization', 'Choisir une entreprise')}</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-ink sm:col-span-2">
            {l('Objective name', 'Nom de l’objectif')}
            <input
              className="mt-2 w-full rounded-lg border border-line px-3 py-2.5"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={l('e.g. Complete 12 actions', 'ex. 12 actions terminées')}
            />
          </label>
          <label className="text-sm font-semibold text-ink">
            {l('Metric', 'Indicateur')}
            <select
              className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2.5"
              value={form.metric}
              onChange={(e) => setForm({ ...form, metric: e.target.value })}
            >
              <option value="completed_actions">
                {l('Completed actions', 'Actions terminées')}
              </option>
              <option value="completed_visits">{l('Completed visits', 'Visites terminées')}</option>
              <option value="qualified_prospects">
                {l('Qualified prospects', 'Prospects qualifiés')}
              </option>
              <option value="converted_prospects">
                {l('Converted prospects', 'Prospects convertis')}
              </option>
              <option value="completed_follow_ups">
                {l('Completed follow-ups', 'Relances terminées')}
              </option>
            </select>
          </label>
          <label className="text-sm font-semibold text-ink">
            {l('Target', 'Cible')}
            <input
              className="mt-2 w-full rounded-lg border border-line px-3 py-2.5"
              type="number"
              min="1"
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
            />
          </label>
          <label className="text-sm font-semibold text-ink">
            {l('Starts', 'Début')}
            <input
              className="mt-2 w-full rounded-lg border border-line px-3 py-2.5"
              type="date"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
          </label>
          <label className="text-sm font-semibold text-ink">
            {l('Ends', 'Fin')}
            <input
              className="mt-2 w-full rounded-lg border border-line px-3 py-2.5"
              type="date"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
            />
          </label>
        </div>
        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-ink-muted" role="status">
            {saved
              ? l('Objective saved.', 'Objectif enregistré.')
              : l(
                  'Changes are saved to the workspace.',
                  'Les changements sont enregistrés dans l’espace.',
                )}
          </span>
          <Button
            disabled={saving || loading || !form.organizationId || !form.name.trim()}
            onClick={() => void create()}
          >
            {saving ? l('Saving…', 'Enregistrement…') : l('Add objective', 'Ajouter l’objectif')}
          </Button>
        </div>
      </Card>
      <Card>
        <CardHeader title={l('Current objectives', 'Objectifs actuels')} />
        {loading ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-14 animate-pulse rounded-xl bg-surface-muted" />
            ))}
          </div>
        ) : objectives.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface-muted px-4 py-8 text-center text-sm text-ink-muted">
            {l('No objectives have been configured yet.', 'Aucun objectif n’est configuré.')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-3 py-3">{l('Objective', 'Objectif')}</th>
                  <th className="px-3 py-3">{l('Metric', 'Indicateur')}</th>
                  <th className="px-3 py-3">{l('Target', 'Cible')}</th>
                  <th className="px-3 py-3">{l('Progress', 'Progression')}</th>
                </tr>
              </thead>
              <tbody>
                {objectives.map((item) => (
                  <tr key={item.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-3 font-semibold text-ink">{item.name}</td>
                    <td className="px-3 py-3 text-ink-muted">{item.metric.replaceAll('_', ' ')}</td>
                    <td className="px-3 py-3">{item.target}</td>
                    <td className="px-3 py-3">
                      {item.progress?.actual ?? 0} / {item.target}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

type TenantSettings = { id: string; name: string; locale: string; timezone: string; etag?: string };
type SecuritySettings = {
  requireMfa: boolean;
  sessionMaxHours: number;
  sso?: { mode?: string };
  etag?: string;
};

function WorkspaceSettings({ language }: { language: string }) {
  const l = (en: string, fr: string) => text(en, fr, language) ?? en;
  const { refreshSession } = useAuth();
  const [tenant, setTenant] = useState<TenantSettings | null>(null);
  const [security, setSecurity] = useState<SecuritySettings | null>(null);
  const [initialSecurity, setInitialSecurity] = useState<SecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const [nextTenant, nextSecurity] = await Promise.all([
        browserResource<TenantSettings>('/api/workspace/tenant', { cache: 'no-store' }),
        browserResource<SecuritySettings>('/api/workspace/settings/security', {
          cache: 'no-store',
        }),
      ]);
      setTenant({ ...nextTenant.resource, etag: nextTenant.etag ?? undefined });
      const loadedSecurity = { ...nextSecurity.resource, etag: nextSecurity.etag ?? undefined };
      setSecurity(loadedSecurity);
      setInitialSecurity(loadedSecurity);
      setError(false);
      setSaveError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const save = async () => {
    if (!tenant || !security || saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      const writes: Promise<unknown>[] = [
        browserJson('/api/workspace/tenant', {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            'idempotency-key': crypto.randomUUID(),
            ...(tenant.etag ? { 'if-match': tenant.etag } : {}),
          },
          body: JSON.stringify({
            name: tenant.name,
            locale: tenant.locale,
            timezone: tenant.timezone,
          }),
        }),
      ];
      const securityChanged =
        initialSecurity === null ||
        security.requireMfa !== initialSecurity.requireMfa ||
        security.sessionMaxHours !== initialSecurity.sessionMaxHours;
      if (securityChanged) {
        writes.push(
          browserJson('/api/workspace/settings/security', {
            method: 'PATCH',
            headers: {
              'content-type': 'application/json',
              'idempotency-key': crypto.randomUUID(),
              ...(security.etag ? { 'if-match': security.etag } : {}),
            },
            body: JSON.stringify({
              requireMfa: security.requireMfa,
              sessionMaxHours: security.sessionMaxHours,
            }),
          }),
        );
      }
      await Promise.all(writes);
      /*
       * The workspace locale is also the interface-language choice shown in
       * this form. The shell reads the signed-in member locale, so keep the
       * member preference in sync and refresh the session before rendering the
       * success state. This makes the language change visible immediately and
       * keeps it after a full reload.
       */
      const account = await getAccountProfile();
      await updateAccountProfile({ locale: tenant.locale }, account.etag);
      await refreshSession();
      setSaved(true);
      await load();
    } catch {
      setSaveError(true);
      setError(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6">
      <SettingsHeader language={language} activeId="workspace-settings" />
      {error && (
        <Alert tone="danger" className="flex flex-wrap items-center justify-between gap-3">
          {l(
            saveError
              ? 'Unable to save workspace settings. Please try again.'
              : 'Unable to load workspace settings.',
            saveError
              ? 'Impossible d’enregistrer les réglages de l’espace. Réessayez.'
              : 'Impossible de charger les réglages de l’espace.',
          )}
          <button className="underline" onClick={() => void load()}>
            {l('Retry', 'Réessayer')}
          </button>
        </Alert>
      )}
      <Card>
        <CardHeader title={l('Workspace', 'Espace de travail')} />
        <p className="mb-5 text-sm text-ink-muted">
          {l(
            'These values are used on exports, letters and e-mails sent from TrackRoster.',
            'Ces valeurs sont utilisées dans les exports, courriers et e-mails envoyés depuis TrackRoster.',
          )}
        </p>
        {loading || !tenant ? (
          <div className="h-36 animate-pulse rounded-xl bg-surface-muted" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-semibold text-ink sm:col-span-2 lg:col-span-1">
              {l('Workspace name', 'Nom de l’espace')}
              <input
                className="mt-2 w-full rounded-lg border border-line px-3 py-2.5"
                value={tenant.name}
                onChange={(e) => setTenant({ ...tenant, name: e.target.value })}
              />
            </label>
            <label className="text-sm font-semibold text-ink">
              {l('Interface language', 'Langue de l’interface')}
              <select
                className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2.5"
                value={tenant.locale}
                onChange={(e) => setTenant({ ...tenant, locale: e.target.value })}
              >
                <option value="en">English</option>
                <option value="fr">Français</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-ink">
              {l('Time zone', 'Fuseau horaire')}
              <select
                className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2.5"
                value={tenant.timezone}
                onChange={(e) => setTenant({ ...tenant, timezone: e.target.value })}
              >
                <option value="Europe/Paris">Europe/Paris (UTC+1)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York</option>
              </select>
            </label>
          </div>
        )}
      </Card>
      <Card>
        <CardHeader title={l('Access and security', 'Accès et sécurité')} />
        {loading || !security ? (
          <div className="h-28 animate-pulse rounded-xl bg-surface-muted" />
        ) : (
          <div className="divide-y divide-line rounded-xl border border-line">
            <label className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <span>
                <strong className="block text-sm text-ink">
                  {l('Two-factor code at sign-in', 'Code à deux facteurs à la connexion')}
                </strong>
                <span className="text-sm text-ink-muted">
                  {l(
                    'Required for every account in this workspace.',
                    'Obligatoire pour chaque compte de cet espace.',
                  )}
                </span>
              </span>
              <input
                type="checkbox"
                checked={security.requireMfa}
                onChange={(e) => setSecurity({ ...security, requireMfa: e.target.checked })}
              />
            </label>
            <label className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <span>
                <strong className="block text-sm text-ink">
                  {l('Sign out after inactivity', 'Déconnexion après inactivité')}
                </strong>
                <span className="text-sm text-ink-muted">
                  {l(
                    'Field sessions stay open for the working day.',
                    'Les sessions terrain restent ouvertes pendant la journée.',
                  )}
                </span>
              </span>
              <select
                className="rounded-lg border border-line bg-surface px-3 py-2"
                value={security.sessionMaxHours}
                onChange={(e) =>
                  setSecurity({ ...security, sessionMaxHours: Number(e.target.value) })
                }
              >
                <option value="8">8 hours</option>
                <option value="24">24 hours</option>
                <option value="168">7 days</option>
              </select>
            </label>
            <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <span>
                <strong className="block text-sm text-ink">
                  {l('Single sign-on', 'Authentification unique')}
                </strong>
                <span className="text-sm text-ink-muted">
                  {l(
                    'SSO configuration is managed separately by an administrator.',
                    'La configuration SSO est gérée séparément par un administrateur.',
                  )}
                </span>
              </span>
              <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-ink-muted">
                {security.sso?.mode === 'configured'
                  ? l('Configured', 'Configuré')
                  : l('Later', 'Plus tard')}
              </span>
            </div>
          </div>
        )}
      </Card>
      <Card>
        <CardHeader title={l('Data and privacy', 'Données et confidentialité')} />
        <div className="divide-y divide-line rounded-xl border border-line">
          <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <strong className="block text-sm text-ink">
                {l(
                  'An opt-out applies to every company',
                  'Un refus s’applique à toutes les entreprises',
                )}
              </strong>
              <span className="text-sm text-ink-muted">
                {l(
                  'Opt-outs are retained with their reason and proof.',
                  'Les refus sont conservés avec leur motif et leur preuve.',
                )}
              </span>
            </span>
            <span className="rounded-full bg-success-bg px-3 py-1 text-xs font-bold text-success">
              {l('Always on', 'Toujours actif')}
            </span>
          </div>
          <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <strong className="block text-sm text-ink">
                {l('Exports are audited', 'Les exports sont audités')}
              </strong>
              <span className="text-sm text-ink-muted">
                {l(
                  'Every export records its filters and row count.',
                  'Chaque export enregistre ses filtres et le nombre de lignes.',
                )}
              </span>
            </span>
            <span className="text-sm font-semibold text-ink">
              {l('Managers and admins', 'Managers et admins')}
            </span>
          </div>
        </div>
      </Card>
      <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <span
          className={`text-sm ${saved ? 'font-semibold text-success' : 'text-ink-muted'}`}
          role="status"
        >
          {saved
            ? l('All changes saved.', 'Toutes les modifications sont enregistrées.')
            : l('Changes apply to this workspace.', 'Les changements s’appliquent à cet espace.')}
        </span>
        <Button disabled={loading || saving || !tenant || !security} onClick={() => void save()}>
          {saving
            ? l('Saving…', 'Enregistrement…')
            : l('Save settings', 'Enregistrer les réglages')}
        </Button>
      </div>
    </div>
  );
}
