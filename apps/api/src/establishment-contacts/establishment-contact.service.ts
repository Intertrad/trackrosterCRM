import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  EstablishmentContact,
  EstablishmentContactSource,
  EstablishmentContactStatus,
} from '../database/schema/establishment-contacts.js';
import { EstablishmentRepository } from '../establishments/establishment.repository.js';
import {
  EstablishmentContactRepository,
  type UpdateEstablishmentContact,
} from './establishment-contact.repository.js';
import {
  normalizeContactEmail,
  normalizeOptionalContactText,
} from './establishment-contact.utils.js';

export interface CreateEstablishmentContactInput {
  tenantId: string;
  establishmentId: string;

  name?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;

  isPrimary?: boolean;

  source?: EstablishmentContactSource;
}

export interface UpdateEstablishmentContactInput {
  name?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;

  isPrimary?: boolean;

  status?: EstablishmentContactStatus;
}

@Injectable()
export class EstablishmentContactService {
  constructor(
    private readonly contactRepository: EstablishmentContactRepository,

    private readonly establishmentRepository: EstablishmentRepository,
  ) {}

  async create(input: CreateEstablishmentContactInput): Promise<EstablishmentContact> {
    await this.requireEstablishment(input.tenantId, input.establishmentId);

    const name = normalizeOptionalContactText(input.name);

    const email = normalizeContactEmail(input.email);

    const phone = normalizeOptionalContactText(input.phone);

    this.validateIdentity(name, email, phone);

    try {
      return await this.contactRepository.create({
        tenantId: input.tenantId,
        establishmentId: input.establishmentId,

        name,

        jobTitle: normalizeOptionalContactText(input.jobTitle),

        email,
        phone,

        isPrimary: input.isPrimary ?? false,

        status: 'active',

        source: input.source ?? 'manual',
      });
    } catch (error: unknown) {
      this.handleUniqueViolation(error);

      throw error;
    }
  }

  async list(tenantId: string, establishmentId: string): Promise<EstablishmentContact[]> {
    await this.requireEstablishment(tenantId, establishmentId);

    return this.contactRepository.findByEstablishment(tenantId, establishmentId);
  }

  async findById(
    tenantId: string,
    establishmentId: string,
    contactId: string,
  ): Promise<EstablishmentContact> {
    const contact = await this.contactRepository.findById(tenantId, establishmentId, contactId);

    if (!contact) {
      throw new NotFoundException('Establishment contact not found');
    }

    return contact;
  }

  async update(
    tenantId: string,
    establishmentId: string,
    contactId: string,
    input: UpdateEstablishmentContactInput,
  ): Promise<EstablishmentContact> {
    const current = await this.findById(tenantId, establishmentId, contactId);

    const update: UpdateEstablishmentContact = {};

    const name = input.name !== undefined ? normalizeOptionalContactText(input.name) : current.name;

    const email = input.email !== undefined ? normalizeContactEmail(input.email) : current.email;

    const phone =
      input.phone !== undefined ? normalizeOptionalContactText(input.phone) : current.phone;

    this.validateIdentity(name, email, phone);

    if (input.name !== undefined) {
      update.name = name;
    }

    if (input.jobTitle !== undefined) {
      update.jobTitle = normalizeOptionalContactText(input.jobTitle);
    }

    if (input.email !== undefined) {
      update.email = email;
    }

    if (input.phone !== undefined) {
      update.phone = phone;
    }

    if (input.isPrimary !== undefined) {
      update.isPrimary = input.isPrimary;
    }

    if (input.status !== undefined) {
      update.status = input.status;

      /*
       * An inactive/archived contact should
       * not remain the primary contact.
       */
      if (input.status !== 'active') {
        update.isPrimary = false;
      }
    }

    try {
      const contact = await this.contactRepository.update(
        tenantId,
        establishmentId,
        contactId,
        update,
      );

      if (!contact) {
        throw new NotFoundException('Establishment contact not found');
      }

      return contact;
    } catch (error: unknown) {
      this.handleUniqueViolation(error);

      throw error;
    }
  }

  private async requireEstablishment(tenantId: string, establishmentId: string): Promise<void> {
    const establishment = await this.establishmentRepository.findById(tenantId, establishmentId);

    if (!establishment) {
      throw new NotFoundException('Establishment not found');
    }
  }

  private validateIdentity(name: string | null, email: string | null, phone: string | null): void {
    if (!name && !email && !phone) {
      throw new BadRequestException('Contact requires a name, email, or phone');
    }
  }

  private handleUniqueViolation(error: unknown): void {
    const constraint = this.getUniqueConstraint(error);

    if (!constraint) {
      return;
    }

    if (constraint === 'establishment_contacts_tenant_establishment_email_unique') {
      throw new ConflictException('Contact email already exists for this establishment');
    }

    if (constraint === 'establishment_contacts_primary_unique') {
      throw new ConflictException('Establishment already has a primary contact');
    }

    throw new ConflictException('Establishment contact already exists');
  }

  private getUniqueConstraint(error: unknown): string | null {
    if (typeof error !== 'object' || error === null || !('cause' in error)) {
      return null;
    }

    const cause = error.cause;

    if (
      typeof cause !== 'object' ||
      cause === null ||
      !('code' in cause) ||
      cause.code !== '23505'
    ) {
      return null;
    }

    if ('constraint' in cause && typeof cause.constraint === 'string') {
      return cause.constraint;
    }

    return '';
  }
}
