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
