import type { ColorRole, StyleCard } from '../types';
import { COLOR_ROLES } from '../types';
import { stackToArray, swatchTokenNames, uniqueFamilyNames } from './util';

/**
 * Exports a StyleCard as a Tailwind config fragment (`theme.extend`), ready to
 * paste into `tailwind.config.js`. Deterministic output (snapshot-tested).
 */

export function toTailwindConfig(card: StyleCard): string {
  const colors: Record<string, Record<string, string>> = {};
  for (const role of COLOR_ROLES) {
    const swatches = card.palette[role];
    if (!swatches.length) continue;
    const group: Record<string, string> = {};
    const names = swatchTokenNames(swatches, (i) => String(i + 1));
    swatches.forEach((swatch, i) => {
      group[names[i]] = swatch.hex;
    });
    colors[role] = group;
  }

  const fontFamily: Record<string, string[]> = {};
  if (card.typography.length) {
    const names = uniqueFamilyNames(card.typography.map((t) => t.family));
    for (const t of card.typography) {
      fontFamily[names.get(t.family)!] = stackToArray(t.stack);
    }
  }

  const extend: Record<string, unknown> = {};
  if (Object.keys(colors).length) extend.colors = colors;
  if (Object.keys(fontFamily).length) extend.fontFamily = fontFamily;

  const body = JSON.stringify({ theme: { extend } }, null, 2);
  return `/** StyleGrab — ${card.url || 'capture'} */\nmodule.exports = ${body};\n`;
}
