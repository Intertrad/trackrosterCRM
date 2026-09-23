import { Controller, Get, UseGuards } from '@nestjs/common';
import { desc, eq, isNull } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { PlatformAdminGuard } from '../authorization/platform-admin.guard.js';
import { DATABASE } from '../database/database.constants.js';
import { Database } from '../database/database.types.js';
import { identities, platformAccessGrants } from '../database/schema/index.js';

@Controller('platform/users')
@UseGuards(AuthGuard, PlatformAdminGuard)
export class PlatformUserController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  @Get()
  async list() {
    return {
      items: await this.db
        .select({
          identityId: identities.id,
          email: identities.email,
          status: identities.status,
          role: platformAccessGrants.role,
          grantedAt: platformAccessGrants.grantedAt,
        })
        .from(platformAccessGrants)
        .innerJoin(identities, eq(identities.id, platformAccessGrants.identityId))
        .where(isNull(platformAccessGrants.revokedAt))
        .orderBy(desc(platformAccessGrants.grantedAt)),
    };
  }
}
