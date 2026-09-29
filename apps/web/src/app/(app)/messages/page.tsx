'use client';
import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/ui/dialog';
import { MessageAttachments } from '@/components/messaging/message-attachments';
import { text } from '@/lib/workspace/copy';
import { Pencil, BellOff, MessagesSquare, Plus, Send, Trash2 } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import { membershipName } from '@/lib/api/membership-types';
import {
  createConversation,
  deleteMessage,
  editMessage,
  listConversations,
  listMessages,
  listMessagingMembers,
  listParticipants,
  markConversationRead,
  muteConversation,
  sendMessage,
} from '@/lib/api/messaging-client';
import {
  CONVERSATION_KINDS,
  MAX_MESSAGE_BODY,
  conversationKindLabelKey,
  conversationName,
  isMuted,
  muteUntil,
  type Conversation,
  type ConversationKind,
  type ConversationParticipant,
  type Message,
  type MessagingMember,
} from '@/lib/api/messaging-types';
import { useAuth } from '@/lib/auth/auth-context';
import { useTranslation, type Translate } from '@/lib/i18n/i18n-context';

const DEMO_MESSAGES_ENABLED = process.env.NODE_ENV !== 'production';
const DEMO_CONVERSATION_ID = '00000000-0000-4000-8000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-4000-8000-000000000010';
const DEMO_PROSPECTOR_ID = '00000000-0000-4000-8000-000000000011';

const demoAdmin = {
  membershipId: DEMO_ADMIN_ID,
  displayName: 'Karim Benali',
  email: 'karim.benali@example.test',
  roles: ['tenant_admin'],
  designation: 'tenant_admin',
};
const demoProspector = {
  membershipId: DEMO_PROSPECTOR_ID,
  displayName: 'Awa Sy',
  email: 'awa.sy@example.test',
  roles: ['prospector'],
  designation: 'prospector',
};

const demoConversations: Conversation[] = [
  {
    id: DEMO_CONVERSATION_ID,
    tenantId: '00000000-0000-4000-8000-000000000099',
    kind: 'prospect',
    title: 'Complément d’information — volume et langues',
    status: 'active',
    createdBy: DEMO_ADMIN_ID,
    createdAt: '2026-09-21T13:00:00.000Z',
    updatedAt: '2026-09-21T15:57:00.000Z',
    context: {
      establishment: 'Direction interrégionale de la protection judiciaire de la jeunesse (DIRPJJ)',
      location: 'Île-de-France et Outre-Mer, Paris',
      action: 'Appel du 21 sept., 12:57 — Intéressé, besoin identifié',
      outcome:
        'Besoin régulier, surtout la nuit et le week-end. Souhaite une liste d’interprètes joignables rapidement.',
    },
    latestMessage: {
      id: '00000000-0000-4000-8000-000000000101',
      body: 'Bonjour, environ 10 à 12 demandes par mois, surtout en dari et en pachto, souvent le soir. La greffière souhaite une réponse sous 2 heures.',
      status: 'sent',
      createdAt: '2026-09-21T15:57:00.000Z',
      sender: demoProspector,
    },
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    tenantId: '00000000-0000-4000-8000-000000000099',
    kind: 'prospect',
    title: 'Numéro erroné — Commissariat de police de Drancy',
    status: 'active',
    createdBy: DEMO_PROSPECTOR_ID,
    createdAt: '2026-09-29T08:00:00.000Z',
    updatedAt: '2026-09-29T09:00:00.000Z',
    latestMessage: {
      id: '00000000-0000-4000-8000-000000000102',
      body: 'Le numéro de la fiche aboutit au standard de la mairie. Le bon numéro semble être celui affiché dans la fiche.',
      status: 'sent',
      createdAt: '2026-09-29T09:00:00.000Z',
      sender: demoAdmin,
    },
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    tenantId: '00000000-0000-4000-8000-000000000099',
    kind: 'prospect',
    title: 'Interlocuteur à préciser',
    status: 'active',
    createdBy: DEMO_PROSPECTOR_ID,
    createdAt: '2026-09-28T13:00:00.000Z',
    updatedAt: '2026-09-28T13:00:00.000Z',
    latestMessage: {
      id: '00000000-0000-4000-8000-000000000103',
      body: 'Bonjour Moussa, qui est l’interlocuteur exact et a-t-il donné une adresse e-mail directe ?',
      status: 'sent',
      createdAt: '2026-09-28T13:00:00.000Z',
      sender: demoAdmin,
    },
  },
];

