'use client';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { browserJson } from '@/lib/api/browser-json';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { useLiveRefresh } from '@/lib/live/use-live-refresh';
import { getRoleLabel } from '@/lib/ui/roles';
import { text } from '@/lib/workspace/copy';
import { Button } from '@/components/ui/button';
type Person = {
  id: string;
  displayName: string | null;
  email: string;
  status: string;
  pendingInvitation: boolean;
  roles: string[];
};
type Duplicate = {
  id: string;
  leftId: string;
  leftName: string;
  rightId: string;
  rightName: string;
  matchingKeys: string[];
  createdAt: string;
};
type PeopleData = {
  total: number;
  active: number;
  invitations: number;
  roles: Array<{ role: string; count: number; invitations: number }>;
  items: Person[];
  nextCursor: string | null;
};
type DuplicateData = { items: Duplicate[]; nextCursor: string | null };
export function AdminIndicatorDetails({ kind }: { kind: 'people' | 'duplicates' }) {
  const { language, locale } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const [role, setRole] = useState<string | null>(null);
  const [people, setPeople] = useState<PeopleData | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(false);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const params = new URLSearchParams();
        if (role) params.set('role', role);
        if (kind === 'people') {
          const data = await browserJson<PeopleData>(`/api/dashboard/admin/people?${params}`, {
            signal,
            cache: 'no-store',
          });
          if (!signal?.aborted) setPeople(data);
        } else {
          const data = await browserJson<DuplicateData>('/api/dashboard/admin/duplicates', {
            signal,
            cache: 'no-store',
          });
          if (!signal?.aborted) setDuplicates(data);
        }
        if (!signal?.aborted) setError(false);
      } catch {
        if (!signal?.aborted) setError(true);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [role, kind],
  );
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setPeople(null);
    setDuplicates(null);
    setExpanded(false);
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  useLiveRefresh(load, { enabled: !expanded, scope: `${kind}:${role}` });
  const more = async () => {
    const cursor = kind === 'people' ? people?.nextCursor : duplicates?.nextCursor;
    if (!cursor) return;
    setExpanded(true);
    setLoading(true);
    try {
      const params = new URLSearchParams({ cursor });
      if (role) params.set('role', role);
      if (kind === 'people') {
        const data = await browserJson<PeopleData>(`/api/dashboard/admin/people?${params}`);
        setPeople((current) => ({ ...data, items: [...(current?.items ?? []), ...data.items] }));
      } else {
        const data = await browserJson<DuplicateData>(`/api/dashboard/admin/duplicates?${params}`);
        setDuplicates((current) => ({
          ...data,
          items: [...(current?.items ?? []), ...data.items],
        }));
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };
  if (loading && !people && !duplicates)
    return <p className="text-sm text-ink-muted">{l('Loading…', 'Chargement…')}</p>;
  if (error)
    return (
      <div role="alert">
        <p className="text-sm text-danger">
          {l('Unable to load details.', 'Impossible de charger le détail.')}
        </p>
        <Button variant="secondary" onClick={() => void load()}>
          {l('Retry', 'Réessayer')}
        </Button>
      </div>
    );
  const roleName = (value: string) =>
    value === 'unassigned'
      ? l('No assigned role', 'Sans rôle attribué')
      : getRoleLabel(value, language);
  return (
    <div className="space-y-4" aria-busy={loading}>
      {kind === 'people' && people ? (
        <>
          {role ? (
            <>
              <Button
                variant="ghost"
                leadingIcon={<ArrowLeft className="size-4" />}
                onClick={() => setRole(null)}
              >
                {l('Back to roles', 'Retour aux rôles')}
              </Button>
              <h3 className="font-bold">{roleName(role)}</h3>
              <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                {people.items.map((person) => (
                  <li key={person.id} className="py-3 text-sm">
                    <strong>{person.displayName || person.email}</strong>
                    <p className="break-all text-ink-muted">{person.email}</p>
                    <p>
                      {person.pendingInvitation
                        ? l('Invitation pending', 'Invitation en attente')
                        : ({
                            active: l('Active', 'Actif'),
                            invited: l(
                              'Invitation expired or consumed',
                              'Invitation expirée ou consommée',
                            ),
                            suspended: l('Suspended', 'Suspendu'),
                            departed: l('Departed', 'Départ enregistré'),
                          }[person.status] ?? person.status)}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold text-navy">{people.total}</p>
              <p className="text-sm text-ink-muted">
                {people.active} {l('active users', 'utilisateurs actifs')} · {people.invitations}{' '}
                {l('invitations pending', 'invitations en attente')}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {people.roles.map((sector) => (
                  <button
                    key={sector.role}
                    type="button"
                    onClick={() => setRole(sector.role)}
                    className="cursor-pointer rounded-xl border border-line bg-brand-wash p-3 text-left hover:border-brand focus-visible:outline-brand"
                  >
                    <strong className="block text-sm text-brand">{roleName(sector.role)}</strong>
                    <span className="block text-xl font-bold">{sector.count}</span>
                    <span className="text-xs text-ink-muted">
                      {sector.invitations} {l('invitations pending', 'invitations en attente')}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-muted">
                {l(
                  'A person with multiple roles appears in each corresponding sector.',
                  'Une personne ayant plusieurs rôles figure dans chaque secteur correspondant.',
                )}
              </p>
            </>
          )}
        </>
      ) : null}
      {kind === 'duplicates' && duplicates ? (
        <ul className="max-h-96 divide-y divide-line overflow-y-auto">
          {duplicates.items.length ? (
            duplicates.items.map((item) => (
              <li key={item.id} className="space-y-1 py-3 text-sm">
                <strong>{item.leftName}</strong>
                <p className="text-ink-muted">↔ {item.rightName}</p>
                <p>
                  {l('Matching fields', 'Champs correspondants')} :{' '}
                  {item.matchingKeys.join(', ') || '—'}
                </p>
                <p className="text-xs text-ink-muted">
                  {new Date(item.createdAt).toLocaleDateString(locale)}
                </p>
              </li>
            ))
          ) : (
            <li className="text-sm text-ink-muted">
              {l('No duplicates awaiting review.', 'Aucun doublon en attente d’examen.')}
            </li>
          )}
        </ul>
      ) : null}
      {(role && people?.nextCursor) || duplicates?.nextCursor ? (
        <Button variant="secondary" disabled={loading} onClick={() => void more()}>
          {l('Load more', 'Charger la suite')}
        </Button>
      ) : null}
    </div>
  );
}

export function UnownedIndicatorDetails() {
  const { language } = useTranslation();
  const [data, setData] = useState<{
    items: Array<{ id: string; name: string; city: string | null }>;
    nextCursor: string | null;
  } | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async (cursor?: string, signal?: AbortSignal) => {
    setLoading(true);
    try {
      const result = await browserJson<NonNullable<typeof data>>(
        `/api/dashboard/admin/unowned${cursor ? `?cursor=${cursor}` : ''}`,
        { signal, cache: 'no-store' },
      );
      if (!signal?.aborted) {
        setData((current) => ({
          ...result,
          items: cursor ? [...(current?.items ?? []), ...result.items] : result.items,
        }));
        setError(false);
      }
    } catch {
      if (!signal?.aborted) setError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(undefined, controller.signal);
    return () => controller.abort();
  }, [load]);
  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {text('Unable to load records.', 'Impossible de charger les établissements.', language)}{' '}
          <button type="button" className="underline" onClick={() => void load()}>
            {text('Retry', 'Réessayer', language)}
          </button>
        </p>
      ) : null}
      <ul className="max-h-80 divide-y divide-line overflow-y-auto">
        {data?.items.map((item) => (
          <li key={item.id} className="py-2 text-sm">
            <strong>{item.name}</strong>
            <p className="text-ink-muted">{item.city}</p>
          </li>
        ))}
      </ul>
      {loading ? (
        <p className="text-sm text-ink-muted">{text('Loading…', 'Chargement…', language)}</p>
      ) : data?.items.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {text(
            'No establishments without an owner.',
            'Aucun établissement sans responsable.',
            language,
          )}
        </p>
      ) : null}
      {data?.nextCursor ? (
        <Button disabled={loading} variant="secondary" onClick={() => void load(data.nextCursor!)}>
          {text('Load more', 'Charger la suite', language)}
        </Button>
      ) : null}
    </div>
  );
}
