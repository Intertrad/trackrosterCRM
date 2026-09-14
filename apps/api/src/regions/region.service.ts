import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { AuditService } from '../audit/audit.service.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import type { Region, RegionStatus, RegionType } from '../database/schema/regions.js';
import { RegionRepository, type UpdateRegion } from './region.repository.js';

const MAX_REGION_HIERARCHY_DEPTH = 1000;

export interface CreateRegionInput {
  tenantId: string;

  actorUserId: string;

  name: string;

  code?: string | null;

  type: RegionType;

  parentRegionId?: string | null;
}

export interface UpdateRegionInput {
  name?: string;

  code?: string | null;

  type?: RegionType;

  parentRegionId?: string | null;

  status?: RegionStatus;
}

@Injectable()
export class RegionService {
  constructor(
    private readonly regionRepository: RegionRepository,

    private readonly auditService: AuditService,

    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async create(input: CreateRegionInput): Promise<Region> {
    const name = this.normalizeRequiredName(input.name);

    const code = this.normalizeOptionalCode(input.code);

    return this.database.transaction(async (transaction) => {
      /*
       * Region hierarchy mutations are serialized
       * per tenant.
       *
       * This closes the race where two concurrent
       * parent changes could independently validate
       * and together create a cycle.
       */
      await this.acquireHierarchyLock(input.tenantId, transaction);

      if (input.parentRegionId) {
        await this.requireParentRegion(input.tenantId, input.parentRegionId, transaction);
      }

      try {
        const region = await this.regionRepository.create(
          {
            tenantId: input.tenantId,

            name,

            code,

            type: input.type,

            parentRegionId: input.parentRegionId ?? null,

            status: 'active',
          },

          transaction,
        );

        await this.auditService.record(
          {
            tenantId: input.tenantId,

            actorType: 'user',

            actorUserId: input.actorUserId,

            action: 'region.created',

            resourceType: 'region',

            resourceId: region.id,

            metadata: {
              name: region.name,

              code: region.code,

              type: region.type,

              parentRegionId: region.parentRegionId,
            },
          },

          transaction,
        );

        return region;
      } catch (error: unknown) {
        this.handlePersistenceError(error);
      }
    });
  }

  async findById(tenantId: string, regionId: string): Promise<Region> {
    const region = await this.regionRepository.findById(tenantId, regionId);

    if (!region) {
      throw new NotFoundException('Region not found');
    }

    return region;
  }

  async list(tenantId: string): Promise<Region[]> {
    return this.regionRepository.findByTenant(tenantId);
  }

  async listChildren(tenantId: string, parentRegionId: string): Promise<Region[]> {
    await this.findById(tenantId, parentRegionId);

    return this.regionRepository.findChildren(tenantId, parentRegionId);
  }

  async update(
    tenantId: string,
    regionId: string,
    actorUserId: string,
    input: UpdateRegionInput,
  ): Promise<Region> {
    /*
     * Normalize values before opening the
     * transaction. This follows the project rule
     * that ordinary input validation should happen
     * before mutation work begins.
     */
    const normalizedName =
      input.name !== undefined ? this.normalizeRequiredName(input.name) : undefined;

    const normalizedCode =
      input.code !== undefined ? this.normalizeOptionalCode(input.code) : undefined;

    return this.database.transaction(async (transaction) => {
      await this.acquireHierarchyLock(tenantId, transaction);

      /*
       * Re-read current state after taking the
       * hierarchy lock so validation works against
       * the latest serialized hierarchy.
       */
      const current = await this.regionRepository.findById(tenantId, regionId, transaction);

      if (!current) {
        throw new NotFoundException('Region not found');
      }

      const update: UpdateRegion = {};

      if (normalizedName !== undefined) {
        update.name = normalizedName;
      }

      if (normalizedCode !== undefined) {
        update.code = normalizedCode;
      }

      if (input.type !== undefined) {
        update.type = input.type;
      }

      if (input.status !== undefined) {
        update.status = input.status;
      }

      if (input.parentRegionId !== undefined) {
        await this.validateParentChange(tenantId, regionId, input.parentRegionId, transaction);

        update.parentRegionId = input.parentRegionId;
      }

      try {
        const region = await this.regionRepository.update(tenantId, regionId, update, transaction);

        if (!region) {
          throw new NotFoundException('Region not found');
        }

        await this.auditService.record(
          {
            tenantId,

            actorType: 'user',

            actorUserId,

            action: 'region.updated',

            resourceType: 'region',

            resourceId: region.id,

            metadata: {
              previousName: current.name,
              newName: region.name,

              previousCode: current.code,
              newCode: region.code,

              previousType: current.type,
              newType: region.type,

              previousParentRegionId: current.parentRegionId,

              newParentRegionId: region.parentRegionId,

              previousStatus: current.status,

              newStatus: region.status,
            },
          },

          transaction,
        );

        return region;
      } catch (error: unknown) {
        this.handlePersistenceError(error);
      }
    });
  }

  private async validateParentChange(
    tenantId: string,
    regionId: string,
    parentRegionId: string | null,
    executor: DatabaseExecutor,
  ): Promise<void> {
    if (parentRegionId === null) {
      return;
    }

    if (parentRegionId === regionId) {
      throw new BadRequestException('Region cannot be its own parent');
    }

    /*
     * Walk from the proposed parent toward the
     * hierarchy root.
     *
     * If regionId appears anywhere in that chain,
     * the proposed update would create a cycle.
     */
    const visited = new Set<string>([regionId]);

    let currentRegionId: string | null = parentRegionId;

    let depth = 0;

    while (currentRegionId) {
      if (visited.has(currentRegionId)) {
        throw new BadRequestException('Region hierarchy cannot contain a cycle');
      }

      visited.add(currentRegionId);

      const region = await this.regionRepository.findById(tenantId, currentRegionId, executor);

      if (!region) {
        throw new NotFoundException('Parent region not found');
      }

      currentRegionId = region.parentRegionId;

      depth += 1;

      if (depth > MAX_REGION_HIERARCHY_DEPTH) {
        /*
         * This should only be reachable if existing
         * data is unexpectedly pathological.
         */
        throw new ServiceUnavailableException('Region hierarchy is too deep');
      }
    }
  }

  private async requireParentRegion(
    tenantId: string,
    parentRegionId: string,
    executor: DatabaseExecutor,
  ): Promise<Region> {
    const parent = await this.regionRepository.findById(tenantId, parentRegionId, executor);

    if (!parent) {
      throw new NotFoundException('Parent region not found');
    }

    return parent;
  }

  private normalizeRequiredName(value: string): string {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException('Region name is required');
    }

    return normalized;
  }

