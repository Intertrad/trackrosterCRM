export type NotificationSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface NotificationItem {
  id: string;
  type: string;
  severity: NotificationSeverity;
  title: string;
  message: string | null;
  followUpId: string | null;
  scheduledFor: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  items: NotificationItem[];
  nextCursor: string | null;
}

export interface ListNotificationsQuery {
  severity?: NotificationSeverity;
  readState?: 'read' | 'unread' | 'all';
  cursor?: string;
  limit?: number;
}

/*
 * The dossier locks collision, opposition and security alerts on. Severity
 * drives presentation only — it must never be used to suppress an alert.
 */
export const SEVERITY_TONE: Record<NotificationSeverity, 'neutral' | 'warning' | 'danger'> = {
  info: 'neutral',
  warning: 'warning',
  error: 'danger',
  critical: 'danger',
};
