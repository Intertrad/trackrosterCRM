import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { AuthMailService } from '../auth/auth-mail.service.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import { auditEvents, organizations, scriptTemplates } from '../database/schema/index.js';

export const SCRIPT_CHANNELS = ['call', 'visit', 'email'] as const;
export type ScriptChannel = (typeof SCRIPT_CHANNELS)[number];
export type ScriptInput = {
  name: string;
  channel: ScriptChannel;
  sector?: string | null;
  organizationId?: string | null;
  subject?: string | null;
  body: string;
  variables?: string[];
  enabled?: boolean;
};

function clean(input: ScriptInput): ScriptInput {
  const name = input.name?.trim();
  const body = input.body?.trim();
  if (!name || !body || !SCRIPT_CHANNELS.includes(input.channel))
    throw new BadRequestException('Name, channel and body are required');
  if (input.channel === 'email' && !input.subject?.trim())
    throw new BadRequestException('Email scripts require a subject');
  const variables = [...new Set((input.variables ?? []).map((v) => v.trim()).filter(Boolean))];
  if (variables.some((v) => !/^[a-z][a-z0-9_]{0,39}$/i.test(v)))
    throw new BadRequestException('Variables must use letters, numbers and underscores');
  return {
    ...input,
    name,
    body,
    subject: input.subject?.trim() || null,
    sector: input.sector?.trim() || null,
    organizationId: input.organizationId || null,
    variables,
    enabled: input.enabled ?? true,
  };
}

function render(text: string | null, values: Record<string, string>) {
  return (text ?? '').replace(
    /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi,
    (_, key: string) => values[key] ?? '',
  );
}

@Injectable()
export class ScriptService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly mail: AuthMailService,
  ) {}

  private async ensureOrganization(
    tx: DatabaseExecutor,
    tenantId: string,
    organizationId?: string | null,
  ) {
    if (!organizationId) return;
    const [organization] = await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(and(eq(organizations.tenantId, tenantId), eq(organizations.id, organizationId)));
    if (!organization) throw new BadRequestException('Organization does not belong to this tenant');
  }

  async list(
    auth: AuthenticatedPrincipal,
    filters: { channel?: ScriptChannel; organizationId?: string; sector?: string },
  ) {
    return this.db
      .select()
      .from(scriptTemplates)
      .where(
        and(
          eq(scriptTemplates.tenantId, auth.tenantId),
          filters.channel ? eq(scriptTemplates.channel, filters.channel) : undefined,
          filters.organizationId
            ? eq(scriptTemplates.organizationId, filters.organizationId)
            : undefined,
          filters.sector ? eq(scriptTemplates.sector, filters.sector) : undefined,
        ),
      )
      .orderBy(asc(scriptTemplates.channel), asc(scriptTemplates.name));
  }

  async get(auth: AuthenticatedPrincipal, id: string, tx: DatabaseExecutor = this.db) {
    const [row] = await tx
      .select()
      .from(scriptTemplates)
      .where(and(eq(scriptTemplates.tenantId, auth.tenantId), eq(scriptTemplates.id, id)));
    if (!row) throw new NotFoundException('Script not found');
    return row;
  }

  async create(auth: AuthenticatedPrincipal, input: ScriptInput) {
    const value = clean(input);
    return this.db.transaction(async (tx) => {
      await this.ensureOrganization(tx, auth.tenantId, value.organizationId);
      const [row] = await tx
        .insert(scriptTemplates)
        .values({
          tenantId: auth.tenantId,
          createdBy: auth.membershipId,
          updatedBy: auth.membershipId,
          ...value,
        })
        .returning();
      await tx
        .insert(auditEvents)
        .values({
          tenantId: auth.tenantId,
          actorType: 'user',
          actorUserId: auth.membershipId,
          resourceType: 'script_template',
          resourceId: row!.id,
          action: 'script_template.created',
          metadata: { name: value.name, channel: value.channel },
        });
      return row;
    });
  }

  async update(auth: AuthenticatedPrincipal, id: string, input: Partial<ScriptInput>) {
    const current = await this.get(auth, id);
    const value = clean({
      ...current,
      ...input,
      channel: (input.channel ?? current.channel) as ScriptChannel,
    });
    return this.db.transaction(async (tx) => {
      await this.ensureOrganization(tx, auth.tenantId, value.organizationId);
      const [row] = await tx
        .update(scriptTemplates)
        .set({ ...value, updatedBy: auth.membershipId, updatedAt: sql`clock_timestamp()` })
        .where(and(eq(scriptTemplates.tenantId, auth.tenantId), eq(scriptTemplates.id, id)))
        .returning();
      if (!row) throw new NotFoundException('Script not found');
      await tx
        .insert(auditEvents)
        .values({
          tenantId: auth.tenantId,
          actorType: 'user',
          actorUserId: auth.membershipId,
          resourceType: 'script_template',
          resourceId: id,
          action: 'script_template.updated',
          metadata: { before: current, after: row },
        });
      return row;
    });
  }

  async remove(auth: AuthenticatedPrincipal, id: string) {
    return this.db.transaction(async (tx) => {
      const current = await this.get(auth, id, tx);
      await tx
        .delete(scriptTemplates)
        .where(and(eq(scriptTemplates.tenantId, auth.tenantId), eq(scriptTemplates.id, id)));
      await tx
        .insert(auditEvents)
        .values({
          tenantId: auth.tenantId,
          actorType: 'user',
          actorUserId: auth.membershipId,
          resourceType: 'script_template',
          resourceId: id,
          action: 'script_template.deleted',
          metadata: { name: current.name },
        });
      return { deleted: true, id };
    });
  }

  async preview(auth: AuthenticatedPrincipal, id: string, values: Record<string, string>) {
    const script = await this.get(auth, id);
    return {
      id: script.id,
      channel: script.channel,
      subject: render(script.subject, values),
      body: render(script.body, values),
      missingVariables: script.variables.filter((key) => !values[key]),
    };
  }

  async sendTest(
    auth: AuthenticatedPrincipal,
    id: string,
    to: string,
    values: Record<string, string>,
  ) {
    if (!/^\S+@\S+\.\S+$/.test(to))
      throw new BadRequestException('A valid recipient email is required');
    const preview = await this.preview(auth, id, values);
    if (preview.channel !== 'email')
      throw new BadRequestException('Only email scripts can be sent as a test');
    await this.db.transaction(async (tx) => {
      await this.mail.enqueue(
        { to: to.trim().toLowerCase(), subject: `[Test] ${preview.subject}`, text: preview.body },
        new Date(Date.now() + 15 * 60_000),
        tx,
      );
      await tx
        .insert(auditEvents)
        .values({
          tenantId: auth.tenantId,
          actorType: 'user',
          actorUserId: auth.membershipId,
          resourceType: 'script_template',
          resourceId: id,
          action: 'script_template.test_sent',
          metadata: { recipient: to.trim().toLowerCase() },
        });
    });
    return { queued: true, recipient: to.trim().toLowerCase() };
  }
}
