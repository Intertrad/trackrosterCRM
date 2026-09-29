import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { CollisionDecisionService } from './collision-decision.service.js';

interface AuthContext {
  userId: string;

  tenantId: string;
}

@Controller('campaigns/:campaignId/prospects/:prospectId/collision-decision')
@UseGuards(AuthGuard)
export class CollisionDecisionController {
  constructor(private readonly collisionDecisionService: CollisionDecisionService) {}

  @Get()
  async evaluate(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Param('prospectId', new ParseUUIDPipe())
    prospectId: string,
  ) {
    const result = await this.collisionDecisionService.evaluate({
      tenantId: auth.tenantId,

      userId: auth.userId,

      campaignId,

      campaignProspectId: prospectId,
    });

    let conflict:
      | {
          expiresAt: string;
        }
      | {
          dueAt: string | null;
        }
      | {
          assignedAt: string;
        }
      | null = null;

    if (result.conflict) {
      /*
       * ACTIVE_RESERVATION / RECENT_CONTACT
       */
      if ('expiresAt' in result.conflict) {
        conflict = {
          expiresAt: result.conflict.expiresAt,
        };
      }

      /*
       * PLANNED_ACTION
       */
      else if ('dueAt' in result.conflict) {
        conflict = {
          dueAt: result.conflict.dueAt,
        };
      }

      /*
       * ACTIVE_ASSIGNMENT
       */
      else {
        conflict = {
          assignedAt: result.conflict.assignedAt,
        };
      }
    }

    return {
      decision: result.decision,

      reasonCode: result.reasonCode,

      establishmentId: result.establishmentId,

      conflict,
    };
  }
}
