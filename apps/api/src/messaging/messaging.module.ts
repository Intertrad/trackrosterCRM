import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Injectable,
  Inject,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { AuthModule } from '../auth/auth.module.js';
import { DATABASE } from '../database/database.constants.js';
import { DatabaseModule } from '../database/database.module.js';
import type { Database } from '../database/database.types.js';
import {
  conversations,
  conversationParticipants,
  messages,
  messageAttachments,
  identities,
  tenantMemberships,
} from '../database/schema/index.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import {
  AddParticipantDto,
  ConversationListDto,
  CreateConversationDto,
  MuteConversationDto,
  SendMessageDto,
  UpdateConversationDto,
} from './messaging.dto.js';

type Auth = AuthenticatedPrincipal;

const page = (n?: number) => Math.min(Math.max(n ?? 50, 1), 100);

/*
 * Both listings are ordered by (timestamp DESC, id DESC). A keyset cursor has
 * to carry both halves of that key: paging on the id alone, as this module
 * previously did, filters on a random UUID while sorting by time and so
 * returns an arbitrary subset rather than the next page.
 */
interface Keyset {
  timestamp: Date;
  id: string;
}

function encodeCursor(timestamp: Date, id: string): string {
  return `${timestamp.toISOString()}|${id}`;
}

function decodeCursor(cursor: string | undefined): Keyset | undefined {
  if (!cursor) return undefined;
  const [iso, id] = cursor.split('|');
  const timestamp = new Date(iso!);
  if (Number.isNaN(timestamp.getTime()) || !id) throw new BadRequestException('Invalid cursor');
  return { timestamp, id };
}

