import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listScopedMemberships } from './membership-client';
import { getTeamCapacity, listTeams } from './team-client';
vi.mock('./team-client', () => ({ getTeamCapacity: vi.fn(), listTeams: vi.fn() }));
const member = (id: string) => ({
  membershipId: id,
  identityId: `identity-${id}`,
  displayName: `Person ${id}`,
  email: `${id}@example.invalid`,
  status: 'active',
  identityStatus: 'active',
  capacity: 10,
  globalWorkload: 2,
  eligible: true,
  available: 8,
});
const ineligibleMember = (id: string) => ({
  ...member(id),
  identityStatus: 'suspended',
  eligible: false,
  available: 0,
});
const capacity = (...ids: string[]) => ({
  paused: 0,
  teamOwned: 0,
  members: { truncated: false, items: ids.map(member) },
});
describe('authorized management directory', () => {
  beforeEach(() => vi.resetAllMocks());
  it('uses the selected team and never reads the tenant-wide directory', async () => {
    vi.mocked(getTeamCapacity).mockResolvedValue(capacity('a'));
    const signal = new AbortController().signal;
    const result = await listScopedMemberships({ teamId: 'team-a', status: 'active' }, signal);
    expect(listTeams).not.toHaveBeenCalled();
    expect(getTeamCapacity).toHaveBeenCalledWith('team-a', signal);
    expect(result.items).toEqual([
      {
        id: 'a',
        identityId: 'identity-a',
        displayName: 'Person a',
        email: 'a@example.invalid',
        status: 'active',
        capacity: 10,
        roles: ['prospector'],
      },
    ]);
  });
  it('pages authorized teams and de-duplicates people before applying the directory cursor', async () => {
    vi.mocked(listTeams)
      .mockResolvedValueOnce({ items: [{ id: 'team-a' } as never], nextCursor: 'next-team' })
      .mockResolvedValueOnce({ items: [{ id: 'team-b' } as never], nextCursor: null });
    vi.mocked(getTeamCapacity)
      .mockResolvedValueOnce(capacity('a', 'b'))
      .mockResolvedValueOnce(capacity('b', 'c', 'd'));
    const result = await listScopedMemberships({ organizationId: 'org', cursor: 'a', limit: 2 });
    expect(listTeams).toHaveBeenLastCalledWith(
      { organizationId: 'org', cursor: 'next-team', limit: 100 },
      undefined,
    );
    expect(result.items.map((person) => person.id)).toEqual(['b', 'c']);
    expect(result.nextCursor).toBe('c');
  });
  it('does not expose members that the assignment preview would reject', async () => {
    vi.mocked(getTeamCapacity).mockResolvedValue({
      ...capacity('eligible'),
      members: { truncated: false, items: [member('eligible'), ineligibleMember('stale')] },
    });

    const result = await listScopedMemberships({ teamId: 'team-a', status: 'active' });

    expect(result.items.map((person) => person.id)).toEqual(['eligible']);
  });
  it('propagates a denied scope instead of displaying it as an empty team', async () => {
    vi.mocked(getTeamCapacity).mockRejectedValue(new Error('Forbidden'));
    await expect(listScopedMemberships({ teamId: 'outside-scope' })).rejects.toThrow('Forbidden');
  });
  it('refuses to claim a truncated roster is complete', async () => {
    vi.mocked(getTeamCapacity).mockResolvedValue({
      ...capacity(),
      members: { items: [], truncated: true },
    });
    await expect(listScopedMemberships({ teamId: 'large-team' })).rejects.toThrow(
      'complete roster',
    );
  });
});
