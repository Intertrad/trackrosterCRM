import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ProspectActivityRepository } from '../activities/prospect-activity.repository.js';
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
       * Cooling-off is part of prospecting
       * safety, so database failure must never
       * silently become "not cooling".
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

    const expiresAt = new Date(activity.occurredAt.getTime() + this.coolingOffMinutes * 60 * 1000);

    const active = expiresAt.getTime() > now.getTime();

    return {
      active,

      activity,

      expiresAt,
    };
  }
}
