import { AsyncLocalStorage } from 'node:async_hooks';

export interface WorkerTenantContext {
  tenantId: string;
  jobId: string;
  jobName: string;
}

const storage = new AsyncLocalStorage<WorkerTenantContext>();

export function setWorkerTenantContext(context: WorkerTenantContext): void {
  storage.enterWith(context);
}

export function getWorkerTenantContext(): WorkerTenantContext | undefined {
  return storage.getStore();
}
