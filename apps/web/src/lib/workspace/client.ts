import { browserResource } from '@/lib/api/browser-resource';
import type { DataRecord, Field } from './types';
import { OPERATIONS } from './operations';

export function getOperation(key: string) {
  const operation = OPERATIONS[key];
  if (!operation) throw new Error('Unknown workspace operation');
  return operation;
}

export function pathKeys(path: string): string[] {
  return [...path.matchAll(/:(\w+)/g)].map((match) => match[1]!);
}
export function operationUrl(key: string, params: DataRecord = {}, query: DataRecord = {}): string {
  const operation = OPERATIONS[key];
  if (!operation) throw new Error('Unknown operation');
  const path = operation.path.replace(/:(\w+)/g, (_, name: string) => {
    const value = params[name];
    if (typeof value !== 'string' || !value) throw new Error(`Choose ${name} first.`);
    return encodeURIComponent(value);
  });
  const search = new URLSearchParams();
  for (const field of operation.query) {
    const value = query[field.name];
    if (value !== '' && value !== undefined && value !== null)
      search.set(field.name, String(value));
  }
  return `/api/workspace${path}${search.size ? `?${search}` : ''}`;
}
export function readOperation(
  key: string,
  params: DataRecord = {},
  query: DataRecord = {},
  signal?: AbortSignal,
) {
  return browserResource<unknown>(operationUrl(key, params, query), { signal, cache: 'no-store' });
}
export function writeOperation(
  key: string,
  params: DataRecord,
  body: DataRecord,
  requestKey: string,
  etag?: string | null,
) {
  return browserResource<unknown>(operationUrl(key, params), {
    method: getOperation(key).method,
    headers: {
      'content-type': 'application/json',
      'idempotency-key': requestKey,
      ...(etag ? { 'if-match': etag } : {}),
    },
    ...(getOperation(key).method !== 'DELETE' ? { body: JSON.stringify(body) } : {}),
  });
}
export function isRecord(value: unknown): value is DataRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
export function rowsOf(value: unknown): DataRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value) && Array.isArray(value.items)) return value.items.filter(isRecord);
  return [];
}
export function valueAt(record: DataRecord, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((value, key) => (isRecord(value) ? value[key] : undefined), record);
}
export function recordName(record: DataRecord): string {
  for (const key of [
    'name',
    'displayName',
    'label',
    'title',
    'email',
    'provider',
    'reportKey',
    'action',
    'url',
    'code',
  ]) {
    if (typeof record[key] === 'string' && record[key]) return String(record[key]);
  }
  return String(record.id ?? record.membershipId ?? '—');
}
export function initialValues(fields: Field[], source: DataRecord = {}): DataRecord {
  return Object.fromEntries(
    fields.flatMap((field) => {
      const value = source[field.name] ?? field.default;
      if (value === undefined)
        return field.type === 'boolean' && !field.optional ? [[field.name, false]] : [];

      if (field.type === 'object' && field.fields && isRecord(value))
        return [[field.name, initialValues(field.fields, value)]];
      return [[field.name, value]];
    }),
  );
}

/** Serialize only accepted fields; preserve explicit false, zero and nullable clears. */
export function serializeFields(fields: Field[], values: DataRecord): DataRecord {
  const result: DataRecord = {};
  for (const field of fields) {
    let value = values[field.name];
    if (value === undefined || (value === '' && field.optional)) continue;
    if (value === null) {
      if (field.nullable) result[field.name] = null;
      continue;
    }
    if (field.type === 'number' && value !== '') value = Number(value);
    if (field.type === 'date' && typeof value === 'string' && value)
      value = new Date(value).toISOString();
    if (field.type === 'object' && field.fields && isRecord(value))
      value = serializeFields(field.fields, value);
    if (field.type === 'array' && Array.isArray(value) && field.item?.type === 'string')
      value = value
        .map(String)
        .map((entry) => entry.trim())
        .filter(Boolean);
    if (field.type === 'array' && Array.isArray(value) && field.item?.fields)
      value = value.map((item) => serializeFields(field.item!.fields!, isRecord(item) ? item : {}));
    result[field.name] = value;
  }
  return result;
}
