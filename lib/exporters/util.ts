/** Shared helpers for exporters — kept in one place so token names stay consistent across formats. */

/** Slug used for a font family in variable/key names, e.g. "Helvetica Neue" → "helvetica-neue". */
export function familySlug(family: string): string {
  return (
    family
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'family'
  );
}

/** Splits a full `font-family` stack into an array of unquoted family names. */
export function stackToArray(stack: string): string[] {
  return stack
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

/**
 * Yields unique names for a list of families, disambiguating collisions by
 * appending -2, -3, … so two families never map to the same key.
 */
export function uniqueFamilyNames(families: string[]): Map<string, string> {
  const seen = new Set<string>();
  const out = new Map<string, string>();
  for (const family of families) {
    const base = familySlug(family);
    let name = base;
    let n = 2;
    while (seen.has(name)) name = `${base}-${n++}`;
    seen.add(name);
    out.set(family, name);
  }
  return out;
}
