/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TextField } from './text-field';

afterEach(cleanup);

describe('TextField', () => {
  it('announces validation errors and associates them with the input', () => {
    render(<TextField label="Workspace name" error="Enter a workspace name" />);

    const input = screen.getByRole('textbox', { name: 'Workspace name' });
    const error = screen.getByRole('alert');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', error.id);
    expect(error).toHaveTextContent('Enter a workspace name');
  });
});