const demoMessages: Message[] = [
  {
    id: '00000000-0000-4000-8000-000000000201',
    tenantId: demoConversations[0]!.tenantId,
    conversationId: DEMO_CONVERSATION_ID,
    senderId: DEMO_ADMIN_ID,
    body: 'Bonjour Awa, pouvez-vous préciser le volume mensuel estimé et les langues les plus demandées ? Je prépare une proposition.',
    status: 'sent',
    createdAt: '2026-09-21T15:57:00.000Z',
    updatedAt: '2026-09-21T15:57:00.000Z',
    sender: demoAdmin,
  },
  {
    id: '00000000-0000-4000-8000-000000000202',
    tenantId: demoConversations[0]!.tenantId,
    conversationId: DEMO_CONVERSATION_ID,
    senderId: DEMO_PROSPECTOR_ID,
    body: 'Bonjour, environ 10 à 12 demandes par mois, surtout en dari et en pachto, souvent le soir. La greffière souhaite une réponse sous 2 heures.',
    status: 'sent',
    createdAt: '2026-09-21T17:57:00.000Z',
    updatedAt: '2026-09-21T17:57:00.000Z',
    sender: demoProspector,
  },
];

const demoParticipants: ConversationParticipant[] = [
  {
    id: '00000000-0000-4000-8000-000000000301',
    tenantId: demoConversations[0]!.tenantId,
    conversationId: DEMO_CONVERSATION_ID,
    membershipId: DEMO_ADMIN_ID,
    lastReadAt: '2026-09-21T15:57:00.000Z',
    mutedUntil: null,
    joinedAt: '2026-09-21T13:00:00.000Z',
    displayName: demoAdmin.displayName,
    email: demoAdmin.email,
    roles: demoAdmin.roles,
    designation: demoAdmin.designation,
  },
  {
    id: '00000000-0000-4000-8000-000000000302',
    tenantId: demoConversations[0]!.tenantId,
    conversationId: DEMO_CONVERSATION_ID,
    membershipId: DEMO_PROSPECTOR_ID,
    lastReadAt: null,
    mutedUntil: null,
    joinedAt: '2026-09-21T13:00:00.000Z',
    displayName: demoProspector.displayName,
    email: demoProspector.email,
    roles: demoProspector.roles,
    designation: demoProspector.designation,
  },
];

