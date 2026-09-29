import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Campaign } from '../database/schema/campaigns.js';
import type {
  CampaignProspect,
  CampaignProspectStatus,
} from '../database/schema/campaign-prospects.js';
import { AuditService } from '../audit/audit.service.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { establishmentFilterConditions } from '../establishments/establishment-filters.js';
import { EstablishmentRepository } from '../establishments/establishment.repository.js';
import type { EnrolCampaignProspectsDto } from './dto/enrol-campaign-prospects.dto.js';
import { CampaignRepository } from './campaign.repository.js';
import { CampaignProspectRepository } from './campaign-prospect.repository.js';

export interface AddCampaignProspectInput {
  tenantId: string;
  campaignId: string;
  establishmentId: string;
}
export interface AddCampaignProspectInput {
  tenantId: string;
  actorUserId: string;
  campaignId: string;
  establishmentId: string;
}
export interface EnrolCampaignProspectsResult {
  campaignId: string;
  mode: 'preview' | 'apply';
  /** Active establishments matching the selection, ignoring `limit`. */
  matched: number;
  /** How many of those this request acted on. */
  selected: number;
  truncated: boolean;
  /** Of the selected, how many were not already in the campaign. */
  enrollable: number;
  /** Memberships actually created. Always 0 in preview. */
  enrolled: number;
  alreadyActive: number;
  /**
   * Already in the campaign but excluded. Left excluded on purpose — see
   * enrol().
   */
  alreadyExcluded: number;
  limit: number;
}

export interface UpdateCampaignProspectStatusInput {
  tenantId: string;
  actorUserId: string;
  campaignId: string;
  prospectId: string;
  status: CampaignProspectStatus;
}

@Injectable()
export class CampaignProspectService {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,

    private readonly prospectRepository: CampaignProspectRepository,

    private readonly campaignRepository: CampaignRepository,

    private readonly establishmentRepository: EstablishmentRepository,

