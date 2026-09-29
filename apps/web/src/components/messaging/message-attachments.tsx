'use client';

import { useId, useRef, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { ApiError } from '@/lib/api/api-error';
import type { Message } from '@/lib/api/messaging-types';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';
import { isRecord, readOperation, writeOperation } from '@/lib/workspace/client';

function safeUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Missing storage URL');
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid storage URL');
  return url.href;
}

/** Attach to a persisted message so retries never create a duplicate message. */
export function MessageAttachments({
  message,
  mine,
  onUpdated,
}: {
  message: Message;
  mine: boolean;
  onUpdated: () => void;
}) {
  const { language } = useTranslation();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const inFlight = useRef(false);
  const attempt = useRef<{
    file: File;
    key: string;
    objectKey?: string;
    uploaded?: boolean;
  } | null>(null);
  const attachmentCount = message.attachments?.length ?? 0;
  if (!mine && !attachmentCount) return null;

  async function upload() {
    if (!file || inFlight.current) return;
    if (file.size > 25_000_000 || file.size === 0) {
      setError(
        text(
          'Choose a non-empty file smaller than 25 MB.',
          'Choisissez un fichier non vide de moins de 25 Mo.',
          language,
        ),
      );
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    if (attempt.current?.file !== file) attempt.current = { file, key: crypto.randomUUID() };
    const current = attempt.current;
    const metadata = {
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      byteSize: file.size,
    };
    try {
      if (!current.uploaded) {
        const { resource } = await writeOperation(
          'POST /uploads/presign',
          {},
          metadata,
          `${current.key}-presign`,
        );
        if (!isRecord(resource) || typeof resource.objectKey !== 'string')
          throw new Error('Invalid upload response');
        const response = await fetch(safeUrl(resource.uploadUrl), {
          method: 'PUT',
          credentials: 'omit',
          body: file,
          headers: { 'content-type': metadata.contentType },
        });
        if (!response.ok) throw new Error('Storage upload failed');
        current.objectKey = resource.objectKey;
        current.uploaded = true;
      }
      await writeOperation(
        'POST /messages/:messageId/attachments',
        { messageId: message.id },
        { ...metadata, objectKey: current.objectKey },
        `${current.key}-attach`,
      );
      setFile(null);
      attempt.current = null;
      onUpdated();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : text(
              'Upload could not finish. Check your connection and storage configuration, then retry.',
              'Le transfert a échoué. Vérifiez la connexion et la configuration du stockage, puis réessayez.',
              language,
            ),
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="mt-2 flex items-center gap-1.5 rounded px-1 py-1 text-xs font-semibold underline underline-offset-2"
        onClick={() => setOpen(true)}
      >
        <Paperclip aria-hidden="true" className="size-3.5" />
        {attachmentCount
          ? text(
              `${attachmentCount} attachment(s)`,
              `${attachmentCount} pièce(s) jointe(s)`,
              language,
            )
          : text('Attach file', 'Joindre un fichier', language)}
      </button>
      <Drawer
        open={open}
        title={text('Message attachments', 'Pièces jointes du message', language)}
        onClose={() => {
          if (!busy) {
            setOpen(false);
            setLinks({});
          }
        }}
      >
        <div className="space-y-5 text-ink">
          <p className="whitespace-pre-wrap text-sm text-ink-muted">{message.body}</p>
          {error && <Alert tone="danger">{error}</Alert>}
          <ul className="space-y-3">
            {message.attachments?.map((attachment) => (
              <li key={attachment.id} className="rounded-lg border border-line p-3">
                <p className="break-all font-semibold">{attachment.filename}</p>
                <p className="mb-2 text-xs text-ink-muted">
                  {(attachment.byteSize / 1024).toFixed(1)} KB
                </p>
                {links[attachment.id] ? (
                  <a
                    className="font-semibold text-brand underline"
                    href={links[attachment.id]}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {text(
                      'Open download (valid for 5 minutes)',
                      'Ouvrir le téléchargement (valable 5 minutes)',
                      language,
                    )}
                  </a>
                ) : (
                  <Button
                    variant="secondary"
                    size="md"
                    loading={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        const { resource } = await readOperation(
                          'GET /attachments/:attachmentId/download',
                          { attachmentId: attachment.id },
                        );
                        if (!isRecord(resource)) throw new Error();
                        setLinks((current) => ({
                          ...current,
                          [attachment.id]: safeUrl(resource.downloadUrl),
                        }));
                      } catch {
                        setError(
                          text(
                            'The download could not be prepared. Retry.',
                            'Le téléchargement n’a pas pu être préparé. Réessayez.',
                            language,
                          ),
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {text('Prepare download', 'Préparer le téléchargement', language)}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {!attachmentCount && (
            <p className="text-sm text-ink-muted">
              {text('No attachments yet.', 'Aucune pièce jointe.', language)}
            </p>
          )}
          {mine && (
            <form
              className="space-y-3 border-t border-line pt-5"
              onSubmit={(e) => {
                e.preventDefault();
                void upload();
              }}
            >
              <label htmlFor={inputId} className="block text-sm font-semibold">
                {text('Add a file', 'Ajouter un fichier', language)}
              </label>
              <input
                key={file?.name ?? 'empty'}
                id={inputId}
                type="file"
                className="block w-full text-sm"
                disabled={busy}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setError(null);
                }}
                aria-describedby={`${inputId}-hint`}
              />
              <p id={`${inputId}-hint`} className="text-xs text-ink-muted">
                {text(
                  'Up to 25 MB. The file is shared with this conversation.',
                  'Jusqu’à 25 Mo. Le fichier est partagé avec cette conversation.',
                  language,
                )}
              </p>
              {file && <p className="break-all text-sm">{file.name}</p>}
              <Button type="submit" loading={busy} disabled={!file}>
                {text('Upload file', 'Transférer le fichier', language)}
              </Button>
            </form>
          )}
        </div>
      </Drawer>
    </>
  );
}
