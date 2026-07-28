import type { FontSource } from '../types';

/**
 * Identifies where a font family is served from, using the family name and the
 * font-related URLs the page exposed (stylesheet hrefs, <link> hrefs, @font-face
 * srcs). Best-effort and pure: cross-origin CSS rules are often unreadable, so
 * detection leans on URLs the scanner could see and on a system-font allowlist.
 */

/** Generic keywords and ubiquitous system faces that no page "hosts". */
const SYSTEM_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'ui-rounded',
  '-apple-system',
  'blinkmacsystemfont',
  'segoe ui',
  'roboto',
  'helvetica',
  'helvetica neue',
  'arial',
  'times new roman',
  'times',
  'georgia',
  'courier new',
  'courier',
  'verdana',
  'tahoma',
  'trebuchet ms',
  'cantarell',
  'noto sans',
  'apple color emoji',
  'segoe ui emoji',
]);

export function normaliseFamily(family: string): string {
  return family.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
}

/** Returns the first (primary) family from a full font-family stack. */
export function primaryFamily(stack: string): string {
  const first = stack.split(',')[0] ?? stack;
  return first.trim().replace(/^['"]|['"]$/g, '');
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function detectFontSource(family: string, fontUrls: string[]): FontSource {
  const key = normaliseFamily(family);
  if (!key) return 'unknown';
  if (SYSTEM_FAMILIES.has(key)) return 'system';

  const familySlug = slug(key);
  const urls = fontUrls.map((u) => u.toLowerCase());

  const onGoogle = urls.some(
    (u) =>
      (u.includes('fonts.googleapis.com') || u.includes('fonts.gstatic.com')) &&
      // the family name usually appears in the Google Fonts request
      (u.includes(familySlug) || u.includes(key.replace(/\s+/g, '+')) || u.includes('fonts.gstatic.com')),
  );
  if (onGoogle) return 'google';

  const onAdobe = urls.some(
    (u) => u.includes('use.typekit.net') || u.includes('typekit.com') || u.includes('adobe'),
  );
  if (onAdobe) return 'adobe';

  // A font file whose URL references this family, served from the site itself.
  const selfHosted = urls.some(
    (u) => /\.(woff2?|ttf|otf|eot)(\?|#|$)/.test(u) && (u.includes(familySlug) || familySlug.length < 3),
  );
  if (selfHosted) return 'self-hosted';

  // Any font file at all present but not matched above → still self-hosted-ish.
  if (urls.some((u) => /\.(woff2?|ttf|otf|eot)(\?|#|$)/.test(u))) return 'self-hosted';

  return 'unknown';
}
