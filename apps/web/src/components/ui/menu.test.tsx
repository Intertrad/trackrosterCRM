/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Menu, MenuItem, MenuLink } from './menu';

afterEach(cleanup);

function renderMenu(onSelect = vi.fn()) {
  return render(
    <>
      <button type="button">Outside</button>

      <Menu label="More for Garage Dupont" trigger={<span>⋯</span>}>
        {(close) => (
          <>
            <MenuLink href="/work-queue/c1/p1" onSelect={close}>
              View prospect
            </MenuLink>

            <MenuItem
              onSelect={() => {
                onSelect();
                close();
              }}
            >
              Release
            </MenuItem>
          </>
        )}
      </Menu>
    </>,
  );
}

describe('Menu', () => {
  it('stays closed until asked', () => {
    renderMenu();

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More for Garage Dupont' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('opens with the expected roles for assistive technology', () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'More for Garage Dupont' }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
  });

  it('closes on an outside click', () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'More for Garage Dupont' }));
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on Escape and hands focus back to the trigger', () => {
    renderMenu();

    const trigger = screen.getByRole('button', { name: 'More for Garage Dupont' });

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    /* Otherwise a keyboard user is dropped at the top of the document. */
    expect(trigger).toHaveFocus();
  });

  it('closes once an item has been chosen', () => {
    const onSelect = vi.fn();

    renderMenu(onSelect);

    fireEvent.click(screen.getByRole('button', { name: 'More for Garage Dupont' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Release' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('does not trap focus, because a menu is not modal', () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'More for Garage Dupont' }));

    const outside = screen.getByRole('button', { name: 'Outside' });

    outside.focus();

    /* Trapping here would make the menu harder to leave than to use. */
    expect(outside).toHaveFocus();
  });
});
