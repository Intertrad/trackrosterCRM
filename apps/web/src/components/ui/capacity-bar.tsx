import { cn } from '@/lib/ui/cn';

/*
 * Capacity is workload against an individual target. The bar never exceeds
 * 100% visually but the label keeps the true figure, so an overloaded member
 * is obvious rather than silently clamped.
 */
export function CapacityBar({
  percent,
  className,
}: {
  percent: number | null;
  className?: string;
}) {
  if (percent === null) {
    return <span className={cn('text-[14px] text-ink-muted', className)}>—</span>;
  }

  const clamped = Math.max(0, Math.min(100, percent));

  const tone = percent >= 95 ? 'bg-danger' : percent >= 85 ? 'bg-warning' : 'bg-success';

  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Capacity used"
        className="block h-2 w-20 shrink-0 overflow-hidden rounded-full bg-line-soft"
      >
        <span
          className={cn('block h-full rounded-full transition-[width] duration-300', tone)}
          style={{ width: `${clamped}%` }}
        />
      </span>

      <span className="text-[14px] font-semibold text-ink tabular-nums">{percent}%</span>
    </span>
  );
}
