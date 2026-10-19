'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';

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
  placement = 'below',
  className,
}: {
  /** Rendered inside the trigger button. */
  trigger: ReactNode;

  /** Accessible name for the trigger. */
  label: string;

  /** Menu items; `MenuItem` and `MenuLink` render the expected roles. */
  children: ReactNode | ((close: () => void) => ReactNode);

  align?: 'start' | 'end';
  placement?: 'below' | 'request-actions';
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const [position, setPosition] = useState({ left: 0, top: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || placement !== 'request-actions') return;

    function updatePosition() {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const menu = menuRef.current?.getBoundingClientRect();
      if (!trigger || !menu) return;
      const gap = 4;
      const padding = 8;
      const fitsBelow = trigger.top + menu.height <= window.innerHeight - padding;
      setPosition({
        left: Math.max(
          padding,
          Math.min(trigger.right + gap, window.innerWidth - menu.width - padding),
        ),
        top: Math.max(padding, fitsBelow ? trigger.top : trigger.bottom - menu.height),
      });
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, placement]);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent): void {
      if (
        !containerRef.current?.contains(event.target as Node) &&
        !menuRef.current?.contains(event.target as Node)
      ) {
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

  const popup = (
    <div
      ref={menuRef}
      role="menu"
      aria-label={label}
      style={placement === 'request-actions' ? position : undefined}
      className={cn(
        'z-20 w-52 max-w-[calc(100vw-16px)] overflow-hidden rounded-xl',
        'border border-line-soft bg-surface shadow-lg',
        placement === 'request-actions'
          ? 'fixed'
          : cn('absolute mt-1', align === 'end' ? 'right-0' : 'left-0'),
      )}
    >
      {typeof children === 'function' ? children(close) : children}
    </div>
  );

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

      {open ? (placement === 'request-actions' ? createPortal(popup, document.body) : popup) : null}
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
