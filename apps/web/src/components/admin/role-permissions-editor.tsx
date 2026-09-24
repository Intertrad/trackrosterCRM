'use client';

import { useEffect, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FilterSelect } from '@/components/ui/filter-select';
import { ApiError } from '@/lib/api/api-error';
import { getRolePermissions, listPermissions, saveRolePermissions } from '@/lib/api/role-client';
import {
  permissionGroup,
  permissionLabel,
  roleLabel,
  TENANT_ROLES,
  type PermissionDescriptor,
  type RolePermissions,
} from '@/lib/api/role-types';

/**
 * Editor for the configurable slice of a role's permissions.
 *
 * Two constraints come straight from the API and are honoured rather than
 * discovered on save:
 *
 *  - tenant_admin (and super_admin) are refused outright, so they render
 *    read-only;
 *  - only permissions marked configurable for that role may be sent, so the
 *    rest render as fixed, checked entries.
 */
export function RolePermissionsEditor() {
  const [role, setRole] = useState<string>('manager');
  const [catalogue, setCatalogue] = useState<PermissionDescriptor[] | null>(null);
  const [config, setConfig] = useState<RolePermissions | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    listPermissions(controller.signal)
      .then((result) => setCatalogue(result.items))
      .catch(() => setCatalogue([]));

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    setConfig(null);
    setError(null);
    setNotice(null);
    setIdempotencyKey(null);

    getRolePermissions(role, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) {
          return;
        }

        setConfig(result.resource);
        setEtag(result.etag);
        setSelected(new Set(result.resource.permissions));
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('We could not load this role’s permissions.');
        }
      });

    return () => controller.abort();
  }, [role]);

  const configurable = useMemo(() => new Set(config?.configurablePermissions ?? []), [config]);

  const groups = useMemo(() => {
    if (!catalogue || !config) {
      return [];
    }

    const relevant = catalogue.filter((item) => item.roles.includes(role));

    const byGroup = new Map<string, PermissionDescriptor[]>();

    for (const item of relevant) {
      const key = permissionGroup(item.permission);

      byGroup.set(key, [...(byGroup.get(key) ?? []), item]);
    }

    return [...byGroup.entries()]
      .map(([name, items]) => ({
        name,
        items: [...items].sort((left, right) => left.permission.localeCompare(right.permission)),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [catalogue, config, role]);

  const dirty = useMemo(() => {
    if (!config) {
      return false;
    }

    const current = new Set(config.permissions);

    if (current.size !== selected.size) {
      return true;
    }

    for (const permission of selected) {
      if (!current.has(permission)) {
        return true;
      }
    }

    return false;
  }, [config, selected]);

  async function save(): Promise<void> {
    if (!config) {
      return;
    }

    const key = idempotencyKey ?? crypto.randomUUID();

    setIdempotencyKey(key);
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      /* Only configurable permissions may be sent; the rest are implied. */
      const payload = [...selected].filter((permission) => configurable.has(permission));

      const updated = await saveRolePermissions(role, payload, { etag, idempotencyKey: key });

      setConfig(updated);
      setSelected(new Set(updated.permissions));
      setEtag(null);
      setIdempotencyKey(null);
      setNotice(`${roleLabel(role)} permissions saved.`);
    } catch (caught) {
      setError(describeSaveError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          label="Role"
          value={role}
          options={TENANT_ROLES.map((value) => ({ value, label: roleLabel(value) }))}
          onChange={setRole}
          disabled={busy}
        />

        {config?.updatedAt ? (
          <p className="pb-2 text-[13px] text-ink-muted">
            Last changed {new Date(config.updatedAt).toLocaleDateString()}
          </p>
        ) : null}
      </div>

      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {config && !config.configurable ? (
        <Alert tone="info" title={`${roleLabel(role)} permissions are fixed.`}>
          {config.message ??
            'The API refuses changes to this role so a workspace can never be left without an administrator.'}
        </Alert>
      ) : null}

      {config === null ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="h-11 animate-pulse rounded-lg bg-line-soft" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="py-8 text-center text-[15px] text-ink-muted">
          This role has no catalogued permissions.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <section key={group.name}>
              <h3 className="text-[15px] font-bold text-navy capitalize">
                {group.name.replace(/[._]/g, ' ')}
              </h3>

              <ul className="mt-2 flex flex-col divide-y divide-line-soft rounded-xl border border-line-soft">
                {group.items.map((item) => {
                  const editable = config.configurable && configurable.has(item.permission);

                  return (
                    <li
                      key={item.permission}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3.5 py-2.5"
                    >
                      <span className="min-w-0 flex-1">
                        <Checkbox
                          label={permissionLabel(item.permission)}
                          checked={selected.has(item.permission)}
                          disabled={!editable || busy}
                          onChange={(event) => {
                            const next = new Set(selected);

                            if (event.target.checked) {
                              next.add(item.permission);
                            } else {
                              next.delete(item.permission);
                            }

                            setSelected(next);
                          }}
                        />

                        <span className="mt-1 block pl-7 text-[13px] text-ink-muted">
                          {item.description}
                        </span>
                      </span>

                      {editable ? null : <Badge tone="neutral">Fixed</Badge>}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {config?.configurable ? (
        <div className="flex flex-wrap gap-3">
          <Button loading={busy} disabled={!dirty} onClick={() => void save()}>
            Save permissions
          </Button>

          <Button
            variant="secondary"
            disabled={!dirty || busy}
            onClick={() => setSelected(new Set(config.permissions))}
          >
            Discard changes
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function describeSaveError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 409 || error.statusCode === 412) {
    return 'These permissions changed elsewhere. Reload the tab before saving again.';
  }

  if (error.statusCode === 403) {
    return 'This role’s permissions cannot be changed through this screen.';
  }

  if (error.statusCode === 400) {
    return error.messages.join(' ');
  }

  return 'We could not save these permissions. Please try again.';
}
