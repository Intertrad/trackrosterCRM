import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PasswordService } from '../auth/password.service.js';
import { UserRepository } from '../users/user.repository.js';
import { UserManagementService } from './user-management.service.js';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common/exceptions/index.js';

describe('UserManagementService', () => {
  let userRepository: UserRepository;
  let passwordService: PasswordService;
  let service: UserManagementService;

  beforeEach(() => {
    userRepository = {
      findByEmail: vi.fn(),
      findByTenant: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      findById: vi.fn(),
    } as unknown as UserRepository;

    passwordService = {
      hash: vi.fn(),
      verify: vi.fn(),
    } as unknown as PasswordService;

    service = new UserManagementService(userRepository, passwordService);
  });

  it('creates a user without exposing the password hash', async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

    vi.mocked(passwordService.hash).mockResolvedValue('$argon2id$hashed-password');

    vi.mocked(userRepository.create).mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      tenantId: '11111111-1111-4111-8111-111111111111',
      email: 'user@trackroster.test',
      passwordHash: '$argon2id$hashed-password',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create({
      tenantId: '11111111-1111-4111-8111-111111111111',

      email: '  USER@TRACKROSTER.TEST ',

      password: 'StrongPassword123!',
    });

    expect(userRepository.findByEmail).toHaveBeenCalledWith('user@trackroster.test');

    expect(passwordService.hash).toHaveBeenCalledWith('StrongPassword123!');

    expect(userRepository.create).toHaveBeenCalledWith({
      tenantId: '11111111-1111-4111-8111-111111111111',

      email: 'user@trackroster.test',

      passwordHash: '$argon2id$hashed-password',

      status: 'active',
    });

    expect(result.email).toBe('user@trackroster.test');

    expect(result).not.toHaveProperty('passwordHash');
  });

  it('rejects a duplicate email', async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      tenantId: '11111111-1111-4111-8111-111111111111',
      email: 'user@trackroster.test',
      passwordHash: 'hash',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.create({
        tenantId: '11111111-1111-4111-8111-111111111111',
        email: 'USER@TRACKROSTER.TEST',
        password: 'StrongPassword123!',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(passwordService.hash).not.toHaveBeenCalled();

    expect(userRepository.create).not.toHaveBeenCalled();
  });

  it('lists tenant users without exposing password hashes', async () => {
    vi.mocked(userRepository.findByTenant).mockResolvedValue([
      {
        id: '22222222-2222-4222-8222-222222222222',
        tenantId: '11111111-1111-4111-8111-111111111111',
        email: 'first@trackroster.test',
        passwordHash: 'hash-one',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        tenantId: '11111111-1111-4111-8111-111111111111',
        email: 'second@trackroster.test',
        passwordHash: 'hash-two',
        status: 'suspended',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await service.list('11111111-1111-4111-8111-111111111111');

    expect(result).toHaveLength(2);

    expect(result[0]).not.toHaveProperty('passwordHash');

    expect(result[1]).not.toHaveProperty('passwordHash');
  });

  it('updates another users status', async () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';

    const actorUserId = '22222222-2222-4222-8222-222222222222';

    const targetUserId = '33333333-3333-4333-8333-333333333333';

    vi.mocked(userRepository.updateStatus).mockResolvedValue({
      id: targetUserId,
      tenantId,
      email: 'user@trackroster.test',
      passwordHash: 'hash',
      status: 'suspended',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.updateStatus(tenantId, actorUserId, targetUserId, 'suspended');

    expect(userRepository.updateStatus).toHaveBeenCalledWith(tenantId, targetUserId, 'suspended');

    expect(result.status).toBe('suspended');

    expect(result).not.toHaveProperty('passwordHash');
  });

  it('rejects updating an unknown user', async () => {
    vi.mocked(userRepository.updateStatus).mockResolvedValue(null);

    await expect(
      service.updateStatus(
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333',
        'suspended',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('prevents an administrator from disabling their own account', async () => {
    const userId = '22222222-2222-4222-8222-222222222222';

    await expect(
      service.updateStatus('11111111-1111-4111-8111-111111111111', userId, userId, 'disabled'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(userRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('prevents an administrator from suspending their own account', async () => {
    const userId = '22222222-2222-4222-8222-222222222222';

    await expect(
      service.updateStatus('11111111-1111-4111-8111-111111111111', userId, userId, 'suspended'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
