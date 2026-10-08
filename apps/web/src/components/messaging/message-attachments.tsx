'use client';

import { useId, useState } from 'react';
import { Download, FileText, Paperclip } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { ApiError } from '@/lib/api/api-error';
import { uploadMessageAttachment } from '@/lib/api/message-attachment-client';
import type { Message } from '@/lib/api/messaging-types';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';
import { isRecord, readOperation } from '@/lib/workspace/client';

function safeUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Missing storage URL');
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid storage URL');
  return url.href;
}

function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const [progress, setProgress] = useState<number | null>(null);
  const attachmentCount = message.attachments?.length ?? 0;
  if (!mine && !attachmentCount) return null;

  async function upload() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      setProgress(0);
      await uploadMessageAttachment(message.id, file, setProgress);
      setFile(null);
      setProgress(null);
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
      setBusy(false);
    }
  }

  return (
    <>
      {attachmentCount ? (
        <div className="mt-2 space-y-1.5">
          {message.attachments?.map((attachment) => (
            <button
              key={attachment.id}
              type="button"
              aria-label={text(
                'Open message attachments',
                'Ouvrir les pièces jointes du message',
                language,
              )}
              className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${mine ? 'border-white/25 bg-white/15 text-white hover:bg-white/20' : 'border-line bg-canvas text-ink hover:border-brand-pale hover:bg-brand-wash'}`}
              onClick={() => setOpen(true)}
            >
              {attachment === message.attachments?.[0] ? (
                <span className="sr-only">
                  {attachmentCount} {text('attachment(s)', 'pièce(s) jointe(s)', language)}
                </span>
              ) : null}
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-md ${mine ? 'bg-white/15 text-white' : 'bg-brand-tint text-brand'}`}
              >
                <FileText aria-hidden="true" className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-bold">{attachment.filename}</span>
                <span className={`block text-[10px] ${mine ? 'text-white/70' : 'text-ink-muted'}`}>
                  {formatAttachmentSize(attachment.byteSize)}
                </span>
              </span>
              <Download
                aria-hidden="true"
                className={`size-3.5 shrink-0 ${mine ? 'text-white/80' : 'text-ink-muted'}`}
              />
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          aria-label={text('Add an attachment', 'Ajouter une pièce jointe', language)}
          className={`mt-1 flex items-center gap-1.5 rounded px-1 py-1 text-[11px] font-semibold text-current/70 transition-opacity hover:text-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/40 ${mine ? 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100' : ''}`}
          onClick={() => setOpen(true)}
        >
          <Paperclip aria-hidden="true" className="size-3.5" />
          {text('Add attachment', 'Ajouter une pièce jointe', language)}
        </button>
      )}
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
              noValidate
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
              {progress !== null && (
                <p className="text-xs text-ink-muted" aria-live="polite">
                  {text(`Uploading… ${progress}%`, `Transfert… ${progress}%`, language)}
                </p>
              )}
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
