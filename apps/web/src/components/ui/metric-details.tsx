'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Dialog } from './dialog';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';
import { cn } from '@/lib/ui/cn';
export function MetricDetails({
  label,
  value,
  description,
  details,
  href,
  className,
  children,
  hideValue = false,
}: {
  label: string;
  value: string | number | null;
  description?: string;
  details?: ReactNode;
  href?: string;
  className?: string;
  children: ReactNode;
  hideValue?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { language } = useTranslation();
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={text(`View details: ${label}`, `Voir le détail : ${label}`, language)}
        onClick={() => setOpen(true)}
        className={cn(
          'w-full cursor-pointer text-left transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
          className,
        )}
      >
        {children}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={label} description={description}>
        {!hideValue ? (
          <p className="text-3xl font-bold text-navy tabular-nums">{value ?? '—'}</p>
        ) : null}
        {value === null || value === '—' ? (
          <p className="text-sm text-ink-muted">
            {text(
              'Data is currently unavailable.',
              'Les données sont actuellement indisponibles.',
              language,
            )}
          </p>
        ) : (
          details
        )}
        {href ? (
          <Link
            href={href}
            onClick={() => setOpen(false)}
            className="text-sm font-semibold text-brand underline"
          >
            {text('View related records', 'Voir les éléments correspondants', language)}
          </Link>
        ) : null}
      </Dialog>
    </>
  );
}
