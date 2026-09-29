import type { WorkQueueLifecycleStage } from '@/lib/api/work-queue-types';

export type LifecycleStageKey = WorkQueueLifecycleStage;
import type { MessageKey } from '@/lib/i18n/dictionary';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { cn } from '@/lib/ui/cn';

/*
 * The lifecycle colours double as the map legend, so the palette lives here
 * and every screen reads it rather than restating hex values.
 */
export const LIFECYCLE_STYLES = {
  to_contact: { label: 'stage.to_contact', dot: 'bg-brand', chip: 'bg-brand-tint text-brand' },
  contact_made: {
    label: 'stage.contact_made',
    dot: 'bg-brand-mid',
    chip: 'bg-brand-tint text-brand',
  },
  in_progress: {
    label: 'stage.in_progress',
    dot: 'bg-brand-mid',
    chip: 'bg-brand-tint text-brand',
  },
  follow_up: { label: 'stage.follow_up', dot: 'bg-warning', chip: 'bg-warning-bg text-warning' },
  qualified: { label: 'stage.qualified', dot: 'bg-lime-deep', chip: 'bg-success-bg text-success' },
  converted: { label: 'stage.converted', dot: 'bg-success', chip: 'bg-success-bg text-success' },
} as const satisfies Record<
  WorkQueueLifecycleStage,
  { label: MessageKey; dot: string; chip: string }
>;

export const LIFECYCLE_ORDER: WorkQueueLifecycleStage[] = [
  'to_contact',
  'contact_made',
  'in_progress',
  'follow_up',
  'qualified',
  'converted',
];

/** The message key for a stage; call sites translate it themselves. */
export function getLifecycleLabelKey(stage: WorkQueueLifecycleStage): MessageKey {
  return LIFECYCLE_STYLES[stage].label;
}

export function LifecycleBadge({
  stage,
  className,
}: {
  stage: WorkQueueLifecycleStage;
  className?: string;
}) {
  const { t } = useTranslation();

  const style = LIFECYCLE_STYLES[stage];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-semibold',
        style.chip,
        className,
      )}
    >
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', style.dot)} />
      {t(style.label)}
    </span>
  );
}

export function LifecycleDot({ stage }: { stage: WorkQueueLifecycleStage }) {
  return (
    <span
      aria-hidden="true"
      className={cn('size-2.5 shrink-0 rounded-full', LIFECYCLE_STYLES[stage].dot)}
    />
  );
}
