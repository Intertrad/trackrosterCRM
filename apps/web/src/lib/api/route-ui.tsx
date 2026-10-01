import { Badge } from '@/components/ui/badge';
import { ApiError } from './api-error';
import type { RouteStatus } from './route-types';

export function RouteStatusBadge({ status }: { status: RouteStatus }) {
  switch (status) {
    case 'active':
      return (
        <Badge tone="brand" dot>
          In progress
        </Badge>
      );
    case 'completed':
      return <Badge tone="success">Completed</Badge>;
    case 'cancelled':
      return <Badge tone="neutral">Cancelled</Badge>;
    default:
      return <Badge tone="warning">Planned</Badge>;
  }
}

export function formatScheduled(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
}

export function describeRouteError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 409 || error.statusCode === 412) {
    return 'This round changed elsewhere. Reload before trying again.';
  }

  if (error.statusCode === 403) {
    return 'You are not authorized to manage rounds for this team.';
  }

  if (error.statusCode === 400) {
    return error.messages.join(' ');
  }

  return 'We could not load your rounds. Please try again.';
}
