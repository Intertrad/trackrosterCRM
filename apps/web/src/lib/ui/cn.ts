type ClassValue = string | false | null | undefined;

/*
 * Minimal class joiner.
 *
 * Components in this codebase own their base classes and accept an
 * additive `className`, so conflicting-utility resolution (the job of
 * tailwind-merge) is deliberately not required and no dependency is added.
 */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
