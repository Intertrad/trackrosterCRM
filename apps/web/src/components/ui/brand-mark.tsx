import { cn } from '@/lib/ui/cn';

/*
 * The 3 x 3 grid is a functional code in the product system: separated
 * cells stand for clear distribution with no overlap and no collision
 * (dossier p.4). The lit cells follow the approved handoff artwork.
 */
const LIT_CELLS = new Set([0, 1, 2, 3, 5, 6, 7, 8]);
const ACCENT_CELLS = new Set([6, 7, 8]);

export function BrandMark({
  className,
  tone = 'light',
}: {
  className?: string;
  tone?: 'light' | 'dark';
}) {
  return (
    <span aria-hidden="true" className={cn('grid grid-cols-3 gap-[3px]', className)}>
      {Array.from({ length: 9 }, (_, index) => (
        <span
          key={index}
          className={cn(
            'block size-[9px] rounded-[2px]',
            !LIT_CELLS.has(index) && 'opacity-0',
            ACCENT_CELLS.has(index) ? 'bg-brand' : tone === 'light' ? 'bg-white' : 'bg-navy',
          )}
        />
      ))}
    </span>
  );
}

export function BrandLockup({
  className,
  tone = 'light',
}: {
  className?: string;
  tone?: 'light' | 'dark';
}) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <BrandMark tone={tone} />

      <span
        className={cn(
          'text-[22px] font-bold tracking-[-0.02em]',
          tone === 'light' ? 'text-white' : 'text-navy',
        )}
      >
        TrackRoster
      </span>
    </span>
  );
}
