import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ProspectActivityRepository } from '../activities/prospect-activity.repository.js';
import type { ProspectActivity } from '../database/schema/prospect-activities.js';
import type { CoolingOffEvaluation } from './cooling-off.types.js';

@Injectable()
export class CoolingOffService {
  private readonly coolingOffMinutes: number;

  constructor(
    private readonly prospectActivityRepository: ProspectActivityRepository,

    private readonly configService: ConfigService,
  ) {
    this.coolingOffMinutes = Number(
      this.configService.getOrThrow<string>('PROSPECT_COOLING_OFF_MINUTES'),
    );
  }

  async evaluate(
    tenantId: string,
    establishmentId: string,
    now: Date = new Date(),
  ): Promise<CoolingOffEvaluation> {
    let activity;

    try {
      activity = await this.prospectActivityRepository.findLatestByEstablishment(
        tenantId,
        establishmentId,
      );
    } catch {
      /*
       * Cooling-off is part of prospecting safety,
       * therefore database failure fails closed.
       */
      throw new ServiceUnavailableException('Cooling-off service is unavailable');
    }

    if (!activity) {
      return {
        active: false,

        activity: null,

        expiresAt: null,
      };
    }

    return this.evaluateActivity(activity, now);
  }

  evaluateActivity(
    activity: ProspectActivity,
    now: Date = new Date(),
    coolingOffMinutes: number = this.coolingOffMinutes,
  ): CoolingOffEvaluation {
    const expiresAt = new Date(activity.occurredAt.getTime() + coolingOffMinutes * 60 * 1000);

    return {
      active: expiresAt.getTime() > now.getTime(),

      activity,

      expiresAt,
    };
  }
}
