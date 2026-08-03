import { describe, expect, it } from 'vitest';
import { parseColorToHex } from '../lib/extract/color';
import { aggregatePalette } from '../lib/extract/colors';
import { detectFontSource, primaryFamily } from '../lib/extract/fontSource';
import { aggregateTypography } from '../lib/extract/typography';
import type { RawSample } from '../lib/extract/types';

function sample(over: Partial<RawSample>): RawSample {
  return {
    tag: 'div',
    color: 'rgb(0, 0, 0)',
    backgroundColor: 'rgba(0, 0, 0, 0)',
    borderColor: 'rgba(0, 0, 0, 0)',
    fontFamily: 'Arial',
    fontWeight: '400',
    fontSize: '16px',
    ...over,
  };
}

describe('parseColorToHex', () => {
  it('normalises rgb/rgba and hex, drops transparent', () => {
    expect(parseColorToHex('rgb(37, 99, 235)')).toBe('#2563eb');
    expect(parseColorToHex('rgba(255, 255, 255, 0.5)')).toBe('#ffffff80');
    expect(parseColorToHex('rgb(255 0 0 / 1)')).toBe('#ff0000');
    expect(parseColorToHex('#ABC')).toBe('#aabbcc');
    expect(parseColorToHex('transparent')).toBeNull();
    expect(parseColorToHex('rgba(0,0,0,0)')).toBeNull();
    expect(parseColorToHex('')).toBeNull();
  });
});

describe('aggregatePalette', () => {
  it('groups colours by role and ranks by frequency', () => {
    const samples: RawSample[] = [
      sample({ backgroundColor: 'rgb(15, 23, 42)', color: 'rgb(226, 232, 240)' }),
      sample({ backgroundColor: 'rgb(15, 23, 42)', color: 'rgb(226, 232, 240)' }),
      sample({ backgroundColor: 'rgb(255, 255, 255)', color: 'rgb(0, 0, 0)' }),
      sample({ tag: 'a', color: 'rgb(37, 99, 235)' }),
      sample({ tag: 'button', borderColor: 'rgb(51, 65, 85)' }),
    ];
    const palette = aggregatePalette(samples);

    // Most frequent background first.
    expect(palette.background[0]).toEqual({ hex: '#0f172a', count: 2 });
    expect(palette.background.map((s) => s.hex)).toContain('#ffffff');
    // Accent colours come only from interactive tags.
    expect(palette.accent.map((s) => s.hex)).toContain('#2563eb');
    // Borders collected from border colour.
    expect(palette.border.map((s) => s.hex)).toContain('#334155');
    // Transparent backgrounds on default samples never enter the palette.
    expect(palette.background.map((s) => s.hex)).not.toContain('#000000');
  });
});

describe('aggregateTypography', () => {
  it('groups by primary family with weights, sizes and source', () => {
    const samples: RawSample[] = [
      sample({ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '400', fontSize: '16px' }),
      sample({ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '700', fontSize: '32px' }),
      sample({ fontFamily: 'Georgia, serif', fontWeight: 'bold', fontSize: '14px' }),
    ];
    const entries = aggregateTypography(samples, [
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;700',
    ]);

    const inter = entries.find((e) => e.family === 'Inter');
    expect(inter).toBeDefined();
    expect(inter!.weights).toEqual([400, 700]);
    expect(inter!.sizes).toEqual([16, 32]);
    expect(inter!.source).toBe('google');
    expect(inter!.count).toBe(2);
    // Inter is more frequent, so it ranks first.
    expect(entries[0].family).toBe('Inter');

    const georgia = entries.find((e) => e.family === 'Georgia');
    expect(georgia!.source).toBe('system');
    expect(georgia!.weights).toEqual([700]); // 'bold' normalised
  });
});

describe('detectFontSource', () => {
  it('classifies system, google, adobe, self-hosted and unknown', () => {
    expect(detectFontSource('sans-serif', [])).toBe('system');
    expect(detectFontSource('Arial', [])).toBe('system');
    expect(detectFontSource('Inter', ['https://fonts.gstatic.com/s/inter/x.woff2'])).toBe('google');
    expect(detectFontSource('Proxima Nova', ['https://use.typekit.net/abc.css'])).toBe('adobe');
    expect(detectFontSource('Whitney', ['https://site.example/fonts/whitney.woff2'])).toBe('self-hosted');
    expect(detectFontSource('Mystery', [])).toBe('unknown');
  });
});

describe('primaryFamily', () => {
  it('extracts and unquotes the first family in a stack', () => {
    expect(primaryFamily('"Helvetica Neue", Arial, sans-serif')).toBe('Helvetica Neue');
    expect(primaryFamily('Inter')).toBe('Inter');
  });
});

