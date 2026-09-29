'use client';
import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CircleAlert, Info } from 'lucide-react';

import { AdminGuard } from '@/components/admin/admin-guard';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LinkButton } from '@/components/ui/link-button';
import { PageHeader } from '@/components/ui/page-header';
import { SelectField } from '@/components/ui/select-field';
import { StatTile } from '@/components/ui/stat-tile';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import { listUnassignedProspects } from '@/lib/api/assignment-client';
import { CATEGORY_LABELS, type UnassignedProspect } from '@/lib/api/assignment-types';
import {
  applyCampaignEnrolment,
  listCampaigns,
  previewCampaignEnrolment,
} from '@/lib/api/campaign-client';
import {
  hasEnrolmentSelection,
  type Campaign,
  type CampaignEnrolmentResult,
  type CampaignEnrolmentSelection,
} from '@/lib/api/campaign-types';
import { ESTABLISHMENT_CATEGORIES, type EstablishmentCategory } from '@/lib/api/import-types';
import { useTranslation } from '@/lib/i18n/i18n-context';

/*
 * The enrolment ceiling upstream. One request, never a loop: the API selects and
 * inserts in a single statement, and the priority population is 4,524 rows.
 */
const ENROLMENT_LIMIT = 10_000;

/* Enough of the queue to show that enrolment worked; the full list lives on the
 * assignments screen, which is where the work is actually handed out. */
const QUEUE_PREVIEW_SIZE = 25;

/* Two digits, or three for the overseas 97x/98x codes — the API's own rule. */
const DEPARTMENT_SHAPE = /^(?:0[1-9]|[1-8]\d|9[0-6]|9[78]\d)$/;

/*
 * The selection, built in one place.
 *
 * Both the enrolment call and the dispatch-queue read go through this, so the two
 * cannot end up describing different populations — which is the guarantee the
 * shared filter helper in the API exists to provide, and it would be lost here if
 * each caller assembled its own criteria.
 *
 * A half-typed department is left out rather than sent: `9` is not a department,
 * the API would refuse it on its shape rule, and the operator would read that as
 * a broken screen.
 */
function buildSelection(fields: {
  category: EstablishmentCategory | '';
  department: string;
  city: string;
  search: string;
}): CampaignEnrolmentSelection {
  return {
    ...(fields.category ? { category: fields.category } : {}),
    ...(DEPARTMENT_SHAPE.test(fields.department) ? { department: fields.department } : {}),
    ...(fields.city.trim() ? { city: fields.city.trim() } : {}),
    ...(fields.search.trim() ? { search: fields.search.trim() } : {}),
  };
}

/*
 * This screen lives under administration, not under the manager workspace, and
 * that is a consequence of the backend rather than a layout choice: bulk
 * enrolment is guarded by ClientAdminGuard, and an establishment outside every
 * campaign is only visible to a tenant-scoped admin or observer. Putting the
 * panel on the team-scoped manager page would render controls that answer 403.
 */
export default function CampaignEnrolmentPage() {
  const { t } = useTranslation();

  return (
    <AdminGuard title={t('enrol.title')} subtitle={t('enrol.subtitle')}>
      <CampaignEnrolment />
    </AdminGuard>
  );
}

