'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { listScopedMemberships } from '@/lib/api/membership-client';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { SearchInput } from '@/components/ui/search-input';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { readOperation, rowsOf, recordName, isRecord } from '@/lib/workspace/client';
import { OPERATIONS } from '@/lib/workspace/operations';
import { text } from '@/lib/workspace/copy';
import type { DataRecord } from '@/lib/workspace/types';

export const LOOKUPS: Record<string, string> = {
  organizationId: '/organizations',
  parentOrganizationId: '/organizations',
  childOrganizationId: '/organizations',
  teamId: '/teams',
  membershipId: '/memberships',
  userId: '/memberships',
  ownerId: '/memberships',
  assignedUserId: '/memberships',
  managerMembershipId: '/memberships',
  campaignId: '/campaigns',
  territoryId: '/territories',
  parentId: '/territories',
  regionId: '/regions',
  parentRegionId: '/regions',
  tagId: '/tags',
  prospectId: '/prospects',
  targetId: '/prospects',
  ruleId: '/assignment-rules',
  campaignProspectId: '/work-queue',
};
export function RecordPicker({
  name,
  label,
  value,
  onChange,
  optional,
  error,
  context = {},
  filters = {},
  disabled = false,
  enabled = true,
  onRecordChange,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  error?: string;
  context?: DataRecord;
  filters?: Record<string, string>;
  disabled?: boolean;
  enabled?: boolean;
  onRecordChange?: (record: DataRecord | null) => void;
}) {
  const { language } = useTranslation();
  const { activeWorkspace, user } = useAuth();
  const scopedPeople = activeWorkspace?.mode === 'manager' || activeWorkspace?.mode === 'director';
  const endpoint = LOOKUPS[name];
  const errorId = useId();
  const campaignId = typeof context.campaignId === 'string' ? context.campaignId : '';
  const needsCampaign = ['ruleId', 'campaignProspectId'].includes(name) && !campaignId;
  const [items, setItems] = useState<DataRecord[]>([]);
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const filterKey = JSON.stringify(filters);
  const generation = useRef(0);
  const teamId = typeof context.teamId === 'string' ? context.teamId : activeWorkspace?.teamId;
  const organizationId =
    typeof context.organizationId === 'string'
      ? context.organizationId
      : activeWorkspace?.organizationId;
  const ownChoice =
    name === 'ownerId' && user
      ? { id: user.userId, displayName: user.displayName, email: user.email }
      : null;
  const ownChoiceKey = JSON.stringify(ownChoice);
  const readChoices = useCallback(
    async (cursor?: string, signal?: AbortSignal) => {
      if (endpoint === '/memberships' && scopedPeople) {
        const resource = await listScopedMemberships(
          {
            teamId: teamId ?? undefined,
            organizationId: organizationId ?? undefined,
            limit: 100,
            search,
            cursor,
            ...JSON.parse(filterKey),
          },
          signal,
        );
        const own = JSON.parse(ownChoiceKey) as DataRecord | null;
        return {
          resource: {
            ...resource,
            items: [
              ...(!cursor &&
              own &&
              (!search || recordName(own).toLowerCase().includes(search.toLowerCase())) &&
              !resource.items.some((item) => item.id === own.id)
                ? [own]
                : []),
              ...resource.items,
            ],
          },
        };
      }
      return readOperation(
        `GET ${endpoint}`,
        {},
        { limit: 100, search, cursor, campaignId, ...JSON.parse(filterKey) },
        signal,
      );
    },
    [endpoint, scopedPeople, teamId, organizationId, search, campaignId, filterKey, ownChoiceKey],
  );
  useEffect(() => {
    generation.current++;
    if (!endpoint || needsCampaign || !enabled) {
      setLoading(false);
      setItems([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        setLoading(true);
        readChoices(undefined, controller.signal)
          .then(({ resource }) => {
            if (controller.signal.aborted) return;
            setItems(rowsOf(resource));
            setCursor(
              isRecord(resource) && typeof resource.nextCursor === 'string'
                ? resource.nextCursor
                : null,
            );
            setLoadError(false);
          })
          .catch(() => {
            if (!controller.signal.aborted) setLoadError(true);
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      search ? 300 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
      generation.current++;
    };
  }, [endpoint, search, retry, needsCampaign, enabled, readChoices]);
  if (!endpoint)
    return (
      <TextField
        name={name}
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error}
        required={!optional}
      />
    );
  const supportsSearch = OPERATIONS[`GET ${endpoint}`]?.query.some((f) => f.name === 'search');
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-2">
      {supportsSearch && (
        <SearchInput
          label={text(
            `Find ${label.toLowerCase()}`,
            `Rechercher : ${label.toLowerCase()}`,
            language,
          )}
          placeholder={text('Find by name…', 'Rechercher par nom…', language)}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
      )}
      <SelectField
        name={name}
        label={label}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onRecordChange?.(
            items.find((item) => String(item.id ?? item.membershipId) === e.target.value) ?? null,
          );
        }}
        required={!optional}
        disabled={needsCampaign || disabled || loading}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        options={[
          {
            value: '',
            label: loading
              ? text('Loading…', 'Chargement…', language)
              : text('Choose…', 'Choisir…', language),
          },
          ...(value &&
          !items.some(
            (item) =>
              (name === 'campaignProspectId'
                ? item.campaignProspectId
                : (item.id ?? item.membershipId)) === value,
          )
            ? [{ value, label: value }]
            : []),
          ...items.map((item) => ({
            value: String(
              name === 'campaignProspectId'
                ? item.campaignProspectId
                : (item.id ?? item.membershipId),
            ),
            label:
              name === 'campaignProspectId' && isRecord(item.establishment)
                ? recordName(item.establishment)
                : recordName(item),
          })),
        ]}
      />
      {error && (
        <p id={errorId} className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {needsCampaign && (
        <p className="text-sm text-ink-muted">
          {text('Choose a campaign first.', 'Choisissez d’abord une campagne.', language)}
        </p>
      )}
      {loadError && (
        <Button variant="ghost" size="md" onClick={() => setRetry((n) => n + 1)}>
          {text(
            'Could not load choices. Retry',
            'Impossible de charger les choix. Réessayer',
            language,
          )}
        </Button>
      )}
      {!loading && !loadError && items.length === 0 && (
        <p className="text-sm text-ink-muted">
          {text(
            'No accessible records match.',
            'Aucun enregistrement accessible ne correspond.',
            language,
          )}
        </p>
      )}
      {cursor && (
        <Button
          variant="ghost"
          size="md"
          loading={loading}
          onClick={async () => {
            const currentGeneration = generation.current;
            setLoading(true);
            try {
              const { resource } = await readChoices(cursor);
              if (generation.current !== currentGeneration) return;
              setItems((current) => [...current, ...rowsOf(resource)]);
              setCursor(
                isRecord(resource) && typeof resource.nextCursor === 'string'
                  ? resource.nextCursor
                  : null,
              );
            } catch {
              if (generation.current === currentGeneration) setLoadError(true);
            } finally {
              if (generation.current === currentGeneration) setLoading(false);
            }
          }}
        >
          {text('Load more choices', 'Charger plus de choix', language)}
        </Button>
      )}
    </fieldset>
  );
}
