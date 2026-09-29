'use client';

import { useTranslation } from '@/lib/i18n/i18n-context';
import { isRecord } from '@/lib/workspace/client';
import { fieldLabel, text } from '@/lib/workspace/copy';

const HIDDEN =
  /^(tenantId|secretHash|passwordHash|password|accessToken|refreshToken|encryptedTokens|clientSecret|apiKey|secret|etag)$/i;
export function ValueView({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const { language, locale } = useTranslation();
  if (value === undefined || value === null || value === '')
    return <span className="text-ink-muted">—</span>;
  if (typeof value === 'boolean')
    return <span>{text(value ? 'Yes' : 'No', value ? 'Oui' : 'Non', language)}</span>;
  if (typeof value === 'number')
    return <span className="tabular-nums">{new Intl.NumberFormat(locale).format(value)}</span>;
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:/.test(value) && Number.isFinite(Date.parse(value)))
      return (
        <time dateTime={value}>
          {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
            new Date(value),
          )}
        </time>
      );
    return <span className="break-words [overflow-wrap:anywhere]">{value}</span>;
  }
  if (Array.isArray(value))
    return value.length ? (
      <ul className="space-y-2">
        {value.map((item, i) => (
          <li key={i} className={isRecord(item) ? 'rounded-lg border border-line-soft p-3' : ''}>
            <ValueView value={item} depth={depth + 1} />
          </li>
        ))}
      </ul>
    ) : (
      <span className="text-ink-muted">{text('None', 'Aucun', language)}</span>
    );
  if (isRecord(value))
    return (
      <dl className={depth ? 'grid gap-3' : 'grid gap-x-8 gap-y-5 sm:grid-cols-2'}>
        {Object.entries(value)
          .filter(([key]) => !HIDDEN.test(key))
          .map(([key, item]) => (
            <div
              key={key}
              className={
                isRecord(item) || Array.isArray(item) ? 'min-w-0 sm:col-span-2' : 'min-w-0'
              }
            >
              <dt className="mb-1 text-xs font-semibold tracking-wide text-ink-muted">
                {fieldLabel(key, language)}
              </dt>
              <dd className="text-sm text-ink">
                {typeof item === 'string' &&
                /^(downloadUrl|downloadURL)$/.test(key) &&
                /^https?:\/\//i.test(item) ? (
                  <a
                    href={item}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-brand underline"
                  >
                    {text('Download file', 'Télécharger le fichier', language)}
                  </a>
                ) : (
                  <ValueView value={item} depth={depth + 1} />
                )}
              </dd>
            </div>
          ))}
      </dl>
    );
  return null;
}
