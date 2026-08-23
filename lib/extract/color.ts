/**
 * Colour parsing/normalisation. Chrome's getComputedStyle returns colours as
 * `rgb(r, g, b)` or `rgba(r, g, b, a)` (occasionally with the modern space
 * syntax). We normalise to a lowercase `#rrggbb`, or `#rrggbbaa` when the
 * colour carries partial transparency. Fully transparent colours return null
 * so callers can drop them.
 */

function toHex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

/** Parses a computed colour string to `#rrggbb`(`aa`), or null if unusable/transparent. */
export function parseColorToHex(input: string | undefined | null): string | null {
  if (!input) return null;
  const value = input.trim().toLowerCase();
  if (value === 'transparent' || value === 'none' || value === '') return null;

  // Already hex.
  if (value.startsWith('#')) {
    if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(value)) return value;
    if (/^#[0-9a-f]{3}$/.test(value)) {
      const [r, g, b] = value.slice(1);
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    return null;
  }

  const match = value.match(/^rgba?\(([^)]+)\)$/);
  if (!match) return null;
  // Accept both "r, g, b, a" and "r g b / a" forms.
  const parts = match[1]
    .replace(/\//g, ' ')
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length < 3) return null;

  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;

  let a = parts[3] === undefined ? 1 : Number(parts[3]);
  if (Number.isNaN(a)) a = 1;
  if (a <= 0) return null; // fully transparent — not a real colour on the page

  const base = `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
  return a >= 1 ? base : `${base}${toHex2(a * 255)}`;
}

/**
 * Perceptual colour difference (CIEDE2000) between two opaque hex colours, used
 * to merge near-duplicate swatches that differ only by DOM noise (#fff vs
 * #fefefe) while keeping genuinely distinct brand colours apart. Two colours at
 * or below `DELTA_E_MERGE_THRESHOLD` read as the same colour to a human.
 */

export const DELTA_E_MERGE_THRESHOLD = 2.5;

export interface Lab {
  l: number;
  a: number;
  b: number;
}

/** sRGB `#rrggbb` → CIELAB (D65 white point). Any trailing alpha digits are ignored. */
export function hexToLab(hex: string): Lab {
  const linear = (index: number): number => {
    const c = parseInt(hex.slice(index, index + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = linear(1);
  const g = linear(3);
  const b = linear(5);

  // sRGB → XYZ (D65), then normalise by the white point.
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;

  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : t * (841 / 108) + 4 / 29);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

const deg2rad = (d: number): number => (d * Math.PI) / 180;
const cosd = (d: number): number => Math.cos(deg2rad(d));

/** CIEDE2000 colour difference. Reference: Sharma, Wu & Dalal (2005). */
export function deltaE2000(x: Lab, y: Lab): number {
  const c1 = Math.hypot(x.a, x.b);
  const c2 = Math.hypot(y.a, y.b);
  const cBar = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)));

  const a1p = (1 + g) * x.a;
  const a2p = (1 + g) * y.a;
  const c1p = Math.hypot(a1p, x.b);
  const c2p = Math.hypot(a2p, y.b);
  const hue = (a: number, b: number): number =>
    a === 0 && b === 0 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  const h1p = hue(a1p, x.b);
  const h2p = hue(a2p, y.b);

  const dLp = y.l - x.l;
  const dCp = c2p - c1p;
  let dhp = 0;
  if (c1p * c2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(deg2rad(dhp) / 2);

  const lBarP = (x.l + y.l) / 2;
  const cBarP = (c1p + c2p) / 2;
  let hBarP = h1p + h2p;
  if (c1p * c2p !== 0) {
    hBarP = (h1p + h2p) / 2;
    if (Math.abs(h1p - h2p) > 180) hBarP += h1p + h2p < 360 ? 180 : -180;
  }

  const t =
    1 -
    0.17 * cosd(hBarP - 30) +
    0.24 * cosd(2 * hBarP) +
    0.32 * cosd(3 * hBarP + 6) -
    0.2 * cosd(4 * hBarP - 63);
  const dTheta = 30 * Math.exp(-(((hBarP - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(cBarP ** 7 / (cBarP ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (lBarP - 50) ** 2) / Math.sqrt(20 + (lBarP - 50) ** 2);
  const sc = 1 + 0.045 * cBarP;
  const sh = 1 + 0.015 * cBarP * t;
  const rt = -Math.sin(deg2rad(2 * dTheta)) * rc;

  const dL = dLp / sl;
  const dC = dCp / sc;
  const dH = dHp / sh;
  return Math.sqrt(dL * dL + dC * dC + dH * dH + rt * dC * dH);
}
