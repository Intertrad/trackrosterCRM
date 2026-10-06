'use client';
import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { type FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/ui/dialog';
import { MessageAttachments } from '@/components/messaging/message-attachments';
import { text } from '@/lib/workspace/copy';
import {
  BellOff,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  FileText,
  Info,
  LockKeyhole,
  MessageCircle,
  MessagesSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Reply,
  Search,
  Send,
  Smile,
  Trash2,
  Users,
  UserRound,
  X,
} from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import { membershipName } from '@/lib/api/membership-types';
import {
  createConversation,
  addParticipant,
  deleteMessage,
  editMessage,
  listConversations,
  listMessages,
  listMessagingMembers,
  listParticipants,
  markConversationRead,
  muteConversation,
  removeParticipant,
  sendMessage,
  updateConversation,
} from '@/lib/api/messaging-client';
import { uploadMessageAttachment } from '@/lib/api/message-attachment-client';
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
import { cn } from '@/lib/ui/cn';

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
  const [participantsLoaded, setParticipantsLoaded] = useState(false);
  const [people, setPeople] = useState<Map<string, MessagingMember>>(new Map());

  const [search, setSearch] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const conversationSearchInput = useRef<HTMLInputElement | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'waiting' | 'closed'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draft = activeId ? (drafts[activeId] ?? '') : '';
  const setDraft = (value: string) => {
    if (activeId) setDrafts((current) => ({ ...current, [activeId]: value }));
  };
  const [editing, setEditing] = useState<Message | null>(null);
  const [editBody, setEditBody] = useState('');
  const [deleting, setDeleting] = useState<Message | null>(null);
  const threadScroll = useRef<HTMLDivElement | null>(null);
  const composerInput = useRef<HTMLTextAreaElement | null>(null);
  const nearBottom = useRef(true);
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [composerFile, setComposerFile] = useState<File | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pendingAttachmentMessageId, setPendingAttachmentMessageId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const composerFileId = useId();
  const [readError, setReadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const listEnd = useRef<HTMLDivElement | null>(null);

  const loadConversations = useCallback(
    (signal?: AbortSignal): Promise<void> =>
      listConversations({ limit: 50 }, signal)
        .then((page) => {
          if (signal?.aborted) {
            return;
          }

          const items = page.items;
          setConversations(items);
          setReadError(null);

          setActiveId((current) =>
            current && items.some((item) => item.id === current) ? current : null,
          );
        })
        .catch((caught: unknown) => {
          if (!signal?.aborted) {
            setConversations([]);
            setReadError(describeMessagingError(caught, t));
          }
        }),
    [t],
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
          setPeople(new Map());
        }
      });

    return () => controller.abort();
  }, [user?.tenantId]);

  const loadThread = useCallback(
    (conversationId: string, signal?: AbortSignal): Promise<void> => {
      return Promise.all([
        listMessages(conversationId, { limit: 100 }, signal),
        listParticipants(conversationId, signal)
          .then((members) => ({ members, loaded: true }))
          .catch(() => ({ members: [] as ConversationParticipant[], loaded: false })),
      ])
        .then(([page, participantResult]) => {
          if (signal?.aborted) {
            return;
          }

          const { members, loaded: participantsAreAuthoritative } = participantResult;

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
          setParticipantsLoaded(participantsAreAuthoritative);
        })
        .catch((caught: unknown) => {
          if (!signal?.aborted) {
            setMessages([]);
            setActionError(describeMessagingError(caught, t));
          }
        });
    },
    [t],
  );

  useLiveRefresh(
    async (signal) => {
      await loadConversations(signal);
      if (activeId && !signal.aborted) await loadThread(activeId, signal);
    },
    { interval: 5_000, scope: activeId ?? '' },
  );

  useEffect(() => {
    // Never carry a selected file or a failed upload retry into another thread.
    setComposerFile(null);
    setPendingAttachmentMessageId(null);
    setUploadProgress(null);

    if (!activeId) {
      setMessages(null);

      return;
    }

    const controller = new AbortController();
    setMessages(null);
    setParticipantsLoaded(false);
    setOlderCursor(null);
    olderLoaded.current = false;
    nearBottom.current = true;

    void loadThread(activeId, controller.signal).then(() => {
      if (!controller.signal.aborted) {
        /* Opening a thread is what marks it read. */
        markConversationRead(activeId)
          .then(() => {
            window.dispatchEvent(new Event('trackroster:messages-read'));
            return loadConversations();
          })
          .catch(() => undefined);
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

    const filtered = conversations.filter((conversation) => {
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

    return [...filtered].sort((left, right) => {
      const leftTime = Date.parse(left.latestMessage?.createdAt ?? left.updatedAt);
      const rightTime = Date.parse(right.latestMessage?.createdAt ?? right.updatedAt);
      return sortOrder === 'newest' ? rightTime - leftTime : leftTime - rightTime;
    });
  }, [conversations, search, filter, t, me, sortOrder]);

  const filterCounts = useMemo(() => {
    const items = conversations ?? [];
    return {
      all: items.length,
      unread: items.filter(
        (conversation) => conversation.latestMessage?.sender?.membershipId !== me,
      ).length,
      waiting: items.filter(
        (conversation) => conversation.latestMessage?.sender?.membershipId === me,
      ).length,
      closed: items.filter((conversation) => conversation.status === 'archived').length,
    };
  }, [conversations, me]);

  const sharedFiles = useMemo(() => {
    const files = (messages ?? []).flatMap((message) => message.attachments ?? []);
    return [...new Map(files.map((file) => [file.id, file])).values()];
  }, [messages]);

  async function send(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!activeId || busy || (draft.trim().length === 0 && !pendingAttachmentMessageId)) {
      return;
    }

    const body = draft.trim();
    const file = composerFile;
    setBusy(true);
    setActionError(null);

    try {
      const sentMessage = pendingAttachmentMessageId
        ? { id: pendingAttachmentMessageId }
        : await sendMessage(activeId, body);

      if (!pendingAttachmentMessageId) setDraft('');
      if (file) {
        setPendingAttachmentMessageId(sentMessage.id);
        setUploadProgress(0);
        try {
          await uploadMessageAttachment(sentMessage.id, file, setUploadProgress);
          setComposerFile(null);
          setPendingAttachmentMessageId(null);
        } catch {
          setActionError(
            text(
              'Message sent, but the attachment could not be uploaded. Retry it from the composer.',
              'Message envoyé, mais la pièce jointe n’a pas pu être transférée. Réessayez depuis le composeur.',
              language,
            ),
          );
        } finally {
          setUploadProgress(null);
        }
      }
      await loadThread(activeId);
      await loadConversations();
    } catch (caught) {
      setActionError(describeMessagingError(caught, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        className={cn('flex flex-wrap items-end justify-between gap-4', active && 'max-lg:hidden')}
      >
        <div>
          <h1 className="text-[27px] font-extrabold tracking-[-0.03em] text-navy">
            {t('messages.title')}
          </h1>
          <p className="mt-1 text-[14px] text-ink-muted">{t('messages.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={text('Search conversations', 'Rechercher une conversation', language)}
            aria-pressed={mobileSearchOpen}
            onClick={() => setMobileSearchOpen((open) => !open)}
            className="flex size-11 items-center justify-center rounded-lg border border-line bg-surface text-ink-soft shadow-raised hover:border-brand hover:text-brand focus-visible:outline-brand sm:hidden"
          >
            <Search aria-hidden="true" className="size-5" />
          </button>
          <Button className="hidden sm:inline-flex" onClick={() => setComposing(true)}>
            <Plus aria-hidden="true" className="size-4" />
            {t('messages.newConversation')}
          </Button>
          <button
            type="button"
            aria-label={t('messages.newConversation')}
            onClick={() => setComposing(true)}
            className="flex size-11 items-center justify-center rounded-lg bg-brand text-white shadow-raised hover:bg-brand-hover focus-visible:outline-brand sm:hidden"
          >
            <Plus aria-hidden="true" className="size-6" />
          </button>
        </div>
      </div>

      {readError ? <Alert tone="danger">{readError}</Alert> : null}

      <section className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-raised max-lg:-mx-4 max-lg:rounded-none max-lg:border-x-0 max-lg:shadow-none">
        <div
          className={cn(
            'h-[min(760px,calc(100dvh-180px))] min-h-0 max-lg:flex max-lg:h-[calc(100dvh-148px)]',
            active
              ? 'grid lg:grid-cols-[348px_minmax(0,1fr)_294px]'
              : 'grid lg:grid-cols-[348px_minmax(0,1fr)]',
          )}
        >
          <aside
            className={cn(
              'min-h-0 border-b border-line lg:border-r lg:border-b-0',
              active && 'max-lg:hidden',
            )}
          >
            <div className="border-b border-line p-3">
              <label className="relative block">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
                />
                <input
                  ref={conversationSearchInput}
                  aria-label={t('messages.search')}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={text(
                    'Filter by subject, person or prospect',
                    'Filtrer par objet, personne ou prospect',
                    language,
                  )}
                  className={cn(
                    'h-10 w-full rounded-lg border border-line bg-surface px-9 text-[13px] text-ink outline-none placeholder:text-ink-muted focus:border-brand',
                    !mobileSearchOpen && 'max-lg:hidden',
                  )}
                />
              </label>
              <div
                className="mt-2 grid grid-cols-4 gap-0.5 rounded-[10px] bg-surface-muted p-1"
                aria-label={text('Conversation filters', 'Filtres des conversations', language)}
              >
                {(['all', 'unread', 'waiting', 'closed'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                    className={`min-w-0 rounded-lg px-1 py-2 text-[12px] font-bold ${filter === value ? 'bg-surface text-navy shadow-sm' : 'text-ink-muted hover:text-navy'}`}
                  >
                    {value === 'all'
                      ? text('All', 'Toutes', language)
                      : value === 'unread'
                        ? text('Unread', 'Non lues', language)
                        : value === 'waiting'
                          ? text('Waiting', 'En attente', language)
                          : text('Closed', 'Fermées', language)}{' '}
                    <span className="text-brand">{filterCounts[value]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="hidden items-center justify-between px-4 pt-3 pb-2 lg:flex">
              <p className="text-[11px] font-extrabold tracking-[0.08em] text-ink-muted">
                {visible.length
                  ? text('CONVERSATIONS', 'CONVERSATIONS', language)
                  : text('INBOX', 'BOÎTE DE RÉCEPTION', language)}
              </p>
              <button
                type="button"
                aria-pressed={sortOrder === 'oldest'}
                onClick={() =>
                  setSortOrder((current) => (current === 'newest' ? 'oldest' : 'newest'))
                }
                className="text-[12px] font-bold text-brand hover:underline"
              >
                {sortOrder === 'newest'
                  ? text('Sort: newest', 'Tri : récent', language)
                  : text('Sort: oldest', 'Tri : ancien', language)}
              </button>
            </div>

            <div className="max-h-[calc(100dvh-340px)] overflow-y-auto pb-2 max-lg:max-h-[calc(100dvh-280px)]">
              {conversations === null ? (
                <div className="space-y-2 px-3" aria-busy="true">
                  {[0, 1, 2, 3].map((row) => (
                    <div key={row} className="h-[78px] animate-pulse rounded-lg bg-line-soft" />
                  ))}
                </div>
              ) : visible.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <MessagesSquare aria-hidden="true" className="mx-auto size-7 text-line" />
                  <p className="mt-3 text-[14px] font-semibold text-navy">
                    {t(conversations.length === 0 ? 'messages.none' : 'messages.noMatches')}
                  </p>
                  {conversations.length === 0 ? (
                    <p className="mt-2 text-[13px] text-ink-muted">{t('messages.startOne')}</p>
                  ) : null}
                </div>
              ) : (
                <ul>
                  {visible.map((conversation, index) => {
                    const latest = conversation.latestMessage;
                    const latestSender = latest?.sender ?? null;
                    const subject = conversationName(
                      conversation,
                      t,
                      latestSender ? [membershipName(latestSender)] : [],
                    );
                    const unread = latest?.sender?.membershipId !== me;
                    const waiting = latest?.sender?.membershipId === me;
                    const isOverdue = waiting && isOlderThan(latest?.createdAt, 48);
                    const previous = visible[index - 1];
                    const previousLatest = previous?.latestMessage;
                    const previousWaiting = previousLatest?.sender?.membershipId === me;
                    const previousOverdue =
                      previousWaiting && isOlderThan(previousLatest?.createdAt, 48);
                    const group = isOverdue ? 'overdue' : 'week';
                    const previousGroup = index === 0 ? '' : previousOverdue ? 'overdue' : 'week';
                    return (
                      <li key={conversation.id}>
                        {group !== previousGroup ? (
                          <div className="px-4 pt-3 pb-1.5 text-[11px] font-extrabold tracking-[0.08em] text-ink-muted">
                            {group === 'overdue'
                              ? text('OVERDUE', 'EN RETARD', language)
                              : text('THIS WEEK', 'CETTE SEMAINE', language)}
                          </div>
                        ) : null}
                        <button
                          type="button"
                          disabled={loadingOlder}
                          onClick={() => {
                            nearBottom.current = true;
                            setActiveId(conversation.id);
                          }}
                          className={`relative flex w-full items-start gap-3 border-b border-line-soft px-3.5 py-3 text-left transition-colors hover:bg-canvas ${conversation.id === activeId ? 'bg-brand-wash' : ''}`}
                        >
                          {conversation.id === activeId ? (
                            <span className="absolute inset-y-0 left-0 w-[3px] bg-brand" />
                          ) : null}
                          <span
                            className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold ${unread ? 'bg-brand-tint text-brand' : 'bg-surface-muted text-ink-muted'}`}
                          >
                            {latestSender ? (
                              initials(latestSender)
                            ) : (
                              <MessageCircle aria-hidden="true" className="size-4" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2">
                              <span
                                className={`truncate text-[14px] ${unread ? 'font-extrabold text-navy' : 'font-bold text-ink'}`}
                              >
                                {subject}
                              </span>
                              <span className="shrink-0 text-[11px] text-ink-muted">
                                {formatTimestamp(latest?.createdAt ?? conversation.updatedAt)}
                              </span>
                            </span>
                            <span className="mt-0.5 block truncate text-[12px] text-ink-muted">
                              {latestSender
                                ? `${membershipName(latestSender)} · ${formatDesignation(latestSender.designation)}`
                                : t(conversationKindLabelKey(conversation.kind))}
                            </span>
                            <span className="mt-1 flex items-center gap-2">
                              <span className="min-w-0 flex-1 truncate text-[12px] text-ink-muted">
                                {latest?.body || text('No messages yet', 'Aucun message', language)}
                              </span>
                              {conversation.status === 'archived' ? (
                                <Badge tone="neutral">{text('Closed', 'Fermée', language)}</Badge>
                              ) : waiting ? (
                                <Badge tone={isOverdue ? 'warning' : 'brand'} dot>
                                  {isOverdue
                                    ? text('Waiting overdue', 'En attente · en retard', language)
                                    : text('Waiting', 'En attente', language)}
                                </Badge>
                              ) : null}
                            </span>
                          </span>
                          {unread ? (
                            <span className="mt-1 size-2 shrink-0 rounded-full bg-success" />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          <section
            className={cn(
              'flex min-h-0 min-w-0 flex-col bg-surface text-ink',
              !active && 'max-lg:hidden',
            )}
          >
            {!active ? (
              <div className="flex flex-1 flex-col items-center justify-center bg-surface px-6 py-20 text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-brand-tint text-brand">
                  <MessageCircle aria-hidden="true" className="size-8" />
                </div>
                <h2 className="mt-5 text-[19px] font-extrabold tracking-[-0.02em] text-navy">
                  {text(
                    'Pick a conversation to read it here',
                    'Choisissez une conversation à lire ici',
                    language,
                  )}
                </h2>
                <p className="mt-2 max-w-md text-[14px] leading-6 text-ink-muted">
                  {filterCounts.waiting > 0
                    ? text(
                        `${filterCounts.waiting} conversation${filterCounts.waiting === 1 ? '' : 's'} are waiting for a prospect reply.`,
                        `${filterCounts.waiting} conversation${filterCounts.waiting === 1 ? ' est' : 's sont'} en attente d’une réponse.`,
                        language,
                      )
                    : text(
                        'Your conversations will appear here when you select one from the list.',
                        'Vos conversations apparaîtront ici lorsque vous en sélectionnerez une.',
                        language,
                      )}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Button onClick={() => setComposing(true)}>
                    <Plus aria-hidden="true" className="size-4" />
                    {t('messages.newConversation')}
                  </Button>
                  {filterCounts.waiting > 0 ? (
                    <Button variant="secondary" onClick={() => setFilter('waiting')}>
                      {text('Open waiting', 'Ouvrir les attentes', language)}
                    </Button>
                  ) : null}
                </div>
                <p className="mt-6 text-[12px] text-ink-muted">
                  {text(
                    'Tip — press C to start a conversation, J / K to move through the list.',
                    'Astuce — appuyez sur C pour démarrer, J / K pour parcourir la liste.',
                    language,
                  )}
                </p>
              </div>
            ) : (
              <>
                <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    className="rounded-md p-1 text-ink-muted hover:bg-surface-muted hover:text-ink lg:hidden"
                    onClick={() => setActiveId(null)}
                    aria-label={text('Back to conversations', 'Retour aux conversations', language)}
                  >
                    <ChevronRight aria-hidden="true" className="size-5 rotate-180" />
                  </button>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[13px] font-extrabold text-brand">
                    {initials({ displayName: nameFor(active, participants), email: '' })}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[15px] font-extrabold text-navy">
                      {nameFor(active, participants)}
                    </h2>
                    <p className="truncate text-[12px] text-ink-muted">
                      {active.context?.establishment ?? t(conversationKindLabelKey(active.kind))}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={text(
                      'Search conversation',
                      'Rechercher dans la conversation',
                      language,
                    )}
                    onClick={() => conversationSearchInput.current?.focus()}
                    className="hidden rounded-md p-2 text-ink-muted hover:bg-surface-muted hover:text-ink sm:block"
                  >
                    <Search aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={text('More conversation actions', 'Plus d’actions', language)}
                    onClick={() => setSettingsOpen(true)}
                    className="rounded-md p-2 text-ink-muted hover:bg-surface-muted hover:text-ink"
                  >
                    <MoreHorizontal aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMembersOpen(true)}
                    className="hidden items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12px] font-bold text-ink-soft hover:border-brand-pale hover:bg-brand-wash sm:flex"
                  >
                    <Users aria-hidden="true" className="size-3.5" />
                    {text('Members', 'Membres', language)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="hidden rounded-lg border border-line px-3 py-2 text-[12px] font-bold text-ink-soft hover:border-brand-pale hover:bg-brand-wash sm:block"
                  >
                    {text('Settings', 'Paramètres', language)}
                  </button>
                  <button
                    type="button"
                    aria-label={t(isMuted(myParticipation) ? 'messages.unmute' : 'messages.mute8h')}
                    className="hidden rounded-md p-2 text-ink-muted hover:bg-surface-muted hover:text-ink sm:block"
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
                    <BellOff aria-hidden="true" className="size-4" />
                  </button>
                  <div className="hidden items-center gap-1 border-l border-line pl-2 sm:flex">
                    <button
                      type="button"
                      aria-label={text(
                        'Conversation info',
                        'Informations de la conversation',
                        language,
                      )}
                      className="rounded-full p-2 text-brand hover:bg-brand-wash"
                      onClick={() => setSettingsOpen(true)}
                    >
                      <Info aria-hidden="true" className="size-5" />
                    </button>
                  </div>
                </header>

                {active.context ? (
                  <Link
                    href={`/search?q=${encodeURIComponent(active.context.establishment)}`}
                    className="mx-4 mt-3 flex items-center justify-between rounded-lg border border-brand-tint bg-brand-wash px-3 py-2 text-[12px] text-ink-soft hover:border-brand sm:mx-5"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-bold text-navy">{active.context.establishment}</span>
                      {active.context.location ? ` · ${active.context.location}` : ''}
                      {active.context.action ? ` · ${active.context.action}` : ''}
                    </span>
                    <ChevronRight aria-hidden="true" className="ml-2 size-4 shrink-0 text-brand" />
                  </Link>
                ) : null}
                {actionError ? (
                  <Alert tone="danger" className="mx-4 mt-3 sm:mx-5">
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
                  className="min-h-0 flex-1 overflow-y-auto bg-surface px-4 py-4 sm:px-6"
                >
                  {olderCursor ? (
                    <div className="mb-4 text-center">
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
                    </div>
                  ) : null}
                  {messages === null ? (
                    <div className="space-y-3" aria-busy="true">
                      {[0, 1, 2].map((row) => (
                        <div
                          key={row}
                          className={`h-16 animate-pulse rounded-xl bg-line-soft ${row === 1 ? 'ml-auto max-w-[70%]' : 'max-w-[75%]'}`}
                        />
                      ))}
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full min-h-64 items-center justify-center text-center text-[14px] text-ink-muted">
                      {text(
                        'No messages yet. Start the conversation.',
                        'Aucun message pour le moment. Commencez la conversation.',
                        language,
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col items-center py-7 text-center">
                        <span className="flex size-20 items-center justify-center rounded-full bg-brand-tint text-xl font-extrabold text-brand shadow-raised">
                          {initials({ displayName: nameFor(active, participants), email: '' })}
                        </span>
                        <p className="mt-3 text-[20px] font-semibold text-navy">
                          {nameFor(active, participants)}
                        </p>
                        <p className="mt-1 text-[14px] text-ink-muted">
                          {active.kind === 'team' || active.kind === 'campaign'
                            ? text('You created this group', 'Vous avez créé ce groupe', language)
                            : text('Conversation started', 'Conversation démarrée', language)}
                        </p>
                      </div>
                      <div className="mb-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                        <span className="h-px flex-1 bg-line-soft" />
                        <span>{formatDateDivider(messages[0]?.createdAt)}</span>
                        <span className="h-px flex-1 bg-line-soft" />
                      </div>
                      <ol className="flex flex-col gap-4">
                        {messages.map((message) => {
                          const mine = message.senderId === me;
                          const sender = message.sender ?? people.get(message.senderId);
                          const readByOther =
                            mine &&
                            participants.some((participant) => {
                              if (participant.membershipId === me || !participant.lastReadAt)
                                return false;
                              const readAt = new Date(participant.lastReadAt).getTime();
                              const sentAt = new Date(message.createdAt).getTime();
                              return (
                                !Number.isNaN(readAt) && !Number.isNaN(sentAt) && readAt >= sentAt
                              );
                            });
                          return (
                            <li
                              key={message.id}
                              className={mine ? 'flex justify-end' : 'flex justify-start'}
                            >
                              <div
                                className={`group flex max-w-[92%] items-end gap-2 sm:max-w-[78%] ${mine ? 'flex-row-reverse' : ''}`}
                              >
                                {!mine ? (
                                  <span
                                    aria-hidden="true"
                                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[11px] font-extrabold text-brand"
                                  >
                                    {sender ? initials(sender) : '?'}
                                  </span>
                                ) : null}
                                <div className="min-w-0">
                                  {!mine ? (
                                    <p className="mb-1 px-1 text-[11px] font-bold text-ink-muted">
                                      {sender
                                        ? membershipName(sender)
                                        : t('messages.unknownSender')}{' '}
                                      {sender ? `· ${formatDesignation(sender.designation)}` : ''}
                                    </p>
                                  ) : null}
                                  <div
                                    className={
                                      mine
                                        ? 'rounded-2xl rounded-br-md bg-brand px-3.5 py-3 text-white shadow-raised'
                                        : 'rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-3 text-ink shadow-raised'
                                    }
                                  >
                                    {message.status === 'deleted' ? (
                                      <p className="text-[14px] italic opacity-70">
                                        {text(
                                          'This message was deleted',
                                          'Ce message a été supprimé',
                                          language,
                                        )}
                                      </p>
                                    ) : (
                                      <p className="whitespace-pre-wrap text-[14px] leading-5">
                                        {message.body}
                                      </p>
                                    )}
                                    {message.status !== 'deleted' ? (
                                      <MessageAttachments
                                        message={message}
                                        mine={mine}
                                        onUpdated={() => void loadThread(active.id)}
                                      />
                                    ) : null}
                                  </div>
                                  <p
                                    className={`mt-1 flex items-center gap-1 px-1 text-[11px] text-ink-muted ${mine ? 'justify-end' : ''}`}
                                  >
                                    {formatTimestamp(message.createdAt)}
                                    {message.status === 'edited'
                                      ? text(' · edited', ' · modifié', language)
                                      : ''}
                                    {mine ? (
                                      readByOther ? (
                                        <>
                                          <CheckCheck
                                            aria-hidden="true"
                                            className="size-3 text-success"
                                          />
                                          {text('Read', 'Lu', language)}
                                        </>
                                      ) : (
                                        <>
                                          <Check aria-hidden="true" className="size-3" />
                                          {text('Sent', 'Envoyé', language)}
                                        </>
                                      )
                                    ) : null}
                                  </p>
                                </div>
                                {mine ? (
                                  <div className="hidden items-center gap-0.5 pb-7 text-ink-muted group-hover:flex sm:flex">
                                    {message.status === 'sent' &&
                                    participantsLoaded &&
                                    !readByOther ? (
                                      <button
                                        type="button"
                                        aria-label={text(
                                          'Edit message',
                                          'Modifier le message',
                                          language,
                                        )}
                                        className="rounded p-1 hover:bg-surface-muted hover:text-ink"
                                        onClick={() => {
                                          setEditing(message);
                                          setEditBody(message.body);
                                        }}
                                      >
                                        <Pencil aria-hidden="true" className="size-3.5" />
                                      </button>
                                    ) : null}
                                    {message.status === 'sent' &&
                                    participantsLoaded &&
                                    !readByOther ? (
                                      <button
                                        type="button"
                                        aria-label={t('messages.deleteMessage')}
                                        disabled={busy}
                                        className="rounded p-1 hover:bg-danger-bg hover:text-danger disabled:opacity-40"
                                        onClick={() => setDeleting(message)}
                                      >
                                        <Trash2 aria-hidden="true" className="size-3.5" />
                                      </button>
                                    ) : null}
                                  </div>
                                ) : null}
                                {!mine ? (
                                  <div className="mb-7 hidden items-center gap-0.5 text-ink-muted group-hover:flex sm:flex">
                                    <button
                                      type="button"
                                      aria-label={text(
                                        'React to message',
                                        'Réagir au message',
                                        language,
                                      )}
                                      title={text('Insert a smile', 'Insérer un sourire', language)}
                                      className="rounded-full p-1.5 text-ink-muted hover:bg-surface-muted hover:text-ink"
                                      onClick={() => {
                                        setDraft(`${draft}🙂`);
                                        requestAnimationFrame(() => composerInput.current?.focus());
                                      }}
                                    >
                                      <Smile aria-hidden="true" className="size-4" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={text(
                                        'Reply to message',
                                        'Répondre au message',
                                        language,
                                      )}
                                      className="rounded-full p-1.5 hover:bg-surface-muted hover:text-ink"
                                      onClick={() => {
                                        setDraft(
                                          draft
                                            ? `${draft}\n\n> ${message.body}`
                                            : `> ${message.body}\n\n`,
                                        );
                                        requestAnimationFrame(() => composerInput.current?.focus());
                                      }}
                                    >
                                      <Reply aria-hidden="true" className="size-4" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled
                                      aria-label={text(
                                        'More message actions',
                                        'Plus d’actions sur le message',
                                        language,
                                      )}
                                      title={text(
                                        'More message actions are not configured',
                                        'Les autres actions ne sont pas configurées',
                                        language,
                                      )}
                                      className="rounded-full p-1.5 text-ink-muted opacity-50"
                                    >
                                      <MoreHorizontal aria-hidden="true" className="size-4" />
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </>
                  )}
                  <div ref={listEnd} />
                </div>

                <div className="bg-surface px-4 pt-2 text-center text-[11px] leading-4 text-ink-muted sm:px-6">
                  <LockKeyhole aria-hidden="true" className="mr-1 inline size-3.5 align-[-2px]" />
                  {text(
                    'Messages and calls are secured with end-to-end encryption.',
                    'Les messages et appels sont sécurisés par chiffrement de bout en bout.',
                    language,
                  )}
                </div>
                <div className="flex gap-2 overflow-x-auto px-4 pt-3 lg:hidden">
                  {[
                    text('Documents uploaded', 'Documents envoyés', language),
                    text("I'll call them today", 'Je les appelle aujourd’hui', language),
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setDraft(suggestion)}
                      className="shrink-0 rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-bold text-ink-soft hover:border-brand hover:bg-brand-wash hover:text-brand"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                <form
                  noValidate
                  onSubmit={(event) => void send(event)}
                  className="border-t border-line bg-surface p-3 sm:p-4"
                >
                  <label htmlFor={`${composerFileId}-message`} className="sr-only">
                    {t('messages.message')}
                  </label>
                  <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
                    <textarea
                      ref={composerInput}
                      id={`${composerFileId}-message`}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                      placeholder={text(
                        'Write a message… use @ to mention, / for a saved reply',
                        'Écrivez un message… utilisez @ pour mentionner',
                        language,
                      )}
                      maxLength={MAX_MESSAGE_BODY}
                      disabled={busy}
                      rows={2}
                      className="min-h-14 w-full resize-y border-0 bg-transparent px-0 py-1 text-[14px] text-ink outline-none placeholder:text-ink-muted disabled:cursor-not-allowed disabled:text-ink-muted"
                    />
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1 text-ink-muted">
                        <input
                          id={composerFileId}
                          type="file"
                          className="sr-only"
                          disabled={busy}
                          onChange={(event) => {
                            const next = event.target.files?.[0] ?? null;
                            event.currentTarget.value = '';
                            if (!next) return;
                            if (!next.size || next.size > 25_000_000) {
                              setActionError(
                                text(
                                  'Choose a non-empty file smaller than 25 MB.',
                                  'Choisissez un fichier non vide de moins de 25 Mo.',
                                  language,
                                ),
                              );
                              return;
                            }
                            setActionError(null);
                            setComposerFile(next);
                          }}
                        />
                        <label
                          htmlFor={composerFileId}
                          title={text('Add attachment', 'Ajouter une pièce jointe', language)}
                          className="flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-surface-muted hover:text-ink has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55"
                        >
                          <Paperclip aria-hidden="true" className="size-[17px]" />
                          <span className="sr-only">
                            {text('Add attachment', 'Ajouter une pièce jointe', language)}
                          </span>
                        </label>
                        <div className="relative">
                          <button
                            type="button"
                            aria-label={text('Insert emoji', 'Insérer un emoji', language)}
                            aria-expanded={emojiOpen}
                            onClick={() => setEmojiOpen((current) => !current)}
                            disabled={busy}
                            className="flex size-8 items-center justify-center rounded-md hover:bg-surface-muted hover:text-ink disabled:opacity-50"
                          >
                            <Smile aria-hidden="true" className="size-[17px]" />
                          </button>
                          {emojiOpen ? (
                            <div
                              role="toolbar"
                              aria-label={text('Emoji', 'Emojis', language)}
                              className="absolute bottom-10 left-0 z-30 flex gap-1 rounded-xl border border-line bg-surface p-2 shadow-lg"
                            >
                              {['🙂', '👍', '❤️', '🎉', '😂', '😮', '😢'].map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  className="rounded-lg p-1.5 text-lg hover:bg-surface-muted"
                                  onClick={() => {
                                    setDraft(`${draft}${emoji}`);
                                    setEmojiOpen(false);
                                    requestAnimationFrame(() => composerInput.current?.focus());
                                  }}
                                >
                                  <span aria-hidden="true">{emoji}</span>
                                  <span className="sr-only">{emoji}</span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          disabled
                          title={text(
                            'Saved replies are not configured',
                            'Les réponses enregistrées ne sont pas configurées',
                            language,
                          )}
                          className="hidden size-8 items-center justify-center rounded-md text-ink-muted opacity-50 sm:flex"
                          aria-label={text('Saved replies', 'Réponses enregistrées', language)}
                        >
                          <FileText aria-hidden="true" className="size-[17px]" />
                        </button>
                        <span className="hidden text-[11px] text-ink-muted sm:inline">
                          {text(
                            'Enter to send · Shift + Enter for a new line',
                            'Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne',
                            language,
                          )}
                        </span>
                      </div>
                      <Button
                        type="submit"
                        size="md"
                        loading={busy}
                        disabled={draft.trim().length === 0 && !pendingAttachmentMessageId}
                        className="bg-brand text-white hover:bg-brand-hover active:bg-brand-active"
                      >
                        {t('messages.send')} <Send aria-hidden="true" className="size-4" />
                      </Button>
                    </div>
                  </div>
                  {composerFile ? (
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-line bg-brand-wash px-3 py-2 text-[12px] text-ink">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText aria-hidden="true" className="size-4 shrink-0 text-brand" />
                        <div className="min-w-0">
                          <p className="truncate font-bold">{composerFile.name}</p>
                          <p className="text-[11px] text-ink-muted">
                            {formatFileSize(composerFile.size)}
                            {uploadProgress !== null ? ` · ${uploadProgress}%` : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={text(
                          'Remove attachment',
                          'Supprimer la pièce jointe',
                          language,
                        )}
                        className="rounded p-1 text-ink-muted hover:text-danger"
                        disabled={busy}
                        onClick={() => {
                          setComposerFile(null);
                          setPendingAttachmentMessageId(null);
                        }}
                      >
                        <X aria-hidden="true" className="size-4" />
                      </button>
                    </div>
                  ) : null}
                  {uploadProgress !== null ? (
                    <div
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-soft"
                      aria-label={text('Upload progress', 'Progression du transfert', language)}
                    >
                      <div
                        className="h-full rounded-full bg-brand transition-[width]"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  ) : null}
                </form>
              </>
            )}
          </section>

          {active ? (
            <aside className="hidden border-l border-line bg-surface lg:block">
              <div className="border-b border-line px-4 py-3">
                <p className="text-[11px] font-extrabold tracking-[0.08em] text-ink-muted">
                  {text('LINKED PROSPECT', 'PROSPECT LIÉ', language)}
                </p>
              </div>
              <div className="space-y-5 p-4">
                <div className="rounded-xl border border-line p-3">
                  <p className="text-[14px] font-extrabold text-navy">
                    {active.context?.establishment ??
                      text('Team conversation', 'Conversation d’équipe', language)}
                  </p>
                  {active.context?.location ? (
                    <p className="mt-1 text-[12px] text-ink-muted">{active.context.location}</p>
                  ) : null}
                  {active.context?.outcome ? (
                    <p className="mt-3 text-[12px] leading-5 text-ink-muted">
                      {active.context.outcome}
                    </p>
                  ) : null}
                  {active.context?.establishment ? (
                    <Link
                      href={`/search?q=${encodeURIComponent(active.context.establishment)}`}
                      className="mt-3 flex items-center justify-between rounded-lg border border-line px-3 py-2 text-[12px] font-bold text-brand hover:bg-brand-wash"
                    >
                      {text('Open prospect record', 'Ouvrir la fiche prospect', language)}
                      <ChevronRight aria-hidden="true" className="size-4" />
                    </Link>
                  ) : null}
                </div>
                {active.context?.action ? (
                  <div>
                    <p className="text-[11px] font-extrabold tracking-[0.08em] text-ink-muted">
                      {text('NEXT FOLLOW-UP', 'PROCHAINE RELANCE', language)}
                    </p>
                    <div className="mt-2 flex items-start gap-2 rounded-xl border border-line p-3">
                      <CalendarDays aria-hidden="true" className="mt-0.5 size-4 text-brand" />
                      <p className="text-[12px] text-ink">
                        <span className="font-bold">{active.context.action}</span>
                        <br />
                        <span className="text-ink-muted">
                          {active.context.outcome ??
                            text(
                              'Details in prospect record',
                              'Détails dans la fiche prospect',
                              language,
                            )}
                        </span>
                      </p>
                    </div>
                  </div>
                ) : null}
                <div>
                  <p className="text-[11px] font-extrabold tracking-[0.08em] text-ink-muted">
                    {text('PARTICIPANTS', 'PARTICIPANTS', language)}
                  </p>
                  <ul className="mt-2 divide-y divide-line-soft rounded-xl border border-line px-3">
                    {participants.map((participant) => {
                      const person = people.get(participant.membershipId);
                      return (
                        <li key={participant.id} className="flex items-center gap-2 py-2.5">
                          <span className="flex size-8 items-center justify-center rounded-full bg-brand-tint text-[10px] font-extrabold text-brand">
                            {person ? initials(person) : '?'}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[12px] font-bold text-navy">
                              {person
                                ? membershipName(person)
                                : (participant.displayName ?? participant.email ?? 'Member')}
                            </span>
                            <span className="block truncate text-[11px] text-ink-muted">
                              {person ? formatDesignation(person.designation) : ''}
                              {participant.membershipId === me
                                ? text(' (you)', ' (vous)', language)
                                : ''}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setMembersOpen(true)}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-[12px] font-bold text-ink-soft hover:border-brand hover:bg-brand-wash hover:text-brand"
                  >
                    <Plus aria-hidden="true" className="size-3.5" />
                    {text('Add a teammate', 'Ajouter un coéquipier', language)}
                  </button>
                </div>
                {sharedFiles.length ? (
                  <div>
                    <p className="text-[11px] font-extrabold tracking-[0.08em] text-ink-muted">
                      {text('SHARED FILES', 'FICHIERS PARTAGÉS', language)}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {sharedFiles.map((file) => (
                        <li
                          key={file.id}
                          className="flex items-center gap-2 rounded-xl border border-line p-2.5"
                        >
                          <span className="flex size-7 items-center justify-center rounded-md bg-danger-bg text-danger">
                            <FileText aria-hidden="true" className="size-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[12px] font-bold text-navy">
                              {file.filename}
                            </span>
                            <span className="block text-[11px] text-ink-muted">
                              {formatFileSize(file.byteSize)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </aside>
          ) : null}
        </div>
      </section>

      <ConversationMembersDrawer
        open={membersOpen}
        conversation={active}
        participants={participants}
        people={[...people.values()]}
        me={me}
        onClose={() => setMembersOpen(false)}
        onUpdated={() => {
          if (activeId) void loadThread(activeId);
        }}
      />
      <ConversationSettingsDrawer
        open={settingsOpen}
        conversation={active}
        onClose={() => setSettingsOpen(false)}
        onUpdated={async () => {
          if (activeId) {
            await loadConversations();
            await loadThread(activeId);
          }
        }}
      />

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

function ConversationMembersDrawer({
  open,
  conversation,
  participants,
  people,
  me,
  onClose,
  onUpdated,
}: {
  open: boolean;
  conversation: Conversation | null;
  participants: ConversationParticipant[];
  people: MessagingMember[];
  me: string | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { language } = useTranslation();
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const participantIds = new Set(participants.map((participant) => participant.membershipId));
  const available = people.filter((person) => !participantIds.has(person.membershipId));

  useEffect(() => {
    if (open) {
      setSelected('');
      setError(null);
    }
  }, [open]);

  if (!conversation) return null;

  return (
    <Drawer
      open={open}
      title={text('Conversation members', 'Membres de la conversation', language)}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="space-y-5">
        <ul className="divide-y divide-line-soft rounded-xl border border-line px-3">
          {participants.map((participant) => {
            const person = people.find((item) => item.membershipId === participant.membershipId);
            const isMe = participant.membershipId === me;
            return (
              <li key={participant.id} className="flex items-center gap-3 py-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-brand-tint text-[11px] font-extrabold text-brand">
                  {person ? initials(person) : '?'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-navy">
                    {person
                      ? membershipName(person)
                      : (participant.displayName ?? participant.email ?? 'Member')}
                    {isMe ? text(' (you)', ' (vous)', language) : ''}
                  </span>
                  <span className="block text-[11px] text-ink-muted">
                    {person ? formatDesignation(person.designation) : ''}
                  </span>
                </span>
                {!isMe ? (
                  <button
                    type="button"
                    className="text-[12px] font-bold text-danger hover:underline"
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      setError(null);
                      removeParticipant(conversation.id, participant.membershipId)
                        .then(onUpdated)
                        .catch((caught: unknown) =>
                          setError(
                            caught instanceof ApiError
                              ? caught.message
                              : text(
                                  'Could not remove this member.',
                                  'Impossible de retirer ce membre.',
                                  language,
                                ),
                          ),
                        )
                        .finally(() => setBusy(false));
                    }}
                  >
                    {text('Remove', 'Retirer', language)}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        {available.length ? (
          <div className="space-y-3 border-t border-line pt-4">
            <SelectField
              label={text('Add a teammate', 'Ajouter un coéquipier', language)}
              value={selected}
              disabled={busy}
              onChange={(event) => setSelected(event.target.value)}
              options={[
                { value: '', label: text('Choose a teammate', 'Choisir un coéquipier', language) },
                ...available.map((person) => ({
                  value: person.membershipId,
                  label: membershipName(person),
                })),
              ]}
            />
            <Button
              fullWidth
              loading={busy}
              disabled={!selected}
              onClick={() => {
                setBusy(true);
                setError(null);
                addParticipant(conversation.id, selected)
                  .then(onUpdated)
                  .catch((caught: unknown) =>
                    setError(
                      caught instanceof ApiError
                        ? caught.message
                        : text(
                            'Could not add this member.',
                            'Impossible d’ajouter ce membre.',
                            language,
                          ),
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              <UserRound aria-hidden="true" className="size-4" />
              {text('Add member', 'Ajouter le membre', language)}
            </Button>
          </div>
        ) : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
    </Drawer>
  );
}

function ConversationSettingsDrawer({
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

  useEffect(() => {
    if (open && conversation) {
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

function formatDateDivider(value?: string): string {
  if (!value) return 'Today';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Today';
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
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

function isOlderThan(value: string | undefined, hours: number): boolean {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return !Number.isNaN(timestamp) && Date.now() - timestamp > hours * 60 * 60 * 1000;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