    private readonly auditService: AuditService,
  ) {}

  async add(input: AddCampaignProspectInput): Promise<CampaignProspect> {
    const campaign = await this.requireCampaign(input.tenantId, input.campaignId);

    this.requireMutableCampaign(campaign);

    await this.requireEstablishment(input.tenantId, input.establishmentId);

    const existing = await this.prospectRepository.findByCampaignAndEstablishment(
      input.tenantId,
      input.campaignId,
      input.establishmentId,
    );

    /*
     * Membership history is preserved.
     *
     * Re-adding an excluded prospect means reactivating
     * the existing membership, not creating a new row.
     */
    if (existing) {
      if (existing.status === 'active') {
        throw new ConflictException('Establishment already belongs to campaign');
      }

      return this.database.transaction(async (transaction) => {
        const reactivated = await this.prospectRepository.updateStatus(
          input.tenantId,
          input.campaignId,
          existing.id,
          'active',
          transaction,
        );

        if (!reactivated) {
          throw new NotFoundException('Campaign prospect not found');
        }

        await this.auditService.record(
          {
            tenantId: input.tenantId,
            actorType: 'user',
            actorUserId: input.actorUserId,
            action: 'campaign_prospect.reactivated',
            resourceType: 'campaign_prospect',
            resourceId: reactivated.id,
            metadata: {
              campaignId: reactivated.campaignId,
              establishmentId: reactivated.establishmentId,
              status: reactivated.status,
            },
          },
          transaction,
        );

        return reactivated;
      });
    }

    try {
      return await this.database.transaction(async (transaction) => {
        const prospect = await this.prospectRepository.create(
          {
            tenantId: input.tenantId,
            campaignId: input.campaignId,
            establishmentId: input.establishmentId,
            status: 'active',
          },
          transaction,
        );

        await this.auditService.record(
          {
            tenantId: input.tenantId,
            actorType: 'user',
            actorUserId: input.actorUserId,
            action: 'campaign_prospect.added',
            resourceType: 'campaign_prospect',
            resourceId: prospect.id,
            metadata: {
              campaignId: prospect.campaignId,
              establishmentId: prospect.establishmentId,
              status: prospect.status,
            },
          },
          transaction,
        );

        return prospect;
      });
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Establishment already belongs to campaign');
      }

      throw error;
    }
  }

  /*
   * Enrol a filtered slice of the shared référentiel into a campaign.
   *
   * This is the step between the imported base and the dispatch workflow. An
   * establishment is tenant-level and organization-neutral — there is no
   * organization column on the table and its RLS policy is `tenant_id` alone —
   * so all five entities read the same 14,649 rows, and a campaign is how one of
   * them takes a slice of that base as its own work. Enrolment therefore creates
   * campaign membership; it never moves or copies an establishment.
   *
   * Everything downstream already exists: `POST /assignments/preview` and
   * `/assignments/bulk` dispatch these memberships to a team or a prospector,
   * and the organization coordination scope refuses a reservation when two
   * entities reach the same establishment. Nothing here re-implements any of it.
   *
   * Three decisions worth stating, because they differ from the single add:
   *
   *   - It is additive only. `add()` reactivates an excluded membership, which is
   *     right for one establishment chosen deliberately; doing it silently for
   *     4,500 would resurrect exclusions somebody made on purpose. Excluded rows
   *     are counted and reported, and left alone.
   *   - Selection and insertion are one statement, so the set that is counted is
   *     the set that is written. A read-then-write would enrol a set that no
   *     longer matches by the time it is written.
   *   - One audit event records the operation and its selection, rather than one
   *     per membership. The memberships are themselves the durable record, each
   *     with its own created_at; 4,500 audit rows saying the same thing would
   *     bury the decision instead of evidencing it.
   */
  async enrol(
    tenantId: string,
    actorUserId: string,
    campaignId: string,
    input: EnrolCampaignProspectsDto,
    mode: 'preview' | 'apply',
  ): Promise<EnrolCampaignProspectsResult> {
    const campaign = await this.requireCampaign(tenantId, campaignId);

    this.requireMutableCampaign(campaign);

    const filters = establishmentFilterConditions({
      ...(input.search === undefined ? {} : { search: input.search }),
      ...(input.category === undefined ? {} : { category: input.category }),
      ...(input.department === undefined ? {} : { department: input.department }),
      ...(input.city === undefined ? {} : { city: input.city }),
      ...(input.regionId === undefined ? {} : { regionId: input.regionId }),
    });

    const ids = input.establishmentIds?.map((id) => id.toLowerCase());

    if (ids?.length) filters.push(sql`e.id = ANY(${sql.param(ids)}::uuid[])`);

    if (filters.length === 0)
      throw new BadRequestException(
        'Select establishments by id or by at least one filter; an unfiltered enrolment would add the entire référentiel',
      );

    /*
     * `filtered` is referenced more than once, so PostgreSQL materialises it and
     * the référentiel is scanned once for the total, the page and the insert.
     */
    const selection = sql`
      WITH filtered AS (
        SELECT e.id, e.normalized_name
        FROM establishments e
        WHERE e.tenant_id = ${tenantId}
          AND e.status = 'active'
          AND ${sql.join(filters, sql` AND `)}
      ), selected AS (
        SELECT id FROM filtered ORDER BY normalized_name, id LIMIT ${input.limit}
      ), existing AS (
        SELECT cp.establishment_id, cp.status
        FROM campaign_prospects cp
        WHERE cp.tenant_id = ${tenantId}
          AND cp.campaign_id = ${campaignId}
          AND cp.establishment_id IN (SELECT id FROM selected)
      )`;

    const counts = sql`
      (SELECT count(*) FROM filtered) AS matched,
      (SELECT count(*) FROM selected) AS selected,
      (SELECT count(*) FROM existing WHERE status = 'active') AS already_active,
      (SELECT count(*) FROM existing WHERE status = 'excluded') AS already_excluded`;

    const result = await this.database.transaction(async (transaction) => {
      const rows = await transaction.execute<{
        matched: string;
        selected: string;
        enrolled: string;
        already_active: string;
        already_excluded: string;
      }>(
        mode === 'apply'
          ? sql`${selection}, inserted AS (
              INSERT INTO campaign_prospects (tenant_id, campaign_id, establishment_id, status)
              SELECT ${tenantId}, ${campaignId}, s.id, 'active'
              FROM selected s
              WHERE NOT EXISTS (SELECT 1 FROM existing x WHERE x.establishment_id = s.id)
              ON CONFLICT DO NOTHING
              RETURNING id
            )
            SELECT ${counts}, (SELECT count(*) FROM inserted) AS enrolled`
          : sql`${selection} SELECT ${counts}, 0 AS enrolled`,
      );

      const row = rows.rows[0];

      if (!row) throw new Error('Enrolment produced no result');

      const matched = Number(row.matched);
      const selected = Number(row.selected);
      const alreadyActive = Number(row.already_active);
      const alreadyExcluded = Number(row.already_excluded);

      const summary: EnrolCampaignProspectsResult = {
        campaignId,
        mode,
        matched,
        selected,
        truncated: matched > selected,
        enrollable: selected - alreadyActive - alreadyExcluded,
        enrolled: Number(row.enrolled),
        alreadyActive,
        alreadyExcluded,
        limit: input.limit,
      };

      if (mode === 'apply' && summary.enrolled > 0)
        await this.auditService.record(
          {
            tenantId,
            actorType: 'user',
            actorUserId,
            action: 'campaign_prospect.bulk_enrolled',
            resourceType: 'campaign',
            resourceId: campaignId,
            metadata: {
              enrolled: summary.enrolled,
              matched: summary.matched,
              selected: summary.selected,
              alreadyActive: summary.alreadyActive,
              alreadyExcluded: summary.alreadyExcluded,
              truncated: summary.truncated,
              /* The selection itself, so the decision can be reproduced. */
              selectionCategory: input.category ?? null,
              selectionDepartment: input.department ?? null,
              selectionCity: input.city ?? null,
              selectionRegionId: input.regionId ?? null,
              selectionSearch: input.search?.trim() ?? null,
              selectionEstablishmentIds: ids?.length ?? 0,
            },
          },
          transaction,
        );

      return summary;
    });

    return result;
  }

  async list(
    tenantId: string,
    campaignId: string,
    establishmentIds?: string[],
  ): Promise<CampaignProspect[]> {
    await this.requireCampaign(tenantId, campaignId);

    return establishmentIds
      ? this.prospectRepository.findByCampaign(tenantId, campaignId, establishmentIds)
      : this.prospectRepository.findByCampaign(tenantId, campaignId);
  }

  async findById(
    tenantId: string,
    campaignId: string,
    prospectId: string,
  ): Promise<CampaignProspect> {
    await this.requireCampaign(tenantId, campaignId);

    const prospect = await this.prospectRepository.findById(tenantId, campaignId, prospectId);

    if (!prospect) {
      throw new NotFoundException('Campaign prospect not found');
    }

    return prospect;
  }

  async updateStatus(input: UpdateCampaignProspectStatusInput): Promise<CampaignProspect> {
    const campaign = await this.requireCampaign(input.tenantId, input.campaignId);

    this.requireMutableCampaign(campaign);

    const current = await this.findById(input.tenantId, input.campaignId, input.prospectId);

    if (current.status === input.status) {
      return current;
    }

    return this.database.transaction(async (transaction) => {
      const prospect = await this.prospectRepository.updateStatus(
        input.tenantId,
        input.campaignId,
        input.prospectId,
        input.status,
        transaction,
      );

      if (!prospect) {
        throw new NotFoundException('Campaign prospect not found');
      }

      const action =
        input.status === 'excluded'
          ? 'campaign_prospect.excluded'
          : 'campaign_prospect.reactivated';

      await this.auditService.record(
        {
          tenantId: input.tenantId,
          actorType: 'user',
          actorUserId: input.actorUserId,
          action,
          resourceType: 'campaign_prospect',
          resourceId: prospect.id,
          metadata: {
            campaignId: prospect.campaignId,
            establishmentId: prospect.establishmentId,
            status: prospect.status,
          },
        },
        transaction,
      );

      return prospect;
    });
  }

  private async requireCampaign(tenantId: string, campaignId: string): Promise<Campaign> {
    const campaign = await this.campaignRepository.findById(tenantId, campaignId);

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  private async requireEstablishment(tenantId: string, establishmentId: string): Promise<void> {
    const establishment = await this.establishmentRepository.findById(tenantId, establishmentId);

    if (!establishment) {
      throw new NotFoundException('Establishment not found');
    }
  }

  private requireMutableCampaign(campaign: Campaign): void {
    if (campaign.status === 'completed' || campaign.status === 'archived') {
      throw new ConflictException('Campaign is no longer editable');
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('cause' in error)) {
      return false;
    }

    const cause = error.cause;

    return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '23505';
  }
}
