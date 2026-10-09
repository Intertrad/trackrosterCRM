/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Button } from './button';

afterEach(cleanup);

describe('Button', () => {
  it('keeps a stable icon slot while loading changes', () => {
    const { rerender } = render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    const iconSlot = button.firstElementChild;

    rerender(<Button loading>Save</Button>);

    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.firstElementChild).toBe(iconSlot);
    expect(iconSlot).toHaveClass('inline-flex');
  });
});