  private normalizeOptionalCode(value: string | null | undefined): string | null {
    if (value == null) {
      return null;
    }

    const normalized = value.trim().toUpperCase();

    if (!normalized) {
      return null;
    }

    return normalized;
  }

  private async acquireHierarchyLock(tenantId: string, executor: DatabaseExecutor): Promise<void> {
    const lockKey = `region-hierarchy:${tenantId}`;

    await executor.execute(
      sql`
        select pg_advisory_xact_lock(
          hashtextextended(
            ${lockKey},
            0
          )
        )
      `,
    );
  }

  private handlePersistenceError(error: unknown): never {
    if (
      error instanceof BadRequestException ||
      error instanceof ConflictException ||
      error instanceof NotFoundException ||
      error instanceof ServiceUnavailableException
    ) {
      throw error;
    }

    if (this.getPostgresErrorCode(error) === '23505') {
      throw new ConflictException('Region code already exists');
    }

    throw error;
  }

  private getPostgresErrorCode(error: unknown): string | null {
    let current: unknown = error;

    for (let depth = 0; depth < 4; depth += 1) {
      if (typeof current !== 'object' || current === null) {
        return null;
      }

      if ('code' in current && typeof current.code === 'string') {
        return current.code;
      }

      if (!('cause' in current)) {
        return null;
      }

      current = current.cause;
    }

    return null;
  }
}
