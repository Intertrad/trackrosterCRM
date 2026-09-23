import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import {
  messageAttachments,
  messages,
  notificationPreferences,
  pushDevices,
} from '../database/schema/index.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { MessagingService } from '../messaging/messaging.module.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';

type Auth = AuthenticatedPrincipal;
@Injectable()
export class CommunicationsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly messaging: MessagingService,
  ) {}
  async presign(a: Auth, d: { filename: string; contentType: string; byteSize: number }) {
    if (!d.filename?.trim() || !d.contentType || d.byteSize < 1 || d.byteSize > 25_000_000)
      throw new BadRequestException('Invalid upload');
    const key = `${a.tenantId}/${a.membershipId}/${randomUUID()}-${d.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const base = process.env.OBJECT_STORAGE_UPLOAD_BASE_URL ?? 'http://localhost:58080/upload';
    return {
      objectKey: key,
      uploadUrl: `${base}/${encodeURIComponent(key)}`,
      expiresInSeconds: 900,
      method: 'PUT',
      headers: { 'content-type': d.contentType },
    };
  }
  async attach(
    a: Auth,
    messageId: string,
    d: { objectKey: string; filename: string; contentType: string; byteSize: number },
  ) {
    const [m] = await this.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, a.tenantId),
          eq(messages.id, messageId),
          sql`EXISTS(SELECT 1 FROM conversation_participants p WHERE p.tenant_id=${a.tenantId} AND p.conversation_id=messages.conversation_id AND p.membership_id=${a.membershipId})`,
        ),
      );
    if (!m) throw new BadRequestException('Message not found');
    if (!d.objectKey.startsWith(`${a.tenantId}/`))
      throw new BadRequestException('Invalid object key');
    const [r] = await this.db
      .insert(messageAttachments)
      .values({ tenantId: a.tenantId, messageId, uploadedBy: a.membershipId, ...d })
      .returning();
    return r;
  }
  async download(a: Auth, id: string) {
    const [r] = await this.db
      .select()
      .from(messageAttachments)
      .where(
        and(
          eq(messageAttachments.tenantId, a.tenantId),
          eq(messageAttachments.id, id),
          sql`EXISTS(SELECT 1 FROM messages m JOIN conversation_participants p ON p.tenant_id=m.tenant_id AND p.conversation_id=m.conversation_id WHERE m.tenant_id=${a.tenantId} AND m.id=message_attachments.message_id AND p.membership_id=${a.membershipId})`,
        ),
      );
    if (!r) throw new BadRequestException('Attachment not found');
    const base = process.env.OBJECT_STORAGE_DOWNLOAD_BASE_URL ?? 'http://localhost:58080/download';
    return {
      attachmentId: id,
      downloadUrl: `${base}/${encodeURIComponent(r.objectKey)}`,
      expiresInSeconds: 300,
    };
  }
  async prefs(a: Auth) {
    const [r] = await this.db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.tenantId, a.tenantId),
          eq(notificationPreferences.membershipId, a.membershipId),
        ),
      );
    return r?.preferences ?? {};
  }
  async setPrefs(a: Auth, p: Record<string, unknown>) {
    const preferences = p as Record<string, { email?: boolean; push?: boolean; inApp?: boolean }>;
    const [r] = await this.db
      .insert(notificationPreferences)
      .values({ tenantId: a.tenantId, membershipId: a.membershipId, preferences })
      .onConflictDoUpdate({
        target: [notificationPreferences.tenantId, notificationPreferences.membershipId],
        set: { preferences, updatedAt: sql`clock_timestamp()` },
      })
      .returning();
    return r!.preferences;
  }
  async device(a: Auth, d: { token: string; platform: string }) {
    if (!d.token || !['ios', 'android', 'web'].includes(d.platform))
      throw new BadRequestException('Invalid device');
    const [r] = await this.db
      .insert(pushDevices)
      .values({
        tenantId: a.tenantId,
        membershipId: a.membershipId,
        token: d.token,
        platform: d.platform,
      })
      .onConflictDoUpdate({
        target: [pushDevices.tenantId, pushDevices.membershipId, pushDevices.token],
        set: { platform: d.platform, revokedAt: null, lastSeenAt: sql`clock_timestamp()` },
      })
      .returning();
    return r;
  }
  async revoke(a: Auth, id: string) {
    await this.db
      .update(pushDevices)
      .set({ revokedAt: sql`clock_timestamp()` })
      .where(
        and(
          eq(pushDevices.tenantId, a.tenantId),
          eq(pushDevices.membershipId, a.membershipId),
          eq(pushDevices.id, id),
        ),
      );
  }
}
@Controller()
@UseGuards(AuthGuard)
export class CommunicationsController {
  constructor(private readonly s: CommunicationsService) {}
  @Post('uploads/presign') @Idempotent('upload.presign') presign(
    @CurrentAuth() a: Auth,
    @Body() d: any,
  ) {
    return this.s.presign(a, d);
  }
  @Post('messages/:messageId/attachments') @Idempotent('message.attachment') attach(
    @CurrentAuth() a: Auth,
    @Param('messageId', ParseUUIDPipe) id: string,
    @Body() d: any,
  ) {
    return this.s.attach(a, id, d);
  }
  @Get('attachments/:attachmentId/download') download(
    @CurrentAuth() a: Auth,
    @Param('attachmentId', ParseUUIDPipe) id: string,
  ) {
    return this.s.download(a, id);
  }
  @Get('notification-preferences') preferences(@CurrentAuth() a: Auth) {
    return this.s.prefs(a);
  }
  @Put('notification-preferences') setPreferences(
    @CurrentAuth() a: Auth,
    @Body() d: Record<string, unknown>,
  ) {
    return this.s.setPrefs(a, d);
  }
  @Post('devices') @Idempotent('device.register') device(@CurrentAuth() a: Auth, @Body() d: any) {
    return this.s.device(a, d);
  }
  @Delete('devices/:deviceId') revoke(
    @CurrentAuth() a: Auth,
    @Param('deviceId', ParseUUIDPipe) id: string,
  ) {
    return this.s.revoke(a, id);
  }
}
@Module({
  imports: [],
  controllers: [CommunicationsController],
  providers: [CommunicationsService],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