@Injectable()
export class MessagingService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Messaging needs a small, tenant-scoped directory for composing a new
   * conversation. The membership administration endpoint is intentionally
   * client-admin-only, so exposing that endpoint here would make ordinary
   * prospectors unable to start a conversation with another active member.
   */
  private async profiles(a: Auth, membershipIds?: string[]) {
    const rows = await this.db
      .select({
        membershipId: tenantMemberships.id,
        displayName: tenantMemberships.displayName,
        email: identities.email,
        roles: sql<string[]>`(
          SELECT coalesce(jsonb_agg(DISTINCT CASE role_grants.role
            WHEN 'client_admin' THEN 'tenant_admin'
            WHEN 'observer' THEN 'auditor'
            ELSE role_grants.role
          END ORDER BY CASE role_grants.role
            WHEN 'client_admin' THEN 'tenant_admin'
            WHEN 'observer' THEN 'auditor'
            ELSE role_grants.role
          END), '[]'::jsonb)
          FROM (
            SELECT g.role::text AS role
            FROM user_access_grants g
            WHERE g.tenant_id = ${a.tenantId} AND g.user_id = ${tenantMemberships.id}
            UNION
            SELECT r.role::text AS role
            FROM membership_resource_scopes r
            WHERE r.tenant_id = ${a.tenantId} AND r.user_id = ${tenantMemberships.id}
          ) role_grants
        )`,
      })
      .from(tenantMemberships)
      .innerJoin(identities, eq(identities.id, tenantMemberships.identityId))
      .where(
        and(
          eq(tenantMemberships.tenantId, a.tenantId),
          eq(tenantMemberships.status, 'active'),
          eq(identities.status, 'active'),
          membershipIds?.length ? inArray(tenantMemberships.id, membershipIds) : undefined,
        ),
      );
    return rows.map((row) => ({
      membershipId: row.membershipId,
      displayName: row.displayName,
      email: row.email,
      roles: row.roles ?? [],
      designation: row.roles?.[0] ?? 'member',
    }));
  }

  async directory(a: Auth) {
    return this.profiles(a);
  }
  async unreadCount(a: Auth) {
    const [row] = await this.db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(conversations)
      .innerJoin(
        conversationParticipants,
        and(
          eq(conversationParticipants.tenantId, a.tenantId),
          eq(conversationParticipants.conversationId, conversations.id),
          eq(conversationParticipants.membershipId, a.membershipId),
        ),
      )
      .innerJoin(
        messages,
        and(
          eq(messages.tenantId, a.tenantId),
          eq(messages.conversationId, conversations.id),
          sql`${messages.senderId} <> ${a.membershipId}`,
          sql`${messages.status} <> 'deleted'`,
          sql`${conversationParticipants.lastReadAt} IS NULL OR ${messages.createdAt} > ${conversationParticipants.lastReadAt}`,
        ),
      )
      .where(eq(conversations.tenantId, a.tenantId));

    return { count: Number(row?.count ?? 0) };
  }
  private async member(a: Auth, id: string) {
    const [m] = await this.db
      .select({ id: conversationParticipants.id })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.tenantId, a.tenantId),
          eq(conversationParticipants.conversationId, id),
          eq(conversationParticipants.membershipId, a.membershipId),
        ),
      );
    /* Not a participant is an authorization outcome, not a malformed
     * request; 400 sends well-behaved clients into a pointless retry loop. */
    if (!m) throw new ForbiddenException('Conversation membership required');
  }
  async list(a: Auth, q: ConversationListDto) {
    const after = decodeCursor(q.cursor);
    const limit = page(q.limit);
    const rows = await this.db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.tenantId, a.tenantId),
          sql`EXISTS (SELECT 1 FROM conversation_participants p WHERE p.tenant_id=${a.tenantId} AND p.conversation_id=conversations.id AND p.membership_id=${a.membershipId})`,
          after
            ? sql`(${conversations.updatedAt}, ${conversations.id}) < (${after.timestamp}, ${after.id})`
            : undefined,
        ),
      )
      .orderBy(desc(conversations.updatedAt), desc(conversations.id))
      .limit(limit + 1);
    const items = rows.slice(0, limit);
    const latestRows = items.length
      ? await this.db
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.tenantId, a.tenantId),
              inArray(
                messages.conversationId,
                items.map((conversation) => conversation.id),
              ),
            ),
          )
          .orderBy(desc(messages.createdAt), desc(messages.id))
      : [];
    const latestByConversation = new Map<string, (typeof latestRows)[number]>();
    for (const message of latestRows) {
      if (!latestByConversation.has(message.conversationId))
        latestByConversation.set(message.conversationId, message);
    }
    const latestSenderIds = [
      ...new Set([...latestByConversation.values()].map((message) => message.senderId)),
    ];
    const latestSenders = latestSenderIds.length ? await this.profiles(a, latestSenderIds) : [];
    const latestSenderByMembership = new Map(
      latestSenders.map((profile) => [profile.membershipId, profile]),
    );
    const inboxItems = items.map((conversation) => {
      const latest = latestByConversation.get(conversation.id);
      return {
        ...conversation,
        latestMessage: latest
          ? {
              id: latest.id,
              body: latest.body,
              status: latest.status,
              createdAt: latest.createdAt,
              sender: latestSenderByMembership.get(latest.senderId) ?? null,
            }
          : null,
      };
    });
    const last = items.at(-1);
    return {
      items: inboxItems,
      nextCursor: rows.length > limit && last ? encodeCursor(last.updatedAt, last.id) : null,
    };
  }
  async create(a: Auth, d: CreateConversationDto) {
    const requested = [...new Set(d.participantIds ?? [])].filter((id) => id !== a.membershipId);

    /*
     * Participant ids arrive from the client and are stamped with the
     * caller's tenant on insert, so an id from another tenant would otherwise
     * be written into this tenant's conversation. addParticipant already
     * performs this check; create did not.
     */
    if (requested.length) {
      const valid = await this.db
        .select({ id: tenantMemberships.id })
        .from(tenantMemberships)
        .where(
          and(
            eq(tenantMemberships.tenantId, a.tenantId),
            eq(tenantMemberships.status, 'active'),
            inArray(tenantMemberships.id, requested),
          ),
        );
      if (valid.length !== requested.length)
        throw new BadRequestException('Every participant must be an active workspace member');
    }

    return this.db.transaction(async (tx) => {
      const [c] = await tx
        .insert(conversations)
        .values({
          tenantId: a.tenantId,
          kind: d.kind,
          title: d.title?.trim() || null,
          createdBy: a.membershipId,
        })
        .returning();
      const ids = [a.membershipId, ...requested];
      await tx
        .insert(conversationParticipants)
        .values(
          ids.map((membershipId) => ({
            tenantId: a.tenantId,
            conversationId: c!.id,
            membershipId,
          })),
        )
        .onConflictDoNothing();
      return c;
    });
  }
  async get(a: Auth, id: string) {
    await this.member(a, id);
    const [c] = await this.db
      .select()
      .from(conversations)
      .where(and(eq(conversations.tenantId, a.tenantId), eq(conversations.id, id)));
    if (!c) throw new NotFoundException('Conversation not found');
    return c;
  }
  async update(a: Auth, id: string, d: UpdateConversationDto) {
    await this.member(a, id);
    const [c] = await this.db
      .update(conversations)
      .set({ title: d.title?.trim(), status: d.status, updatedAt: sql`clock_timestamp()` })
      .where(and(eq(conversations.tenantId, a.tenantId), eq(conversations.id, id)))
      .returning();
    return c;
  }
  participants(a: Auth, id: string) {
    return this.member(a, id).then(() =>
      this.db
        .select({
          membership: conversationParticipants,
          profile: {
            membershipId: tenantMemberships.id,
            displayName: tenantMemberships.displayName,
            email: identities.email,
            roles: sql<string[]>`(
            SELECT coalesce(jsonb_agg(DISTINCT CASE role_grants.role
              WHEN 'client_admin' THEN 'tenant_admin'
              WHEN 'observer' THEN 'auditor'
              ELSE role_grants.role
            END), '[]'::jsonb)
            FROM (
              SELECT g.role::text AS role
              FROM user_access_grants g
              WHERE g.tenant_id = ${a.tenantId} AND g.user_id = ${tenantMemberships.id}
              UNION
              SELECT r.role::text AS role
              FROM membership_resource_scopes r
              WHERE r.tenant_id = ${a.tenantId} AND r.user_id = ${tenantMemberships.id}
            ) role_grants
          )`,
          },
        })
        .from(conversationParticipants)
        .innerJoin(
          tenantMemberships,
          and(
            eq(tenantMemberships.tenantId, conversationParticipants.tenantId),
            eq(tenantMemberships.id, conversationParticipants.membershipId),
          ),
        )
        .innerJoin(identities, eq(identities.id, tenantMemberships.identityId))
        .where(
          and(
            eq(conversationParticipants.tenantId, a.tenantId),
            eq(conversationParticipants.conversationId, id),
          ),
        )
        .then((rows) =>
          rows.map(({ membership, profile }) => ({
            ...membership,
            displayName: profile.displayName,
            email: profile.email,
            roles: profile.roles ?? [],
            designation: profile.roles?.[0] ?? 'member',
          })),
        ),
    );
  }
  async addParticipant(a: Auth, id: string, membershipId: string) {
    await this.member(a, id);
    const [m] = await this.db
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, a.tenantId),
          eq(tenantMemberships.id, membershipId),
          eq(tenantMemberships.status, 'active'),
        ),
      );
    if (!m) throw new BadRequestException('Active membership required');
    await this.db
      .insert(conversationParticipants)
      .values({ tenantId: a.tenantId, conversationId: id, membershipId })
      .onConflictDoNothing();
    return { conversationId: id, membershipId };
  }
  async removeParticipant(a: Auth, id: string, membershipId: string) {
    await this.member(a, id);
    await this.db
      .delete(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.tenantId, a.tenantId),
          eq(conversationParticipants.conversationId, id),
          eq(conversationParticipants.membershipId, membershipId),
        ),
      );
  }
  async listMessages(a: Auth, id: string, q: ConversationListDto) {
    await this.member(a, id);
    const after = decodeCursor(q.cursor);
    const limit = page(q.limit);
    const rows = await this.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, a.tenantId),
          eq(messages.conversationId, id),
          after
            ? sql`(${messages.createdAt}, ${messages.id}) < (${after.timestamp}, ${after.id})`
            : undefined,
        ),
      )
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit + 1);
    const items = rows.slice(0, limit);
    const senderProfiles = await this.profiles(a, [
      ...new Set(items.map((message) => message.senderId)),
    ]);
    const profileByMembership = new Map(
      senderProfiles.map((profile) => [profile.membershipId, profile]),
    );
    // Batch attachment metadata after membership and tenant checks; never expose storage keys.
    const visibleIds = items
      .filter((message) => message.status !== 'deleted')
      .map((message) => message.id);
    const attachments = visibleIds.length
      ? await this.db
          .select({
            id: messageAttachments.id,
            messageId: messageAttachments.messageId,
            filename: messageAttachments.filename,
            contentType: messageAttachments.contentType,
            byteSize: messageAttachments.byteSize,
          })
          .from(messageAttachments)
          .where(
            and(
              eq(messageAttachments.tenantId, a.tenantId),
              inArray(messageAttachments.messageId, visibleIds),
            ),
          )
      : [];
    const last = items.at(-1);
    return {
      items: items.map((message) => ({
        ...message,
        sender: profileByMembership.get(message.senderId) ?? null,
        attachments: attachments.filter((attachment) => attachment.messageId === message.id),
      })),
      nextCursor: rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }
  async send(a: Auth, id: string, body: string) {
    await this.member(a, id);
    if (!body.trim()) throw new BadRequestException('Message body is required');
    const [m] = await this.db
      .insert(messages)
      .values({
        tenantId: a.tenantId,
        conversationId: id,
        senderId: a.membershipId,
        body: body.trim(),
      })
      .returning();
    await this.db
      .update(conversations)
      .set({ updatedAt: sql`clock_timestamp()` })
      .where(eq(conversations.id, id));
    return m;
  }
  async edit(a: Auth, id: string, body: string) {
    const [m] = await this.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, a.tenantId),
          eq(messages.id, id),
          eq(messages.senderId, a.membershipId),
          eq(messages.status, 'sent'),
        ),
      );
    if (!m) throw new ForbiddenException('Only the sender can edit a sent message');
    const [r] = await this.db
      .update(messages)
      .set({ body: body.trim(), status: 'edited', updatedAt: sql`clock_timestamp()` })
      .where(eq(messages.id, id))
      .returning();
    return r;
  }
  async remove(a: Auth, id: string) {
    const [m] = await this.db
      .update(messages)
      .set({ body: '', status: 'deleted', updatedAt: sql`clock_timestamp()` })
      .where(
        and(
          eq(messages.tenantId, a.tenantId),
          eq(messages.id, id),
          eq(messages.senderId, a.membershipId),
        ),
      )
      .returning({ id: messages.id });
    if (!m) throw new NotFoundException('Message not found');
  }
  async read(a: Auth, id: string) {
    await this.member(a, id);
    await this.db
      .update(conversationParticipants)
      .set({ lastReadAt: sql`clock_timestamp()` })
      .where(
        and(
          eq(conversationParticipants.tenantId, a.tenantId),
          eq(conversationParticipants.conversationId, id),
          eq(conversationParticipants.membershipId, a.membershipId),
        ),
      );
    return { conversationId: id, read: true };
  }
  async mute(a: Auth, id: string, until?: string | null) {
    await this.member(a, id);
    const [p] = await this.db
      .update(conversationParticipants)
      .set({ mutedUntil: until ? new Date(until) : null })
      .where(
        and(
          eq(conversationParticipants.tenantId, a.tenantId),
          eq(conversationParticipants.conversationId, id),
          eq(conversationParticipants.membershipId, a.membershipId),
        ),
      )
      .returning({ mutedUntil: conversationParticipants.mutedUntil });
    return p;
  }
}

