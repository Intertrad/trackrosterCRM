/** Two-letter avatar fallback derived from a display name, else the email. */
export function getInitials(displayName: string | null, email: string): string {
  const source = displayName?.trim() || email.split('@')[0] || '';

  const parts = source.split(/[\s._-]+/).filter(Boolean);

  if (parts.length === 0) {
    return 'U';
  }

  if (parts.length === 1) {
    return (parts[0] ?? '').slice(0, 2).toUpperCase();
  }

  return `${(parts[0] ?? '').charAt(0)}${(parts[1] ?? '').charAt(0)}`.toUpperCase();
}
