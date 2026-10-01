import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Injectable,
  Module,
  NotFoundException,
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
import {
  AttachUploadDto,
  NotificationPreferencesDto,
  PresignUploadDto,
  RegisterDeviceDto,
  normalizeNotificationPreferences,
} from './communications.dto.js';
import { ObjectStorageService } from '../providers/object-storage.service.js';
import { ProvidersModule } from '../providers/providers.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { MessagingModule } from '../messaging/messaging.module.js';

type Auth = AuthenticatedPrincipal;
@Injectable()
export class CommunicationsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly messaging: MessagingService,
    private readonly storage: ObjectStorageService,
  ) {}
  async presign(a: Auth, d: PresignUploadDto) {
    /* The DTO bounds filename, content type and size; this guards the one
     * case validation cannot express — a name that is only whitespace. */
    if (!d.filename.trim()) throw new BadRequestException('A filename is required');
    const key = `${a.tenantId}/${a.membershipId}/${randomUUID()}-${d.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const base = process.env.OBJECT_STORAGE_UPLOAD_BASE_URL ?? 'http://localhost:58080/upload';
    const signedUrl = await this.storage.uploadUrl(key, d.contentType);
    return {
      objectKey: key,
      uploadUrl: signedUrl ?? `${base}/${encodeURIComponent(key)}`,
      expiresInSeconds: 900,
      method: 'PUT',
      headers: { 'content-type': d.contentType },
    };
  }
  async attach(a: Auth, messageId: string, d: AttachUploadDto) {
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
    if (!m) throw new NotFoundException('Message not found');
    /* Presign namespaces every key by tenant, so a key that does not carry
     * this tenant's prefix was not issued to this caller. */
    if (!d.objectKey.startsWith(`${a.tenantId}/`))
      throw new ForbiddenException('Object key does not belong to this workspace');
    const [r] = await this.db
      .insert(messageAttachments)
      /* Columns are named explicitly. Spreading the request body here let
       * any field the body happened to carry reach the insert. */
      .values({
        tenantId: a.tenantId,
        messageId,
        uploadedBy: a.membershipId,
        objectKey: d.objectKey,
        filename: d.filename,
        contentType: d.contentType,
        byteSize: d.byteSize,
      })
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
    const signedUrl = await this.storage.downloadUrl(r.objectKey);
    return {
      attachmentId: id,
      downloadUrl: signedUrl ?? `${base}/${encodeURIComponent(r.objectKey)}`,
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
  async setPrefs(a: Auth, p: NotificationPreferencesDto) {
    /* Validation has already rejected any key outside the catalogue, so this
     * is a narrowing to the column's stored shape, not a trust decision. */
    const preferences = normalizeNotificationPreferences(p) as Record<
      string,
      { email?: boolean; push?: boolean; inApp?: boolean }
    >;
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
  async device(a: Auth, d: RegisterDeviceDto) {
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
    @Body() d: PresignUploadDto,
  ) {
    return this.s.presign(a, d);
  }
  @Post('messages/:messageId/attachments') @Idempotent('message.attachment') attach(
    @CurrentAuth() a: Auth,
    @Param('messageId', ParseUUIDPipe) id: string,
    @Body() d: AttachUploadDto,
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
    @Body() d: NotificationPreferencesDto,
  ) {
    return this.s.setPrefs(a, d);
  }
  @Post('devices') @Idempotent('device.register') device(
    @CurrentAuth() a: Auth,
    @Body() d: RegisterDeviceDto,
  ) {
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
  imports: [DatabaseModule, AuthModule, MessagingModule, ProvidersModule],
  controllers: [CommunicationsController],
  providers: [CommunicationsService],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
