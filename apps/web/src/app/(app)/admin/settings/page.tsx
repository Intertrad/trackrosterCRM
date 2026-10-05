'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminGuard } from '@/components/admin/admin-guard';
import { Tabs } from '@/components/ui/tabs';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { browserJson } from '@/lib/api/browser-json';
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
  durationMinutes: number;
  cooldownMinutes: number;
  maxHoldMinutes: number;
  allowExtension: boolean;
  allowManagerOverride: boolean;
};

function ReservationSettings({ language }: { language: string }) {
  const l = (en: string, fr: string) => text(en, fr, language) ?? en;
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [policies, setPolicies] = useState<CoordinationPolicy[]>([]);
  const [rule, setRule] = useState<ReservationRule | null>(null);
  const [matrix, setMatrix] = useState<Record<string, number>>({});
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      setRule(rulePage.items?.find((item) => item.id) ?? null);
      const next: Record<string, number> = {};
      for (const a of orgPage.items ?? [])
        for (const b of orgPage.items ?? [])
          next[`${a.id}:${b.id}`] =
            a.id === b.id ? (rulePage.items?.[0]?.durationMinutes ?? 30) : 7;
      for (const p of policyRows)
        next[`${p.organizationAId}:${p.organizationBId}`] =
          p.policy === 'delayed'
            ? Math.ceil((p.delayMinutes ?? 10080) / 1440)
            : p.policy === 'independent'
              ? 0
              : 7;
      setMatrix(next);
      setError(false);
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
  const applyPreset = (sameCompany: number, otherCompany: number) => {
    const next: Record<string, number> = {};
    for (const a of organizations)
      for (const b of organizations)
        next[`${a.id}:${b.id}`] = a.id === b.id ? sameCompany : otherCompany;
    setMatrix(next);
    setSaved(false);
  };
  const save = async () => {
    if (!rule || saving) return;
    setSaving(true);
    try {
      const existing = new Map(
        policies.map((p) => [`${p.organizationAId}:${p.organizationBId}`, p]),
      );
      for (let i = 0; i < organizations.length; i++)
        for (let j = i + 1; j < organizations.length; j++) {
          const a = organizations[i]!,
            b = organizations[j]!;
          const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
          const days = matrix[`${a.id}:${b.id}`] ?? 7;
          const current = existing.get(key);
          const input = {
            policy: days === 0 ? ('independent' as const) : ('delayed' as const),
            delayMinutes: days === 0 ? null : days * 1440,
          };
          if (current) await updateCoordinationPolicy(current.id, input);
          else if (days !== 7)
            await createCoordinationPolicy({
              organizationAId: a.id,
              organizationBId: b.id,
              ...input,
            });
        }
      if (rule)
        await browserJson(`/api/workspace/reservation-rules/${encodeURIComponent(rule.id)}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify(rule),
        });
      setSaved(true);
      await load();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6">
      <SettingsHeader language={language} activeId="reservation-rules" />
      {error && (
        <Alert tone="danger" className="flex items-center justify-between gap-3">
          {l('Unable to load settings.', 'Impossible de charger les réglages.')}{' '}
          <button className="underline" onClick={() => void load()}>
            {l('Retry', 'Réessayer')}
          </button>
        </Alert>
      )}
      <Card className="overflow-hidden border-line/80 shadow-[0_18px_50px_rgba(9,31,105,0.07)]">
        <CardHeader
          title={l(
            'Delay between contacts at the same establishment',
            'Délais entre deux contacts d’un même établissement',
          )}
        />
        <p className="mb-5 max-w-3xl text-sm leading-6 text-ink-muted">
          {l(
            'Rows show the company that contacted last; columns show the next company. Values are days.',
            'Ligne = entreprise qui a contacté en dernier ; colonne = entreprise qui veut contacter. Valeurs en jours.',
          )}
        </p>
        {loading ? (
          <div
            className="grid gap-3 py-6"
            aria-label={l('Loading settings', 'Chargement des réglages')}
          >
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-12 animate-pulse rounded-xl bg-surface-muted" />
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
          <div className="overflow-x-auto rounded-xl border border-line bg-surface-muted/50 p-2">
            <table className="min-w-[760px] border-separate border-spacing-1.5 text-center text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-48 bg-surface-muted p-3 text-left text-xs font-bold uppercase tracking-wide text-ink-muted">
                    {l('Contacted by ↓ / then by →', 'Contacté par ↓ / puis par →')}
                  </th>
                  {organizations.map((org) => (
                    <th
                      key={org.id}
                      className="min-w-28 rounded-xl px-3 py-3 text-xs font-bold text-white shadow-sm"
                      style={{ backgroundColor: org.color ?? '#155eef' }}
                    >
                      {org.shortName ?? org.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {organizations.map((row) => (
                  <tr key={row.id}>
                    <th
                      className="sticky left-0 z-[1] min-w-48 rounded-xl px-4 py-3 text-left text-xs font-bold text-white shadow-sm"
                      style={{ backgroundColor: row.color ?? '#155eef' }}
                    >
                      {row.shortName ?? row.name}
                    </th>
                    {organizations.map((col) => (
                      <td key={col.id}>
                        <input
                          aria-label={`${row.name} to ${col.name}`}
                          min="0"
                          max="365"
                          type="number"
                          value={matrix[`${row.id}:${col.id}`] ?? 7}
                          onChange={(event) => {
                            setCell(
                              row.id,
                              col.id,
                              Math.max(0, Math.min(365, Number(event.target.value) || 0)),
                            );
                            setSaved(false);
                          }}
                          className={`w-20 rounded-xl border px-3 py-2.5 text-center font-semibold text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 ${row.id === col.id ? 'border-brand/30 bg-brand-tint/40' : 'border-line bg-surface'}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
            {l('Presets', 'Préréglages')}
          </span>
          <button
            type="button"
            onClick={() => applyPreset(30, 7)}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand"
          >
            30 / 7 {l('days', 'jours')}
          </button>
          <button
            type="button"
            onClick={() => applyPreset(30, 14)}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand"
          >
            30 / 14 {l('days', 'jours')}
          </button>
          <button
            type="button"
            onClick={() => applyPreset(45, 30)}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand"
          >
            45 / 30 {l('days', 'jours')}
          </button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={rule?.allowManagerOverride ?? true}
              onChange={(event) =>
                setRule((current) =>
                  current ? { ...current, allowManagerOverride: event.target.checked } : current,
                )
              }
            />
            {l('Allow manager overrides', 'Autoriser les dérogations manager')}
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={rule?.allowExtension ?? true}
              onChange={(event) =>
                setRule((current) =>
                  current ? { ...current, allowExtension: event.target.checked } : current,
                )
              }
            />
            {l('Allow reservation extensions', 'Autoriser les prolongations')}
          </label>
        </div>
      </Card>
      <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <span
          className={`text-sm ${saved ? 'font-semibold text-emerald-700' : 'text-ink-muted'}`}
          role="status"
        >
          {saved
            ? l('Everything is saved.', 'Tout est enregistré.')
            : l(
                'Changes apply to future contact lists.',
                'Les changements s’appliquent aux prochaines listes.',
              )}
        </span>
        <Button disabled={loading || saving || !rule} onClick={() => void save()}>
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
          {l('Unable to load objectives.', 'Impossible de charger les objectifs.')}
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

type TenantSettings = { id: string; name: string; locale: string; timezone: string };
type SecuritySettings = { requireMfa: boolean; sessionMaxHours: number; sso?: { mode?: string } };

function WorkspaceSettings({ language }: { language: string }) {
  const l = (en: string, fr: string) => text(en, fr, language) ?? en;
  const [tenant, setTenant] = useState<TenantSettings | null>(null);
  const [security, setSecurity] = useState<SecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const [nextTenant, nextSecurity] = await Promise.all([
        browserJson<TenantSettings>('/api/workspace/tenant', { cache: 'no-store' }),
        browserJson<SecuritySettings>('/api/workspace/settings/security', { cache: 'no-store' }),
      ]);
      setTenant(nextTenant);
      setSecurity(nextSecurity);
      setError(false);
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
    try {
      await Promise.all([
        browserJson('/api/workspace/tenant', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({
            name: tenant.name,
            locale: tenant.locale,
            timezone: tenant.timezone,
          }),
        }),
        browserJson('/api/workspace/settings/security', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({
            requireMfa: security.requireMfa,
            sessionMaxHours: security.sessionMaxHours,
          }),
        }),
      ]);
      setSaved(true);
      await load();
    } catch {
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
            'Unable to load workspace settings.',
            'Impossible de charger les réglages de l’espace.',
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
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
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
          className={`text-sm ${saved ? 'font-semibold text-emerald-700' : 'text-ink-muted'}`}
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
