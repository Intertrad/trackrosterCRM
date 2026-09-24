import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestTenantContext {
  tenantId: string;
  membershipId: string;
  identityId: string;
}

const storage = new AsyncLocalStorage<RequestTenantContext>();

export function setRequestTenantContext(context: RequestTenantContext): void {
  storage.enterWith(context);
}

export function getRequestTenantContext(): RequestTenantContext | undefined {
  return storage.getStore();
}
