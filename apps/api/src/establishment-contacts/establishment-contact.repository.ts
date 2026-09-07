import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  establishmentContacts,
  type EstablishmentContact,
  type NewEstablishmentContact,
} from '../database/schema/establishment-contacts.js';

export type UpdateEstablishmentContact = Partial<
  Pick<EstablishmentContact, 'name' | 'jobTitle' | 'email' | 'phone' | 'isPrimary' | 'status'>
>;

export interface FindImportContactInput {
  email: string | null;
  phone: string | null;
  name: string | null;
}

@Injectable()
export class EstablishmentContactRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async create(
    input: NewEstablishmentContact,
    executor: DatabaseExecutor = this.database,
  ): Promise<EstablishmentContact> {
    const [contact] = await executor.insert(establishmentContacts).values(input).returning();

    if (!contact) {
      throw new Error('Failed to create establishment contact');
    }

    return contact;
  }

  async findById(
    tenantId: string,
    establishmentId: string,
    contactId: string,
    executor: DatabaseExecutor = this.database,
  ): Promise<EstablishmentContact | null> {
    const [contact] = await executor
      .select()
      .from(establishmentContacts)
      .where(
        and(
          eq(establishmentContacts.tenantId, tenantId),
          eq(establishmentContacts.establishmentId, establishmentId),
          eq(establishmentContacts.id, contactId),
        ),
      )
      .limit(1);

    return contact ?? null;
  }

  async findByEstablishment(
    tenantId: string,
    establishmentId: string,
  ): Promise<EstablishmentContact[]> {
    return this.database
      .select()
      .from(establishmentContacts)
      .where(
        and(
          eq(establishmentContacts.tenantId, tenantId),
          eq(establishmentContacts.establishmentId, establishmentId),
        ),
      )
      .orderBy(desc(establishmentContacts.isPrimary), asc(establishmentContacts.createdAt));
  }

  async update(
    tenantId: string,
    establishmentId: string,
    contactId: string,
    input: UpdateEstablishmentContact,
  ): Promise<EstablishmentContact | null> {
    const [contact] = await this.database
      .update(establishmentContacts)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(establishmentContacts.tenantId, tenantId),
          eq(establishmentContacts.establishmentId, establishmentId),
          eq(establishmentContacts.id, contactId),
        ),
      )
      .returning();

    return contact ?? null;
  }

  async findImportDuplicate(
    tenantId: string,
    establishmentId: string,
    input: FindImportContactInput,
    executor: DatabaseExecutor = this.database,
  ): Promise<EstablishmentContact | null> {
    if (input.email) {
      const [contact] = await executor
        .select()
        .from(establishmentContacts)
        .where(
          and(
            eq(establishmentContacts.tenantId, tenantId),
            eq(establishmentContacts.establishmentId, establishmentId),
            eq(establishmentContacts.email, input.email),
          ),
        )
        .limit(1);

      return contact ?? null;
    }

    if (input.phone) {
      const phone = input.phone.trim();

      const [contact] = await this.database
        .select()
        .from(establishmentContacts)
        .where(
          and(
            eq(establishmentContacts.tenantId, tenantId),
            eq(establishmentContacts.establishmentId, establishmentId),
            sql`
              btrim(
                coalesce(
                  ${establishmentContacts.phone},
                  ''
                )
              )
              =
              ${phone}
            `,
          ),
        )
        .limit(1);

      return contact ?? null;
    }

    if (input.name) {
      const name = input.name.trim().toLowerCase();

      const [contact] = await this.database
        .select()
        .from(establishmentContacts)
        .where(
          and(
            eq(establishmentContacts.tenantId, tenantId),
            eq(establishmentContacts.establishmentId, establishmentId),
            sql`
              lower(
                btrim(
                  coalesce(
                    ${establishmentContacts.name},
                    ''
                  )
                )
              )
              =
              ${name}
            `,
          ),
        )
        .limit(1);

      return contact ?? null;
    }

    return null;
  }
}
