import { describe, expect, it } from 'vitest';
import { contrastPairs, contrastRatio, relativeLuminance, wcagLevel } from '../lib/contrast';
import { emptyPalette } from '../lib/types';

describe('relativeLuminance', () => {
  it('anchors black at 0 and white at 1', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10);
  });
});

describe('contrastRatio', () => {
  it('reports the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
    // #767676 is the canonical "just passes AA on white" grey.
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  it('is symmetric — order of the two colours does not matter', () => {
    expect(contrastRatio('#0a2540', '#ffffff')).toBe(contrastRatio('#ffffff', '#0a2540'));
  });
});

describe('wcagLevel', () => {
  it('classifies the standard thresholds inclusively', () => {
    expect(wcagLevel(21)).toBe('AAA');
    expect(wcagLevel(7)).toBe('AAA');
    expect(wcagLevel(6.99)).toBe('AA');
    expect(wcagLevel(4.5)).toBe('AA');
    expect(wcagLevel(4.49)).toBe('AA Large');
    expect(wcagLevel(3)).toBe('AA Large');
    expect(wcagLevel(2.99)).toBe('Fail');
  });
});

describe('contrastPairs', () => {
  it('crosses the top text colours with the top backgrounds, most frequent pair first', () => {
    const palette = emptyPalette();
    palette.text = [
      { hex: '#e2e8f0', count: 9 },
      { hex: '#94a3b8', count: 2 },
    ];
    palette.background = [
      { hex: '#0f172a', count: 12 },
      { hex: '#ffffff', count: 1 },
    ];
    const pairs = contrastPairs(palette);

    expect(pairs).toHaveLength(4);
    expect(pairs[0].text.hex).toBe('#e2e8f0');
    expect(pairs[0].background.hex).toBe('#0f172a');
    expect(pairs[0].level).toBe('AAA');
    // The light-on-light combination is honestly reported as failing.
    const failing = pairs.find((p) => p.text.hex === '#e2e8f0' && p.background.hex === '#ffffff');
    expect(failing!.level).toBe('Fail');
  });

  it('skips colours with alpha — their contrast depends on the backdrop', () => {
    const palette = emptyPalette();
    palette.text = [{ hex: '#ffffff80', count: 5 }, { hex: '#111111', count: 1 }];
    palette.background = [{ hex: '#ffffff', count: 5 }];
    const pairs = contrastPairs(palette);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].text.hex).toBe('#111111');
  });

  it('considers only the top three of each role and honours the limit', () => {
    const palette = emptyPalette();
    palette.text = Array.from({ length: 5 }, (_, i) => ({ hex: `#11111${i}`, count: 5 - i }));
    palette.background = Array.from({ length: 5 }, (_, i) => ({ hex: `#eeeee${i}`, count: 5 - i }));
    expect(contrastPairs(palette, 100)).toHaveLength(9);
    expect(contrastPairs(palette, 4)).toHaveLength(4);
  });

  it('returns nothing when either role is empty', () => {
    const palette = emptyPalette();
    palette.text = [{ hex: '#111111', count: 1 }];
    expect(contrastPairs(palette)).toEqual([]);
  });
});
