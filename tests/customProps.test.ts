import { describe, expect, it } from 'vitest';
import { applyTokenNames, isFrameworkToken, tokenNamesByHex } from '../lib/extract/customProps';
import type { Palette } from '../lib/types';
import { emptyPalette } from '../lib/types';

/**
 * Custom-property harvesting: the site's own `:root` tokens become the names
 * on exported swatches. These tests pin the selection rules — colours only,
 * framework soup filtered, shortest name wins — and the fallback guarantee
 * that a page exposing nothing usable changes nothing.
 */

function paletteWith(background: Palette['background']): Palette {
  return { ...emptyPalette(), background };
}

describe('isFrameworkToken', () => {
  it('flags machine-generated prefixes and passes real tokens', () => {
    expect(isFrameworkToken('--tw-ring-color')).toBe(true);
    expect(isFrameworkToken('--bs-primary')).toBe(true);
    expect(isFrameworkToken('--wp--preset--color--vivid-red')).toBe(true);
    expect(isFrameworkToken('--color-primary')).toBe(false);
    expect(isFrameworkToken('--brand')).toBe(false);
  });
});

describe('tokenNamesByHex', () => {
  it('maps colour values to names without the -- prefix', () => {
    const names = tokenNamesByHex({ '--color-primary': '#6c5ce7' });
    expect(names.get('#6c5ce7')).toBe('color-primary');
  });

  it('accepts any colour syntax parseColorToHex understands', () => {
    const names = tokenNamesByHex({
      '--brand': 'rgb(99, 91, 255)',
      '--surface': '#FFF',
    });
    expect(names.get('#635bff')).toBe('brand');
    expect(names.get('#ffffff')).toBe('surface');
  });

  it('ignores non-colour values and framework tokens', () => {
    const names = tokenNamesByHex({
      '--spacing-4': '1rem',
      '--shadow': '0 1px 2px rgb(0, 0, 0)',
      '--tw-ring-color': '#2563eb',
      '--font-sans': 'Inter, sans-serif',
    });
    expect(names.size).toBe(0);
  });

  it('prefers the shortest name for an aliased colour, ties alphabetical', () => {
    expect(
      tokenNamesByHex({
        '--button-primary-background': '#6c5ce7',
        '--primary': '#6c5ce7',
      }).get('#6c5ce7'),
    ).toBe('primary');
    expect(tokenNamesByHex({ '--b': '#6c5ce7', '--a': '#6c5ce7' }).get('#6c5ce7')).toBe('a');
  });
});

describe('applyTokenNames', () => {
  it('names the swatches whose colour a root token resolves to', () => {
    const palette = applyTokenNames(
      paletteWith([
        { hex: '#6c5ce7', count: 5 },
        { hex: '#0f172a', count: 3 },
      ]),
      { '--primary': '#6c5ce7' },
    );
    expect(palette.background).toEqual([
      { hex: '#6c5ce7', count: 5, name: 'primary' },
      { hex: '#0f172a', count: 3 },
    ]);
  });

  it('matches a name declared for an absorbed merge member', () => {
    const palette = applyTokenNames(
      paletteWith([{ hex: '#ffffff', count: 5, merged: [{ hex: '#fefefe', count: 2 }] }]),
      { '--surface': '#fefefe' },
    );
    expect(palette.background[0].name).toBe('surface');
  });

  it('prefers the canonical hex over a merge member when both are named', () => {
    const palette = applyTokenNames(
      paletteWith([{ hex: '#ffffff', count: 5, merged: [{ hex: '#fefefe', count: 2 }] }]),
      { '--white': '#ffffff', '--white-dim': '#fefefe' },
    );
    expect(palette.background[0].name).toBe('white');
  });

  it('is a no-op without root props or without usable colours', () => {
    const palette = paletteWith([{ hex: '#0f172a', count: 1 }]);
    expect(applyTokenNames(palette, undefined)).toBe(palette);
    expect(applyTokenNames(palette, {})).toBe(palette);
    expect(applyTokenNames(palette, { '--radius': '8px' })).toBe(palette);
  });
});
