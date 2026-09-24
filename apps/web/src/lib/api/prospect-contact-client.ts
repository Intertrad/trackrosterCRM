import { browserJson } from './browser-json';
import type { ProspectAddressPage, ProspectContactPage } from './prospect-contact-types';

/**
 * Both endpoints key on the establishment id, which is what the work-queue
 * detail response exposes as `establishment.id`.
 */
export function listProspectContacts(
  establishmentId: string,
  signal?: AbortSignal,
): Promise<ProspectContactPage> {
  return browserJson<ProspectContactPage>(
    `/api/prospects/${encodeURIComponent(establishmentId)}/contacts`,
    { cache: 'no-store', signal },
  );
}

export function listProspectAddresses(
  establishmentId: string,
  signal?: AbortSignal,
): Promise<ProspectAddressPage> {
  return browserJson<ProspectAddressPage>(
    `/api/prospects/${encodeURIComponent(establishmentId)}/addresses`,
    { cache: 'no-store', signal },
  );
}
