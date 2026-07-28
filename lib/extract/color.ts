/**
 * Colour parsing/normalisation. Chrome's getComputedStyle returns colours as
 * `rgb(r, g, b)` or `rgba(r, g, b, a)` (occasionally with the modern space
 * syntax). We normalise to a lowercase `#rrggbb`, or `#rrggbbaa` when the
 * colour carries partial transparency. Fully transparent colours return null
 * so callers can drop them.
 */

function toHex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

/** Parses a computed colour string to `#rrggbb`(`aa`), or null if unusable/transparent. */
export function parseColorToHex(input: string | undefined | null): string | null {
  if (!input) return null;
  const value = input.trim().toLowerCase();
  if (value === 'transparent' || value === 'none' || value === '') return null;

  // Already hex.
  if (value.startsWith('#')) {
    if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(value)) return value;
    if (/^#[0-9a-f]{3}$/.test(value)) {
      const [r, g, b] = value.slice(1);
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    return null;
  }

  const match = value.match(/^rgba?\(([^)]+)\)$/);
  if (!match) return null;
  // Accept both "r, g, b, a" and "r g b / a" forms.
  const parts = match[1]
    .replace(/\//g, ' ')
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length < 3) return null;

  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;

  let a = parts[3] === undefined ? 1 : Number(parts[3]);
  if (Number.isNaN(a)) a = 1;
  if (a <= 0) return null; // fully transparent — not a real colour on the page

  const base = `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
  return a >= 1 ? base : `${base}${toHex2(a * 255)}`;
}
