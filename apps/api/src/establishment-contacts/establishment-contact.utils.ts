export function normalizeOptionalContactText(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const normalized = value.trim();

  return normalized || null;
}

export function normalizeContactEmail(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalContactText(value);

  return normalized ? normalized.toLowerCase() : null;
}
