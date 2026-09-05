import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import { AuthSession, authSessions, NewAuthSession } from '../database/schema/auth-sessions.js';
import { Database } from '../database/database.types.js';

@Injectable()
export class AuthSessionRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async create(input: NewAuthSession): Promise<AuthSession> {
    const [session] = await this.database.insert(authSessions).values(input).returning();

    if (!session) {
      throw new Error('Failed to create authentication session');
    }

    return session;
  }

  async findActiveById(sessionId: string, userId: string): Promise<AuthSession | null> {
    const [session] = await this.database
      .select()
      .from(authSessions)
      .where(
        and(
          eq(authSessions.id, sessionId),
          eq(authSessions.userId, userId),
          isNull(authSessions.revokedAt),
        ),
      )
      .limit(1);

    return session ?? null;
  }

  async rotate(
    sessionId: string,
    userId: string,
    currentRefreshTokenHash: string,
    newRefreshTokenHash: string,
    expiresAt: Date,
  ): Promise<AuthSession | null> {
    const [session] = await this.database
      .update(authSessions)
      .set({
        refreshTokenHash: newRefreshTokenHash,
        expiresAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(authSessions.id, sessionId),
          eq(authSessions.userId, userId),
          eq(authSessions.refreshTokenHash, currentRefreshTokenHash),
          isNull(authSessions.revokedAt),
        ),
      )
      .returning();

    return session ?? null;
  }

  async revoke(sessionId: string, userId: string): Promise<boolean> {
    const [session] = await this.database
      .update(authSessions)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(authSessions.id, sessionId),
          eq(authSessions.userId, userId),
          isNull(authSessions.revokedAt),
        ),
      )
      .returning({
        id: authSessions.id,
      });

    return Boolean(session);
  }
}
