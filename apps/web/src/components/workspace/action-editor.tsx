'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Drawer } from '@/components/ui/drawer';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import type { BrowserResource } from '@/lib/api/browser-resource';
import { useTranslation } from '@/lib/i18n/i18n-context';
import {
  initialValues,
  isRecord,
  pathKeys,
  readOperation,
  serializeFields,
  writeOperation,
  recordName,
} from '@/lib/workspace/client';
import { getOperation } from '@/lib/workspace/client';
import { copy, text } from '@/lib/workspace/copy';
import type { Action, DataRecord, Field } from '@/lib/workspace/types';
import { validateFields } from '@/lib/workspace/validation';
import { SchemaFields } from './schema-fields';
import { ValueView } from './record-view';

export function ActionEditor({
  action,
  context,
  record,
  etag: startingEtag,
  reloadKey,
  onClose,
  onSaved,
}: {
  action: Action;
  context: DataRecord;
  record?: DataRecord;
  etag?: string | null;
  reloadKey?: string;
  onClose: () => void;
  onSaved: (result: BrowserResource<unknown>) => void;
}) {
  const { language } = useTranslation();
  const operation = getOperation(action.operation);
  const parameterFields: Field[] = pathKeys(operation.path)
    .filter((key) => !context[key])
    .map((name) => ({
      name,
      type: 'string',
      ...(/Id$/.test(name) ? { format: 'uuid' as const } : {}),
    }));
  const edit = ['PATCH', 'PUT'].includes(operation.method);
  const initial = useRef(initialValues(operation.fields, edit ? record : {}));
  const [values, setValues] = useState<DataRecord>(initial.current);
  const [parameters, setParameters] = useState<DataRecord>({});
  const [etag, setEtag] = useState(startingEtag);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState<unknown>();
  const [discard, setDiscard] = useState<string | true | null>(null);
  const [compared, setCompared] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const inFlight = useRef(false);
  const attempt = useRef<{ body: string; key: string } | null>(null);
  const autoRecovered = useRef(false);
  const dirty =
    !saved &&
    (JSON.stringify(values) !== JSON.stringify(initial.current) ||
      Object.keys(parameters).length > 0);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const navigate = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? (event.target.closest('a[href]') as HTMLAnchorElement | null)
          : null;
      if (
        !link ||
        link.target === '_blank' ||
        event.ctrlKey ||
        event.metaKey ||
        link.href === window.location.href
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setDiscard(link.href);
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigate, true);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', navigate, true);
    };
  }, [dirty]);
  const close = () => {
    if (busy) return;
    if (dirty) setDiscard(true);
    else onClose();
  };

  function bodyFor(nextValues: DataRecord, baseline: DataRecord) {
    const body = serializeFields(operation.fields, nextValues);
    if (operation.method === 'PATCH')
      for (const field of operation.fields) {
        if (
          field.optional &&
          JSON.stringify(nextValues[field.name]) === JSON.stringify(baseline[field.name])
        )
          delete body[field.name];
      }
    return body;
  }

  async function save() {
    if (inFlight.current) return;
    const found = {
      ...validateFields(operation.fields, values, language),
      ...validateFields(parameterFields, parameters, language),
    };
    setErrors(found);
    setError(null);
    if (Object.keys(found).length) {
      requestAnimationFrame(() =>
        form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    const body = bodyFor(values, initial.current);
    const params = { ...context, ...parameters };
    const fingerprint = JSON.stringify({ operation: action.operation, params, body, etag });
    if (attempt.current?.body !== fingerprint)
      attempt.current = { body: fingerprint, key: crypto.randomUUID() };
    inFlight.current = true;
    setBusy(true);
    try {
      const response = await writeOperation(
        action.operation,
        params,
        body,
        attempt.current.key,
        etag,
      );
      setResult(response.resource);
      setSaved(true);
      onSaved(response);
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        caught.statusCode === 412 &&
        reloadKey &&
        !autoRecovered.current
      ) {
        autoRecovered.current = true;
        const recovered = await compareLatest();
        if (recovered) {
          if (recovered.overlap.length > 0) {
            setError(caught);
            return;
          }
          const retryParams = { ...context, ...parameters };
          const retryBody = bodyFor(recovered.values, recovered.initial);
          const retryKey = crypto.randomUUID();
          const retryFingerprint = JSON.stringify({
            operation: action.operation,
            params: retryParams,
            body: retryBody,
            etag: recovered.etag,
          });
          attempt.current = { body: retryFingerprint, key: retryKey };
          try {
            const response = await writeOperation(
              action.operation,
              retryParams,
              retryBody,
              retryKey,
              recovered.etag,
            );
            setResult(response.resource);
            setSaved(true);
            onSaved(response);
            return;
          } catch (retryCaught) {
            setError(retryCaught instanceof Error ? retryCaught : new Error('Request failed'));
            return;
          }
        }
      }
      setError(caught instanceof Error ? caught : new Error('Request failed'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function compareLatest(): Promise<{
    values: DataRecord;
    initial: DataRecord;
    etag: string | null;
    overlap: string[];
  } | null> {
    if (!reloadKey) return null;
    setBusy(true);
    try {
      const fresh = await readOperation(reloadKey, context);
      if (!isRecord(fresh.resource))
        throw new Error(
          text(
            'The record is no longer available.',
            'Cet enregistrement n’est plus disponible.',
            language,
          ),
        );
      const latestInitial = initialValues(operation.fields, fresh.resource);
      const next = { ...latestInitial };
      const overlap: string[] = [];
      // Carry only the person's changed fields over the latest record.
      for (const [name, value] of Object.entries(values))
        if (JSON.stringify(value) !== JSON.stringify(initial.current[name])) {
          if (JSON.stringify(latestInitial[name]) !== JSON.stringify(initial.current[name]))
            overlap.push(name);
          next[name] = value;
        }
      initial.current = latestInitial;
      setValues(next);
      setEtag(fresh.etag);
      setError(null);
      setCompared(true);
      attempt.current = null;
      return { values: next, initial: latestInitial, etag: fresh.etag, overlap };
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error('Request failed'));
      return null;
    } finally {
      setBusy(false);
    }
  }
  const conflict = error instanceof ApiError && error.statusCode === 412;
  const secret = isRecord(result) && typeof result.secret === 'string' ? result.secret : null;
  return (
    <>
      <Drawer
        open={!discard}
        title={copy(action.label, language)}
        onClose={close}
        footer={
          saved ? (
            <Button fullWidth onClick={onClose}>
              {text('Done', 'Terminer', language)}
            </Button>
          ) : (
            <div className="flex justify-end gap-3">
              <Button variant="secondary" disabled={busy} onClick={close}>
                {text('Cancel', 'Annuler', language)}
              </Button>
              <Button
                variant={action.danger ? 'danger' : 'primary'}
                loading={busy}
                disabled={conflict || (edit && !dirty)}
                onClick={() => void save()}
              >
                {copy(action.label, language)}
              </Button>
            </div>
          )
        }
      >
        {saved ? (
          <div className="space-y-5">
            <Alert
              tone="success"
              title={text('Saved successfully', 'Enregistrement réussi', language)}
            >
              {text(
                'The workspace now reflects the server’s response.',
                'L’espace reflète maintenant la réponse du serveur.',
                language,
              )}
            </Alert>
            {secret && (
              <>
                <Alert tone="warning">
                  {text(
                    'Copy this secret now. It is shown only once.',
                    'Copiez ce secret maintenant. Il ne sera affiché qu’une seule fois.',
                    language,
                  )}
                </Alert>
                <TextField
                  label={text('Client secret', 'Secret client', language)}
                  type="password"
                  readOnly
                  value={secret}
                />
              </>
            )}
            {result !== undefined && <ValueView value={result} />}
          </div>
        ) : (
          <form
            ref={form}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
            className="space-y-6"
          >
            {record && (
              <p className="rounded-lg bg-surface-muted p-3 text-sm font-semibold break-words">
                {recordName(record)}
              </p>
            )}
            {action.danger && (
              <Alert tone="warning">
                {text(
                  'Review this change before confirming. Access or existing records may be affected.',
                  'Vérifiez cette modification avant de confirmer. Les accès ou les données existantes peuvent être affectés.',
                  language,
                )}
              </Alert>
            )}
            {action.description && (
              <p className="text-sm text-ink-soft">{copy(action.description, language)}</p>
            )}
            {error && (
              <Alert
                tone="danger"
                title={
                  conflict
                    ? text(
                        'Someone changed this record',
                        'Cet enregistrement a été modifié',
                        language,
                      )
                    : text(
                        'The change was not saved',
                        'La modification n’a pas été enregistrée',
                        language,
                      )
                }
              >
                <p>
                  {conflict
                    ? text(
                        'Your edits are still here. Load the latest version, review your changes, then save again.',
                        'Vos modifications sont conservées. Chargez la dernière version, vérifiez vos changements, puis enregistrez.',
                        language,
                      )
                    : error.message}
                </p>
                {error instanceof ApiError && error.requestId && (
                  <p className="mt-2 text-xs">
                    {text('Reference', 'Référence', language)}: {error.requestId}
                  </p>
                )}
                {conflict && reloadKey && (
                  <Button
                    size="md"
                    variant="secondary"
                    className="mt-3"
                    loading={busy}
                    onClick={() => void compareLatest()}
                  >
                    {text(
                      'Load latest and keep my edits',
                      'Charger la dernière version et conserver mes modifications',
                      language,
                    )}
                  </Button>
                )}
              </Alert>
            )}
            {compared && (
              <Alert tone="info">
                {text(
                  'Latest data loaded. Your changed fields are retained below; review before saving.',
                  'Dernières données chargées. Vos champs modifiés sont conservés ci-dessous ; vérifiez avant d’enregistrer.',
                  language,
                )}
              </Alert>
            )}
            <SchemaFields
              context={{ ...context, ...parameters, ...values }}
              fields={parameterFields}
              values={parameters}
              onChange={setParameters}
              errors={errors}
            />
            <SchemaFields
              context={{ ...context, ...parameters, ...values }}
              fields={operation.fields}
              values={values}
              onChange={(next) => {
                setValues(next);
                setErrors({});
              }}
              errors={errors}
            />
            {!operation.fields.length && !parameterFields.length && (
              <p className="text-sm text-ink-soft">
                {text(
                  'Confirm to apply this action.',
                  'Confirmez pour appliquer cette action.',
                  language,
                )}
              </p>
            )}
            <button type="submit" className="sr-only" tabIndex={-1}>
              {text('Save', 'Enregistrer', language)}
            </button>
          </form>
        )}
      </Drawer>
      <Dialog
        open={!!discard}
        title={text('Discard unsaved changes?', 'Abandonner les modifications ? ', language)}
        description={text(
          'Your changes have not been saved.',
          'Vos modifications n’ont pas été enregistrées.',
          language,
        )}
        onClose={() => setDiscard(null)}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDiscard(null)}>
              {text('Keep editing', 'Continuer', language)}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const target = discard;
                onClose();
                if (typeof target === 'string') window.location.assign(target);
              }}
            >
              {text('Discard', 'Abandonner', language)}
            </Button>
          </div>
        }
      />
    </>
  );
}
