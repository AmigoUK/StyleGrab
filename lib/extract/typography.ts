import type { TypographyEntry } from '../types';
import { detectFontSource, primaryFamily } from './fontSource';
import type { RawSample } from './types';

/**
 * Turns raw per-element samples into a ranked list of typography stacks: one
 * entry per primary font family, carrying the distinct weights and sizes seen,
 * a representative full stack string, and the identified font source. Pure and
 * unit-tested.
 */

const MAX_ENTRIES = 12;

function normaliseWeight(weight: string): number | null {
  const named: Record<string, number> = { normal: 400, bold: 700, lighter: 300, bolder: 700 };
  const n = named[weight.trim().toLowerCase()] ?? Number(weight);
  return Number.isFinite(n) ? n : null;
}

function normaliseSize(size: string): number | null {
  const n = parseFloat(size);
  return Number.isFinite(n) ? Math.round(n) : null;
}

interface Bucket {
  family: string;
  count: number;
  weights: Set<number>;
  sizes: Set<number>;
  stacks: Map<string, number>;
}

export function aggregateTypography(samples: RawSample[], fontUrls: string[]): TypographyEntry[] {
  const buckets = new Map<string, Bucket>();

  for (const s of samples) {
    const stack = s.fontFamily?.trim();
    if (!stack) continue;
    const family = primaryFamily(stack);
    if (!family) continue;
    const key = family.toLowerCase();

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { family, count: 0, weights: new Set(), sizes: new Set(), stacks: new Map() };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    const w = normaliseWeight(s.fontWeight);
    if (w !== null) bucket.weights.add(w);
    const sz = normaliseSize(s.fontSize);
    if (sz !== null) bucket.sizes.add(sz);
    bucket.stacks.set(stack, (bucket.stacks.get(stack) ?? 0) + 1);
  }

  return [...buckets.values()]
    .sort((a, b) => b.count - a.count || a.family.localeCompare(b.family))
    .slice(0, MAX_ENTRIES)
    .map((b) => {
      // Representative stack = the most frequently seen full font-family value.
      const stack = [...b.stacks.entries()].sort((x, y) => y[1] - x[1])[0][0];
      return {
        family: b.family,
        stack,
        weights: [...b.weights].sort((x, y) => x - y),
        sizes: [...b.sizes].sort((x, y) => x - y),
        source: detectFontSource(b.family, fontUrls),
        count: b.count,
      } satisfies TypographyEntry;
    });
}
