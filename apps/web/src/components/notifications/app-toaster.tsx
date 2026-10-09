'use client';

import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';

type ToastTheme = 'light' | 'dark';

/**
 * The single notification host for the whole application.
 *
 * The account theme is stored on <html data-theme="dark">, so Sonner cannot
 * use its system-only theme option here. Reading the attribute after mount
 * avoids a hydration mismatch and observing it keeps notifications in sync
 * when the user changes their preference without a full navigation.
 */
export function AppToaster() {
  const [theme, setTheme] = useState<ToastTheme>('light');

  useEffect(() => {
    const root = document.documentElement;
    const readTheme = () => setTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');

    readTheme();
    const observer = new MutationObserver(readTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    return () => observer.disconnect();
  }, []);

  return (
    <Toaster
      theme={theme}
      position="top-right"
      closeButton
      richColors
      visibleToasts={4}
      gap={10}
      offset={{ top: 16, right: 16 }}
      mobileOffset={{ top: 12, right: 12, left: 12 }}
      containerAriaLabel="Notifications"
      className="trackroster-toaster"
      toastOptions={{
        className: 'trackroster-toast',
        duration: 4000,
        closeButton: true,
        closeButtonAriaLabel: 'Dismiss notification',
      }}
    />
  );
}
