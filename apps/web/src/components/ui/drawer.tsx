'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/ui/cn';

/*
 * Right-hand drawer used for action completion and detail panels. It traps
 * focus and restores it on close so a keyboard user is never dropped back at
 * the top of a long list after logging an outcome.
 */
export function Drawer({
  open,
  title,
  onClose,
  children,
  footer,
  headerAccessory,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  headerAccessory?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-navy/35"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative flex h-full w-full max-w-[520px] flex-col bg-surface shadow-overlay',
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
              aria-label="Close panel"
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
