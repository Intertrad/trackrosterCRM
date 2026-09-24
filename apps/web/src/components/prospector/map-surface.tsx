import type { ReactNode } from 'react';
import { MapPinned } from 'lucide-react';

import { LIFECYCLE_ORDER, LIFECYCLE_STYLES } from '@/components/prospector/lifecycle-badge';
import { cn } from '@/lib/ui/cn';

/*
 * The map canvas and its legend.
 *
 * No tile provider or marker layer is mounted yet: no prospector-reachable
 * endpoint returns coordinates. GET /establishments/nearby is the only
 * geospatial route and it sits behind ClientAdminGuard, and work-queue items
 * carry no latitude/longitude. Rendering invented pins here would contradict
 * the design spec's rule that out-of-scope records stay unavailable, so the
 * surface states the dependency instead.
 */
export function MapSurface({
  title,
  description,
  footer,
  className,
}: {
  title: string;
  description: string;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-[380px] flex-col overflow-hidden rounded-xl border border-line-soft bg-surface-muted',
        className,
      )}
    >
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <MapPinned aria-hidden="true" className="size-10 text-brand-pale" />

        <p className="mt-4 text-[17px] font-bold text-navy">{title}</p>

        <p className="mt-1.5 max-w-md text-[14px] text-ink-soft">{description}</p>
      </div>

      {footer ?? <MapLegend />}
    </div>
  );
}

export function MapLegend({ includeUnavailable = true }: { includeUnavailable?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line-soft bg-surface px-4 py-3">
      {LIFECYCLE_ORDER.map((stage) => (
        <span key={stage} className="inline-flex items-center gap-2 text-[13px] text-ink-soft">
          <span
            aria-hidden="true"
            className={cn('size-2.5 rounded-full', LIFECYCLE_STYLES[stage].dot)}
          />
          {LIFECYCLE_STYLES[stage].label}
        </span>
      ))}

      {includeUnavailable ? (
        <span className="inline-flex items-center gap-2 text-[13px] text-ink-soft">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-line" />
          Unavailable (out of scope)
        </span>
      ) : null}
    </div>
  );
}
