import { Injectable } from '@nestjs/common';

import type { Establishment } from '../database/schema/establishments.js';
import { EstablishmentRepository } from '../establishments/establishment.repository.js';
import { normalizeEstablishmentName } from '../establishments/establishment.utils.js';
import type { ImportPreviewEstablishment } from './import-preview.types.js';
import { sql } from 'drizzle-orm';
import type { DatabaseExecutor, DatabaseTransaction } from '../database/database.types.js';

@Injectable()
export class ImportDeduplicationService {
  constructor(private readonly establishmentRepository: EstablishmentRepository) {}

  async findExisting(
    tenantId: string,
    input: ImportPreviewEstablishment,
    executor?: DatabaseExecutor,
  ): Promise<Establishment | null> {
    if (input.externalReference) {
      const byExternalReference = executor
        ? await this.establishmentRepository.findByExternalReference(
            tenantId,
            'import',
            input.externalReference,
            executor,
          )
        : await this.establishmentRepository.findByExternalReference(
            tenantId,
            'import',
            input.externalReference,
          );

      if (byExternalReference) {
        return byExternalReference;
      }
    }

    const normalizedName = normalizeEstablishmentName(input.name);

    if (executor) {
      return this.establishmentRepository.findByIdentity(
        tenantId,
        normalizedName,
        input.postalCode,
        input.city,
        input.countryCode,
        executor,
      );
    }

    return this.establishmentRepository.findByIdentity(
      tenantId,
      normalizedName,
      input.postalCode,
      input.city,
      input.countryCode,
    );
  }

  async acquireExecutionLock(
    tenantId: string,
    input: ImportPreviewEstablishment,
    transaction: DatabaseTransaction,
  ): Promise<void> {
    // Serialize staged atomic commits with legacy per-row import execution.
    await transaction.execute(sql`SELECT id FROM tenants WHERE id=${tenantId} FOR NO KEY UPDATE`);
    const identity = input.externalReference
      ? `external:${input.externalReference.trim().toLowerCase()}`
      : [
          'identity',
          normalizeEstablishmentName(input.name),
          input.postalCode?.trim().toLowerCase() ?? '',
          input.city?.trim().toLowerCase() ?? '',
          input.countryCode.trim().toUpperCase(),
        ].join(':');

    const lockKey = `${tenantId}:${identity}`;

    await transaction.execute(
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
}
