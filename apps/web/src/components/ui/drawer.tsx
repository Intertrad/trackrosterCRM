'use client';

import { type ReactNode, useRef } from 'react';
import { X } from 'lucide-react';

import { useTranslation } from '@/lib/i18n/i18n-context';
import { cn } from '@/lib/ui/cn';
import { useFocusTrap } from '@/lib/ui/use-focus-trap';

/*
 * Right-hand drawer used for action completion and detail panels.
 *
 * Focus is trapped and restored by the shared hook the dialog also uses —
 * this previously only moved focus in, so Tab walked straight out into the
 * page behind a panel that still called itself modal.
 */
export function Drawer({
  open,
  title,
  onClose,
  children,
  footer,
  headerAccessory,
  width = 'default',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  headerAccessory?: ReactNode;
  width?: 'default' | 'prospect';
}) {
  const { t } = useTranslation();

  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(panelRef, open, onClose);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/*
        Decorative: clicking away dismisses, but the backdrop carries no
        accessible name of its own. As a labelled button it was a second
        "Close" control the size of the screen, which a screen reader
        announced before the real one. Keyboard users have Escape and the
        close button in the header.
      */}
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-navy/35" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative flex h-full w-full flex-col bg-surface shadow-overlay',
          width === 'prospect' ? 'max-w-[720px]' : 'max-w-[520px]',
          'outline-none',
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line-soft px-5 py-4 sm:px-6">
          <h2 className="text-[20px] font-bold tracking-[-0.02em] text-navy">{title}</h2>

          <div className="flex shrink-0 items-center gap-3">
            {headerAccessory}

            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="text-ink-muted transition-colors hover:text-ink"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

        {footer ? (
          <footer
            className="border-t border-line-soft px-5 py-4 sm:px-6"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
          >
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
