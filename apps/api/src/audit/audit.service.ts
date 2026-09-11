import { BadRequestException, Injectable } from '@nestjs/common';

import type { AuditEvent } from '../database/schema/audit-events.js';
import type { DatabaseExecutor } from '../database/database.types.js';
import { AuditRepository } from './audit.repository.js';
import type { AuditMetadata, RecordAuditEventInput } from './audit.types.js';

const AUDIT_ACTION_PATTERN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

const AUDIT_RESOURCE_TYPE_PATTERN = /^[a-z][a-z0-9_]*$/;

/*
 * Normalize key names before checking so these all
 * resolve to the same protected concept:
 *
 * passwordHash
 * password_hash
 * PASSWORD-HASH
 */
const FORBIDDEN_METADATA_KEYS = new Set([
  'password',
  'passwordhash',
  'accesstoken',
  'refreshtoken',
  'refreshtokenhash',
  'authorization',
  'authorizationheader',
  'cookie',
  'cookies',
  'apikey',
  'secret',
  'clientsecret',
]);

const MAX_METADATA_DEPTH = 10;

@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  async record(input: RecordAuditEventInput, executor?: DatabaseExecutor): Promise<AuditEvent> {
    const action = input.action.trim();

    const resourceType = input.resourceType.trim();

    const resourceId = input.resourceId.trim();

    this.validateAction(action);

    this.validateResourceType(resourceType);

    if (!resourceId) {
      throw new BadRequestException('Audit resourceId must not be blank');
    }

    const metadata = input.metadata ?? {};

    this.validateMetadata(metadata);

    return this.auditRepository.create(
      {
        tenantId: input.tenantId,

        actorType: input.actorType,

        actorUserId: input.actorType === 'user' ? input.actorUserId : null,

        action,

        resourceType,

        resourceId,

        metadata,
      },

      executor,
    );
  }

  private validateAction(action: string): void {
    if (!AUDIT_ACTION_PATTERN.test(action)) {
      throw new BadRequestException('Audit action must use lowercase domain.verb format');
    }
  }

  private validateResourceType(resourceType: string): void {
    if (!AUDIT_RESOURCE_TYPE_PATTERN.test(resourceType)) {
      throw new BadRequestException('Audit resourceType must use lowercase snake_case format');
    }
  }

  private validateMetadata(metadata: AuditMetadata): void {
    this.inspectMetadataValue(metadata, 0);
  }

  private inspectMetadataValue(value: unknown, depth: number): void {
    if (depth > MAX_METADATA_DEPTH) {
      throw new BadRequestException('Audit metadata exceeds maximum nesting depth');
    }

    if (
      value === null ||
      value === undefined ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        this.inspectMetadataValue(item, depth + 1);
      }

      return;
    }

    if (typeof value !== 'object') {
      throw new BadRequestException('Audit metadata contains an unsupported value');
    }

    /*
     * Audit metadata should be JSON data, not
     * class instances, Dates, Buffers, Maps, etc.
     */
    const prototype = Object.getPrototypeOf(value);

    if (prototype !== Object.prototype && prototype !== null) {
      throw new BadRequestException('Audit metadata must contain plain JSON-compatible objects');
    }

    for (const [key, childValue] of Object.entries(value)) {
      const normalizedKey = this.normalizeMetadataKey(key);

      if (FORBIDDEN_METADATA_KEYS.has(normalizedKey)) {
        throw new BadRequestException(`Audit metadata contains forbidden field: ${key}`);
      }

      this.inspectMetadataValue(childValue, depth + 1);
    }
  }

  private normalizeMetadataKey(key: string): string {
    return key.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
}
