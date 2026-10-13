import { toast, type ExternalToast } from 'sonner';

export type NotificationAction = {
  label: string;
  onClick: () => void;
};

export type NotificationOptions = {
  /** Stable IDs update an existing toast instead of stacking duplicates. */
  id?: string;
  description?: string;
  duration?: number;
  action?: NotificationAction;
  /** Safe request reference only; never pass a token or response body. */
  requestId?: string;
};

export type NotificationPromiseOptions<T> = {
  loading: string;
  success: string | ((value: T) => string);
  error: string | ((error: unknown) => string);
  id?: string;
};

const DURATIONS = {
  success: 4000,
  info: 5000,
  warning: 6000,
  error: 6500,
  loading: Infinity,
} as const;

function externalOptions(
  options: NotificationOptions | undefined,
  fallbackDuration: number,
): ExternalToast {
  if (!options) return { duration: fallbackDuration };

  const description = [
    options.description,
    options.requestId ? `Reference: ${options.requestId}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    ...(options.id ? { id: options.id } : {}),
    ...(description ? { description } : {}),
    duration: options.duration ?? fallbackDuration,
    ...(options.action
      ? {
          action: {
            label: options.action.label,
            onClick: options.action.onClick,
          },
        }
      : {}),
  };
}

function notifyWith(
  method: 'success' | 'error' | 'warning' | 'info' | 'loading',
  message: string,
  options: NotificationOptions | undefined,
) {
  return toast[method](message, externalOptions(options, DURATIONS[method]));
}

export const notify = {
  success(message: string, options?: NotificationOptions) {
    return notifyWith('success', message, options);
  },

  error(message: string, options?: NotificationOptions) {
    return notifyWith('error', message, options);
  },

  warning(message: string, options?: NotificationOptions) {
    return notifyWith('warning', message, options);
  },

  info(message: string, options?: NotificationOptions) {
    return notifyWith('info', message, options);
  },

  loading(message: string, options?: NotificationOptions) {
    return notifyWith('loading', message, options);
  },

  promise<T>(promise: Promise<T>, options: NotificationPromiseOptions<T>) {
    return toast.promise(promise, {
      ...(options.id ? { id: options.id } : {}),
      loading: options.loading,
      success: options.success,
      error: options.error,
    });
  },

  dismiss(id?: string | number) {
    return toast.dismiss(id);
  },
};
