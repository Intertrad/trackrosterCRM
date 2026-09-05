import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import { NewUser, User, users } from '../database/schema/users.js';
import { Database } from '../database/database.types.js';

@Injectable()
export class UserRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async create(input: NewUser): Promise<User> {
    const [user] = await this.database.insert(users).values(input).returning();

    if (!user) {
      throw new Error('Failed to create user');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [user] = await this.database.select().from(users).where(eq(users.email, email)).limit(1);

    return user ?? null;
  }

  async findById(tenantId: string, userId: string): Promise<User | null> {
    const [user] = await this.database
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)))
      .limit(1);

    return user ?? null;
  }
}
