import type { ColorRole, StyleCard } from '../types';
import { COLOR_ROLES } from '../types';
import { uniqueFamilyNames } from './util';

/** Exports a StyleCard as SCSS variables. Deterministic output (snapshot-tested). */

const ROLE_PREFIX: Record<ColorRole, string> = {
  background: 'bg',
  text: 'text',
  accent: 'accent',
  border: 'border',
};

export function toScssVariables(card: StyleCard): string {
  const lines: string[] = [];
  lines.push(`// StyleGrab — ${card.url || 'capture'}`);

  for (const role of COLOR_ROLES) {
    const swatches = card.palette[role];
    if (!swatches.length) continue;
    lines.push(`// ${role[0].toUpperCase()}${role.slice(1)}`);
    swatches.forEach((swatch, i) => {
      lines.push(`$${ROLE_PREFIX[role]}-${i + 1}: ${swatch.hex};`);
    });
  }

  if (card.typography.length) {
    lines.push('// Typography');
    const names = uniqueFamilyNames(card.typography.map((t) => t.family));
    for (const t of card.typography) {
      lines.push(`$font-${names.get(t.family)}: ${t.stack};`);
    }
  }

  return lines.join('\n') + '\n';
}
