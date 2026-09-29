import { cn } from '@/lib/ui/cn';

export function MemberCell({
  initials,
  name,
  location,
  className,
}: {
  initials: string;
  name: string;
  location: string;
  className?: string;
}) {
  return (
    <span className={cn('flex items-center gap-3', className)}>
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[13px] font-bold text-brand"
      >
        {initials}
      </span>

      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold text-navy">{name}</span>

        <span className="flex items-center gap-1.5 text-[13px] text-ink-muted">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
          {location}
        </span>
      </span>
    </span>
  );
}
