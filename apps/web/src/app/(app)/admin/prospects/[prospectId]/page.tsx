'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Ban, CircleCheck, CircleHelp, TriangleAlert } from 'lucide-react';

import { AdminGuard } from '@/components/admin/admin-guard';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LinkButton } from '@/components/ui/link-button';
import { PageHeader } from '@/components/ui/page-header';
import { ApiError } from '@/lib/api/api-error';
import { CATEGORY_LABELS } from '@/lib/api/assignment-types';
import { listConsents } from '@/lib/api/consent-client';
import type { ConsentRestriction } from '@/lib/api/consent-types';
import { listProspectAddresses, listProspectContacts } from '@/lib/api/prospect-contact-client';
import {
  contactDisplayName,
  formatAddress,
  sortContacts,
  type ProspectAddress,
  type ProspectContact,
} from '@/lib/api/prospect-contact-types';
import { getProspect } from '@/lib/api/prospect-client';
import { prospectDepartment, type ProspectDetail } from '@/lib/api/prospect-types';

import { CampaignContext } from './campaign-context';

/*
 * The establishment workspace.
 *
 * Administration only, because an establishment outside every campaign is visible
 * to a tenant-scoped grant alone — the API's rule, mirrored by AdminGuard.
 *
 * Four requests, in parallel: the establishment, its contacts, its addresses and
 * its consent record. None depends on another, so none waits for another.
 */
export default function ProspectDetailPage() {
  return (
    <AdminGuard title="Fiche établissement" subtitle="The shared référentiel record">
      <ProspectWorkspace />
    </AdminGuard>
  );
}

interface Loaded {
  prospect: ProspectDetail;
  contacts: ProspectContact[];
  addresses: ProspectAddress[];
  restrictions: ConsentRestriction[];
  /* Distinguishes "no opposition recorded" from "the consent read failed". */
  consentFailed: boolean;
}

