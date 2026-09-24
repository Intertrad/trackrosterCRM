/*
 * GET /manager/dashboard returns per-prospector rows keyed by userId only,
 * and GET /users is behind ClientAdminGuard, so a manager cannot resolve a
 * member's name. These helpers produce a stable, readable handle from the id
 * rather than printing a raw UUID in the interface.
 */
export function shortenId(value: string): string {
  return value.length <= 10 ? value : `${value.slice(0, 8)}…`;
}

export function initialsFromId(value: string): string {
  const compact = value.replace(/[^a-z0-9]/gi, '');

  return (compact.slice(0, 2) || 'U').toUpperCase();
}
