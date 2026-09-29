import { and, eq, inArray, type SQL } from 'drizzle-orm';
import type { Database } from '../../src/database/database.types.js';
import { auditEvents } from '../../src/database/schema/audit-events.js';
import { users } from '../../src/database/schema/users.js';

/** Fixture teardown only: remove new session evidence before deleting its actor. */
export async function clearSessionEvidenceForUsers(
  database: Database,
  fixturePredicate: SQL,
): Promise<void> {
  await database
    .delete(auditEvents)
    .where(
      and(
        eq(auditEvents.resourceType, 'auth_session'),
        inArray(
          auditEvents.actorUserId,
          database.select({ id: users.id }).from(users).where(fixturePredicate),
        ),
      ),
    );
}