describe('parseColorToHex — edge cases', () => {
  it('passes through 8-digit hex and clamps out-of-range channels', () => {
    expect(parseColorToHex('#0F172ACC')).toBe('#0f172acc');
    expect(parseColorToHex('rgb(300, -5, 0)')).toBe('#ff0000');
  });

  it('rejects malformed input rather than guessing', () => {
    expect(parseColorToHex('#12345')).toBeNull();
    expect(parseColorToHex('rgb(1, 2)')).toBeNull();
    expect(parseColorToHex('hsl(210, 50%, 40%)')).toBeNull();
    expect(parseColorToHex('none')).toBeNull();
    expect(parseColorToHex(undefined)).toBeNull();
    expect(parseColorToHex(null)).toBeNull();
  });

  it('is insensitive to case and surrounding whitespace', () => {
    expect(parseColorToHex('  RGB(37, 99, 235)  ')).toBe('#2563eb');
  });

  it('treats a non-numeric alpha as fully opaque', () => {
    expect(parseColorToHex('rgba(0, 0, 0, none)')).toBe('#000000');
  });
});

describe('aggregatePalette — ranking and limits', () => {
  it('caps each role at 12 swatches, keeping the most frequent', () => {
    const samples: RawSample[] = [];
    for (let i = 0; i < 20; i++) {
      // Colour i appears (20 - i) times, so the top 12 are i = 0…11.
      for (let n = 0; n < 20 - i; n++) {
        samples.push(sample({ backgroundColor: `rgb(${i}, 0, 0)` }));
      }
    }
    const palette = aggregatePalette(samples);
    expect(palette.background).toHaveLength(12);
    expect(palette.background[0].hex).toBe('#000000');
    expect(palette.background.at(-1)!.hex).toBe('#0b0000');
  });

  it('breaks count ties alphabetically by hex, so output is deterministic', () => {
    const palette = aggregatePalette([
      sample({ backgroundColor: 'rgb(255, 255, 255)' }),
      sample({ backgroundColor: 'rgb(0, 0, 0)' }),
    ]);
    expect(palette.background.map((s) => s.hex)).toEqual(['#000000', '#ffffff']);
  });

  it('takes a button background as an accent, not just its text colour', () => {
    const palette = aggregatePalette([
      sample({ tag: 'button', backgroundColor: 'rgb(99, 91, 255)', color: 'rgb(255, 255, 255)' }),
    ]);
    expect(palette.accent.map((s) => s.hex).sort()).toEqual(['#635bff', '#ffffff']);
  });

  it('returns an empty palette for no samples', () => {
    expect(aggregatePalette([])).toEqual({ background: [], text: [], accent: [], border: [] });
  });
});

describe('aggregateTypography — grouping details', () => {
  it('groups families case-insensitively and keeps the first casing seen', () => {
    const entries = aggregateTypography(
      [sample({ fontFamily: 'Inter, sans-serif' }), sample({ fontFamily: 'inter, sans-serif' })],
      [],
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].family).toBe('Inter');
    expect(entries[0].count).toBe(2);
  });

  it('reports the most frequently seen full stack as representative', () => {
    const entries = aggregateTypography(
      [
        sample({ fontFamily: 'Inter, Arial' }),
        sample({ fontFamily: 'Inter, system-ui, sans-serif' }),
        sample({ fontFamily: 'Inter, system-ui, sans-serif' }),
      ],
      [],
    );
    expect(entries[0].stack).toBe('Inter, system-ui, sans-serif');
  });

  it('normalises named weights and ignores samples without a family', () => {
    const entries = aggregateTypography(
      [
        sample({ fontFamily: 'Inter', fontWeight: 'normal' }),
        sample({ fontFamily: 'Inter', fontWeight: 'lighter' }),
        sample({ fontFamily: '   ' }),
      ],
      [],
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].weights).toEqual([300, 400]);
  });

  it('caps the list at 12 families', () => {
    const samples = Array.from({ length: 20 }, (_, i) => sample({ fontFamily: `Family${i}` }));
    expect(aggregateTypography(samples, [])).toHaveLength(12);
  });
});

describe('detectFontSource — harder classification', () => {
  it('handles quoted and empty family names', () => {
    expect(detectFontSource('"Helvetica Neue"', [])).toBe('system');
    expect(detectFontSource('   ', [])).toBe('unknown');
  });

  it('reads a Google Fonts stylesheet URL that spells the family with +', () => {
    expect(
      detectFontSource('Source Sans Pro', [
        'https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400',
      ]),
    ).toBe('google');
  });

  it('falls back to self-hosted when a font file exists but names no family', () => {
    expect(detectFontSource('Whitney', ['https://site.example/assets/f1.woff2'])).toBe('self-hosted');
  });

  it('prefers Google over Adobe when both are present', () => {
    expect(
      detectFontSource('Inter', ['https://use.typekit.net/x.css', 'https://fonts.gstatic.com/a.woff2']),
    ).toBe('google');
  });

  it('ignores non-font URLs entirely', () => {
    expect(detectFontSource('Whitney', ['https://site.example/app.js'])).toBe('unknown');
  });
});
