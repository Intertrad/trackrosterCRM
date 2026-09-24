import type { ReactNode } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/ui/cn';

type LinkButtonVariant = 'primary' | 'secondary';

const VARIANTS: Record<LinkButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover',
  secondary: 'bg-brand-wash text-brand border border-transparent hover:bg-brand-tint',
};

/*
 * A navigation control that looks like a button. Kept separate from Button so
 * an anchor is never given button semantics (or the reverse), which breaks
 * middle-click, open-in-new-tab and screen-reader announcements.
 */
export function LinkButton({
  href,
  variant = 'secondary',
  className,
  children,
}: {
  href: string;
  variant?: LinkButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4',
        'text-[15px] font-semibold transition-colors duration-150',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}