function ProspectWorkspace() {
  const params = useParams<{ prospectId: string }>();
  const prospectId = params?.prospectId ?? '';

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!prospectId) {
        return;
      }

      setLoaded(null);
      setError(null);

      try {
        /*
         * The establishment is the only one that can fail the page; a contact,
         * address or consent read that fails leaves the record readable, so those
         * three are settled rather than awaited together.
         */
        const prospect = await getProspect(prospectId, signal);

        const [contacts, addresses, consents] = await Promise.allSettled([
          listProspectContacts(prospectId, signal),
          listProspectAddresses(prospectId, signal),
          listConsents(prospectId, { limit: 50 }, signal),
        ]);

        if (signal?.aborted) {
          return;
        }

        setLoaded({
          prospect,
          contacts: contacts.status === 'fulfilled' ? contacts.value.items : [],
          addresses: addresses.status === 'fulfilled' ? addresses.value.items : [],
          restrictions: consents.status === 'fulfilled' ? consents.value.restrictions : [],
          consentFailed: consents.status === 'rejected',
        });
      } catch (caught) {
        if (signal?.aborted) {
          return;
        }

        /*
         * No falling back to the row the list already had. A detail read that
         * failed is an integration problem, and showing stale fields instead would
         * disguise it as a working page.
         */
        setError(caught instanceof Error ? caught : new Error('Unknown failure'));
      }
    },
    [prospectId],
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load, attempt]);

  if (error) {
    return <FailureState error={error} onRetry={() => setAttempt((count) => count + 1)} />;
  }

  if (!loaded) {
    return <DetailSkeleton />;
  }

  const { prospect } = loaded;
  const department = prospectDepartment(prospect.postalCode);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={prospect.name}
        subtitle={
          [prospect.category ? CATEGORY_LABELS[prospect.category] : null, prospect.city, department]
            .filter(Boolean)
            .join(' · ') || undefined
        }
        action={
          <LinkButton href="/admin/prospects" variant="secondary">
            <ArrowLeft aria-hidden="true" className="mr-1.5 size-4" />
            Prospects
          </LinkButton>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {prospect.category ? (
          <Badge tone="brand">{CATEGORY_LABELS[prospect.category]}</Badge>
        ) : null}

        <Badge tone={prospect.status === 'active' ? 'success' : 'neutral'}>{prospect.status}</Badge>

        {prospect.source === 'import' ? <Badge tone="neutral">Imported</Badge> : null}

        {prospect.tags.map((tag) => (
          <Badge key={tag.id} tone="neutral">
            {tag.name}
          </Badge>
        ))}
      </div>

      {/*
       * A merged record is superseded. Recording work against it is how activity
       * ends up on the wrong establishment, so it is stated before anything else.
       */}
      {prospect.mergedIntoId ? (
        <Alert tone="warning" title="This record was merged into another establishment.">
          Work recorded here will not appear on the establishment that superseded it.
        </Alert>
      ) : null}

      <ConsentSection
        restrictions={loaded.restrictions}
        failed={loaded.consentFailed}
        prospectId={prospect.id}
      />

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-[19px] font-bold tracking-[-0.015em] text-navy">Informations</h2>

          {/*
           * Master data: the établissement as the référentiel holds it. It is
           * tenant-level and organization-neutral, so nothing here says which
           * entity it belongs to — no entity does.
           */}
          <dl className="flex flex-col gap-2 text-[14px]">
            <Field label="Address">{prospect.addressLine1}</Field>
            <Field label="Commune">
              {[prospect.postalCode, prospect.city].filter(Boolean).join(' ') || null}
            </Field>
            <Field label="Department">{department}</Field>
            <Field label="Country">{prospect.countryCode}</Field>
            <Field label="Phone">{prospect.phone}</Field>
            <Field label="Website">{prospect.website}</Field>
            <Field label="Coordinates">
              {prospect.latitude !== null && prospect.longitude !== null
                ? `${prospect.latitude.toFixed(5)}, ${prospect.longitude.toFixed(5)}`
                : null}
            </Field>
            <Field label="Reference">{prospect.externalReference}</Field>
            <Field label="Source">{prospect.source}</Field>
          </dl>

          {prospect.latitude === null ? (
            <Alert tone="info" className="mt-4">
              No coordinates, so this establishment cannot be mapped or routed to.
            </Alert>
          ) : null}
        </Card>

        <Card>
          {/*
           * Everything the tenant has added, kept apart from the master record
           * above: a prospector enriches these without editing the référentiel.
           */}
          <h2 className="mb-4 text-[19px] font-bold tracking-[-0.015em] text-navy">
            Recorded by the team
          </h2>

          {Object.keys(prospect.customFields).length === 0 && prospect.tags.length === 0 ? (
            <p className="text-[14px] text-ink-muted">
              Nothing has been recorded against this establishment yet.
            </p>
          ) : (
            <dl className="flex flex-col gap-2 text-[14px]">
              {Object.entries(prospect.customFields).map(([key, value]) => (
                <Field key={key} label={key}>
                  {value}
                </Field>
              ))}
            </dl>
          )}

          {loaded.addresses.length > 0 ? (
            <div className="mt-5">
              <h3 className="mb-2 text-[15px] font-semibold text-navy">Other addresses</h3>

              <ul className="flex flex-col gap-1.5 text-[14px] text-ink">
                {loaded.addresses.map((address) => (
                  <li key={address.id} className="flex flex-wrap items-baseline gap-2">
                    <span>{formatAddress(address)}</span>

                    {address.isPrimary ? <Badge tone="neutral">Primary</Badge> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      </div>

      <Card className="p-0 sm:p-0">
        <div className="flex items-center gap-3 px-5 py-4 sm:px-6">
          <h2 className="text-[19px] font-bold tracking-[-0.015em] text-navy">Contacts</h2>

          <Badge tone="neutral">{loaded.contacts.length}</Badge>
        </div>

        {loaded.contacts.length === 0 ? (
          <p className="px-6 pb-8 text-[14px] text-ink-muted">
            No contact has been recorded for this establishment.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft border-t border-line-soft">
            {/* Primary first, then by name — the API orders by id, which is random. */}
            {sortContacts(loaded.contacts).map((contact) => (
              <li
                key={contact.id}
                className="flex flex-wrap items-baseline gap-3 px-5 py-3 sm:px-6"
              >
                <span className="text-[15px] font-semibold text-navy">
                  {contactDisplayName(contact)}
                </span>

                {contact.jobTitle ? (
                  <span className="text-[14px] text-ink-muted">{contact.jobTitle}</span>
                ) : null}

                {contact.isPrimary ? <Badge tone="brand">Primary</Badge> : null}

                <span className="ml-auto flex flex-wrap gap-4 text-[14px] text-ink">
                  {contact.phone ? <span>{contact.phone}</span> : null}
                  {contact.email ? <span className="truncate">{contact.email}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/*
       * Loaded on its own so it cannot take the record above it down, and
       * because its contract is the newest thing on this page.
       */}
      <CampaignContext prospectId={prospect.id} />
    </div>
  );
}

/*
 * The opposition state, from the API's own resolution.
 *
 * `restrictions` is computed by `trackroster_consent_blocked`, the same function
 * the reservation and activity guards consult. Replaying the consent records in
 * the browser would be a second copy of a compliance decision that disagrees the
 * moment one expires.
 *
 * Never colour alone: each channel carries an icon and a word.
 */
function ConsentSection({
  restrictions,
  failed,
  prospectId,
}: {
  restrictions: ConsentRestriction[];
  failed: boolean;
  prospectId: string;
}) {
  if (failed) {
    return (
      <Alert tone="warning" title="The contact restrictions could not be read.">
        Treat this establishment as do-not-contact until the record loads.
      </Alert>
    );
  }

  const blocked = restrictions.filter((restriction) => restriction.blocked);

  return (
    <Card>
      <h2 className="mb-3 text-[19px] font-bold tracking-[-0.015em] text-navy">
        Contact permission
      </h2>

      {blocked.length > 0 ? (
        <Alert
          tone="danger"
          title={`Do not contact by ${blocked.map((restriction) => restriction.channel).join(', ')}.`}
          className="mb-4"
        >
          An opposition covers this establishment. A reservation on a blocked channel is refused.
        </Alert>
      ) : null}

      {restrictions.length === 0 ? (
        <p className="flex items-center gap-2 text-[14px] text-ink-muted">
          <CircleHelp aria-hidden="true" className="size-4" />
          No restriction has been recorded, so no channel is known to be blocked.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {restrictions.map((restriction) => (
            <li
              key={restriction.channel}
              className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[14px]"
            >
              {restriction.blocked ? (
                <Ban aria-hidden="true" className="size-4 text-danger" />
              ) : (
                <CircleCheck aria-hidden="true" className="size-4 text-success" />
              )}

              <span className="font-semibold text-ink">{restriction.channel}</span>

              <span className={restriction.blocked ? 'text-danger' : 'text-ink-muted'}>
                {restriction.blocked ? 'Do not contact' : 'Allowed'}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[13px] text-ink-muted">
        Resolved by the API for establishment {prospectId}.
      </p>
    </Card>
  );
}

/* A missing value is stated. A blank row reads as a failed load. */
function Field({ label, children }: { label: string; children: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line-soft pb-2 last:border-0">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-ink">{children ?? '—'}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the establishment</span>

      <div className="h-9 w-2/3 rounded bg-surface-muted" />
      <div className="h-24 rounded-xl bg-surface-muted" />

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="h-72 rounded-xl bg-surface-muted" />
        <div className="h-72 rounded-xl bg-surface-muted" />
      </div>

      <div className="h-40 rounded-xl bg-surface-muted" />
    </div>
  );
}

/*
 * 404 and 403 are different answers and get different pages. The API answers 404
 * for a record the caller may not see, so "not found" here honestly covers both
 * "no such establishment" and "not yours" — that is the API declining to disclose
 * which, and the page must not guess either.
 */
function FailureState({ error, onRetry }: { error: ApiError | Error; onRetry: () => void }) {
  const status = error instanceof ApiError ? error.statusCode : null;

  if (status === 404) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Establishment not found" />

        <Alert tone="info" title="This establishment is not in your référentiel.">
          It may have been archived, merged, or it may belong to another tenant.
        </Alert>

        <LinkButton href="/admin/prospects" variant="secondary" className="self-start">
          <ArrowLeft aria-hidden="true" className="mr-1.5 size-4" />
          Back to Prospects
        </LinkButton>
      </div>
    );
  }

  if (status === 403) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Fiche établissement" />

        {/* No fields are rendered above this: nothing was loaded to render. */}
        <Alert tone="danger" title="You do not have access to this establishment.">
          The shared référentiel is visible to tenant administrators.
        </Alert>

        <LinkButton href="/admin/prospects" variant="secondary" className="self-start">
          <ArrowLeft aria-hidden="true" className="mr-1.5 size-4" />
          Back to Prospects
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Fiche établissement" />

      <Alert tone="danger" title="We could not load this establishment.">
        {status === 401
          ? 'Your session has expired. Sign in again to continue.'
          : error.message || 'Try again in a moment.'}
      </Alert>

      <div className="flex gap-2">
        <Button onClick={onRetry}>
          <TriangleAlert aria-hidden="true" className="mr-1.5 size-4" />
          Try again
        </Button>

        <LinkButton href="/admin/prospects" variant="secondary">
          Back to Prospects
        </LinkButton>
      </div>
    </div>
  );
}
