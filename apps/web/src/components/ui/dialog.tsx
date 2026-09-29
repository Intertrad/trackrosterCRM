'use client';

import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { cn } from '@/lib/ui/cn';
import { useFocusTrap } from '@/lib/ui/use-focus-trap';

/**
 * A centred modal, for decisions that cannot wait and do not need a panel.
 *
 * The drawer is the right shape for editing something alongside its context;
 * this is the right shape for a question. Both share one focus trap so the
 * keyboard behaviour cannot drift between them.
 */
export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  tone = 'default',
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;

  /** `danger` styles the heading for a destructive confirmation. */
  tone?: 'default' | 'danger';
}) {
  const { t } = useTranslation();

  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(panelRef, open, onClose);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      {/*
        Decorative: clicking away dismisses, but the backdrop carries no
        accessible name of its own. As a labelled button it was a second
        "Close" control the size of the screen, which a screen reader
        announced before the real one. Keyboard users have Escape and the
        close button in the header.
      */}
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-navy/45" />

      <div
        ref={panelRef}
        /* `alertdialog` when the answer is destructive: assistive technology
           announces it more insistently than a plain dialog. */
        role={tone === 'danger' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-label={title}
        aria-describedby={description ? 'trackroster-dialog-description' : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex w-full max-w-[460px] flex-col gap-4 bg-surface outline-none shadow-overlay',
          'rounded-t-2xl px-5 pt-5 sm:rounded-2xl sm:px-6 sm:pt-6',
        )}
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            className={cn(
              'text-[19px] font-bold tracking-[-0.015em]',
              tone === 'danger' ? 'text-danger' : 'text-navy',
            )}
          >
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="shrink-0 text-ink-muted transition-colors hover:text-ink"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        {description ? (
          <p id="trackroster-dialog-description" className="text-[15px] text-ink-soft">
            {description}
          </p>
        ) : null}

        {children}

        {footer ? <div className="flex flex-wrap justify-end gap-2.5">{footer}</div> : null}
      </div>
    </div>
  );
}

/**
 * The common case: a question with a cancel and a confirm.
 *
 * Cancel comes first in the DOM so Escape and Tab both reach the safe answer
 * before the destructive one.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
  busy = false,
  tone = 'danger',
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
  tone?: 'default' | 'danger';
}) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      tone={tone}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>

          <Button size="md" loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
