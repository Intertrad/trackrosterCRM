'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Elements a keyboard can reach, in document order.
 *
 * `disabled` controls and `tabindex="-1"` are excluded because neither takes
 * sequential focus.
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableWithin(container: HTMLElement): HTMLElement[] {
  /*
   * Deliberately not a layout check. `offsetParent` is null for everything
   * inside a `position: fixed` overlay — which is every dialog and drawer in
   * this product — so measuring visibility that way excludes the entire
   * panel. The selector already drops disabled and `tabindex="-1"`; what is
   * left to exclude is content explicitly marked as hidden.
   */
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => !element.closest('[hidden], [aria-hidden="true"]'),
  );
}

/**
 * Keeps keyboard focus inside an open overlay, and puts it back afterwards.
 *
 * Without this, Tab walks out of a modal into the page behind it: the reader
 * is then operating controls they cannot see, under a dialog that still
 * claims to be modal. Escape closes, and focus returns to whatever opened the
 * overlay so a keyboard user is not dropped at the top of a long list.
 *
 * Shared rather than reimplemented per overlay, because this is the part that
 * is easy to get subtly wrong and impossible to notice with a mouse.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;

    /*
     * The panel itself, not its first control.
     *
     * The first focusable in an overlay is usually its close button, so
     * focusing it would announce "Close" instead of what the overlay is for,
     * and put Enter one keystroke from dismissing it. Focusing the panel lets
     * the title be read first; Tab then moves through the controls in order.
     */
    containerRef.current?.focus();

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();

        return;
      }

      if (event.key !== 'Tab' || !containerRef.current) {
        return;
      }

      const focusable = focusableWithin(containerRef.current);

      if (focusable.length === 0) {
        /* Nothing to cycle through; hold focus on the panel rather than
         * letting Tab leave the overlay entirely. */
        event.preventDefault();
        containerRef.current.focus();

        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === containerRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);

      /* The opener can be gone by now — a row that the action removed. */
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [containerRef, onClose, open]);
}
