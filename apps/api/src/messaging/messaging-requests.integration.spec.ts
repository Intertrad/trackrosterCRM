import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { MessagingService } from './messaging.module.js';
import {
  tenants,
  users,
  conversations,
  conversationParticipants,
} from '../database/schema/index.js';
import type { Database } from '../database/database.types.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
const url = process.env.DATABASE_MIGRATION_URL;
const local = !!url && ['localhost', '127.0.0.1'].includes(new URL(url).hostname);
const pool = new Pool({ connectionString: url });
afterAll(() => pool.end());
async function fixture(
  run: (
    service: MessagingService,
    sender: AuthenticatedPrincipal,
    recipient: AuthenticatedPrincipal,
    id: string,
    otherId: string,
  ) => Promise<void>,
) {
  const rollback = new Error('ROLLBACK_TEST_FIXTURE');
  try {
    await drizzle(pool).transaction(async (tx) => {
      const tenantId = randomUUID(),
        senderId = randomUUID(),
        recipientId = randomUUID(),
        id = randomUUID(),
        otherId = randomUUID();
      await tx.insert(tenants).values({
        id: tenantId,
        name: 'Messaging request regression',
        slug: 'requests-' + tenantId,
      });
      await tx.insert(users).values([
        {
          id: senderId,
          tenantId,
          email: senderId + '@requests.test',
          displayName: 'Requester',
          passwordHash: 'test-only',
          status: 'active',
        },
        {
          id: recipientId,
          tenantId,
          email: recipientId + '@requests.test',
          displayName: 'Recipient',
          passwordHash: 'test-only',
          status: 'active',
        },
      ]);
      await tx.insert(conversations).values(
        [id, otherId].map((id) => ({
          id,
          tenantId,
          kind: 'direct' as const,
          createdBy: senderId,
        })),
      );
      await tx.insert(conversationParticipants).values(
        [id, otherId].flatMap((conversationId) =>
          [senderId, recipientId].map((membershipId) => ({
            tenantId,
            conversationId,
            membershipId,
          })),
        ),
      );
      const sender = { tenantId, membershipId: senderId } as AuthenticatedPrincipal;
      const recipient = { tenantId, membershipId: recipientId } as AuthenticatedPrincipal;
      await run(new MessagingService(tx as unknown as Database), sender, recipient, id, otherId);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}
describe.skipIf(!local)('message requests on local PostgreSQL (rolled back)', () => {
  it('only explicit requests wait; only an explicit reply resolves them', async () =>
    fixture(async (s, a, b, id) => {
      await s.send(a, id, 'Normal message');
      expect(
        (await s.list(a, { limit: 50 })).items.find((c) => c.id === id)?.pendingRequests,
      ).toHaveLength(0);
      const request = await s.send(a, id, 'Please confirm', { isRequest: true });
      expect(request?.isRequest).toBe(true);
      await s.read(b, id, request!.id);
      await s.send(b, id, 'Normal conversation, not an answer');
      expect(
        (await s.list(a, { limit: 50 })).items.find((c) => c.id === id)?.pendingRequests,
      ).toHaveLength(1);
      const reply = await s.send(b, id, 'Confirmed', { replyToRequestId: request!.id });
      expect(reply?.replyToRequestId).toBe(request!.id);
      expect(
        (await s.list(a, { limit: 50 })).items.find((c) => c.id === id)?.pendingRequests,
      ).toHaveLength(0);
      await expect(
        s.send(b, id, 'Duplicate answer', { replyToRequestId: request!.id }),
      ).rejects.toBeInstanceOf(ConflictException);
    }));
  it('keeps other requests waiting when only one is answered', async () =>
    fixture(async (s, a, b, id) => {
      const first = await s.send(a, id, 'First', { isRequest: true });
      const second = await s.send(a, id, 'Second', { isRequest: true });
      await s.send(b, id, 'Answer first', { replyToRequestId: first!.id });
      const pending = (await s.list(a, { limit: 50 })).items.find(
        (c) => c.id === id,
      )!.pendingRequests;
      expect(pending.map((r) => r.id)).toEqual([second!.id]);
    }));
  it('rejects self replies, cross-conversation replies and conflicting send modes', async () =>
    fixture(async (s, a, b, id, otherId) => {
      const request = await s.send(a, id, 'Question', { isRequest: true });
      await expect(
        s.send(a, id, 'Self reply', { replyToRequestId: request!.id }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        s.send(b, otherId, 'Wrong thread', { replyToRequestId: request!.id }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        s.send(b, id, 'Both modes', { isRequest: true, replyToRequestId: request!.id }),
      ).rejects.toBeInstanceOf(BadRequestException);
      const plain = await s.send(a, id, 'Normal');
      await expect(
        s.send(b, id, 'Not a request', { replyToRequestId: plain!.id }),
      ).rejects.toBeInstanceOf(NotFoundException);
    }));
});
