import { contrastPairs } from '../contrast';
import type { ColorRole, FontSource, StyleCard } from '../types';
import { COLOR_ROLES } from '../types';
import { swatchTokenNames, uniqueFamilyNames } from './util';

/**
 * Exports a StyleCard as one self-describing Markdown file — a style spec
 * written to be handed to a coding agent (or committed to a repo as STYLE.md)
 * as design context: palette by role with token names and usage, WCAG contrast
 * verdicts, and the typography scale with each font's serving source.
 * Deliberately one opinionated file. Deterministic output (snapshot-tested).
 */

const ROLE_PREFIX: Record<ColorRole, string> = {
  background: 'bg',
  text: 'text',
  accent: 'accent',
  border: 'border',
};

const ROLE_TITLES: Record<ColorRole, string> = {
  background: 'Backgrounds',
  text: 'Text',
  accent: 'Accents',
  border: 'Borders',
};

const SOURCE_LABELS: Record<FontSource, string> = {
  google: 'Google Fonts',
  adobe: 'Adobe Fonts',
  'self-hosted': 'self-hosted',
  system: 'system font',
  unknown: 'unknown source',
};

export function toAgentSpec(card: StyleCard): string {
  const lines: string[] = [];
  lines.push(`# Style spec — ${card.title || card.url || 'capture'}`);
  lines.push('');
  lines.push(`> Captured from ${card.url || 'an unknown page'} on ${card.createdAt.slice(0, 10)}`);
  lines.push('> by StyleGrab. Use this as design context when building UI to match the');
  lines.push('> source: use these exact colour values and font stacks. Colours are grouped');
  lines.push('> by the role they play on the page and ranked by how many elements used');
  lines.push("> them. Token names not ending in a number are the site's own design-token");
  lines.push('> names, harvested from its `:root` custom properties.');

  const hasColors = COLOR_ROLES.some((role) => card.palette[role].length > 0);
  if (hasColors) {
    lines.push('');
    lines.push('## Colours');
    const seen = new Set<string>();
    for (const role of COLOR_ROLES) {
      const swatches = card.palette[role];
      if (!swatches.length) continue;
      const names = swatchTokenNames(swatches, (i) => `${ROLE_PREFIX[role]}-${i + 1}`, seen);
      lines.push('');
      lines.push(`### ${ROLE_TITLES[role]}`);
      lines.push('');
      lines.push('| Token | Value | Usage |');
      lines.push('| --- | --- | --- |');
      swatches.forEach((swatch, i) => {
        lines.push(`| \`--${names[i]}\` | \`${swatch.hex}\` | ${swatch.count}× |`);
      });
    }
  }

  const pairs = contrastPairs(card.palette);
  if (pairs.length) {
    lines.push('');
    lines.push('## Contrast (WCAG 2.x)');
    lines.push('');
    lines.push('| Text on background | Ratio | Verdict |');
    lines.push('| --- | --- | --- |');
    for (const p of pairs) {
      lines.push(
        `| \`${p.text.hex}\` on \`${p.background.hex}\` | ${p.ratio.toFixed(2)}:1 | ${p.level} |`,
      );
    }
  }

  if (card.typography.length) {
    lines.push('');
    lines.push('## Typography');
    const names = uniqueFamilyNames(card.typography.map((t) => t.family));
    for (const t of card.typography) {
      lines.push('');
      lines.push(`### ${t.family} (${SOURCE_LABELS[t.source]})`);
      lines.push('');
      lines.push(`- Stack: \`${t.stack}\``);
      lines.push(`- Weights: ${t.weights.join(', ') || '—'}`);
      lines.push(`- Sizes: ${t.sizes.map((s) => `${s}px`).join(', ') || '—'}`);
      lines.push(`- Usage: ${t.count}× · token: \`--font-${names.get(t.family)}\``);
    }
  }

  if (card.notes) {
    lines.push('');
    lines.push('## Notes');
    lines.push('');
    lines.push(card.notes);
  }

  return lines.join('\n') + '\n';
}
