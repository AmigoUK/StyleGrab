import type { StyleCard } from '../types';
import { COLOR_ROLES } from '../types';
import { swatchTokenNames, uniqueFamilyNames } from './util';

/**
 * Exports a StyleCard as Tokens Studio (for Figma) JSON — `value` + `type`
 * nodes under a `global` set, importable straight into the plugin. The designer
 * counterpart to the W3C export. Deterministic output (snapshot-tested).
 */

interface StudioToken {
  value: string;
  type: 'color' | 'fontFamilies';
}

export function toTokensStudio(card: StyleCard): string {
  const global: Record<string, Record<string, StudioToken>> = {};

  for (const role of COLOR_ROLES) {
    const swatches = card.palette[role];
    if (!swatches.length) continue;
    const group: Record<string, StudioToken> = {};
    const names = swatchTokenNames(swatches, (i) => String(i + 1));
    swatches.forEach((swatch, i) => {
      group[names[i]] = { value: swatch.hex, type: 'color' };
    });
    global[role] = group;
  }

  if (card.typography.length) {
    const names = uniqueFamilyNames(card.typography.map((t) => t.family));
    const group: Record<string, StudioToken> = {};
    for (const t of card.typography) {
      group[names.get(t.family)!] = { value: t.family, type: 'fontFamilies' };
    }
    global.fontFamilies = group;
  }

  return JSON.stringify({ global }, null, 2) + '\n';
}
