import type { ScanResult, StyleCard } from '../lib/types';
import { emptyPalette } from '../lib/types';

/** Shared card/scan builders so every suite exercises the same data shape. */

export function makeScan(over: Partial<ScanResult> = {}): ScanResult {
  return {
    url: 'https://example.com/',
    title: 'Example',
    palette: emptyPalette(),
    typography: [],
    ...over,
  };
}

export function makeCard(over: Partial<StyleCard> = {}): StyleCard {
  return {
    ...makeScan(over),
    id: 'card-1',
    createdAt: '2026-07-28T00:00:00.000Z',
    notes: '',
    ...over,
  };
}

/** A realistic capture: several roles populated, a Google-served font. */
export const richCard: StyleCard = makeCard({
  id: 'stripe',
  url: 'https://stripe.com/pricing',
  title: 'Stripe — Pricing',
  notes: 'gradient hero worth stealing',
  palette: {
    background: [
      { hex: '#0a2540', count: 12 },
      { hex: '#ffffff', count: 6 },
    ],
    text: [{ hex: '#425466', count: 9 }],
    accent: [{ hex: '#635bff', count: 4 }],
    border: [{ hex: '#e3e8ee', count: 2 }],
  },
  typography: [
    {
      family: 'Inter',
      stack: 'Inter, system-ui, sans-serif',
      weights: [400, 600],
      sizes: [16, 28],
      source: 'google',
      count: 14,
    },
    {
      family: 'Georgia',
      stack: 'Georgia, serif',
      weights: [400],
      sizes: [18],
      source: 'system',
      count: 3,
    },
  ],
});
