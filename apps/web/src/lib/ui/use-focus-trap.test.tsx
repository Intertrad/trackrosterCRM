/* @vitest-environment jsdom */
import { useRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { useFocusTrap } from './use-focus-trap';

function Panel({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true, onClose);
  return (
    <div ref={ref} role="dialog" tabIndex={-1}>
      <input aria-label="Draft" />
      <button>Save</button>
      <fieldset disabled>
        <button>Unavailable</button>
      </fieldset>
    </div>
  );
}

afterEach(cleanup);
describe('overlay focus lifecycle', () => {
  it('only closes the top overlay when a detail panel opens a second drawer', () => {
    const outer = vi.fn(),
      inner = vi.fn();
    const first = render(<Panel onClose={outer} />);
    const second = render(<Panel onClose={inner} />);
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(inner).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();
    second.unmount();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(outer).toHaveBeenCalledOnce();
    first.unmount();
    expect(document.body.style.overflow).toBe('');
  });
  it('keeps focus during rerenders, uses the latest close handler, and restores the opener', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const first = vi.fn(),
      latest = vi.fn();
    const view = render(<Panel onClose={first} />);
    screen.getByLabelText('Draft').focus();
    view.rerender(<Panel onClose={latest} />);
    expect(screen.getByLabelText('Draft')).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
    view.unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
  it('skips controls disabled by a parent fieldset when wrapping focus', () => {
    render(<Panel onClose={vi.fn()} />);
    screen.getByRole('button', { name: 'Save' }).focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByLabelText('Draft')).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  });
});
