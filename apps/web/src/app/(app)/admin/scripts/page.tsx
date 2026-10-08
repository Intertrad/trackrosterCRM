'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Mail, Plus, Send, Sparkles, Trash2, WandSparkles } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { StatTile } from '@/components/ui/stat-tile';
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
  const selectedVariables = useMemo(() => draft.variables, [draft.variables]);
  function edit(script: Script) {
    setSelected(script);
    setDraft({
      name: script.name,
      channel: script.channel,
      sector: script.sector,
      subject: script.subject,
      body: script.body,
      variables: script.variables ?? [],
      enabled: script.enabled,
    });
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
      await browserResource<Script>(selected ? `/api/scripts/${selected.id}` : '/api/scripts', {
        method: selected ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({
          name: draft.name,
          channel: draft.channel,
          sector: draft.sector,
          subject: draft.subject,
          body: draft.body,
          variables: draft.variables,
          enabled: draft.enabled,
        }),
      });
      setNotice(isFrench ? 'Modèle enregistré.' : 'Template saved.');
      await load();
      setSelected(null);
      setDraft({ ...blank });
      setPreview(null);
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
    const values = Object.fromEntries(selectedVariables.map((key) => [key, `[${key}]`])) as Record<
      string,
      string
    >;

    /* Preview the current draft, including unsaved edits. The old flow sent
     * only the persisted template id, so the button was absent for new
     * templates and stale while editing an existing one. */
    const render = (value: string | null | undefined) =>
      (value ?? '').replace(
        /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi,
        (_, key: string) => values[key] ?? '',
      );
    if (!selected) {
      const missingVariables = [
        ...new Set(
          [...draft.body.matchAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi)].map((match) => match[1]!),
        ),
      ].filter((key) => !values[key]);
      setPreview({
        subject: render(draft.subject),
        body: render(draft.body),
        missingVariables,
      });
      return;
    }

    try {
      const result = await browserResource<{
        subject: string;
        body: string;
        missingVariables: string[];
      }>(`/api/scripts/${selected.id}/preview`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          values,
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
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <StatTile
          icon={<Mail className="size-5" />}
          value={scripts.length}
          label={isFrench ? 'Modèles créés' : 'Templates created'}
        />
        <StatTile
          icon={<CheckCircle2 className="size-5" />}
          tone="success"
          value={scripts.filter((script) => script.enabled).length}
          label={isFrench ? 'Actifs' : 'Active'}
        />
        <StatTile
          icon={<WandSparkles className="size-5" />}
          tone="warning"
          value={scripts.reduce((total, script) => total + script.variables.length, 0)}
          label={isFrench ? 'Variables disponibles' : 'Variables available'}
        />
      </div>
      {scripts.length === 0 ? (
        <Card className="border-warning/40 bg-warning-bg/20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-extrabold text-navy">
                {isFrench ? 'Aucun modèle pour le moment' : 'No template yet'}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                {isFrench
                  ? 'Créez un modèle pour garder une formulation cohérente entre les prospecteurs.'
                  : 'Create a template to keep wording consistent across prospectors.'}
              </p>
            </div>
            <Button onClick={newScript}>
              {isFrench ? 'Commencer' : 'Start from the dossier wording'}
            </Button>
          </div>
        </Card>
      ) : null}
      <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(260px,0.78fr)_minmax(0,1.62fr)]">
        <Card padding="none" className="min-h-[620px] overflow-hidden">
          <CardHeader
            className="mb-0 border-b border-line-soft px-5 py-4"
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
              <p className="p-6 text-sm leading-6 text-ink-muted">
                {isFrench
                  ? 'Aucun modèle. Créez le premier.'
                  : 'No templates yet. Create the first one.'}
              </p>
            ) : null}
          </div>
        </Card>
        <Card className="min-h-[620px]">
          <CardHeader
            className="mb-6"
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
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-bold text-navy">
              {isFrench ? 'Nom' : 'Name'}
              <input
                value={draft.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder={isFrench ? 'Nom du modèle' : 'Template name'}
                className="mt-2 h-12 w-full rounded-[10px] border border-line bg-surface px-3.5 text-[15px] font-normal text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
            </label>
            <label className="text-sm font-bold text-navy">
              {isFrench ? 'Canal' : 'Channel'}
              <select
                value={draft.channel}
                onChange={(e) => update('channel', e.target.value as Script['channel'])}
                className="mt-2 h-12 w-full rounded-[10px] border border-line bg-surface px-3.5 text-[15px] font-normal text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
              >
                <option value="email">Email</option>
                <option value="call">Call</option>
                <option value="visit">Visit</option>
              </select>
            </label>
          </div>
          {draft.channel === 'email' ? (
            <label className="mt-5 block text-sm font-bold text-navy">
              Subject
              <input
                value={draft.subject ?? ''}
                onChange={(e) => update('subject', e.target.value)}
                placeholder={isFrench ? 'Objet de l’e-mail' : 'Email subject'}
                className="mt-2 h-12 w-full rounded-[10px] border border-line bg-surface px-3.5 text-[15px] font-normal text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
            </label>
          ) : null}
          <label className="mt-5 block text-sm font-bold text-navy">
            {isFrench ? 'Secteur (optionnel)' : 'Sector (optional)'}
            <input
              value={draft.sector ?? ''}
              onChange={(e) => update('sector', e.target.value)}
              className="mt-2 h-12 w-full rounded-[10px] border border-line bg-surface px-3.5 text-[15px] font-normal text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
              placeholder="sante"
            />
          </label>
          <label className="mt-5 block text-sm font-bold text-navy">
            {isFrench ? 'Contenu' : 'Body'}
            <textarea
              value={draft.body}
              onChange={(e) => update('body', e.target.value)}
              rows={9}
              className="mt-2 min-h-[220px] w-full resize-y rounded-[10px] border border-line bg-surface px-3.5 py-3 text-[15px] font-normal leading-6 text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
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
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={save} loading={busy}>
              {isFrench ? 'Enregistrer' : 'Save template'}
            </Button>
            <Button
              variant="secondary"
              onClick={renderPreview}
              leadingIcon={<Sparkles size={15} />}
            >
              {isFrench ? 'Aperçu' : 'Preview'}
            </Button>
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
                  className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
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
