import { cn } from '@/lib/ui/cn';

export interface BarLinePoint {
  label: string;
  bar: number;
  line: number;
}

/*
 * Bars on a left axis with a percentage line on the right, drawn as inline SVG
 * so no charting dependency enters the bundle. The chart is described in text
 * for assistive technology instead of being announced as a wall of numbers.
 */
export function BarLineChart({
  points,
  barLabel,
  lineLabel,
  className,
}: {
  points: BarLinePoint[];
  barLabel: string;
  lineLabel: string;
  className?: string;
}) {
  const width = 480;
  const height = 240;
  const padding = { top: 18, right: 42, bottom: 44, left: 40 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const maxBar = Math.max(1, ...points.map((point) => point.bar));
  const barMax = Math.ceil(maxBar / 40) * 40;

  const slotWidth = plotWidth / Math.max(1, points.length);
  const barWidth = Math.min(64, slotWidth * 0.5);

  const x = (index: number) => padding.left + slotWidth * index + slotWidth / 2;
  const barY = (value: number) => padding.top + plotHeight - (value / barMax) * plotHeight;
  const lineY = (value: number) => padding.top + plotHeight - (value / 100) * plotHeight;

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${lineY(point.line)}`)
    .join(' ');

  const gridValues = [0, 0.25, 0.5, 0.75, 1];

  return (
    <figure className={cn('w-full', className)}>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${barLabel} and ${lineLabel} by period: ${points
            .map((point) => `${point.label}, ${point.bar} ${barLabel}, ${point.line}% ${lineLabel}`)
            .join('; ')}`}
          className="h-auto w-full min-w-[420px]"
        >
          {gridValues.map((ratio) => {
            const y = padding.top + plotHeight * (1 - ratio);

            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={y}
                  y2={y}
                  stroke="var(--color-line-soft)"
                  strokeWidth={1}
                />

                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-[var(--color-ink-muted)] text-[11px]"
                >
                  {Math.round(barMax * ratio)}
                </text>

                <text
                  x={width - padding.right + 8}
                  y={y + 4}
                  className="fill-[var(--color-ink-muted)] text-[11px]"
                >
                  {Math.round(100 * ratio)}%
                </text>
              </g>
            );
          })}

          {points.map((point, index) => (
            <g key={point.label}>
              <rect
                x={x(index) - barWidth / 2}
                y={barY(point.bar)}
                width={barWidth}
                height={padding.top + plotHeight - barY(point.bar)}
                rx={4}
                fill="var(--color-brand)"
              />

              <text
                x={x(index)}
                y={barY(point.bar) - 7}
                textAnchor="middle"
                className="fill-[var(--color-navy)] text-[12px] font-bold"
              >
                {point.bar}
              </text>

              <text
                x={x(index)}
                y={height - padding.bottom + 18}
                textAnchor="middle"
                className="fill-[var(--color-ink-muted)] text-[11px]"
              >
                {point.label}
              </text>
            </g>
          ))}

          <path d={linePath} fill="none" stroke="var(--color-success)" strokeWidth={2} />

          {points.map((point, index) => (
            <g key={`${point.label}-point`}>
              <circle cx={x(index)} cy={lineY(point.line)} r={4.5} fill="var(--color-success)" />

              <text
                x={x(index)}
                y={lineY(point.line) + 20}
                textAnchor="middle"
                className="fill-[var(--color-success)] text-[11px] font-semibold"
              >
                {point.line}%
              </text>
            </g>
          ))}
        </svg>
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center justify-center gap-5 text-[13px] text-ink-soft">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-brand" />
          {barLabel}
        </span>

        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="h-0.5 w-5 rounded bg-success" />
          {lineLabel}
        </span>
      </figcaption>
    </figure>
  );
}
