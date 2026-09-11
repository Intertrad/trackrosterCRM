import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import {
  auditEvents,
  type AuditEvent,
  type NewAuditEvent,
} from '../database/schema/audit-events.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';

export interface FindAuditEventsByResourceInput {
  tenantId: string;

  resourceType: string;

  resourceId: string;

  limit?: number;
}

@Injectable()
export class AuditRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async create(
    input: NewAuditEvent,
    executor: DatabaseExecutor = this.database,
  ): Promise<AuditEvent> {
    const [event] = await executor.insert(auditEvents).values(input).returning();

    if (!event) {
      throw new Error('Failed to create audit event');
    }

    return event;
  }

  async findById(
    tenantId: string,
    auditEventId: string,
    executor: DatabaseExecutor = this.database,
  ): Promise<AuditEvent | null> {
    const [event] = await executor
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.tenantId, tenantId),

          eq(auditEvents.id, auditEventId),
        ),
      )
      .limit(1);

    return event ?? null;
  }

  async findByResource(
    input: FindAuditEventsByResourceInput,
    executor: DatabaseExecutor = this.database,
  ): Promise<AuditEvent[]> {
    const limit = input.limit ?? 100;

    return executor
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.tenantId, input.tenantId),

          eq(auditEvents.resourceType, input.resourceType),

          eq(auditEvents.resourceId, input.resourceId),
        ),
      )
      .orderBy(desc(auditEvents.occurredAt))
      .limit(limit);
  }
}
