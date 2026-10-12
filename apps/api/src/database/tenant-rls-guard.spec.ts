import { describe, expect, it, vi } from 'vitest';

import { RUNTIME_ROLE_QUERY, verifyTenantRlsRuntime } from './tenant-rls-guard.js';

const restrictedRole = {
  roleName: 'trackroster_app',
  isSuperuser: false,
  bypassesRls: false,
  isDatabaseOwner: false,
  ownsApplicationTable: false,
};

describe('verifyTenantRlsRuntime', () => {
  it('does not query when RLS checks are disabled', async () => {
    const pool = { query: vi.fn() };

    await verifyTenantRlsRuntime(pool, 'disabled');

    expect(pool.query).not.toHaveBeenCalled();
  });

  it('accepts a restricted role', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [restrictedRole] }) };

    await expect(verifyTenantRlsRuntime(pool, 'enforce')).resolves.toBeUndefined();
    expect(pool.query).toHaveBeenCalledWith(RUNTIME_ROLE_QUERY);
  });

  it('fails closed for a superuser in enforce mode', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{ ...restrictedRole, isSuperuser: true }],
      }),
    };

    await expect(verifyTenantRlsRuntime(pool, 'enforce')).rejects.toThrow('SUPERUSER');
  });

  it('fails closed for an owner or RLS bypass role in enforce mode', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{ ...restrictedRole, isDatabaseOwner: true, bypassesRls: true }],
      }),
    };

    await expect(verifyTenantRlsRuntime(pool, 'enforce')).rejects.toThrow(
      'BYPASSRLS, database owner',
    );
  });

  it('warns but keeps observe mode available for local diagnosis', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{ ...restrictedRole, ownsApplicationTable: true }],
      }),
    };
    const warn = vi.fn();

    await expect(verifyTenantRlsRuntime(pool, 'observe', warn)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('application table owner'));
  });

  it('fails closed when the role query is inconclusive', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [] }) };

    await expect(verifyTenantRlsRuntime(pool, 'enforce')).rejects.toThrow(
      'returned no database role',
    );
  });
});
