import { describe, expect, it } from 'vitest';
import { toCssVariables } from '../lib/exporters/css';
import { EXPORT_FORMATS, getFormat } from '../lib/exporters';
import type { StyleCard } from '../lib/types';

const card: StyleCard = {
  id: 'test',
  url: 'https://example.com/',
  title: 'Example',
  createdAt: '2026-07-28T00:00:00.000Z',
  notes: '',
  palette: {
    background: [
      { hex: '#0f172a', count: 10 },
      { hex: '#ffffff', count: 3 },
    ],
    text: [{ hex: '#e2e8f0', count: 8 }],
    accent: [{ hex: '#2563eb', count: 5 }],
    border: [],
  },
  typography: [
    { family: 'Inter', stack: 'Inter, system-ui, sans-serif', weights: [400, 700], sizes: [16, 32], source: 'google', count: 12 },
  ],
};

describe('toCssVariables', () => {
  it('emits a :root block grouped by role, skipping empty roles', () => {
    const css = toCssVariables(card);
    expect(css).toBe(
      [
        '/* StyleGrab — https://example.com/ */',
        ':root {',
        '  /* Background */',
        '  --bg-1: #0f172a;',
        '  --bg-2: #ffffff;',
        '  /* Text */',
        '  --text-1: #e2e8f0;',
        '  /* Accent */',
        '  --accent-1: #2563eb;',
        '  /* Typography */',
        '  --font-inter: Inter, system-ui, sans-serif;',
        '}',
        '',
      ].join('\n'),
    );
    // Empty border role produces no comment or variables.
    expect(css).not.toContain('Border');
  });
});

describe('export registry', () => {
  it('exposes CSS and resolves formats by id', () => {
    expect(EXPORT_FORMATS.map((f) => f.id)).toContain('css');
    expect(getFormat('css')?.ext).toBe('css');
    expect(getFormat('nope')).toBeUndefined();
  });
});
