'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminGuard } from '@/components/admin/admin-guard';
import { Tabs } from '@/components/ui/tabs';
import { WorkspaceModulePage } from '@/components/workspace/workspace-module';
import { WORKSPACE_MODULES } from '@/lib/workspace/modules';
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
  const definition = WORKSPACE_MODULES.find((m) => m.id === section[0])!;
  if (section[0] === 'reservation-rules') return <ReservationSettings language={language} />;
  return (
    <div className="space-y-5">
      <WorkspaceModulePage
        backLink={false}
        headerAddon={
          <Tabs
            label={text('Settings sections', 'Sections des réglages', language)}
            activeId={section[0]!}
            items={sections.map(([key, en, fr]) => ({
              id: key!,
              label: text(en!, fr!, language),
              href: `/admin/settings?section=${key}`,
            }))}
          />
        }
        key={definition.id}
        module={{
          ...definition,
          title: { en: 'Rules and settings', fr: 'Règles et réglages' },
          description: {
            en:
              'Configure ' +
              section[1]!.toLowerCase() +
              '. Changes apply to your authorized scope.',
            fr:
              'Configurez ' +
              section[2]!.toLowerCase() +
              '. Les modifications s’appliquent à votre périmètre autorisé.',
          },
        }}
      />
    </div>
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
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">
            {l('Administration', 'Administration')}
          </p>
          <h1 className="text-[35px] font-extrabold tracking-tight text-navy">
            {l('Rules and settings', 'Règles et réglages')}
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-ink-muted">
            {l(
              'Anti-collision rules, session objectives and prospector permissions.',
              'Toutes les règles anti-collision, les objectifs de session et les droits des prospecteurs.',
            )}
          </p>
        </div>
        <Tabs
          label={text('Settings sections', 'Sections des réglages', language)}
          activeId="reservation-rules"
          items={sections.map(([key, en, fr]) => ({
            id: key!,
            label: text(en!, fr!, language),
            href: `/admin/settings?section=${key}`,
          }))}
        />
      </header>
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
                          type="number"
                          min="0"
                          max="365"
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
