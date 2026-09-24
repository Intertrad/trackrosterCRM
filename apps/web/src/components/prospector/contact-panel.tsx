'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mail, MapPin, Phone, Star } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';
import { listProspectAddresses, listProspectContacts } from '@/lib/api/prospect-contact-client';
import type { ProspectAddress, ProspectContact } from '@/lib/api/prospect-contact-types';
import { contactDisplayName, formatAddress, sortContacts } from '@/lib/api/prospect-contact-types';
import { useTranslation } from '@/lib/i18n/i18n-context';

/**
 * Named people and postal addresses held against an establishment.
 *
 * The prospect record itself carries only a switchboard number, which is not
 * who a prospector is trying to reach. Both reads are keyed by establishment
 * id and authorised by the caller's own scope, so this shows exactly what the
 * viewer is entitled to see and nothing more.
 *
 * Read-only by design: the matching write endpoints sit behind
 * `ProspectWriteGuard` in a family the readiness audit has not certified.
 */
export function ContactPanel({ establishmentId }: { establishmentId: string }) {
  const { t } = useTranslation();

  const [contacts, setContacts] = useState<ProspectContact[] | null>(null);
  const [addresses, setAddresses] = useState<ProspectAddress[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      try {
        const [contactPage, addressPage] = await Promise.all([
          listProspectContacts(establishmentId, signal),
          listProspectAddresses(establishmentId, signal),
        ]);

        if (signal?.aborted) {
          return;
        }

        setContacts(sortContacts(contactPage.items));
        setAddresses(addressPage.items);
        setError(null);
      } catch (caught: unknown) {
        if (signal?.aborted) {
          return;
        }

        setContacts([]);
        setAddresses([]);

        /* Contact detail is separately authorised. A denial means this
           viewer may not see it — which is not a failure of the page. */
        if (
          caught instanceof ApiError &&
          (caught.statusCode === 403 || caught.statusCode === 404)
        ) {
          setDenied(true);

          return;
        }

        setError(t('contacts.loadError'));
      }
    },
    [establishmentId],
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  if (denied) {
    return null;
  }

  const loading = contacts === null || addresses === null;

  /* Nothing recorded is a normal state for a freshly imported prospect, and
     an empty card says less than no card at all. */
  if (!loading && !error && contacts.length === 0 && addresses.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader title={t('contacts.title')} />

      {loading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1].map((row) => (
            <div key={row} className="h-11 animate-pulse rounded-lg bg-line-soft" />
          ))}
        </div>
      ) : error ? (
        <p className="text-[14px] text-ink-muted">{error}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {contacts.length > 0 ? (
            <ul
              aria-label={t('contacts.named')}
              className="flex flex-col divide-y divide-line-soft"
            >
              {contacts.map((contact) => (
                <li key={contact.id} className="flex flex-col gap-1 py-2.5 first:pt-0">
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-navy">
                      {contactDisplayName(contact, t('contacts.unnamed'))}
                    </span>

                    {contact.isPrimary ? (
                      <Badge tone="brand">
                        <Star aria-hidden="true" className="mr-1 inline size-3" />
                        {t('contacts.primary')}
                      </Badge>
                    ) : null}
                  </span>

                  {contact.jobTitle ? (
                    <span className="text-[13px] text-ink-muted">{contact.jobTitle}</span>
                  ) : null}

                  <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {contact.phone ? (
                      <a
                        href={`tel:${contact.phone}`}
                        className="inline-flex items-center gap-1.5 text-[14px] text-brand hover:text-brand-hover"
                      >
                        <Phone aria-hidden="true" className="size-4" />
                        {contact.phone}
                      </a>
                    ) : null}

                    {contact.email ? (
                      <a
                        href={`mailto:${contact.email}`}
                        className="inline-flex min-w-0 items-center gap-1.5 text-[14px] text-brand hover:text-brand-hover"
                      >
                        <Mail aria-hidden="true" className="size-4 shrink-0" />

                        <span className="truncate">{contact.email}</span>
                      </a>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {addresses.length > 0 ? (
            <div>
              <h3 className="text-[13px] font-bold tracking-wide text-ink-muted uppercase">
                {t('contacts.addresses')}
              </h3>

              <ul aria-label={t('contacts.addresses')} className="mt-2 flex flex-col gap-2">
                {addresses.map((address) => (
                  <li key={address.id} className="flex items-start gap-2">
                    <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-muted" />

                    <span className="min-w-0 text-[14px] text-ink">
                      {address.label ? (
                        <span className="block text-[13px] font-semibold text-ink-soft">
                          {address.label}
                        </span>
                      ) : null}

                      {formatAddress(address)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
