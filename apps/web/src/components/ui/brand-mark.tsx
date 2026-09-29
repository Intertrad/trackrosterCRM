import Image from 'next/image';
import { cn } from '@/lib/ui/cn';

/** Original artwork from the user-supplied TrackRoster frontend. */
export function BrandMark({
  className,
  hero = false,
}: {
  className?: string;
  tone?: 'light' | 'dark';
  hero?: boolean;
}) {
  return (
    <Image
      src="/brand/roster.png"
      alt=""
      aria-hidden="true"
      width={hero ? 208 : 38}
      height={hero ? 208 : 38}
      className={cn('shrink-0 object-contain', className)}
      priority
    />
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
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark />
      <span
        className={cn(
          'text-[19.2px] font-bold tracking-tight',
          tone === 'light' ? 'text-white' : 'text-navy',
        )}
      >
        TrackRoster
      </span>
    </span>
  );
}
