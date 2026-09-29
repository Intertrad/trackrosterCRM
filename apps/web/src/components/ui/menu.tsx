'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/ui/cn';

/**
 * A popup menu anchored to a trigger.
 *
 * Every screen that needed one was reimplementing the same outside-click and
 * Escape handling, each slightly differently — this is the one copy. It is
 * deliberately not a focus trap: a menu is not modal, and trapping focus in
 * one makes it harder to leave than to use.
 */
export function Menu({
  trigger,
  label,
  children,
  align = 'end',
  className,
}: {
  /** Rendered inside the trigger button. */
  trigger: ReactNode;

  /** Accessible name for the trigger. */
  label: string;

  /** Menu items; `MenuItem` and `MenuLink` render the expected roles. */
  children: ReactNode | ((close: () => void) => ReactNode);

  align?: 'start' | 'end';
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent): void {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setOpen(false);

        /* Back to the trigger, not to the top of the document. */
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-lg text-ink-muted',
          'transition-colors duration-150 hover:bg-surface-muted hover:text-ink',
        )}
      >
        {trigger}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={label}
          className={cn(
            'absolute z-20 mt-1 w-52 overflow-hidden rounded-xl',
            'border border-line-soft bg-surface shadow-lg',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>
      ) : null}
    </div>
  );
}

const ITEM = cn(
  'flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] font-semibold',
  'transition-colors duration-150 hover:bg-surface-muted',
);

export function MenuItem({
  icon,
  onSelect,
  tone = 'default',
  disabled,
  children,
}: {
  icon?: ReactNode;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        ITEM,
        tone === 'danger' ? 'text-danger' : 'text-ink',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/** A menu entry that navigates, keeping client-side routing and prefetch. */
export function MenuLink({
  href,
  icon,
  onSelect,
  children,
}: {
  href: string;
  icon?: ReactNode;
  onSelect?: () => void;
  children: ReactNode;
}) {
  return (
    <Link role="menuitem" href={href} onClick={onSelect} className={cn(ITEM, 'text-ink')}>
      {icon}
      {children}
    </Link>
  );
}
