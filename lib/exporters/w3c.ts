import type { ColorRole, StyleCard } from '../types';
import { COLOR_ROLES } from '../types';
import { stackToArray, swatchTokenNames, uniqueFamilyNames } from './util';

/**
 * Exports a StyleCard as W3C Design Tokens
 * (https://tr.designtokens.org/format/) JSON — `$type` + `$value` nodes grouped
 * by colour role and by font family. Deterministic output (snapshot-tested).
 */

interface ColorToken {
  $type: 'color';
  $value: string;
}
interface FontFamilyToken {
  $type: 'fontFamily';
  $value: string[];
}

export function toW3CTokens(card: StyleCard): string {
  const color: Record<string, Record<string, ColorToken>> = {};
  for (const role of COLOR_ROLES) {
    const swatches = card.palette[role];
    if (!swatches.length) continue;
    const group: Record<string, ColorToken> = {};
    const names = swatchTokenNames(swatches, (i) => String(i + 1));
    swatches.forEach((swatch, i) => {
      group[names[i]] = { $type: 'color', $value: swatch.hex };
    });
    color[role] = group;
  }

  const fontFamily: Record<string, FontFamilyToken> = {};
  if (card.typography.length) {
    const names = uniqueFamilyNames(card.typography.map((t) => t.family));
    for (const t of card.typography) {
      fontFamily[names.get(t.family)!] = { $type: 'fontFamily', $value: stackToArray(t.stack) };
    }
  }

  const doc: Record<string, unknown> = { $description: `StyleGrab — ${card.url || 'capture'}` };
  if (Object.keys(color).length) doc.color = color;
  if (Object.keys(fontFamily).length) doc.fontFamily = fontFamily;

  return JSON.stringify(doc, null, 2) + '\n';
}
