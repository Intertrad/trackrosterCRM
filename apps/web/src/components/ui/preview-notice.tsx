import { FlaskConical } from 'lucide-react';

import { cn } from '@/lib/ui/cn';

/*
 * Marks a screen whose figures are placeholders rather than API data. Without
 * this a reviewer could read placeholder numbers as production data, which is
 * the one way a design-first build goes wrong.
 */
export function PreviewNotice({ className }: { className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        'flex items-center gap-2.5 rounded-lg border border-warning-border bg-warning-bg px-4 py-2.5',
        className,
      )}
    >
      <FlaskConical aria-hidden="true" className="size-[18px] shrink-0 text-warning" />

      <p className="text-[13px] text-ink-soft">
        <strong className="font-semibold text-ink">Preview data.</strong> Figures on this screen are
        placeholders pending API integration.
      </p>
    </div>
  );
}

export function PreviewTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded bg-warning-bg px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-warning uppercase',
        className,
      )}
    >
      Preview
    </span>
  );
}
