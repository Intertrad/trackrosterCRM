import { Badge } from '@/components/ui/badge';
import { ApiError } from './api-error';
import type { ImportStatus } from './import-types';

export function ImportStatusBadge({ status }: { status: ImportStatus }) {
  switch (status) {
    case 'committed':
      return <Badge tone="success">Committed</Badge>;
    case 'validated':
      return <Badge tone="warning">Awaiting commit</Badge>;
    case 'uploaded':
      return <Badge tone="brand">Needs validation</Badge>;
    case 'cancelled':
      return <Badge tone="neutral">Cancelled</Badge>;
    default:
      return <Badge tone="neutral">Draft</Badge>;
  }
}

export function describeImportError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 403) {
    return 'Imports require tenant administrator access.';
  }

  if (error.statusCode === 413) {
    return 'That file is larger than the 5 MB limit.';
  }

  if (error.statusCode === 409 || error.statusCode === 412) {
    return 'This import changed elsewhere. Reload the page before continuing.';
  }

  if (error.statusCode === 400) {
    return error.messages.join(' ');
  }

  return 'We could not reach TrackRoster. Please try again.';
}
