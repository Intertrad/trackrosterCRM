import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';

import { AuthorizationService } from '../authorization/authorization.service.js';
import {
  ProspectorTodayRepository,
  type FindProspectorTodayInput,
} from './prospector-today.repository.js';
import { resolveProspectorTodayDay } from './prospector-today-time-zone.js';
import type { ProspectorTodayResponse } from './prospector-today.types.js';

export interface GetProspectorTodayInput {
  tenantId: string;

  userId: string;

  teamId: string;

  timeZone: string;
}

interface ProspectorWorkspaceScope {
  organizationId: string;

  teamId: string;
}

@Injectable()
export class ProspectorTodayService {
  constructor(
    private readonly authorizationService: AuthorizationService,

    private readonly todayRepository: ProspectorTodayRepository,
  ) {}

  async getToday(input: GetProspectorTodayInput): Promise<ProspectorTodayResponse> {
    /*
     * Resolve durable authority before any operational data lookup. A teamId
     * supplied by the browser is only a requested workspace, never authority.
     */
    const scope = await this.requireProspectorWorkspaceAccess(
      input.tenantId,
      input.userId,
      input.teamId,
    );

    /*
     * Capture the server clock exactly once. The same instant defines overdue
     * rows, remaining-today rows, generatedAt, and every priority flag.
     */
    const generatedAt = new Date();

    const day = resolveProspectorTodayDay(generatedAt, input.timeZone);

    const repositoryInput: FindProspectorTodayInput = {
      tenantId: input.tenantId,
      organizationId: scope.organizationId,
      teamId: scope.teamId,
      userId: input.userId,
      now: generatedAt,
      startsAt: day.startsAt,
      endsAt: day.endsAt,
    };

    let result: Awaited<ReturnType<ProspectorTodayRepository['findToday']>>;

    try {
      result = await this.todayRepository.findToday(repositoryInput);
    } catch {
      throw new ServiceUnavailableException('Prospector today view is unavailable');
    }

    return {
      generatedAt: generatedAt.toISOString(),
      day: {
        date: day.date,
        timeZone: day.timeZone,
        startsAt: day.startsAt.toISOString(),
        endsAt: day.endsAt.toISOString(),
      },
      summary: result.summary,
      completed: result.completed.flatMap((row) =>
        row.completedAt
          ? [
              {
                ...row,
                completedAt: row.completedAt.toISOString(),
              },
            ]
          : [],
      ),
      priorities: result.priorities.map((priority) => ({
        id: priority.id,
        campaignId: priority.campaignId,
        campaignProspectId: priority.campaignProspectId,
        dueAt: priority.dueAt.toISOString(),
        isOverdue: priority.dueAt.getTime() < generatedAt.getTime(),
        category: priority.category,
        channel: priority.channel,
        establishment: {
          id: priority.establishment.id,
          name: priority.establishment.name,
          city: priority.establishment.city,
          phone: priority.establishment.phone,
          /* Postgres numeric arrives as a string; publish a number or null. */
          latitude: toCoordinate(priority.establishment.latitude),
          longitude: toCoordinate(priority.establishment.longitude),
        },
      })),
    };
  }

  private async requireProspectorWorkspaceAccess(
    tenantId: string,
    userId: string,
    teamId: string,
  ): Promise<ProspectorWorkspaceScope> {
    const grants = await this.authorizationService.getUserGrants(tenantId, userId);

    const grant = grants.find(
      (candidate) =>
        candidate.role === 'prospector' &&
        candidate.scopeType === 'team' &&
        candidate.teamId === teamId &&
        candidate.organizationId !== null,
    );

    if (!grant || grant.organizationId === null || grant.teamId === null) {
      throw new ForbiddenException('User does not have access to this prospector workspace');
    }

    return {
      organizationId: grant.organizationId,
      teamId: grant.teamId,
    };
  }
}

/*
 * A coordinate the driver hands back as a string, or null when the
 * establishment has never been geocoded. Anything unparseable is treated as
 * absent rather than published as NaN, which would break any map consuming it.
 */
function toCoordinate(value: string | number | null): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}