export default function MessagesPage() {
  const { user } = useAuth();
  const { t, language } = useTranslation();

  /*
   * `userId` on the session is the membership id: the auth guard builds the
   * principal with `userId: payload.membershipId`. Message senders and
   * conversation participants are keyed by membership, so this is the id to
   * compare against.
   */
  const me = user?.userId ?? null;
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const olderLoaded = useRef(false);
  const [participants, setParticipants] = useState<ConversationParticipant[]>([]);
  const [people, setPeople] = useState<Map<string, MessagingMember>>(new Map());

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'waiting' | 'closed'>('all');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draft = activeId ? (drafts[activeId] ?? '') : '';
  const setDraft = (value: string) => {
    if (activeId) setDrafts((current) => ({ ...current, [activeId]: value }));
  };
  const [editing, setEditing] = useState<Message | null>(null);
  const [editBody, setEditBody] = useState('');
  const [deleting, setDeleting] = useState<Message | null>(null);
  const threadScroll = useRef<HTMLDivElement | null>(null);
  const nearBottom = useRef(true);
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const listEnd = useRef<HTMLDivElement | null>(null);

  const loadConversations = useCallback(
    (signal?: AbortSignal): Promise<void> =>
      listConversations({ limit: 50 }, signal)
        .then((page) => {
          if (signal?.aborted) {
            return;
          }

          const serverItems = page.items.filter(
            (item) => !demoConversations.some((demo) => demo.id === item.id),
          );
          const items = DEMO_MESSAGES_ENABLED
            ? [...demoConversations, ...serverItems]
            : serverItems;
          setConversations(items);
          setReadError(null);

          if (DEMO_MESSAGES_ENABLED) {
            setPeople((current) =>
              new Map(current)
                .set(demoAdmin.membershipId, demoAdmin)
                .set(demoProspector.membershipId, demoProspector),
            );
          }

          setActiveId((current) =>
            current && items.some((item) => item.id === current)
              ? current
              : DEMO_MESSAGES_ENABLED
                ? DEMO_CONVERSATION_ID
                : null,
          );
        })
        .catch((caught: unknown) => {
          if (!signal?.aborted) {
            setConversations(DEMO_MESSAGES_ENABLED ? demoConversations : []);
            setReadError(DEMO_MESSAGES_ENABLED ? null : describeMessagingError(caught, t));
            if (DEMO_MESSAGES_ENABLED) {
              setPeople((current) =>
                new Map(current)
                  .set(demoAdmin.membershipId, demoAdmin)
                  .set(demoProspector.membershipId, demoProspector),
              );
            }
          }
        }),
    [],
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadConversations(controller.signal);

    return () => controller.abort();
  }, [loadConversations]);

  useEffect(() => {
    const controller = new AbortController();
    setPeople(new Map());
    listMessagingMembers(controller.signal)
      .then((page) => {
        if (!controller.signal.aborted)
          setPeople(new Map(page.map((item) => [item.membershipId, item])));
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPeople(
            DEMO_MESSAGES_ENABLED
              ? new Map([
                  [demoAdmin.membershipId, demoAdmin],
                  [demoProspector.membershipId, demoProspector],
                ])
              : new Map(),
          );
        }
      });

    return () => controller.abort();
  }, [user?.tenantId]);

  const loadThread = useCallback((conversationId: string, signal?: AbortSignal): Promise<void> => {
    if (DEMO_MESSAGES_ENABLED && conversationId === DEMO_CONVERSATION_ID) {
      setMessages(demoMessages);
      setParticipants(demoParticipants);
      setOlderCursor(null);
      setPeople((current) =>
        new Map(current)
          .set(demoAdmin.membershipId, demoAdmin)
          .set(demoProspector.membershipId, demoProspector),
      );
      return Promise.resolve();
    }

    return Promise.all([
      listMessages(conversationId, { limit: 100 }, signal),
      listParticipants(conversationId, signal).catch(() => []),
    ])
      .then(([page, members]) => {
        if (signal?.aborted) {
          return;
        }

        /* The API returns newest first; a thread reads oldest to newest. */
        setMessages((current) => {
          const recent = [...page.items].reverse();
          const ids = new Set(recent.map((item) => item.id));
          const next = olderLoaded.current
            ? [...(current ?? []).filter((item) => !ids.has(item.id)), ...recent]
            : recent;
          return JSON.stringify(current) === JSON.stringify(next) ? current : next;
        });
        setPeople((current) => {
          const next = new Map(current);
          for (const member of members) {
            next.set(member.membershipId, {
              membershipId: member.membershipId,
              displayName: member.displayName ?? null,
              email: member.email ?? '',
              roles: member.roles ?? [],
              designation: member.designation ?? member.roles?.[0] ?? 'member',
            });
          }
          for (const message of page.items) {
            if (message.sender) next.set(message.sender.membershipId, message.sender);
          }
          return next;
        });
        if (!olderLoaded.current) setOlderCursor(page.nextCursor);
        setParticipants(members);
      })
      .catch((caught: unknown) => {
        if (!signal?.aborted) {
          setMessages([]);
          setActionError(describeMessagingError(caught, t));
        }
      });
  }, []);

  useLiveRefresh(
    async (signal) => {
      await loadConversations(signal);
      if (activeId && !signal.aborted) await loadThread(activeId, signal);
    },
    { interval: 5_000, scope: activeId ?? '' },
  );

  useEffect(() => {
    if (!activeId) {
      setMessages(null);

      return;
    }

    const controller = new AbortController();
    setMessages(null);
    setOlderCursor(null);
    olderLoaded.current = false;
    nearBottom.current = true;

    void loadThread(activeId, controller.signal).then(() => {
      if (!controller.signal.aborted) {
        /* Opening a thread is what marks it read. */
        if (!(DEMO_MESSAGES_ENABLED && activeId === DEMO_CONVERSATION_ID)) {
          markConversationRead(activeId)
            .then(() => void loadConversations())
            .catch(() => undefined);
        }
      }
    });

    return () => controller.abort();
  }, [activeId, loadConversations, loadThread]);

  useEffect(() => {
    if (nearBottom.current && threadScroll.current)
      threadScroll.current.scrollTop = threadScroll.current.scrollHeight;
  }, [messages]);

  const active = useMemo(
    () => conversations?.find((conversation) => conversation.id === activeId) ?? null,
    [activeId, conversations],
  );

  const myParticipation = useMemo(
    () => participants.find((participant) => participant.membershipId === me),
    [me, participants],
  );

  function nameFor(conversation: Conversation, members: ConversationParticipant[]): string {
    const others = members
      .filter((participant) => participant.membershipId !== me)
      .map((participant) => people.get(participant.membershipId))
      .filter((person): person is MessagingMember => Boolean(person))
      .map((person) => membershipName(person));

    return conversationName(conversation, t, others);
  }

  const visible = useMemo(() => {
    if (!conversations) {
      return [];
    }

    const query = search.trim().toLowerCase();

    return conversations.filter((conversation) => {
      const sender = conversation.latestMessage?.sender;
      const haystack = [
        conversationName(conversation, t, sender ? [membershipName(sender)] : []),
        conversation.latestMessage?.body,
        sender ? membershipName(sender) : undefined,
        sender?.designation,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const unread = conversation.latestMessage?.sender?.membershipId !== me;
      const waiting = conversation.latestMessage?.sender?.membershipId === me;
      const matchesFilter =
        filter === 'all' ||
        (filter === 'unread' && unread) ||
        (filter === 'waiting' && waiting) ||
        (filter === 'closed' && conversation.status === 'archived');
      return matchesFilter && haystack.includes(query);
    });
  }, [conversations, search, filter, t, me]);

  async function send(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!activeId || draft.trim().length === 0 || busy) {
      return;
    }

    setBusy(true);
    setActionError(null);

    try {
      if (DEMO_MESSAGES_ENABLED && activeId === DEMO_CONVERSATION_ID) {
        const sender =
          (me ? people.get(me) : undefined) ??
          ({
            membershipId: me ?? 'demo-current-user',
            displayName: user?.displayName ?? 'Vous',
            email: user?.email ?? 'you@example.test',
            roles: ['prospector'],
            designation: 'prospector',
          } satisfies MessagingMember);
        const now = new Date().toISOString();
        const localMessage: Message = {
          id: crypto.randomUUID(),
          tenantId: demoConversations[0]!.tenantId,
          conversationId: DEMO_CONVERSATION_ID,
          senderId: sender.membershipId,
          body: draft.trim(),
          status: 'sent',
          createdAt: now,
          updatedAt: now,
          sender,
        };
        setMessages((current) => [...(current ?? []), localMessage]);
        setPeople((current) => new Map(current).set(sender.membershipId, sender));
        setDraft('');
        setBusy(false);
        return;
      }
      await sendMessage(activeId, draft.trim());

      setDraft('');
      await loadThread(activeId);
      await loadConversations();
    } catch (caught) {
      setActionError(describeMessagingError(caught, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('messages.title')}
        subtitle={t('messages.subtitle')}
        action={
          <Button disabled={loadingOlder} onClick={() => setComposing(true)}>
            <Plus aria-hidden="true" className="mr-2 size-4" />
            {t('messages.newConversation')}
          </Button>
        }
      />

      {readError ? <Alert tone="danger">{readError}</Alert> : null}

      <div className="flex flex-wrap items-center gap-2.5">
        <div
          className="inline-flex gap-0.5 rounded-[11px] bg-surface-muted p-[3px]"
          aria-label={text('Conversation filters', 'Filtres des conversations', language)}
        >
          {(['all', 'unread', 'waiting', 'closed'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`rounded-[9px] px-3.5 py-[7px] text-sm font-bold ${filter === value ? 'bg-surface text-navy shadow-sm' : 'text-ink-muted'}`}
            >
              {value === 'all'
                ? text('All', 'Toutes', language)
                : value === 'unread'
                  ? text('Unread replies', 'Réponses à lire', language)
                  : value === 'waiting'
                    ? text('Waiting for prospect', 'En attente du prospecteur', language)
                    : text('Closed', 'Clôturées', language)}
            </button>
          ))}
        </div>
        <SearchInput
          className="min-w-48 flex-1"
          label={t('messages.search')}
          placeholder={text('Subject or conversation', 'Objet ou conversation', language)}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div
        className={
          active
            ? 'grid items-start gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]'
            : 'grid grid-cols-1'
        }
      >
        <div className={active ? 'hidden lg:block' : ''}>
          {conversations === null ? (
            <div className="mt-4 flex flex-col gap-2" aria-busy="true">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-14 animate-pulse rounded-lg bg-line-soft" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="py-10 text-center">
              <MessagesSquare aria-hidden="true" className="mx-auto size-7 text-line" />

              <p className="mt-3 text-[15px] font-semibold text-navy">
                {t(conversations.length === 0 ? 'messages.none' : 'messages.noMatches')}
              </p>

              {conversations.length === 0 ? (
                <p className="mx-auto mt-2 max-w-xs text-[14px] text-ink-muted">
                  {t('messages.startOne')}
                </p>
              ) : null}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {visible.map((conversation) => {
                const latest = conversation.latestMessage;
                const latestSender = latest?.sender ?? null;
                const subject = conversationName(
                  conversation,
                  t,
                  latestSender ? [membershipName(latestSender)] : [],
                );
                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      disabled={loadingOlder}
                      onClick={() => {
                        nearBottom.current = true;
                        setActiveId(conversation.id);
                      }}
                      className={
                        conversation.id === activeId
                          ? 'w-full rounded-xl border border-brand bg-surface px-3.5 py-3 text-left ring-2 ring-brand/15'
                          : 'w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-left hover:border-brand'
                      }
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-bold text-navy">
                            {subject}
                          </span>
                          <span className="mt-1 block truncate text-[13px] text-ink-muted">
                            {latestSender
                              ? `${membershipName(latestSender)} · ${formatDesignation(latestSender.designation)}`
                              : t(conversationKindLabelKey(conversation.kind))}
                          </span>
                        </span>
                        <span className="shrink-0 text-[12px] text-ink-muted">
                          {formatTimestamp(latest?.createdAt ?? conversation.updatedAt)}
                        </span>
                      </span>

                      <span className="mt-2 flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[13px] text-ink-muted">
                          {latest?.body || text('No messages yet', 'Aucun message', language)}
                        </span>
                        <Badge tone={conversation.status === 'archived' ? 'neutral' : 'success'}>
                          {conversation.status === 'archived'
                            ? text('Closed', 'Clôturée', language)
                            : latest
                              ? text('Active', 'Active', language)
                              : text('Open', 'Ouverte', language)}
                        </Badge>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {active && (
          <Card className="flex min-h-[28rem] flex-col">
            {active === null ? (
              <p className="py-20 text-center text-[15px] text-ink-muted">
                Choose a conversation to read it.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  className="mb-4 self-start text-sm font-bold text-brand hover:underline"
                  onClick={() => setActiveId(null)}
                >
                  {text('← All conversations', '← Toutes les conversations', language)}
                </button>
                <CardHeader
                  title={nameFor(active, participants)}
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-brand"
                        href={`/workspace/conversation-members?id=${active.id}`}
                      >
                        {text('Members', 'Membres', language)}
                      </Link>
                      <Link
                        className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-brand"
                        href={`/workspace/conversation-settings?id=${active.id}`}
                      >
                        {text('Settings', 'Paramètres', language)}
                      </Link>
                      {isMuted(myParticipation) ? (
                        <Badge tone="neutral">
                          <BellOff aria-hidden="true" className="mr-1 inline size-3.5" />
                          {text('Muted', 'En sourdine', language)}
                        </Badge>
                      ) : null}

                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => {
                          const next = isMuted(myParticipation) ? null : muteUntil(8);

                          setBusy(true);

                          muteConversation(active.id, next)
                            .then(() => loadThread(active.id))
                            .catch((caught: unknown) =>
                              setActionError(describeMessagingError(caught, t)),
                            )
                            .finally(() => setBusy(false));
                        }}
                      >
                        {t(isMuted(myParticipation) ? 'messages.unmute' : 'messages.mute8h')}
                      </Button>
                    </div>
                  }
                />

                {active.context ? (
                  <div className="mb-4 rounded-xl border border-line-soft bg-surface-muted px-4 py-3 text-[14px] text-ink-muted">
                    <p>
                      <span className="font-semibold text-navy">
                        {text('Establishment', 'Établissement', language)}:
                      </span>{' '}
                      <span className="font-semibold text-brand">
                        {active.context.establishment}
                      </span>
                      {active.context.location ? ` — ${active.context.location}` : ''}
                    </p>
                    {active.context.action ? (
                      <p className="mt-2">
                        <span className="font-semibold text-navy">
                          {text('Related action', 'Action concernée', language)}:
                        </span>{' '}
                        {active.context.action}
                      </p>
                    ) : null}
                    {active.context.outcome ? (
                      <p className="mt-2 text-ink">{active.context.outcome}</p>
                    ) : null}
                  </div>
                ) : null}

                {actionError ? (
                  <Alert tone="danger" className="mb-4">
                    {actionError}
                  </Alert>
                ) : null}

                <div
                  ref={threadScroll}
                  onScroll={() => {
                    const el = threadScroll.current;
                    if (el)
                      nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                  }}
                  className="max-h-[55vh] min-h-48 flex-1 overflow-y-auto rounded-lg bg-canvas p-4"
                >
                  {olderCursor && (
                    <Button
                      variant="ghost"
                      size="md"
                      loading={loadingOlder}
                      onClick={async () => {
                        if (!activeId || loadingOlder) return;
                        setLoadingOlder(true);
                        const scroller = threadScroll.current;
                        const height = scroller?.scrollHeight ?? 0;
                        try {
                          const page = await listMessages(activeId, {
                            limit: 100,
                            cursor: olderCursor,
                          });
                          olderLoaded.current = true;
                          nearBottom.current = false;
                          setMessages((current) => {
                            const ids = new Set((current ?? []).map((item) => item.id));
                            return [
                              ...page.items.reverse().filter((item) => !ids.has(item.id)),
                              ...(current ?? []),
                            ];
                          });
                          setOlderCursor(page.nextCursor);
                          requestAnimationFrame(() => {
                            if (scroller) scroller.scrollTop += scroller.scrollHeight - height;
                          });
                        } catch (error) {
                          setActionError(describeMessagingError(error, t));
                        } finally {
                          setLoadingOlder(false);
                        }
                      }}
                    >
                      {text('Load older messages', 'Charger les messages précédents', language)}
                    </Button>
                  )}
                  {messages === null ? (
                    <div className="flex flex-col gap-2" aria-busy="true">
                      {[0, 1, 2].map((row) => (
                        <div key={row} className="h-12 animate-pulse rounded-lg bg-line-soft" />
                      ))}
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="py-16 text-center text-[15px] text-ink-muted">
                      {text(
                        'No messages yet. Start the conversation.',
                        'Aucun message pour le moment. Commencez la conversation.',
                        language,
                      )}
                    </p>
                  ) : (
                    <ol className="flex flex-col gap-3">
                      {messages.map((message) => {
                        const mine = message.senderId === me;
                        const sender = message.sender ?? people.get(message.senderId);

                        return (
                          <li
                            key={message.id}
                            className={mine ? 'flex justify-end' : 'flex justify-start'}
                          >
                            <div className="flex max-w-[85%] items-start gap-2.5">
                              {!mine ? (
                                <span
                                  aria-hidden="true"
                                  className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[12px] font-bold text-brand"
                                >
                                  {sender ? initials(sender) : '?'}
                                </span>
                              ) : null}

                              <div
                                className={
                                  mine
                                    ? 'rounded-2xl rounded-br-sm bg-brand px-3.5 py-2.5 text-white'
                                    : 'rounded-2xl rounded-bl-sm bg-surface-muted px-3.5 py-2.5'
                                }
                              >
                                {!mine ? (
                                  <p className="text-[12px] font-semibold text-ink-muted">
                                    {sender ? membershipName(sender) : t('messages.unknownSender')}
                                    {sender ? ` · ${formatDesignation(sender.designation)}` : ''}
                                  </p>
                                ) : null}

                                {message.status === 'deleted' ? (
                                  <p
                                    className={
                                      mine
                                        ? 'text-[14px] italic text-white/70'
                                        : 'text-[14px] italic text-ink-muted'
                                    }
                                  >
                                    {text(
                                      'This message was deleted',
                                      'Ce message a été supprimé',
                                      language,
                                    )}
                                  </p>
                                ) : (
                                  <p
                                    className={
                                      mine
                                        ? 'text-[15px] whitespace-pre-wrap text-white'
                                        : 'text-[15px] whitespace-pre-wrap text-ink'
                                    }
                                  >
                                    {message.body}
                                  </p>
                                )}

                                {message.status !== 'deleted' && (
                                  <MessageAttachments
                                    message={message}
                                    mine={mine}
                                    onUpdated={() => void loadThread(active.id)}
                                  />
                                )}
                                <p
                                  className={
                                    mine
                                      ? 'mt-1 text-[11px] text-white/70'
                                      : 'mt-1 text-[11px] text-ink-muted'
                                  }
                                >
                                  {formatTimestamp(message.createdAt)}
                                  {message.status === 'edited'
                                    ? text(' · edited', ' · modifié', language)
                                    : ''}
                                </p>
                              </div>

                              {mine && message.status === 'sent' && (
                                <button
                                  type="button"
                                  aria-label={text('Edit message', 'Modifier le message', language)}
                                  className="mt-1 shrink-0 p-1 text-ink-muted hover:text-brand"
                                  onClick={() => {
                                    setEditing(message);
                                    setEditBody(message.body);
                                  }}
                                >
                                  <Pencil aria-hidden="true" className="size-4" />
                                </button>
                              )}
                              {mine && message.status !== 'deleted' ? (
                                <button
                                  type="button"
                                  aria-label={t('messages.deleteMessage')}
                                  disabled={busy}
                                  className="mt-1 shrink-0 text-ink-muted hover:text-danger disabled:opacity-40"
                                  onClick={() => setDeleting(message)}
                                >
                                  <Trash2 aria-hidden="true" className="size-4" />
                                </button>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}

                  <div ref={listEnd} />
                </div>

                <form
                  noValidate
                  onSubmit={(event) => void send(event)}
                  className="mt-4 flex gap-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <TextField
                      label={t('messages.message')}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder={t('messages.writeMessage')}
                      maxLength={MAX_MESSAGE_BODY}
                      disabled={busy}
                    />
                  </div>

                  <Button type="submit" loading={busy} disabled={draft.trim().length === 0}>
                    <Send aria-hidden="true" className="size-4" />
                    <span className="sr-only">{t('messages.send')}</span>
                  </Button>
                </form>
              </>
            )}
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={!!deleting}
        title={text('Delete message?', 'Supprimer le message ?', language)}
        description={text(
          'The message will be replaced with a deletion notice.',
          'Le message sera remplacé par un avis de suppression.',
          language,
        )}
        confirmLabel={text('Delete message', 'Supprimer le message', language)}
        busy={busy}
        onClose={() => {
          if (!busy) setDeleting(null);
        }}
        onConfirm={() => {
          if (!deleting || busy) return;
          setBusy(true);
          deleteMessage(deleting.id)
            .then(async () => {
              setDeleting(null);
              if (activeId) await loadThread(activeId);
            })
            .catch((error) => setActionError(describeMessagingError(error, t)))
            .finally(() => setBusy(false));
        }}
      />
      <Drawer
        open={!!editing}
        title={text('Edit message', 'Modifier le message', language)}
        onClose={() => {
          if (!busy) setEditing(null);
        }}
      >
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!editing || busy || !editBody.trim()) return;
            setBusy(true);
            editMessage(editing.id, editBody.trim())
              .then(async () => {
                setEditing(null);
                if (activeId) await loadThread(activeId);
              })
              .catch((error) => setActionError(describeMessagingError(error, t)))
              .finally(() => setBusy(false));
          }}
        >
          {actionError && <Alert tone="danger">{actionError}</Alert>}
          <TextField
            label={t('messages.message')}
            value={editBody}
            maxLength={MAX_MESSAGE_BODY}
            required
            onChange={(e) => setEditBody(e.target.value)}
          />
          <Button type="submit" loading={busy} disabled={!editBody.trim()}>
            {text('Save message', 'Enregistrer le message', language)}
          </Button>
        </form>
      </Drawer>
      <ComposeDrawer
        open={composing}
        people={[...people.values()].filter((person) => person.membershipId !== me)}
        onClose={() => setComposing(false)}
        onCreated={(conversation) => {
          setComposing(false);
          setActiveId(conversation.id);
          void loadConversations();
        }}
      />
    </div>
  );
}

function ComposeDrawer({
  open,
  people,
  onClose,
  onCreated,
}: {
  open: boolean;
  people: MessagingMember[];
  onClose: () => void;
  onCreated: (conversation: Conversation) => void;
}) {
  const { t } = useTranslation();

  const [kind, setKind] = useState<ConversationKind>('direct');
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setKind('direct');
      setTitle('');
      setSelected([]);
      setError(null);
    }
  }, [open]);

  return (
    <Drawer open={open} title={t('messages.newConversation')} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <SelectField
          label={t('messages.kind')}
          value={kind}
          disabled={busy}
          onChange={(event) => setKind(event.target.value as ConversationKind)}
          options={CONVERSATION_KINDS.map((value) => ({
            value,
            label: t(conversationKindLabelKey(value)),
          }))}
        />

        <TextField
          label={t('messages.titleOptional')}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t('messages.titlePlaceholder')}
          maxLength={200}
          disabled={busy}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="text-[14px] font-semibold text-ink">
            {t('messages.participants')}
          </legend>

          {people.length === 0 ? (
            <p className="text-[14px] text-ink-muted">{t('messages.nobodyAvailable')}</p>
          ) : (
            <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              {people.map((person) => (
                <li key={person.membershipId}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line-soft px-3 py-2">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={selected.includes(person.membershipId)}
                      disabled={busy}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, person.membershipId]
                            : current.filter((id) => id !== person.membershipId),
                        )
                      }
                    />

                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-navy">
                        {membershipName(person)}
                      </span>

                      <span className="block truncate text-[12px] text-ink-muted">
                        {person.email} · {formatDesignation(person.designation)}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        {error ? <Alert tone="danger">{error}</Alert> : null}

        <Button
          fullWidth
          loading={busy}
          disabled={selected.length === 0}
          onClick={() => {
            setBusy(true);
            setError(null);

            createConversation({
              kind,
              ...(title.trim() ? { title: title.trim() } : {}),
              participantIds: selected,
            })
              .then(onCreated)
              .catch((caught: unknown) => setError(describeMessagingError(caught, t)))
              .finally(() => setBusy(false));
          }}
        >
          Start conversation
        </Button>
      </div>
    </Drawer>
  );
}

function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const sameDay = new Date().toDateString() === date.toDateString();

  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
}

function initials(member: { displayName?: string | null; email?: string }): string {
  const source = membershipName({
    displayName: member.displayName ?? null,
    email: member.email ?? '',
  });
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0])
      .join('') || '?'
  ).toUpperCase();
}

function formatDesignation(value?: string): string {
  if (!value) return 'Member';
  if (value === 'tenant_admin' || value === 'client_admin') return 'Admin';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function describeMessagingError(error: unknown, t: Translate): string {
  if (!(error instanceof ApiError)) {
    return t('messages.genericError');
  }

  if (error.statusCode === 403) {
    return t('messages.notParticipant');
  }

  if (error.statusCode === 404) {
    return t('messages.gone');
  }

  if (error.statusCode === 400) {
    /* The API's own validation wording, which it already localises or keeps
     * field-specific; replacing it would lose the detail. */
    return error.messages.join(' ');
  }

  return t('messages.unreachable');
}
