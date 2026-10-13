import type { Pool } from 'pg';

export type TenantRlsMode = 'disabled' | 'observe' | 'enforce';

type TenantRlsRuntimeRow = {
  roleName: string;
  isSuperuser: boolean;
  bypassesRls: boolean;
  isDatabaseOwner: boolean;
  ownsApplicationTable: boolean;
};

type QueryablePool = Pick<Pool, 'query'>;

const RUNTIME_ROLE_QUERY = `
  SELECT
    current_user AS "roleName",
    role.rolsuper AS "isSuperuser",
    role.rolbypassrls AS "bypassesRls",
    database.datdba = role.oid AS "isDatabaseOwner",
    EXISTS (
      SELECT 1
      FROM pg_class AS relation
      JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE relation.relkind IN ('r', 'p')
        AND namespace.nspname NOT IN ('pg_catalog', 'information_schema')
        AND relation.relowner = role.oid
    ) AS "ownsApplicationTable"
  FROM pg_roles AS role
  JOIN pg_database AS database ON database.datname = current_database()
  WHERE role.rolname = current_user
`;

export async function verifyTenantRlsRuntime(
  pool: QueryablePool,
  mode: TenantRlsMode,
  warn: (message: string) => void = () => undefined,
): Promise<void> {
  if (mode === 'disabled') return;

  const result = await pool.query<TenantRlsRuntimeRow>(RUNTIME_ROLE_QUERY);
  const runtime = result.rows[0];

  if (!runtime) {
    throw new Error('Tenant RLS runtime check returned no database role');
  }

  const unsafeReasons = [
    runtime.isSuperuser && 'SUPERUSER',
    runtime.bypassesRls && 'BYPASSRLS',
    runtime.isDatabaseOwner && 'database owner',
    runtime.ownsApplicationTable && 'application table owner',
  ].filter((reason): reason is string => Boolean(reason));

  if (unsafeReasons.length === 0) return;

  const reason = `role ${runtime.roleName} has ${unsafeReasons.join(', ')}`;
  if (mode === 'enforce') {
    throw new Error(`TENANT_RLS_MODE=enforce requires a restricted database role; ${reason}`);
  }

  warn(`TENANT_RLS_MODE=observe detected an unrestricted database role; ${reason}`);
}

export { RUNTIME_ROLE_QUERY };
