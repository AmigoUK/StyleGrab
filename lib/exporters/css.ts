import type { ColorRole, StyleCard } from '../types';
import { COLOR_ROLES } from '../types';

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

function familyVarName(family: string): string {
  const slug = family
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `--font-${slug || 'family'}`;
}

export function toCssVariables(card: StyleCard): string {
  const lines: string[] = [];
  lines.push(`/* StyleGrab — ${card.url || 'capture'} */`);
  lines.push(':root {');

  for (const role of COLOR_ROLES) {
    const swatches = card.palette[role];
    if (!swatches.length) continue;
    lines.push(`  /* ${role[0].toUpperCase()}${role.slice(1)} */`);
    swatches.forEach((swatch, i) => {
      lines.push(`  --${ROLE_PREFIX[role]}-${i + 1}: ${swatch.hex};`);
    });
  }

  if (card.typography.length) {
    lines.push('  /* Typography */');
    const seen = new Set<string>();
    for (const t of card.typography) {
      let name = familyVarName(t.family);
      // Guard against two families sluggifying to the same variable name.
      let n = 2;
      const base = name;
      while (seen.has(name)) name = `${base}-${n++}`;
      seen.add(name);
      lines.push(`  ${name}: ${t.stack};`);
    }
  }

  lines.push('}');
  return lines.join('\n') + '\n';
}
