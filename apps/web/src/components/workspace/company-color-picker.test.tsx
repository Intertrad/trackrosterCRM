// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CompanyColorPicker } from './company-color-picker';
vi.stubGlobal('React', React);
vi.mock('@/lib/i18n/i18n-context', () => ({ useTranslation: () => ({ language: 'en' }) }));
afterEach(cleanup);
it('offers named colors and returns the API hex value on selection', () => {
  const onChange = vi.fn();
  render(<CompanyColorPicker value="#05124A" onChange={onChange} />);
  expect(screen.getAllByRole('radio')).toHaveLength(12);
  expect((screen.getByRole('radio', { name: 'Navy' }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole('radio', { name: 'Purple' }));
  expect(onChange).toHaveBeenCalledWith('#7c3aed');
});
it('preserves an existing custom color until another is selected', () => {
  const onChange = vi.fn();
  render(<CompanyColorPicker value="#123456" onChange={onChange} />);
  expect((screen.getByRole('radio', { name: 'Current color' }) as HTMLInputElement).checked).toBe(
    true,
  );
  expect(onChange).not.toHaveBeenCalled();
});
