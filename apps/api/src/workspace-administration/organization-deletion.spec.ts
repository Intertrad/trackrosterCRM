import { describe, expect, it, vi } from 'vitest';
import { WorkspaceAdministrationService } from './workspace-administration.service.js';
import { resourceETag } from '../http/resource-etag.js';

function setup({
  admin = true,
  exists = true,
  linked = false,
  deleteError = undefined as unknown,
} = {}) {
  const row = { id: 'org', name: 'Example', slug: 'example', tenantId: 'tenant' };
  const remove = vi.fn(async () => {
    if (deleteError) throw deleteError;
  });
  const locked = { for: vi.fn(async () => (exists ? [row] : [])) };
  const tx = {
    select: () => ({ from: () => ({ where: () => locked }) }),
    execute: vi.fn(async () => ({ rows: linked ? [{}] : [] })),
    delete: vi.fn(() => ({ where: remove })),
  };
  const database = { transaction: vi.fn(async (work: (tx: unknown) => unknown) => work(tx)) };
  const audit = { record: vi.fn(async () => undefined) };
  const service = new WorkspaceAdministrationService(
    database as never,
    { isClientAdmin: vi.fn(async () => admin) } as never,
    audit as never,
  );
  vi.spyOn(service, 'organization').mockResolvedValue(row as never);
  const auth = { tenantId: 'tenant', membershipId: 'admin' } as never;
  return { service, database, tx, remove, audit, auth, row };
}
describe('permanent organization deletion', () => {
  it('deletes an unlinked organization and records an audit event', async () => {
    const s = setup();
    await expect(
      s.service.deleteOrganizationPermanently(s.auth, 'org', resourceETag(s.row)),
    ).resolves.toEqual({ deleted: true, id: 'org' });
    expect(s.remove).toHaveBeenCalledOnce();
    expect(s.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'organization.deleted', tenantId: 'tenant' }),
      s.tx,
    );
  });
  it('denies non-admin callers before a transaction', async () => {
    const s = setup({ admin: false });
    await expect(s.service.deleteOrganizationPermanently(s.auth, 'org')).rejects.toMatchObject({
      status: 403,
    });
    expect(s.database.transaction).not.toHaveBeenCalled();
  });
  it('does not delete a missing or out-of-tenant record', async () => {
    const s = setup({ exists: false });
    await expect(s.service.deleteOrganizationPermanently(s.auth, 'org')).rejects.toMatchObject({
      status: 404,
    });
    expect(s.remove).not.toHaveBeenCalled();
  });
  it('rejects stale versions without deleting', async () => {
    const s = setup();
    await expect(
      s.service.deleteOrganizationPermanently(s.auth, 'org', 'stale'),
    ).rejects.toMatchObject({ status: 412 });
    expect(s.remove).not.toHaveBeenCalled();
  });
  it('blocks links that would otherwise cascade', async () => {
    const s = setup({ linked: true });
    await expect(s.service.deleteOrganizationPermanently(s.auth, 'org')).rejects.toMatchObject({
      status: 409,
    });
    expect(s.remove).not.toHaveBeenCalled();
  });
  it('maps restrictive foreign keys to a conflict and does not audit success', async () => {
    const s = setup({ deleteError: { cause: { code: '23503' } } });
    await expect(s.service.deleteOrganizationPermanently(s.auth, 'org')).rejects.toMatchObject({
      status: 409,
    });
    expect(s.audit.record).not.toHaveBeenCalled();
  });
});
