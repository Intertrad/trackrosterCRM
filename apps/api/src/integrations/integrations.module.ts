import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { AuthModule } from '../auth/auth.module.js';
import { DATABASE } from '../database/database.constants.js';
import { DatabaseModule } from '../database/database.module.js';
import type { Database } from '../database/database.types.js';
import { apiClients, integrations, webhookDeliveries, webhooks } from '../database/schema/index.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
type Auth = AuthenticatedPrincipal;
import {
  ApiClientDto,
  ConnectIntegrationDto,
  WebhookDto,
  WebhookUpdateDto,
} from './integrations.dto.js';
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
@Injectable()
export class IntegrationsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  async list(a: Auth) {
    return this.db
      .select({
        id: integrations.id,
        provider: integrations.provider,
        status: integrations.status,
        config: integrations.config,
        createdAt: integrations.createdAt,
        updatedAt: integrations.updatedAt,
      })
      .from(integrations)
      .where(eq(integrations.tenantId, a.tenantId));
  }
  async connect(a: Auth, provider: string, config: Record<string, unknown> = {}) {
    if (!/^[a-z0-9_-]{2,50}$/i.test(provider)) throw new BadRequestException('Invalid provider');
    const [r] = await this.db
      .insert(integrations)
      .values({
        tenantId: a.tenantId,
        provider,
        status: 'connected',
        config,
        connectedBy: a.membershipId,
      })
      .returning();
    return r;
  }
  async remove(a: Auth, id: string) {
    await this.db
      .update(integrations)
      .set({ status: 'revoked', updatedAt: sql`clock_timestamp()` })
      .where(and(eq(integrations.tenantId, a.tenantId), eq(integrations.id, id)));
  }
  async health(a: Auth, provider: string) {
    const [row] = await this.db
      .select({
        status: integrations.status,
        config: integrations.config,
        updatedAt: integrations.updatedAt,
      })
      .from(integrations)
      .where(
        and(
          eq(integrations.tenantId, a.tenantId),
          eq(integrations.provider, provider),
          eq(integrations.connectedBy, a.membershipId),
        ),
      )
      .limit(1);
    if (!row) return { provider, connected: false, healthy: false, reason: 'not_connected' };
    const config = row.config as { encryptedTokens?: string; tokenUpdatedAt?: string };
    const tokenPresent = Boolean(config.encryptedTokens);
    const tokenAge = config.tokenUpdatedAt
      ? Date.now() - Date.parse(config.tokenUpdatedAt)
      : Infinity;
    return {
      provider,
      connected: row.status === 'connected',
      healthy: row.status === 'connected' && tokenPresent,
      tokenUpdatedAt: config.tokenUpdatedAt ?? null,
      stale: tokenAge > 24 * 60 * 60 * 1000,
      updatedAt: row.updatedAt,
    };
  }
  async clients(a: Auth) {
    return this.db
      .select({
        id: apiClients.id,
        name: apiClients.name,
        scopes: apiClients.scopes,
        expiresAt: apiClients.expiresAt,
        revokedAt: apiClients.revokedAt,
        createdAt: apiClients.createdAt,
      })
      .from(apiClients)
      .where(eq(apiClients.tenantId, a.tenantId));
  }
  async createClient(a: Auth, d: { name: string; scopes: string[]; expiresAt?: string }) {
    if (!d.name?.trim() || !Array.isArray(d.scopes))
      throw new BadRequestException('Invalid API client');
    const secret = randomBytes(32).toString('base64url');
    const [r] = await this.db
      .insert(apiClients)
      .values({
        tenantId: a.tenantId,
        name: d.name.trim(),
        scopes: d.scopes,
        secretHash: hash(secret),
        expiresAt: d.expiresAt ? new Date(d.expiresAt) : undefined,
        createdBy: a.membershipId,
      })
      .returning();
    return { ...r, secret };
  }
  async updateClient(
    a: Auth,
    id: string,
    d: { name?: string; scopes?: string[]; expiresAt?: string },
  ) {
    const [r] = await this.db
      .update(apiClients)
      .set({
        name: d.name?.trim(),
        scopes: d.scopes,
        expiresAt: d.expiresAt ? new Date(d.expiresAt) : undefined,
      })
      .where(
        and(eq(apiClients.tenantId, a.tenantId), eq(apiClients.id, id), sql`revoked_at IS NULL`),
      )
      .returning({
        id: apiClients.id,
        name: apiClients.name,
        scopes: apiClients.scopes,
        expiresAt: apiClients.expiresAt,
      });
    if (!r) throw new BadRequestException('API client not found');
    return r;
  }
  async revokeClient(a: Auth, id: string) {
    await this.db
      .update(apiClients)
      .set({ revokedAt: sql`clock_timestamp()` })
      .where(and(eq(apiClients.tenantId, a.tenantId), eq(apiClients.id, id)));
  }
  async rotate(a: Auth, id: string) {
    const secret = randomBytes(32).toString('base64url');
    const [r] = await this.db
      .update(apiClients)
      .set({ secretHash: hash(secret) })
      .where(
        and(eq(apiClients.tenantId, a.tenantId), eq(apiClients.id, id), sql`revoked_at IS NULL`),
      )
      .returning({ id: apiClients.id });
    if (!r) throw new BadRequestException('API client not found');
    return { ...r, secret };
  }
  async hooks(a: Auth) {
    return this.db
      .select({
        id: webhooks.id,
        url: webhooks.url,
        events: webhooks.events,
        active: webhooks.active,
        createdAt: webhooks.createdAt,
        updatedAt: webhooks.updatedAt,
      })
      .from(webhooks)
      .where(eq(webhooks.tenantId, a.tenantId));
  }
  async createHook(a: Auth, d: { url: string; events: string[] }) {
    let u: URL;
    try {
      u = new URL(d.url);
    } catch {
      throw new BadRequestException('Invalid webhook URL');
    }
    if (u.protocol !== 'https:') throw new BadRequestException('Webhook URL must use HTTPS');
    const secret = randomBytes(32).toString('base64url');
    const [r] = await this.db
      .insert(webhooks)
      .values({
        tenantId: a.tenantId,
        url: d.url,
        events: d.events,
        secretHash: hash(secret),
        createdBy: a.membershipId,
      })
      .returning();
    return { ...r, secret };
  }
  async updateHook(a: Auth, id: string, d: { url?: string; events?: string[]; active?: boolean }) {
    const [r] = await this.db
      .update(webhooks)
      .set({ url: d.url, events: d.events, active: d.active, updatedAt: sql`clock_timestamp()` })
      .where(and(eq(webhooks.tenantId, a.tenantId), eq(webhooks.id, id)))
      .returning({
        id: webhooks.id,
        url: webhooks.url,
        events: webhooks.events,
        active: webhooks.active,
      });
    if (!r) throw new BadRequestException('Webhook not found');
    return r;
  }
  async deleteHook(a: Auth, id: string) {
    await this.db
      .update(webhooks)
      .set({ active: false, updatedAt: sql`clock_timestamp()` })
      .where(and(eq(webhooks.tenantId, a.tenantId), eq(webhooks.id, id)));
  }
  async testHook(a: Auth, id: string) {
    const [w] = await this.db
      .select()
      .from(webhooks)
      .where(and(eq(webhooks.tenantId, a.tenantId), eq(webhooks.id, id)));
    if (!w) throw new BadRequestException('Webhook not found');
    const [d] = await this.db
      .insert(webhookDeliveries)
      .values({ tenantId: a.tenantId, webhookId: id, event: 'webhook.test', status: 'queued' })
      .returning();
    return d;
  }
  async deliveries(a: Auth, id: string) {
    return this.db
      .select()
      .from(webhookDeliveries)
      .where(and(eq(webhookDeliveries.tenantId, a.tenantId), eq(webhookDeliveries.webhookId, id)))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(100);
  }
  async retry(a: Auth, id: string) {
    const [d] = await this.db
      .update(webhookDeliveries)
      .set({ status: 'queued', attempts: '0' })
      .where(and(eq(webhookDeliveries.tenantId, a.tenantId), eq(webhookDeliveries.id, id)))
      .returning();
    if (!d) throw new BadRequestException('Delivery not found');
    return d;
  }
}
@Controller()
@UseGuards(AuthGuard)
export class IntegrationsController {
  constructor(private readonly s: IntegrationsService) {}
  @Get('integrations') list(@CurrentAuth() a: Auth) {
    return this.s.list(a);
  }
  @Post('integrations/:provider/connect') @Idempotent('integration.connect') connect(
    @CurrentAuth() a: Auth,
    @Param('provider') p: string,
    @Body() d: ConnectIntegrationDto,
  ) {
    /*
     * Provider settings now arrive under `config` rather than as loose
     * top-level keys. With validation switched on, forbidNonWhitelisted
     * would reject the flat shape outright, so the payload is nested to
     * keep provider-specific keys expressible while still being checked.
     */
    return this.s.connect(a, p, d.config ?? {});
  }
  @Get('integrations/:provider/callback') callback(
    @CurrentAuth() a: Auth,
    @Param('provider') p: string,
  ) {
    return this.s.connect(a, p, { callback: true });
  }
  @Post('integrations/:integrationId/test') test(
    @CurrentAuth() a: Auth,
    @Param('integrationId', ParseUUIDPipe) id: string,
  ) {
    return this.s.list(a).then((rows) => rows.find((r) => r.id === id) ?? null);
  }
  @Post('integrations/:integrationId/sync') sync(
    @CurrentAuth() a: Auth,
    @Param('integrationId', ParseUUIDPipe) id: string,
  ) {
    return this.test(a, id);
  }
  @Get('integrations/:provider/health') health(
    @CurrentAuth() a: Auth,
    @Param('provider') provider: string,
  ) {
    return this.s.health(a, provider);
  }
  @Delete('integrations/:integrationId') @HttpCode(204) remove(
    @CurrentAuth() a: Auth,
    @Param('integrationId', ParseUUIDPipe) id: string,
  ) {
    return this.s.remove(a, id);
  }
  @Get('api-clients') clients(@CurrentAuth() a: Auth) {
    return this.s.clients(a);
  }
  @Post('api-clients') @Idempotent('api_client.create') createClient(
    @CurrentAuth() a: Auth,
    @Body() d: ApiClientDto,
  ) {
    return this.s.createClient(a, d);
  }
  @Patch('api-clients/:clientId') updateClient(
    @CurrentAuth() a: Auth,
    @Param('clientId', ParseUUIDPipe) id: string,
    @Body() d: ApiClientDto,
  ) {
    return this.s.updateClient(a, id, d);
  }
  @Delete('api-clients/:clientId') @HttpCode(204) revokeClient(
    @CurrentAuth() a: Auth,
    @Param('clientId', ParseUUIDPipe) id: string,
  ) {
    return this.s.revokeClient(a, id);
  }
  @Post('api-clients/:clientId/rotate-secret') rotate(
    @CurrentAuth() a: Auth,
    @Param('clientId', ParseUUIDPipe) id: string,
  ) {
    return this.s.rotate(a, id);
  }
  @Get('webhooks') hooks(@CurrentAuth() a: Auth) {
    return this.s.hooks(a);
  }
  @Post('webhooks') @Idempotent('webhook.create') createHook(
    @CurrentAuth() a: Auth,
    @Body() d: WebhookDto,
  ) {
    return this.s.createHook(a, d);
  }
  @Patch('webhooks/:webhookId') updateHook(
    @CurrentAuth() a: Auth,
    @Param('webhookId', ParseUUIDPipe) id: string,
    @Body() d: WebhookUpdateDto,
  ) {
    return this.s.updateHook(a, id, d);
  }
  @Delete('webhooks/:webhookId') @HttpCode(204) deleteHook(
    @CurrentAuth() a: Auth,
    @Param('webhookId', ParseUUIDPipe) id: string,
  ) {
    return this.s.deleteHook(a, id);
  }
  @Post('webhooks/:webhookId/test') testHook(
    @CurrentAuth() a: Auth,
    @Param('webhookId', ParseUUIDPipe) id: string,
  ) {
    return this.s.testHook(a, id);
  }
  @Get('webhooks/:webhookId/deliveries') deliveries(
    @CurrentAuth() a: Auth,
    @Param('webhookId', ParseUUIDPipe) id: string,
  ) {
    return this.s.deliveries(a, id);
  }
  @Get('webhook-deliveries/:deliveryId') delivery(
    @CurrentAuth() a: Auth,
    @Param('deliveryId', ParseUUIDPipe) id: string,
  ) {
    return this.s.deliveries(a, id).then((rows) => rows.find((r) => r.id === id) ?? null);
  }
  @Post('webhook-deliveries/:deliveryId/retry') retry(
    @CurrentAuth() a: Auth,
    @Param('deliveryId', ParseUUIDPipe) id: string,
  ) {
    return this.s.retry(a, id);
  }
}
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
})
export class IntegrationsModule {}
