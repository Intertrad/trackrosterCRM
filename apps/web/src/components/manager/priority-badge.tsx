import { cn } from '@/lib/ui/cn';

const PRIORITIES = {
  high: { label: 'High', dot: 'bg-danger', text: 'text-ink' },
  medium: { label: 'Medium', dot: 'bg-warning', text: 'text-ink' },
  low: { label: 'Low', dot: 'bg-success', text: 'text-ink' },
} as const;

export function PriorityBadge({
  priority,
  className,
}: {
  priority: keyof typeof PRIORITIES;
  className?: string;
}) {
  const config = PRIORITIES[priority];

  return (
    <span className={cn('inline-flex items-center gap-2 text-[14px]', config.text, className)}>
      <span aria-hidden="true" className={cn('size-2 rounded-full', config.dot)} />
      {config.label}
    </span>
  );
}

const AVAILABILITY = {
  high: 'bg-success-bg text-success',
  medium: 'bg-warning-bg text-warning',
  low: 'bg-danger-bg text-danger',
} as const;

export function AvailabilityBadge({ availability }: { availability: keyof typeof AVAILABILITY }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2.5 py-1 text-[13px] font-semibold capitalize',
        AVAILABILITY[availability],
      )}
    >
      {availability}
    </span>
  );
}
