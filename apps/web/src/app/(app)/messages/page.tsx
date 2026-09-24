'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BellOff, MessagesSquare, Plus, Send, Trash2 } from 'lucide-react';

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
import { listMemberships } from '@/lib/api/membership-client';
import {
  membershipInitials,
  membershipName,
  type MembershipSummary,
} from '@/lib/api/membership-types';
import {
  createConversation,
  deleteMessage,
  listConversations,
  listMessages,
  listParticipants,
  markConversationRead,
  muteConversation,
  sendMessage,
} from '@/lib/api/messaging-client';
import {
  CONVERSATION_KINDS,
  MAX_MESSAGE_BODY,
  conversationKindLabel,
  conversationName,
  hasUnread,
  isMuted,
  muteUntil,
  type Conversation,
  type ConversationKind,
  type ConversationParticipant,
  type Message,
} from '@/lib/api/messaging-types';
import { useAuth } from '@/lib/auth/auth-context';

export default function MessagesPage() {
  const { user } = useAuth();

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
  const [participants, setParticipants] = useState<ConversationParticipant[]>([]);
  const [people, setPeople] = useState<Map<string, MembershipSummary>>(new Map());

  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
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

          setConversations(page.items);
          setReadError(null);

          setActiveId((current) => current ?? page.items[0]?.id ?? null);
        })
        .catch((caught: unknown) => {
          if (!signal?.aborted) {
            setConversations([]);
            setReadError(describeMessagingError(caught));
          }
        }),
    [],
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadConversations(controller.signal);

    listMemberships({ limit: 100 }, controller.signal)
      .then((page) => setPeople(new Map(page.items.map((item) => [item.id, item]))))
      .catch(() => setPeople(new Map()));

    return () => controller.abort();
  }, [loadConversations]);

  const loadThread = useCallback(
    (conversationId: string, signal?: AbortSignal): Promise<void> =>
      Promise.all([
        listMessages(conversationId, { limit: 100 }, signal),
        listParticipants(conversationId, signal).catch(() => []),
      ])
        .then(([page, members]) => {
          if (signal?.aborted) {
            return;
          }

          /* The API returns newest first; a thread reads oldest to newest. */
          setMessages([...page.items].reverse());
          setParticipants(members);
        })
        .catch((caught: unknown) => {
          if (!signal?.aborted) {
            setMessages([]);
            setActionError(describeMessagingError(caught));
          }
        }),
    [],
  );

  useEffect(() => {
    if (!activeId) {
      setMessages(null);

      return;
    }

    const controller = new AbortController();

    void loadThread(activeId, controller.signal).then(() => {
      if (!controller.signal.aborted) {
        /* Opening a thread is what marks it read. */
        markConversationRead(activeId)
          .then(() => void loadConversations())
          .catch(() => undefined);
      }
    });

    return () => controller.abort();
  }, [activeId, loadConversations, loadThread]);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: 'end' });
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
      .filter((person): person is MembershipSummary => Boolean(person))
      .map((person) => membershipName(person));

    return conversationName(conversation, others);
  }

  const visible = useMemo(() => {
    if (!conversations) {
      return [];
    }

    const query = search.trim().toLowerCase();

    if (query === '') {
      return conversations;
    }

    return conversations.filter((conversation) =>
      conversationName(conversation).toLowerCase().includes(query),
    );
  }, [conversations, search]);

  async function send(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!activeId || draft.trim().length === 0 || busy) {
      return;
    }

    setBusy(true);
    setActionError(null);

    try {
      await sendMessage(activeId, draft.trim());

      setDraft('');
      await loadThread(activeId);
      await loadConversations();
    } catch (caught) {
      setActionError(describeMessagingError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Messages"
        subtitle="Coordinate with your team without leaving TrackRoster"
        action={
          <Button onClick={() => setComposing(true)}>
            <Plus aria-hidden="true" className="mr-2 size-4" />
            New conversation
          </Button>
        }
      />

      {readError ? <Alert tone="danger">{readError}</Alert> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        <Card>
          <SearchInput
            label="Search conversations"
            placeholder="Search conversations…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

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
                {conversations.length === 0 ? 'No conversations yet' : 'No matches'}
              </p>

              {conversations.length === 0 ? (
                <p className="mx-auto mt-2 max-w-xs text-[14px] text-ink-muted">
                  Start one to coordinate a visit or hand a prospect over.
                </p>
              ) : null}
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-1.5">
              {visible.map((conversation) => {
                const unread = hasUnread(conversation, myParticipation);

                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(conversation.id)}
                      className={
                        conversation.id === activeId
                          ? 'w-full rounded-xl border border-brand bg-brand-tint/50 px-3.5 py-3 text-left'
                          : 'w-full rounded-xl border border-line-soft px-3.5 py-3 text-left hover:border-brand'
                      }
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-navy">
                          {conversationName(conversation)}
                        </span>

                        {conversation.id !== activeId && unread ? (
                          <span
                            aria-label="Unread messages"
                            className="size-2 shrink-0 rounded-full bg-brand"
                          />
                        ) : null}
                      </span>

                      <span className="mt-0.5 flex items-center gap-2 text-[13px] text-ink-muted">
                        <Badge tone="neutral">{conversationKindLabel(conversation.kind)}</Badge>

                        {formatTimestamp(conversation.updatedAt)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="flex min-h-[28rem] flex-col">
          {active === null ? (
            <p className="py-20 text-center text-[15px] text-ink-muted">
              Choose a conversation to read it.
            </p>
          ) : (
            <>
              <CardHeader
                title={nameFor(active, participants)}
                action={
                  <div className="flex flex-wrap items-center gap-2">
                    {isMuted(myParticipation) ? (
                      <Badge tone="neutral">
                        <BellOff aria-hidden="true" className="mr-1 inline size-3.5" />
                        Muted
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
                            setActionError(describeMessagingError(caught)),
                          )
                          .finally(() => setBusy(false));
                      }}
                    >
                      {isMuted(myParticipation) ? 'Unmute' : 'Mute 8h'}
                    </Button>
                  </div>
                }
              />

              {actionError ? (
                <Alert tone="danger" className="mb-4">
                  {actionError}
                </Alert>
              ) : null}

              <div className="flex-1 overflow-y-auto">
                {messages === null ? (
                  <div className="flex flex-col gap-2" aria-busy="true">
                    {[0, 1, 2].map((row) => (
                      <div key={row} className="h-12 animate-pulse rounded-lg bg-line-soft" />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <p className="py-16 text-center text-[15px] text-ink-muted">
                    No messages yet. Say something.
                  </p>
                ) : (
                  <ol className="flex flex-col gap-3">
                    {messages.map((message) => {
                      const mine = message.senderId === me;
                      const sender = people.get(message.senderId);

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
                                {sender ? membershipInitials(sender) : '?'}
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
                                  {sender ? membershipName(sender) : 'Unknown'}
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
                                  This message was deleted
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

                              <p
                                className={
                                  mine
                                    ? 'mt-1 text-[11px] text-white/70'
                                    : 'mt-1 text-[11px] text-ink-muted'
                                }
                              >
                                {formatTimestamp(message.createdAt)}
                                {message.status === 'edited' ? ' · edited' : ''}
                              </p>
                            </div>

                            {mine && message.status !== 'deleted' ? (
                              <button
                                type="button"
                                aria-label="Delete message"
                                disabled={busy}
                                className="mt-1 shrink-0 text-ink-muted hover:text-danger disabled:opacity-40"
                                onClick={() => {
                                  setBusy(true);

                                  deleteMessage(message.id)
                                    .then(() => loadThread(active.id))
                                    .catch((caught: unknown) =>
                                      setActionError(describeMessagingError(caught)),
                                    )
                                    .finally(() => setBusy(false));
                                }}
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

              <form onSubmit={(event) => void send(event)} className="mt-4 flex gap-2.5">
                <div className="min-w-0 flex-1">
                  <TextField
                    label="Message"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Write a message…"
                    maxLength={MAX_MESSAGE_BODY}
                    disabled={busy}
                  />
                </div>

                <Button type="submit" loading={busy} disabled={draft.trim().length === 0}>
                  <Send aria-hidden="true" className="size-4" />
                  <span className="sr-only">Send</span>
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>

      <ComposeDrawer
        open={composing}
        people={[...people.values()].filter((person) => person.id !== me)}
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
  people: MembershipSummary[];
  onClose: () => void;
  onCreated: (conversation: Conversation) => void;
}) {
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
    <Drawer open={open} title="New conversation" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <SelectField
          label="Kind"
          value={kind}
          disabled={busy}
          onChange={(event) => setKind(event.target.value as ConversationKind)}
          options={CONVERSATION_KINDS.map((value) => ({
            value,
            label: conversationKindLabel(value),
          }))}
        />

        <TextField
          label="Title (optional)"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What is this about?"
          maxLength={200}
          disabled={busy}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="text-[14px] font-semibold text-ink">Participants</legend>

          {people.length === 0 ? (
            <p className="text-[14px] text-ink-muted">
              Nobody else is available in this workspace.
            </p>
          ) : (
            <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              {people.map((person) => (
                <li key={person.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line-soft px-3 py-2">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={selected.includes(person.id)}
                      disabled={busy}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, person.id]
                            : current.filter((id) => id !== person.id),
                        )
                      }
                    />

                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-navy">
                        {membershipName(person)}
                      </span>

                      <span className="block truncate text-[12px] text-ink-muted">
                        {person.email}
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
              .catch((caught: unknown) => setError(describeMessagingError(caught)))
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

function describeMessagingError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 403) {
    return 'You are not a participant in this conversation.';
  }

  if (error.statusCode === 404) {
    return 'That conversation no longer exists.';
  }

  if (error.statusCode === 400) {
    return error.messages.join(' ');
  }

  return 'We could not reach messaging. Please try again.';
}
