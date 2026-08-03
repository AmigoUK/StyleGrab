import { describe, expect, it } from 'vitest';
import { cardMatches, filterCards } from '../lib/search';
import type { StyleCard } from '../lib/types';
import { emptyPalette } from '../lib/types';

function makeCard(over: Partial<StyleCard>): StyleCard {
  return {
    id: over.id ?? 'x',
    url: 'https://example.com/',
    title: 'Example',
    createdAt: '2026-07-28T00:00:00.000Z',
    notes: '',
    palette: emptyPalette(),
    typography: [],
    ...over,
  };
}

const stripe = makeCard({
  id: 'stripe',
  url: 'https://stripe.com/',
  title: 'Stripe',
  palette: { ...emptyPalette(), accent: [{ hex: '#635bff', count: 5 }] },
  typography: [
    { family: 'Inter', stack: 'Inter, sans-serif', weights: [400], sizes: [16], source: 'google', count: 3 },
  ],
});
const notion = makeCard({ id: 'notion', url: 'https://notion.so/', title: 'Notion', notes: 'clean docs UI' });

describe('cardMatches', () => {
  it('matches on url, title, hex, font family, source and notes', () => {
    expect(cardMatches(stripe, 'stripe')).toBe(true); // url + title
    expect(cardMatches(stripe, '#635b')).toBe(true); // partial hex
    expect(cardMatches(stripe, 'inter')).toBe(true); // font family
    expect(cardMatches(stripe, 'google')).toBe(true); // font source
    expect(cardMatches(notion, 'docs')).toBe(true); // notes
    expect(cardMatches(notion, 'inter')).toBe(false);
  });

  it('matches everything on an empty query', () => {
    expect(cardMatches(notion, '   ')).toBe(true);
  });
});

describe('filterCards', () => {
  it('returns the same array reference when the query is blank', () => {
    const cards = [stripe, notion];
    expect(filterCards(cards, '')).toBe(cards);
  });

  it('narrows to matching cards', () => {
    expect(filterCards([stripe, notion], 'inter').map((c) => c.id)).toEqual(['stripe']);
    expect(filterCards([stripe, notion], 'zzz')).toEqual([]);
  });
});

describe('cardMatches — query normalisation', () => {
  const card = makeCard({
    id: 'q',
    url: 'https://Example.COM/Pricing',
    title: 'Acme — Pricing',
    notes: 'Nice GRADIENT hero',
    palette: { ...emptyPalette(), background: [{ hex: '#0A2540', count: 3 }] },
    typography: [
      {
        family: 'Söhne',
        stack: '"Söhne", sans-serif',
        weights: [400],
        sizes: [16],
        source: 'self-hosted',
        count: 2,
      },
    ],
  });

  it('ignores case on both sides and trims the query', () => {
    expect(cardMatches(card, '  PRICING  ')).toBe(true);
    expect(cardMatches(card, 'example.com')).toBe(true);
    expect(cardMatches(card, 'gradient')).toBe(true);
    expect(cardMatches(card, '#0a2540')).toBe(true);
  });

  it('matches a hex fragment typed without the leading #', () => {
    expect(cardMatches(card, '0a2540')).toBe(true);
    expect(cardMatches(card, 'a254')).toBe(true);
  });

  it('matches on the font source label and on the full stack', () => {
    expect(cardMatches(card, 'self-hosted')).toBe(true);
    expect(cardMatches(card, 'sans-serif')).toBe(true);
    expect(cardMatches(card, 'söhne')).toBe(true);
  });

  it('does not match an unrelated query', () => {
    expect(cardMatches(card, 'tailwind')).toBe(false);
  });

  it('treats a multi-word query as one literal phrase, not separate terms', () => {
    expect(cardMatches(card, 'acme — pricing')).toBe(true);
    expect(cardMatches(card, 'acme pricing')).toBe(false);
  });
});

describe('filterCards — result identity', () => {
  it('returns a new array when it actually filters', () => {
    const cards = [stripe, notion];
    const filtered = filterCards(cards, 'stripe');
    expect(filtered).not.toBe(cards);
    expect(filtered).toEqual([stripe]);
  });

  it('keeps the original order of the survivors', () => {
    expect(filterCards([stripe, notion], 'https').map((c) => c.id)).toEqual(['stripe', 'notion']);
  });
});
