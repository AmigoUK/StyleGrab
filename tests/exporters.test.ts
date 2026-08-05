import { describe, expect, it } from 'vitest';
import { toCssVariables } from '../lib/exporters/css';
import { toScssVariables } from '../lib/exporters/scss';
import { toTailwindConfig } from '../lib/exporters/tailwind';
import { toW3CTokens } from '../lib/exporters/w3c';
import { familySlug, stackToArray, uniqueFamilyNames } from '../lib/exporters/util';
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

describe('toScssVariables', () => {
  it('emits $-variables grouped by role, skipping empty roles', () => {
    expect(toScssVariables(card)).toBe(
      [
        '// StyleGrab — https://example.com/',
        '// Background',
        '$bg-1: #0f172a;',
        '$bg-2: #ffffff;',
        '// Text',
        '$text-1: #e2e8f0;',
        '// Accent',
        '$accent-1: #2563eb;',
        '// Typography',
        '$font-inter: Inter, system-ui, sans-serif;',
        '',
      ].join('\n'),
    );
  });
});

describe('toTailwindConfig', () => {
  it('produces a valid, parseable theme.extend fragment', () => {
    const out = toTailwindConfig(card);
    expect(out.startsWith('/** StyleGrab — https://example.com/ */')).toBe(true);
    expect(out).toContain('module.exports = {');
    // The body after `module.exports = ` up to the trailing `;` is valid JSON.
    const json = out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1);
    const parsed = JSON.parse(json);
    expect(parsed.theme.extend.colors.background['1']).toBe('#0f172a');
    expect(parsed.theme.extend.colors.background['2']).toBe('#ffffff');
    expect(parsed.theme.extend.colors.accent['1']).toBe('#2563eb');
    expect(parsed.theme.extend.colors).not.toHaveProperty('border');
    expect(parsed.theme.extend.fontFamily.inter).toEqual(['Inter', 'system-ui', 'sans-serif']);
  });
});

describe('toW3CTokens', () => {
  it('produces valid W3C design-token JSON', () => {
    const parsed = JSON.parse(toW3CTokens(card));
    expect(parsed.$description).toBe('StyleGrab — https://example.com/');
    expect(parsed.color.background['1']).toEqual({ $type: 'color', $value: '#0f172a' });
    expect(parsed.color).not.toHaveProperty('border');
    expect(parsed.fontFamily.inter).toEqual({
      $type: 'fontFamily',
      $value: ['Inter', 'system-ui', 'sans-serif'],
    });
  });
});

describe('uniqueFamilyNames', () => {
  it('disambiguates families that slugify to the same name', () => {
    const names = uniqueFamilyNames(['Inter', 'inter', 'Roboto']);
    expect([...names.values()]).toEqual(['inter', 'inter-2', 'roboto']);
  });
});

describe('export registry', () => {
  it('exposes all four formats and resolves them by id', () => {
    expect(EXPORT_FORMATS.map((f) => f.id)).toEqual(['css', 'scss', 'tailwind', 'w3c']);
    expect(getFormat('css')?.ext).toBe('css');
    expect(getFormat('tailwind')?.ext).toBe('js');
    expect(getFormat('w3c')?.mime).toBe('application/json');
    expect(getFormat('nope')).toBeUndefined();
  });
});

describe('exporters — empty capture', () => {
  const bare: StyleCard = {
    id: 'bare',
    url: '',
    title: '',
    createdAt: '2026-07-28T00:00:00.000Z',
    notes: '',
    palette: { background: [], text: [], accent: [], border: [] },
    typography: [],
  };

  it('still produces syntactically valid output in every format', () => {
    expect(toCssVariables(bare)).toBe('/* StyleGrab — capture */\n:root {\n}\n');
    expect(toScssVariables(bare)).toBe('// StyleGrab — capture\n');
    expect(JSON.parse(toW3CTokens(bare))).toEqual({ $description: 'StyleGrab — capture' });

    const tw = toTailwindConfig(bare);
    expect(JSON.parse(tw.slice(tw.indexOf('{'), tw.lastIndexOf('}') + 1))).toEqual({
      theme: { extend: {} },
    });
  });
});

