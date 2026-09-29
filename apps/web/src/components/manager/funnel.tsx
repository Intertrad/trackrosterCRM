import { cn } from '@/lib/ui/cn';

export interface FunnelStage {
  label: string;
  value: number | null;
  caption: string;
}

/*
 * A proportional funnel. A stage whose value is null renders as unavailable
 * rather than zero, so a metric the API cannot supply is never read as a
 * genuine drop-off.
 */
export function Funnel({ stages }: { stages: FunnelStage[] }) {
  const top = stages[0]?.value ?? 0;

  return (
    <ol className="flex flex-col gap-2.5">
      {stages.map((stage, index) => {
        const width =
          stage.value === null || top === 0
            ? 100
            : Math.max(28, Math.round((stage.value / top) * 100));

        const unavailable = stage.value === null;

        return (
          <li key={stage.label} className="flex items-center gap-4">
            <span
              className={cn(
                'flex h-14 items-center justify-center rounded-lg text-[20px] font-bold tabular-nums',
                unavailable
                  ? 'bg-surface-muted text-ink-muted'
                  : index === stages.length - 1
                    ? 'bg-success-bg text-success'
                    : 'bg-brand-pale/55 text-navy',
              )}
              style={{ width: `${width}%`, minWidth: '5rem' }}
            >
              {unavailable ? '—' : stage.value}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-navy">{stage.label}</span>

              <span className="block text-[13px] text-ink-muted">{stage.caption}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
