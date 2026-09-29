/** Explicit selection only: never implies selecting unloaded results. */
export function toggleRecord<T extends { id: string }>(
  selected: ReadonlyMap<string, T>,
  record: T,
  limit: number,
): Map<string, T> {
  const next = new Map(selected);
  if (next.has(record.id)) next.delete(record.id);
  else if (next.size < limit) next.set(record.id, record);
  return next;
}
export function togglePage<T extends { id: string }>(
  selected: ReadonlyMap<string, T>,
  page: T[],
  limit: number,
): Map<string, T> {
  const next = new Map(selected);
  const all = page.length > 0 && page.every((r) => next.has(r.id));
  for (const record of page) {
    if (all) next.delete(record.id);
    else if (next.size < limit) next.set(record.id, record);
  }
  return next;
}
