import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { User } from '../database/schema/users.js';
import { PasswordService } from '../auth/password.service.js';
import { UserRepository } from '../users/user.repository.js';
import { ManagedUser } from './user-management.types.js';

export interface CreateManagedUserInput {
  tenantId: string;
  email: string;
  password: string;
}

@Injectable()
export class UserManagementService {
  constructor(
    @Inject(UserRepository)
    private readonly userRepository: UserRepository,

    @Inject(PasswordService)
    private readonly passwordService: PasswordService,
  ) {}

  async list(tenantId: string): Promise<ManagedUser[]> {
    const users = await this.userRepository.findByTenant(tenantId);

    return users.map((user) => this.toManagedUser(user));
  }

  async create(input: CreateManagedUserInput): Promise<ManagedUser> {
    const email = input.email.trim().toLowerCase();

    const existing = await this.userRepository.findByEmail(email);

    if (existing) {
      throw new ConflictException('User email already exists');
    }

    const passwordHash = await this.passwordService.hash(input.password);

    try {
      const user = await this.userRepository.create({
        tenantId: input.tenantId,
        email,
        passwordHash,
        status: 'active',
      });

      return this.toManagedUser(user);
    } catch (error: unknown) {
      if (this.hasPostgresCode(error, '23505')) {
        throw new ConflictException('User email already exists');
      }

      throw error;
    }
  }

  async updateStatus(
    tenantId: string,
    actorUserId: string,
    targetUserId: string,
    status: User['status'],
  ): Promise<ManagedUser> {
    if (actorUserId === targetUserId && status !== 'active') {
      throw new ForbiddenException('You cannot suspend or disable your own account');
    }

    const user = await this.userRepository.updateStatus(tenantId, targetUserId, status);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toManagedUser(user);
  }

  private toManagedUser(user: User): ManagedUser {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private hasPostgresCode(error: unknown, code: string): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const cause = error.cause;

    if (typeof cause !== 'object' || cause === null || !('code' in cause)) {
      return false;
    }

    return cause.code === code;
  }
}