@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationController {
  constructor(private readonly s: MessagingService) {}
  @Get('members') directory(@CurrentAuth() a: Auth) {
    return this.s.directory(a);
  }
  @Get('unread-count') unreadCount(@CurrentAuth() a: Auth) {
    return this.s.unreadCount(a);
  }
  @Get() list(@CurrentAuth() a: Auth, @Query() q: ConversationListDto) {
    return this.s.list(a, q);
  }
  @Post() @Idempotent('conversation.create') create(
    @CurrentAuth() a: Auth,
    @Body() d: CreateConversationDto,
  ) {
    return this.s.create(a, d);
  }
  @Get(':id') get(@CurrentAuth() a: Auth, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.get(a, id);
  }
  @Patch(':id') update(
    @CurrentAuth() a: Auth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: UpdateConversationDto,
  ) {
    return this.s.update(a, id, d);
  }
  @Get(':id/participants') participants(
    @CurrentAuth() a: Auth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.s.participants(a, id);
  }
  @Post(':id/participants') add(
    @CurrentAuth() a: Auth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: AddParticipantDto,
  ) {
    return this.s.addParticipant(a, id, d.membershipId);
  }
  @Delete(':id/participants/:membershipId') @HttpCode(204) remove(
    @CurrentAuth() a: Auth,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('membershipId', ParseUUIDPipe) m: string,
  ) {
    return this.s.removeParticipant(a, id, m);
  }
  @Get(':id/messages') messages(
    @CurrentAuth() a: Auth,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: ConversationListDto,
  ) {
    return this.s.listMessages(a, id, q);
  }
  @Post(':id/messages') @Idempotent('message.create') send(
    @CurrentAuth() a: Auth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: SendMessageDto,
  ) {
    return this.s.send(a, id, d.body);
  }
  @Post(':id/read') read(@CurrentAuth() a: Auth, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.read(a, id);
  }
  @Patch(':id/mute') mute(
    @CurrentAuth() a: Auth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: MuteConversationDto,
  ) {
    return this.s.mute(a, id, d.mutedUntil);
  }
}
@Controller('messages')
@UseGuards(AuthGuard)
export class MessageController {
  constructor(private readonly s: MessagingService) {}
  @Patch(':id') edit(
    @CurrentAuth() a: Auth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: SendMessageDto,
  ) {
    return this.s.edit(a, id, d.body);
  }
  @Delete(':id') @HttpCode(204) remove(
    @CurrentAuth() a: Auth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.s.remove(a, id);
  }
}
@Module({
  /* DatabaseModule is not global, so DATABASE has to be imported here; the
   * module previously declared no imports at all and could not instantiate. */
  imports: [DatabaseModule, AuthModule],
  controllers: [ConversationController, MessageController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
