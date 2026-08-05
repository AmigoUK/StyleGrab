import type { Palette, Swatch } from '../types';
import { parseColorToHex } from './color';

/**
 * Turns the custom properties harvested from a page's `:root` into token names
 * on the palette: when a site declares `--color-primary: #6c5ce7`, the swatch
 * for `#6c5ce7` is exported under the site's own name instead of a numbered
 * guess. Pure and unit-tested; silently a no-op when a page exposes nothing
 * usable, so the numbered fallback behaviour is unchanged there.
 */

/**
 * Prefixes of framework-generated custom properties that are runtime plumbing,
 * not design intent — naming a swatch `--tw-ring-color` would make exports
 * worse, not better. A small curated list on purpose; extend only with
 * prefixes that are unambiguously machine-generated.
 */
const FRAMEWORK_TOKEN_PREFIXES = [
  '--tw-', // Tailwind runtime internals
  '--un-', // UnoCSS
  '--bs-', // Bootstrap
  '--wp--', // WordPress global styles
  '--mui-', // MUI
  '--chakra-', // Chakra UI
  '--mantine-', // Mantine
  '--radix-', // Radix UI
  '--rdx-', // Radix (short form)
  '--ant-', // Ant Design
  '--vscode-', // VS Code webviews
];

export function isFrameworkToken(name: string): boolean {
  return FRAMEWORK_TOKEN_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/**
 * Maps each colour value found in the root custom properties to the best token
 * name for it: the shortest (ties broken alphabetically), since sites often
 * alias tokens and the shortest name is usually the semantic one
 * (`--primary` over `--button-primary-hover-fallback`). Names are returned
 * without their `--` prefix. Non-colour values and framework tokens are ignored.
 */
export function tokenNamesByHex(rootProps: Record<string, string>): Map<string, string> {
  const entries = Object.entries(rootProps)
    .filter(([name]) => name.startsWith('--') && !isFrameworkToken(name))
    .sort((a, b) => a[0].length - b[0].length || a[0].localeCompare(b[0]));

  const byHex = new Map<string, string>();
  for (const [name, value] of entries) {
    const hex = parseColorToHex(value);
    if (hex && !byHex.has(hex)) byHex.set(hex, name.slice(2));
  }
  return byHex;
}

/**
 * Returns a palette whose swatches carry the site's own token names where a
 * root custom property resolves to the swatch's colour — checking absorbed
 * merge members too, since the site may name the shade the clustering folded
 * in rather than the canonical.
 */
export function applyTokenNames(
  palette: Palette,
  rootProps: Record<string, string> | undefined,
): Palette {
  if (!rootProps) return palette;
  const names = tokenNamesByHex(rootProps);
  if (!names.size) return palette;

  const rename = (swatches: Swatch[]): Swatch[] =>
    swatches.map((s) => {
      const name = names.get(s.hex) ?? s.merged?.map((m) => names.get(m.hex)).find(Boolean);
      return name ? { ...s, name } : s;
    });

  return {
    background: rename(palette.background),
    text: rename(palette.text),
    accent: rename(palette.accent),
    border: rename(palette.border),
  };
}
