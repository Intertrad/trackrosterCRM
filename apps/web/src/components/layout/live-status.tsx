'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';

export function LiveStatus() {
  const { language } = useTranslation();
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return offline ? (
    <Alert
      tone="warning"
      className="mb-5"
      title={text('You are offline', 'Vous êtes hors ligne', language)}
    >
      {text(
        'Live updates are paused. Keep this page open to preserve your edits. Reconnect before saving.',
        'Les mises à jour sont suspendues. Gardez cette page ouverte pour conserver vos modifications. Reconnectez-vous avant d’enregistrer.',
        language,
      )}
    </Alert>
  ) : null;
}
