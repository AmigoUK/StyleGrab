import type { ColorRole, StyleCard } from '../types';
import { COLOR_ROLES } from '../types';
import { swatchTokenNames, uniqueFamilyNames } from './util';

/**
 * Exports a StyleCard as CSS custom properties — a `:root { --… }` block you
 * paste straight into a stylesheet. Deterministic output (snapshot-tested).
 */

const ROLE_PREFIX: Record<ColorRole, string> = {
  background: 'bg',
  text: 'text',
  accent: 'accent',
  border: 'border',
};

export function toCssVariables(card: StyleCard): string {
  const lines: string[] = [];
  lines.push(`/* StyleGrab — ${card.url || 'capture'} */`);
  lines.push(':root {');

  // One shared namespace: every role's variables land in the same :root block.
  const seen = new Set<string>();
  for (const role of COLOR_ROLES) {
    const swatches = card.palette[role];
    if (!swatches.length) continue;
    lines.push(`  /* ${role[0].toUpperCase()}${role.slice(1)} */`);
    const names = swatchTokenNames(swatches, (i) => `${ROLE_PREFIX[role]}-${i + 1}`, seen);
    swatches.forEach((swatch, i) => {
      lines.push(`  --${names[i]}: ${swatch.hex};`);
    });
  }

  if (card.typography.length) {
    lines.push('  /* Typography */');
    const names = uniqueFamilyNames(card.typography.map((t) => t.family));
    for (const t of card.typography) {
      lines.push(`  --font-${names.get(t.family)}: ${t.stack};`);
    }
  }

  lines.push('}');
  return lines.join('\n') + '\n';
}
