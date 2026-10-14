'use client';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import { updateConversation } from '@/lib/api/messaging-client';
import type { Conversation } from '@/lib/api/messaging-types';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';

export function ConversationSettingsDrawer({
  open,
  conversation,
  onClose,
  onUpdated,
}: {
  open: boolean;
  conversation: Conversation | null;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const { language } = useTranslation();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editingConversation = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      editingConversation.current = null;
    } else if (conversation && editingConversation.current !== conversation.id) {
      editingConversation.current = conversation.id;
      setTitle(conversation.title ?? '');
      setError(null);
    }
  }, [conversation, open]);

  if (!conversation) return null;

  return (
    <Drawer
      open={open}
      title={text('Conversation settings', 'Paramètres de la conversation', language)}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        noValidate
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError(null);
          updateConversation(conversation.id, { title: title.trim() || undefined })
            .then(async () => {
              await onUpdated();
              onClose();
            })
            .catch((caught: unknown) =>
              setError(
                caught instanceof ApiError
                  ? caught.message
                  : text(
                      'Could not save conversation settings.',
                      'Impossible d’enregistrer les paramètres.',
                      language,
                    ),
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        <TextField
          label={text('Conversation title', 'Titre de la conversation', language)}
          value={title}
          maxLength={200}
          disabled={busy}
          onChange={(event) => setTitle(event.target.value)}
        />
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Button type="submit" fullWidth loading={busy}>
          {text('Save settings', 'Enregistrer les paramètres', language)}
        </Button>
        <div className="border-t border-line pt-4">
          <Button
            type="button"
            fullWidth
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              updateConversation(conversation.id, {
                status: conversation.status === 'archived' ? 'active' : 'archived',
              })
                .then(async () => {
                  await onUpdated();
                  onClose();
                })
                .catch((caught: unknown) =>
                  setError(
                    caught instanceof ApiError
                      ? caught.message
                      : text(
                          'Could not update conversation status.',
                          'Impossible de modifier le statut.',
                          language,
                        ),
                  ),
                )
                .finally(() => setBusy(false));
            }}
          >
            {conversation.status === 'archived'
              ? text('Reopen conversation', 'Rouvrir la conversation', language)
              : text('Close conversation', 'Fermer la conversation', language)}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
