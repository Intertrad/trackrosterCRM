'use client';

import { useEffect, useMemo, useState } from 'react';
import { Mail, Plus, Send, Sparkles, Trash2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { browserResource } from '@/lib/api/browser-resource';
import { useAuth } from '@/lib/auth/auth-context';
import { useTranslation } from '@/lib/i18n/i18n-context';

type Script = {
  id: string;
  name: string;
  channel: 'call' | 'visit' | 'email';
  sector: string | null;
  subject: string | null;
  body: string;
  variables: string[];
  enabled: boolean;
};
const blank: Omit<Script, 'id'> = {
  name: '',
  channel: 'email',
  sector: '',
  subject: '',
  body: '',
  variables: [],
  enabled: true,
};

export default function ScriptsPage() {
  const { activeWorkspace } = useAuth();
  const { language } = useTranslation();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [draft, setDraft] = useState<Omit<Script, 'id'>>(blank);
  const [selected, setSelected] = useState<Script | null>(null);
  const [preview, setPreview] = useState<{
    subject: string;
    body: string;
    missingVariables: string[];
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState('');
  const isFrench = language === 'fr';
  const canEdit = activeWorkspace?.mode === 'admin';
  const title = isFrench ? 'Scripts et e-mails' : 'Scripts and emails';

  async function load() {
    try {
      const result = await browserResource<Script[]>('/api/scripts', { cache: 'no-store' });
      setScripts(result.resource);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load scripts');
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const selectedVariables = useMemo(
    () => selected?.variables ?? draft.variables,
    [selected, draft.variables],
  );
  function edit(script: Script) {
    setSelected(script);
    setDraft({ ...script });
    setPreview(null);
    setNotice(null);
  }
  function newScript() {
    setSelected(null);
    setDraft({ ...blank });
    setPreview(null);
    setNotice(null);
  }
  function update<K extends keyof Omit<Script, 'id'>>(key: K, value: Omit<Script, 'id'>[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  async function save() {
    setBusy(true);
    setError(null);
    try {
      const result = await browserResource<Script>(
        selected ? `/api/scripts/${selected.id}` : '/api/scripts',
        {
          method: selected ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({ ...draft, variables: draft.variables }),
        },
      );
      setNotice(isFrench ? 'Modèle enregistré.' : 'Template saved.');
      await load();
      edit(result.resource);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save script');
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!selected || !window.confirm(isFrench ? 'Supprimer ce modèle ?' : 'Delete this template?'))
      return;
    setBusy(true);
    try {
      await browserResource(`/api/scripts/${selected.id}`, {
        method: 'DELETE',
        headers: { 'idempotency-key': crypto.randomUUID() },
      });
      newScript();
      await load();
      setNotice(isFrench ? 'Modèle supprimé.' : 'Template deleted.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to delete script');
    } finally {
      setBusy(false);
    }
  }
  async function renderPreview() {
    if (!selected) return;
    try {
      const result = await browserResource<{
        subject: string;
        body: string;
        missingVariables: string[];
      }>(`/api/scripts/${selected.id}/preview`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          values: Object.fromEntries(selectedVariables.map((key) => [key, `[${key}]`])),
        }),
      });
      setPreview(result.resource);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to render preview');
    }
  }
  async function sendTest() {
    if (!selected || !testTo) return;
    setBusy(true);
    try {
      await browserResource(`/api/scripts/${selected.id}/test`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({
          to: testTo,
          values: Object.fromEntries(selectedVariables.map((key) => [key, `[${key}]`])),
        }),
      });
      setNotice(isFrench ? 'E-mail de test mis en file.' : 'Test email queued.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to queue email');
    } finally {
      setBusy(false);
    }
  }
  if (!canEdit)
    return (
      <Alert tone="warning">
        {isFrench
          ? 'Cette rubrique est réservée aux administrateurs client.'
          : 'This area is available to client administrators.'}
      </Alert>
    );
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={
          isFrench
            ? 'Modèles d’appel, de visite et d’e-mail avec variables réutilisables.'
            : 'Reusable call, visit and email templates with dynamic variables.'
        }
        action={
          <Button onClick={newScript} leadingIcon={<Plus size={16} />}>
            {isFrench ? 'Nouveau modèle' : 'New template'}
          </Button>
        }
      />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <div className="grid gap-5 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.6fr)]">
        <Card padding="none">
          <CardHeader
            title={isFrench ? 'Bibliothèque' : 'Library'}
            action={<span className="text-xs text-ink-muted">{scripts.length}</span>}
          />
          <div className="divide-y divide-line">
            {scripts.map((script) => (
              <button
                key={script.id}
                onClick={() => edit(script)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-brand-wash ${selected?.id === script.id ? 'bg-brand-wash' : ''}`}
              >
                <span className="mt-0.5 rounded-md bg-brand-tint p-2 text-brand">
                  <Mail size={15} />
                </span>
                <span className="min-w-0">
                  <strong className="block truncate text-sm text-navy">{script.name}</strong>
                  <span className="text-xs capitalize text-ink-muted">
                    {script.channel}
                    {script.sector ? ` · ${script.sector}` : ''}
                  </span>
                </span>
              </button>
            ))}
            {scripts.length === 0 ? (
              <p className="p-5 text-sm text-ink-muted">
                {isFrench
                  ? 'Aucun modèle. Créez le premier.'
                  : 'No templates yet. Create the first one.'}
              </p>
            ) : null}
          </div>
        </Card>
        <Card>
          <CardHeader
            title={
              selected
                ? isFrench
                  ? 'Modifier le modèle'
                  : 'Edit template'
                : isFrench
                  ? 'Nouveau modèle'
                  : 'New template'
            }
            action={
              selected ? (
                <Button
                  variant="danger"
                  size="md"
                  onClick={remove}
                  leadingIcon={<Trash2 size={15} />}
                >
                  {isFrench ? 'Supprimer' : 'Delete'}
                </Button>
              ) : null
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-navy">
              {isFrench ? 'Nom' : 'Name'}
              <input
                value={draft.name}
                onChange={(e) => update('name', e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-navy">
              {isFrench ? 'Canal' : 'Channel'}
              <select
                value={draft.channel}
                onChange={(e) => update('channel', e.target.value as Script['channel'])}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
              >
                <option value="email">Email</option>
                <option value="call">Call</option>
                <option value="visit">Visit</option>
              </select>
            </label>
          </div>
          {draft.channel === 'email' ? (
            <label className="mt-4 block text-sm font-semibold text-navy">
              Subject
              <input
                value={draft.subject ?? ''}
                onChange={(e) => update('subject', e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
              />
            </label>
          ) : null}
          <label className="mt-4 block text-sm font-semibold text-navy">
            {isFrench ? 'Secteur (optionnel)' : 'Sector (optional)'}
            <input
              value={draft.sector ?? ''}
              onChange={(e) => update('sector', e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
              placeholder="sante"
            />
          </label>
          <label className="mt-4 block text-sm font-semibold text-navy">
            {isFrench ? 'Contenu' : 'Body'}
            <textarea
              value={draft.body}
              onChange={(e) => update('body', e.target.value)}
              rows={10}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal"
              placeholder="Bonjour {{first_name}}, ..."
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedVariables.map((key) => (
              <button
                key={key}
                type="button"
                className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-semibold text-brand"
                onClick={() => update('body', `${draft.body} {{${key}}}`)}
              >
                <Sparkles size={12} className="mr-1 inline" />
                {key}
              </button>
            ))}
            <button
              type="button"
              className="rounded-full border border-dashed border-line px-2.5 py-1 text-xs text-ink-muted"
              onClick={() => {
                const key = window.prompt('Variable name');
                if (key) update('variables', [...new Set([...draft.variables, key.trim()])]);
              }}
            >
              + variable
            </button>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={save} loading={busy}>
              {isFrench ? 'Enregistrer' : 'Save template'}
            </Button>
            {selected ? (
              <Button
                variant="secondary"
                onClick={renderPreview}
                leadingIcon={<Sparkles size={15} />}
              >
                {isFrench ? 'Aperçu' : 'Preview'}
              </Button>
            ) : null}
          </div>
          {preview ? (
            <div className="mt-5 rounded-lg border border-line bg-surface-muted p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                {preview.subject}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{preview.body}</p>
              {preview.missingVariables.length ? (
                <p className="mt-3 text-xs text-warning">
                  Missing: {preview.missingVariables.join(', ')}
                </p>
              ) : null}
            </div>
          ) : null}
          {selected?.channel === 'email' ? (
            <div className="mt-5 rounded-lg border border-brand-pale bg-brand-wash p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-navy">
                <Send size={15} />
                {isFrench ? 'Envoyer un e-mail de test' : 'Send test email'}
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  type="email"
                  placeholder="you@example.com"
                  className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm"
                />
                <Button size="md" variant="secondary" onClick={sendTest} disabled={!testTo || busy}>
                  Send
                </Button>
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                {isFrench
                  ? 'Utilise la boîte locale en développement ou Brevo configuré.'
                  : 'Uses the local mailbox in development or configured Brevo.'}
              </p>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