function CampaignEnrolment() {
  const { t } = useTranslation();

  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [campaignId, setCampaignId] = useState('');

  const [category, setCategory] = useState<EstablishmentCategory | ''>('');
  const [department, setDepartment] = useState('');
  const [city, setCity] = useState('');
  const [search, setSearch] = useState('');

  const [result, setResult] = useState<CampaignEnrolmentResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);

  const [queue, setQueue] = useState<UnassignedProspect[] | null>(null);
  const [queueDenied, setQueueDenied] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [refreshVersion, setRefreshVersion] = useState(0);
  useLiveRefresh(() => setRefreshVersion((version) => version + 1));

  useEffect(() => {
    const controller = new AbortController();

    listCampaigns({ limit: 100, sort: 'name' }, controller.signal)
      .then((page) => {
        /* Completed and archived campaigns refuse enrolment upstream. */
        const open = page.items.filter(
          (campaign) => campaign.status !== 'completed' && campaign.status !== 'archived',
        );

        setCampaigns(open);
        setCampaignId((current) => current || (open[0]?.id ?? ''));
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setCampaigns([]);
          setError(describeError(caught, t('enrol.selectionRequired')));
        }
      });

    return () => controller.abort();
  }, [t, refreshVersion]);

  const selection = buildSelection({ category, department, city, search });

  const selected = hasEnrolmentSelection(selection);

  const loadQueue = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!campaignId || !selected) {
        setQueue(null);

        return;
      }

      try {
        const page = await listUnassignedProspects(
          {
            campaignId,
            ...buildSelection({ category, department, city, search }),
            limit: QUEUE_PREVIEW_SIZE,
          },
          signal,
        );

        if (signal?.aborted) {
          return;
        }

        setQueue(page.items);
        setQueueDenied(false);
      } catch (caught) {
        if (signal?.aborted) {
          return;
        }

        /* A 403 here is a scope answer, not a failure of the enrolment itself. */
        setQueueDenied(caught instanceof ApiError && caught.statusCode === 403);
        setQueue([]);
      }
    },
    [campaignId, selected, category, department, city, search],
  );

  useLiveRefresh(loadQueue);

  async function runPreview(): Promise<void> {
    if (!campaignId || !selected) {
      return;
    }

    setPreviewing(true);
    setError(null);

    try {
      /* The API's own preview, so the counts are the server's and not a guess. */
      setResult(
        await previewCampaignEnrolment(campaignId, { ...selection, limit: ENROLMENT_LIMIT }),
      );
      await loadQueue();
    } catch (caught) {
      setResult(null);
      setError(describeError(caught, t('enrol.selectionRequired')));
    } finally {
      setPreviewing(false);
    }
  }

  async function runApply(): Promise<void> {
    if (!campaignId || !selected) {
      return;
    }

    setApplying(true);
    setError(null);

    try {
      setResult(await applyCampaignEnrolment(campaignId, { ...selection, limit: ENROLMENT_LIMIT }));

      /*
       * Re-read the queue rather than inserting the new rows locally. The server
       * decides what is dispatchable — an opposition or another campaign already
       * working the establishment changes the answer — so a local guess would be
       * a second, weaker copy of that logic.
       */
      await loadQueue();
    } catch (caught) {
      setError(describeError(caught, t('enrol.selectionRequired')));
    } finally {
      setApplying(false);
    }
  }

  const campaignOptions = campaigns?.length
    ? campaigns.map((campaign) => ({
        value: campaign.id,
        label:
          campaign.status === 'active' ? campaign.name : `${campaign.name} (${campaign.status})`,
      }))
    : [{ value: '', label: t('enrol.campaign.none') }];

  const applied = result?.mode === 'apply';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t('enrol.title')} subtitle={t('enrol.subtitle')} />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Card>
        <h2 className="mb-4 text-[19px] font-bold tracking-[-0.015em] text-navy">
          {t('enrol.step.select')}
        </h2>

        {campaigns === null ? (
          <FieldsSkeleton />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <SelectField
              label={t('enrol.campaign')}
              value={campaignId}
              disabled={campaigns.length === 0}
              onChange={(event) => {
                setCampaignId(event.target.value);
                setResult(null);
                setQueue(null);
              }}
              options={campaignOptions}
            />

            <SelectField
              label={t('enrol.section')}
              value={category}
              onChange={(event) => {
                setCategory(event.target.value as EstablishmentCategory | '');
                setResult(null);
              }}
              options={[
                { value: '', label: t('enrol.section.all') },
                ...ESTABLISHMENT_CATEGORIES.map((value) => ({
                  value,
                  label: CATEGORY_LABELS[value],
                })),
              ]}
            />

            <TextField
              label={t('enrol.department')}
              hint={t('enrol.department.hint')}
              inputMode="numeric"
              maxLength={3}
              value={department}
              onChange={(event) => {
                setDepartment(event.target.value.replace(/\D/g, ''));
                setResult(null);
              }}
            />

            <TextField
              label={t('enrol.city')}
              value={city}
              onChange={(event) => {
                setCity(event.target.value);
                setResult(null);
              }}
            />

            <TextField
              label={t('enrol.search')}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setResult(null);
              }}
            />
          </div>
        )}

        {/*
         * Stated before the action is offered rather than after the API refuses
         * it: an empty selection would mean the entire shared base.
         */}
        {!selected ? (
          <Alert tone="info" className="mt-4">
            {t('enrol.selectionRequired')}
          </Alert>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            disabled={!campaignId || !selected || previewing || applying}
            onClick={() => void runPreview()}
          >
            {previewing ? t('enrol.previewing') : t('enrol.preview')}
          </Button>

          <Button
            disabled={
              !campaignId || !selected || previewing || applying || result?.enrollable === 0
            }
            onClick={() => void runApply()}
          >
            {applying ? t('enrol.applying') : t('enrol.apply')}
          </Button>
        </div>
      </Card>

      {result ? (
        <Card>
          <h2 className="mb-4 text-[19px] font-bold tracking-[-0.015em] text-navy">
            {t('enrol.step.enrol')}
          </h2>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              icon={<Info aria-hidden="true" className="size-6" />}
              tone="neutral"
              value={result.matched}
              label={t('enrol.matched')}
            />

            <StatTile
              icon={<ArrowRight aria-hidden="true" className="size-6" />}
              tone={applied ? 'success' : 'brand'}
              value={applied ? result.enrolled : result.enrollable}
              label={applied ? t('enrol.enrolled') : t('enrol.enrollable')}
            />

            <StatTile
              icon={<Info aria-hidden="true" className="size-6" />}
              tone="neutral"
              value={result.alreadyActive}
              label={t('enrol.alreadyActive')}
            />

            <StatTile
              icon={<CircleAlert aria-hidden="true" className="size-6" />}
              tone={result.alreadyExcluded > 0 ? 'warning' : 'neutral'}
              value={result.alreadyExcluded}
              label={t('enrol.alreadyExcluded')}
            />
          </div>

          {result.matched === 0 ? (
            <Alert tone="info" className="mt-4">
              {t('enrol.noMatches')}
            </Alert>
          ) : null}

          {/* Not an error: everything matching is already in the campaign. */}
          {result.matched > 0 && result.enrollable === 0 ? (
            <Alert tone="info" className="mt-4">
              {t('enrol.nothingToAdd')}
            </Alert>
          ) : null}

          {result.truncated ? (
            <Alert tone="warning" className="mt-4">
              {t('enrol.truncated', { matched: result.matched, selected: result.selected })}
            </Alert>
          ) : null}

          {/*
           * No "reactivate all". Somebody excluded these deliberately, and the
           * bulk path is additive precisely so it cannot undo that silently.
           */}
          {result.alreadyExcluded > 0 ? (
            <Alert tone="info" className="mt-4">
              {t('enrol.excludedKept')}
            </Alert>
          ) : null}
        </Card>
      ) : null}

      {queue !== null ? (
        <Card className="p-0 sm:p-0">
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6">
            <h2 className="text-[19px] font-bold tracking-[-0.015em] text-navy">
              {t('enrol.step.dispatch')}
            </h2>

            <Badge tone="neutral">{queue.length}</Badge>

            <LinkButton href="/manager/assignments" variant="secondary" className="ml-auto">
              {t('enrol.goAssign')}
            </LinkButton>
          </div>

          <p className="px-5 pb-3 text-[14px] text-ink-muted sm:px-6">{t('enrol.queue.explain')}</p>

          {queueDenied ? (
            <Alert tone="info" className="mx-5 mb-5 sm:mx-6">
              {t('enrol.assignHint')}
            </Alert>
          ) : queue.length === 0 ? (
            <p className="px-6 py-12 text-center text-[15px] text-ink-muted">
              {t('enrol.queue.empty')}
            </p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-line-soft overflow-y-auto border-t border-line-soft">
              {queue.map((prospect) => (
                <li
                  key={prospect.campaignProspectId}
                  className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-navy">
                      {prospect.name}
                    </span>

                    <span className="block truncate text-[13px] text-ink-muted">
                      {[
                        prospect.category ? CATEGORY_LABELS[prospect.category] : null,
                        [prospect.postalCode, prospect.city].filter(Boolean).join(' ') || null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>

                  {/* Backend decisions, displayed. Neither is computed here. */}
                  {prospect.contactBlocked ? (
                    <Badge tone="danger">{t('enrol.queue.opposition')}</Badge>
                  ) : null}

                  {prospect.activeElsewhere ? (
                    <Badge tone="warning">{t('enrol.queue.elsewhere')}</Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}

/* Three placeholder rows while the campaign list loads. */
function FieldsSkeleton() {
  return (
    <div className="grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {[0, 1, 2].map((row) => (
        <div key={row} className="h-[72px] rounded-lg bg-surface-muted" />
      ))}
    </div>
  );
}

function describeError(error: unknown, selectionRequired: string): string {
  if (error instanceof ApiError) {
    switch (error.statusCode) {
      /* The API's message names the field it rejected; prefer it. */
      case 400:
        return error.message || selectionRequired;

      case 401:
        return 'Your session has expired. Sign in again to continue.';

      case 403:
        return 'You do not have administrator access for this tenant.';

      case 404:
        return 'That campaign no longer exists.';

      case 409:
        return 'This campaign is no longer editable.';

      default:
        return error.message || 'Something went wrong. Try again.';
    }
  }

  return 'Something went wrong. Try again.';
}
