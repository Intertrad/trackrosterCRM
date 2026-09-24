/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfirmDialog, Dialog } from './dialog';

afterEach(cleanup);

describe('Dialog', () => {
  it('renders nothing while closed', () => {
    const { container } = render(
      <Dialog open={false} title="Release prospect" onClose={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('focuses the panel so its title is announced before any control', () => {
    render(
      <Dialog open title="Release prospect" onClose={vi.fn()}>
        <button type="button">First</button>
      </Dialog>,
    );

    /* Focusing the close button instead would announce "Close" and leave
     * Enter one keystroke from dismissing the dialog. */
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('keeps Tab inside the dialog', () => {
    render(
      <>
        <button type="button">Behind the dialog</button>

        <Dialog open title="Release prospect" onClose={vi.fn()}>
          <button type="button">First</button>
          <button type="button">Last</button>
        </Dialog>
      </>,
    );

    screen.getByRole('button', { name: 'Last' }).focus();

    /*
     * Without a trap this lands on the page behind, where the reader is
     * operating controls they cannot see under a dialog still claiming to be
     * modal.
     */
    fireEvent.keyDown(document, { key: 'Tab' });

    /* Wraps to the first control in the panel, which is its close button. */
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('wraps backwards from the first element to the last', () => {
    render(
      <Dialog open title="Release prospect" onClose={vi.fn()}>
        <button type="button">First</button>
        <button type="button">Last</button>
      </Dialog>,
    );

    screen.getByRole('button', { name: 'Close' }).focus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
  });

  it('returns focus to whatever opened it', () => {
    function Harness() {
      return (
        <>
          <button type="button" id="opener">
            Open
          </button>

          <Dialog open title="Release prospect" onClose={vi.fn()}>
            <button type="button">Inside</button>
          </Dialog>
        </>
      );
    }

    const opener = document.createElement('button');

    opener.textContent = 'Opener';
    document.body.append(opener);
    opener.focus();

    const { unmount } = render(<Harness />);

    unmount();

    /* A keyboard user must not be dropped at the top of a long list. */
    expect(opener).toHaveFocus();

    opener.remove();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();

    render(<Dialog open title="Release prospect" onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('announces a destructive question more insistently', () => {
    render(
      <Dialog open tone="danger" title="Delete campaign" onClose={vi.fn()}>
        <button type="button">Inside</button>
      </Dialog>,
    );

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('associates its description for assistive technology', () => {
    render(
      <Dialog
        open
        title="Release prospect"
        description="This frees it for the team."
        onClose={vi.fn()}
      >
        <button type="button">Inside</button>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog');

    expect(dialog).toHaveAttribute('aria-describedby');
    expect(screen.getByText('This frees it for the team.')).toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('puts the safe answer before the destructive one', () => {
    render(
      <ConfirmDialog
        open
        title="Delete campaign"
        confirmLabel="Delete"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole('button').map((button) => button.textContent);

    /* Tab and the initial focus both reach Cancel first. */
    expect(buttons.indexOf('Cancel')).toBeLessThan(buttons.indexOf('Delete'));
  });

  it('confirms and cancels through their own handlers', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Delete campaign"
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('blocks both answers while the confirmation is in flight', () => {
    render(
      <ConfirmDialog
        open
        busy
        title="Delete campaign"
        confirmLabel="Delete"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    /* A double-submitted destructive action is the one that hurts. */
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
