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
 * Final token names for a role's swatches: the site's harvested name when the
 * swatch carries one, otherwise `fallback(i)`. Collisions are disambiguated
 * with -2, -3, … against `seen`; pass a shared set when several roles emit
 * into one namespace (a single `:root` block) so names stay unique across it.
 */
export function swatchTokenNames(
  swatches: { name?: string }[],
  fallback: (index: number) => string,
  seen: Set<string> = new Set(),
): string[] {
  return swatches.map((swatch, i) => {
    const base = swatch.name ?? fallback(i);
    let name = base;
    let n = 2;
    while (seen.has(name)) name = `${base}-${n++}`;
    seen.add(name);
    return name;
  });
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
