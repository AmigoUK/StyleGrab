import { describe, expect, it } from 'vitest';
import { isRestrictedUrl } from '../lib/messages';
import { COLOR_ROLES, emptyPalette } from '../lib/types';

describe('isRestrictedUrl', () => {
  it('rejects browser and store pages that cannot be scanned', () => {
    expect(isRestrictedUrl(undefined)).toBe(true);
    expect(isRestrictedUrl('chrome://extensions')).toBe(true);
    expect(isRestrictedUrl('chrome-extension://abc/library.html')).toBe(true);
    expect(isRestrictedUrl('about:blank')).toBe(true);
    expect(isRestrictedUrl('https://chromewebstore.google.com/detail/x')).toBe(true);
  });

  it('allows ordinary web pages', () => {
    expect(isRestrictedUrl('https://example.com')).toBe(false);
    expect(isRestrictedUrl('http://localhost:3000/app')).toBe(false);
  });
});

describe('emptyPalette', () => {
  it('has an empty array for every colour role', () => {
    const palette = emptyPalette();
    expect(Object.keys(palette).sort()).toEqual([...COLOR_ROLES].sort());
    for (const role of COLOR_ROLES) {
      expect(palette[role]).toEqual([]);
    }
  });
});