describe('exporters — awkward font names', () => {
  const quoted: StyleCard = {
    id: 'quoted',
    url: 'https://example.com/',
    title: '',
    createdAt: '2026-07-28T00:00:00.000Z',
    notes: '',
    palette: { background: [], text: [], accent: [], border: [] },
    typography: [
      {
        family: 'Helvetica Neue',
        stack: '"Helvetica Neue", \'Segoe UI\', sans-serif',
        weights: [400],
        sizes: [16],
        source: 'system',
        count: 2,
      },
      {
        family: 'Inter',
        stack: 'Inter, sans-serif',
        weights: [400],
        sizes: [16],
        source: 'google',
        count: 1,
      },
      {
        family: 'inter',
        stack: 'inter, sans-serif',
        weights: [400],
        sizes: [16],
        source: 'google',
        count: 1,
      },
    ],
  };

  it('slugifies multi-word families and disambiguates casing collisions', () => {
    expect(toCssVariables(quoted)).toContain('--font-helvetica-neue:');
    expect(toCssVariables(quoted)).toContain('--font-inter:');
    expect(toCssVariables(quoted)).toContain('--font-inter-2:');
    expect(toScssVariables(quoted)).toContain('$font-helvetica-neue:');
  });

  it('unquotes each family when a stack becomes a JSON array', () => {
    const parsed = JSON.parse(toW3CTokens(quoted));
    expect(parsed.fontFamily['helvetica-neue'].$value).toEqual([
      'Helvetica Neue',
      'Segoe UI',
      'sans-serif',
    ]);
    // Keys collide before disambiguation — all three families must survive.
    expect(Object.keys(parsed.fontFamily)).toEqual(['helvetica-neue', 'inter', 'inter-2']);
  });

  it('produces a Tailwind fragment that actually evaluates as a module', () => {
    const out = toTailwindConfig(quoted);
    const module = { exports: {} as { theme?: { extend?: { fontFamily?: Record<string, string[]> } } } };
    new Function('module', out)(module);
    expect(module.exports.theme!.extend!.fontFamily!['helvetica-neue']).toEqual([
      'Helvetica Neue',
      'Segoe UI',
      'sans-serif',
    ]);
  });
});

describe('export registry — every format renders', () => {
  it('returns non-empty text for the same card in all four formats', () => {
    for (const format of EXPORT_FORMATS) {
      const out = format.render(card);
      expect(out.length).toBeGreaterThan(0);
      expect(out.endsWith('\n')).toBe(true);
    }
  });
});

describe('familySlug and stackToArray', () => {
  it('falls back to a usable name when a family has no alphanumerics', () => {
    expect(familySlug('!!!')).toBe('family');
    expect(familySlug('  Helvetica  Neue  ')).toBe('helvetica-neue');
  });

  it('drops empty entries and quotes when splitting a stack', () => {
    expect(stackToArray('"Inter", , sans-serif,')).toEqual(['Inter', 'sans-serif']);
  });
});

describe('harvested token names in exports', () => {
  const named: StyleCard = {
    ...card,
    palette: {
      background: [
        { hex: '#0f172a', count: 10, name: 'surface' },
        { hex: '#ffffff', count: 3 },
      ],
      text: [{ hex: '#e2e8f0', count: 8 }],
      accent: [{ hex: '#2563eb', count: 5, name: 'brand' }],
      border: [],
    },
  };

  it('CSS uses the site name where present, numbered fallback elsewhere', () => {
    const css = toCssVariables(named);
    expect(css).toContain('  --surface: #0f172a;');
    expect(css).toContain('  --bg-2: #ffffff;');
    expect(css).toContain('  --text-1: #e2e8f0;');
    expect(css).toContain('  --brand: #2563eb;');
    expect(css).not.toContain('--bg-1:');
  });

  it('SCSS mirrors the same names', () => {
    const scss = toScssVariables(named);
    expect(scss).toContain('$surface: #0f172a;');
    expect(scss).toContain('$bg-2: #ffffff;');
    expect(scss).toContain('$brand: #2563eb;');
  });

  it('Tailwind and W3C use the name as the token key', () => {
    const tw = toTailwindConfig(named);
    const module = { exports: {} as { theme?: { extend?: { colors?: Record<string, Record<string, string>> } } } };
    new Function('module', tw)(module);
    expect(module.exports.theme!.extend!.colors!.background).toEqual({
      surface: '#0f172a',
      '2': '#ffffff',
    });

    const w3c = JSON.parse(toW3CTokens(named));
    expect(w3c.color.background.surface.$value).toBe('#0f172a');
    expect(w3c.color.accent.brand.$value).toBe('#2563eb');
  });

  it('disambiguates when the same site name lands in two roles of one namespace', () => {
    const collide: StyleCard = {
      ...card,
      palette: {
        background: [{ hex: '#ffffff', count: 5, name: 'base' }],
        text: [{ hex: '#111111', count: 4, name: 'base' }],
        accent: [],
        border: [],
      },
    };
    const css = toCssVariables(collide);
    expect(css).toContain('  --base: #ffffff;');
    expect(css).toContain('  --base-2: #111111;');
    const scss = toScssVariables(collide);
    expect(scss).toContain('$base: #ffffff;');
    expect(scss).toContain('$base-2: #111111;');
  });

  it('disambiguates a site name colliding with a numbered fallback', () => {
    const collide: StyleCard = {
      ...card,
      palette: {
        background: [
          { hex: '#0f172a', count: 5 },
          { hex: '#ffffff', count: 4, name: 'bg-1' },
        ],
        text: [],
        accent: [],
        border: [],
      },
    };
    const css = toCssVariables(collide);
    expect(css).toContain('  --bg-1: #0f172a;');
    expect(css).toContain('  --bg-1-2: #ffffff;');
  });
});
