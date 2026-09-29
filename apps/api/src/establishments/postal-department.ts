import { sql, type SQL } from 'drizzle-orm';

/*
 * A French department, read from the establishment's postal code.
 *
 * The department is not stored. It is not in the référentiel, not in the source
 * workbook, and `regions` models a tenant-defined hierarchy rather than the
 * French administrative one — so for the 14,649 imported establishments the
 * postal code is the only thing that carries it. Managers dispatch by
 * department, so it is derived here rather than invented per screen.
 *
 * The rule, measured against the real base:
 *
 *   - 5 digits is the only shape a department can be read from. 14,369 of the
 *     14,371 codes present are exactly that; the remaining two are a code with
 *     the letter O typed for a zero and a cell holding a commune name, and both
 *     yield no department rather than a wrong one.
 *   - Overseas codes (97x, 98x) name the department in three digits: 97400 is
 *     974 (La Réunion), not 97.
 *   - Everything else is the first two digits.
 *
 * Corsica deliberately reads `20` and not `2A`/`2B`. Those two are INSEE codes
 * with no exact postal equivalent — the usual 200xx/201xx → 2A, 202xx+ → 2B
 * split is an approximation that misfiles real communes — and a filter that is
 * quietly wrong about where an establishment is costs more than one that says
 * `20` for all 165 Corsican rows. Resolving 2A/2B needs the commune → INSEE
 * mapping that the geodata work (TR-928) brings in.
 */
export const DEPARTMENT_PATTERN = /^(?:0[1-9]|[1-8]\d|9[0-6]|9[78]\d)$/;

export function postalDepartment(postalCode: SQL | SQL.Aliased): SQL<string | null> {
  return sql<string | null>`
    CASE
      WHEN ${postalCode} ~ '^[0-9]{5}$' THEN
        CASE
          WHEN left(${postalCode}, 2) IN ('97', '98') THEN left(${postalCode}, 3)
          ELSE left(${postalCode}, 2)
        END
      ELSE NULL
    END
  `;
}
