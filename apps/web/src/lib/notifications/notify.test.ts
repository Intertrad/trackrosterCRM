import { beforeEach, describe, expect, it, vi } from 'vitest';

const sonner = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    promise: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock('sonner', () => sonner);

import { notify } from './notify';

describe('notify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes each notification type through the shared defaults', () => {
    notify.success('Saved');
    notify.error('Failed');
    notify.warning('Check this');
    notify.info('Preparing');
    notify.loading('Uploading');

    expect(sonner.toast.success).toHaveBeenCalledWith('Saved', {
      duration: 4000,
    });
    expect(sonner.toast.error).toHaveBeenCalledWith('Failed', {
      duration: 6500,
    });
    expect(sonner.toast.warning).toHaveBeenCalledWith('Check this', {
      duration: 6000,
    });
    expect(sonner.toast.info).toHaveBeenCalledWith('Preparing', {
      duration: 5000,
    });
    expect(sonner.toast.loading).toHaveBeenCalledWith('Uploading', {
      duration: Infinity,
    });
  });

  it('passes a stable id, safe description, and retry action', () => {
    const retry = vi.fn();

    notify.error('Unable to save', {
      id: 'settings-save',
      description: 'Please try again.',
      requestId: 'req-123',
      action: { label: 'Retry', onClick: retry },
    });

    expect(sonner.toast.error).toHaveBeenCalledWith('Unable to save', {
      id: 'settings-save',
      description: 'Please try again. · Reference: req-123',
      duration: 6500,
      action: { label: 'Retry', onClick: retry },
    });
  });

  it('uses Sonner ids to deduplicate repeated failures and supports transitions', () => {
    const promise = Promise.resolve('done');
    notify.error('Network unavailable', { id: 'portfolio-load' });
    notify.error('Network unavailable', { id: 'portfolio-load' });
    notify.promise(promise, {
      id: 'report-export',
      loading: 'Preparing report…',
      success: 'Report ready.',
      error: 'Report failed.',
    });

    expect(sonner.toast.error).toHaveBeenCalledTimes(2);
    expect(sonner.toast.error).toHaveBeenNthCalledWith(1, 'Network unavailable', {
      id: 'portfolio-load',
      duration: 6500,
    });
    expect(sonner.toast.error).toHaveBeenNthCalledWith(2, 'Network unavailable', {
      id: 'portfolio-load',
      duration: 6500,
    });
    expect(sonner.toast.promise).toHaveBeenCalledWith(promise, {
      id: 'report-export',
      loading: 'Preparing report…',
      success: 'Report ready.',
      error: 'Report failed.',
    });
  });

  it('does not invent a message or expose an error object', () => {
    expect(() => notify.error('Internal server error')).not.toThrow();
    expect(sonner.toast.error).toHaveBeenCalledWith('Internal server error', {
      duration: 6500,
    });
  });
});
