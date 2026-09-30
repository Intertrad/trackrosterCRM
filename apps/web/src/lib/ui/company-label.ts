/** Optional display-only breaks between words in compound company names.
 * Preserve all-capital abbreviations and never modify stored names or field labels.
 */
export function companyLabel(name: string): string {
  return name
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1\u200B$2')
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1\u200B$2');
}
