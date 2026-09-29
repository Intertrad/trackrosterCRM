import { browserJson } from './browser-json';
import type { AdminDashboard } from './admin-types';

export function getAdminDashboard(signal?: AbortSignal): Promise<AdminDashboard> {
  return browserJson<AdminDashboard>('/api/dashboard/admin', { cache: 'no-store', signal });
}
