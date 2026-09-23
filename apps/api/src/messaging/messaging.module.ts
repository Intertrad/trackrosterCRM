import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Inject,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import {
  conversations,
  conversationParticipants,
  messages,
  tenantMemberships,
} from '../database/schema/index.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';

type Auth = AuthenticatedPrincipal;
const page = (n?: number) => Math.min(Math.max(n ?? 50, 1), 100);

@Injectable()
export class MessagingService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
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
    if (!m) throw new BadRequestException('Conversation membership required');
  }
  async list(a: Auth, limit?: number, cursor?: string) {
    return this.db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.tenantId, a.tenantId),
          sql`EXISTS (SELECT 1 FROM conversation_participants p WHERE p.tenant_id=${a.tenantId} AND p.conversation_id=conversations.id AND p.membership_id=${a.membershipId})`,
          cursor ? gt(conversations.id, cursor) : undefined,
        ),
      )
      .orderBy(desc(conversations.updatedAt), desc(conversations.id))
      .limit(page(limit));
  }
  async create(
    a: Auth,
    d: {
      kind: 'direct' | 'team' | 'prospect' | 'campaign';
      title?: string;
      participantIds?: string[];
    },
  ) {
    if (!d.kind) throw new BadRequestException('kind is required');
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
      const ids = [...new Set([a.membershipId, ...(d.participantIds ?? [])])];
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
    return c;
  }
  async update(a: Auth, id: string, d: { title?: string; status?: 'active' | 'archived' }) {
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
        .select()
        .from(conversationParticipants)
        .where(
          and(
            eq(conversationParticipants.tenantId, a.tenantId),
            eq(conversationParticipants.conversationId, id),
          ),
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
  async listMessages(a: Auth, id: string, limit?: number, cursor?: string) {
    await this.member(a, id);
    return this.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, a.tenantId),
          eq(messages.conversationId, id),
          cursor ? gt(messages.id, cursor) : undefined,
        ),
      )
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(page(limit));
  }
  async send(a: Auth, id: string, body: string) {
    await this.member(a, id);
    if (!body?.trim()) throw new BadRequestException('Message body is required');
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
    if (!m) throw new BadRequestException('Message not editable');
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
    if (!m) throw new BadRequestException('Message not found');
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
  @Get() list(@CurrentAuth() a: Auth, @Query('limit') l?: number, @Query('cursor') c?: string) {
    return this.s.list(a, l, c);
  }
  @Post() @Idempotent('conversation.create') create(@CurrentAuth() a: Auth, @Body() d: any) {
    return this.s.create(a, d);
  }
  @Get(':id') get(@CurrentAuth() a: Auth, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.get(a, id);
  }
  @Patch(':id') update(
    @CurrentAuth() a: Auth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: any,
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
    @Body() d: { membershipId: string },
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
    @Query('limit') l?: number,
    @Query('cursor') c?: string,
  ) {
    return this.s.listMessages(a, id, l, c);
  }
  @Post(':id/messages') @Idempotent('message.create') send(
    @CurrentAuth() a: Auth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: { body: string },
  ) {
    return this.s.send(a, id, d.body);
  }
  @Post(':id/read') read(@CurrentAuth() a: Auth, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.read(a, id);
  }
  @Patch(':id/mute') mute(
    @CurrentAuth() a: Auth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: { mutedUntil?: string | null },
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
    @Body() d: { body: string },
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
  imports: [],
  controllers: [ConversationController, MessageController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
