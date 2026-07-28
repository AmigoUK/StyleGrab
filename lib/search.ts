import type { StyleCard } from './types';
import { COLOR_ROLES } from './types';

/**
 * Free-text filtering of the library. A card matches when the query appears in
 * its title, URL, notes, any palette hex, or any typography family/stack/source.
 * Pure and unit-tested; the library UI wraps it around a search box.
 */

export function cardMatches(card: StyleCard, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (card.title.toLowerCase().includes(q)) return true;
  if (card.url.toLowerCase().includes(q)) return true;
  if (card.notes.toLowerCase().includes(q)) return true;

  for (const role of COLOR_ROLES) {
    if (card.palette[role].some((s) => s.hex.toLowerCase().includes(q))) return true;
  }

  return card.typography.some(
    (t) =>
      t.family.toLowerCase().includes(q) ||
      t.stack.toLowerCase().includes(q) ||
      t.source.includes(q),
  );
}

export function filterCards(cards: StyleCard[], query: string): StyleCard[] {
  if (!query.trim()) return cards;
  return cards.filter((c) => cardMatches(c, query));
}
