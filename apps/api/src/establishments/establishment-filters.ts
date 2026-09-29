import { sql, type SQL } from 'drizzle-orm';

import type { EstablishmentCategory } from '../database/schema/establishments.js';

/*
 * How the référentiel is narrowed, in one place.
 *
 * The same vocabulary has to mean the same thing on the dispatch queue
 * (which prospects in this campaign are free) and on bulk enrolment (which
 * establishments go into the campaign in the first place). Two copies of
 * "department 974" would eventually disagree, and the way that failure shows up
 * is a manager enrolling a set of establishments and then not finding them in
 * the queue they enrolled them for.
 */
export interface EstablishmentFilter {
  category?: EstablishmentCategory;
  department?: string;
  postalCode?: string;
  city?: string;
  address?: string;
  regionId?: string;
  search?: string;
}

/* `%` and `_` are wildcards; a manager searching for a literal one means it. */
function contains(value: string): string {
  return `%${value.replace(/[\\%_]/g, '\\$&')}%`;
}

/*
 * `alias` is the establishments alias in the caller's query. Conditions are
 * returned separately rather than pre-joined so a caller can add its own and
 * keep one `AND` chain.
 */
export function establishmentFilterConditions(
  filter: EstablishmentFilter,
  alias: SQL = sql`e`,
): SQL[] {
  const conditions: SQL[] = [];

  const search = filter.search?.trim();

  if (search)
    conditions.push(
      sql`(${alias}.name ILIKE ${contains(search)} OR ${alias}.city ILIKE ${contains(search)} OR ${alias}.postal_code ILIKE ${contains(search)} OR ${alias}.address_line1 ILIKE ${contains(search)})`,
    );

  if (filter.category) conditions.push(sql`${alias}.category=${filter.category}`);

  if (filter.regionId) conditions.push(sql`${alias}.region_id=${filter.regionId}`);

  /*
   * A prefix match rather than an equality on the derived department, because it
   * selects the same rows and can use the postal-code index. The five-digit
   * guard is what makes the two equivalent — see postal-department.ts.
   */
  if (filter.department)
    conditions.push(
      sql`${alias}.postal_code ~ '^[0-9]{5}$' AND ${alias}.postal_code LIKE ${filter.department + '%'}`,
    );

  if (filter.postalCode)
    conditions.push(sql`${alias}.postal_code ILIKE ${contains(filter.postalCode)}`);

  if (filter.city) conditions.push(sql`${alias}.city ILIKE ${contains(filter.city)}`);

  if (filter.address)
    conditions.push(sql`${alias}.address_line1 ILIKE ${contains(filter.address)}`);

  return conditions;
}
