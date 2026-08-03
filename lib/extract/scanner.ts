import type { RawSample, RawScan } from './types';

/**
 * Collects raw computed-style samples and font URLs from the current page.
 *
 * IMPORTANT: this function is stringified and injected into the page via
 * chrome.scripting.executeScript (`func`), so it MUST be fully self-contained —
 * it may reference only DOM/global APIs and its own locals, never any module
 * import or outer-scope binding. The type imports above are erased at compile
 * time and do not appear in the injected code.
 */
export function collectRawScan(): RawScan {
  const MAX_ELEMENTS = 4000;
  const samples: RawSample[] = [];

  // `html` and `body` carry the page's own background and base type, which is
  // usually the single most important colour on the page — sample them first,
  // then everything they contain.
  const all: HTMLElement[] = [document.documentElement, document.body].filter(Boolean);
  all.push(...(document.querySelectorAll('body *') as NodeListOf<HTMLElement>));
  const limit = Math.min(all.length, MAX_ELEMENTS);
  for (let i = 0; i < limit; i++) {
    const el = all[i];
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    samples.push({
      tag: el.tagName.toLowerCase(),
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      borderColor: cs.borderTopColor,
      fontFamily: cs.fontFamily,
      fontWeight: cs.fontWeight,
      fontSize: cs.fontSize,
    });
  }

  const fontUrls: string[] = [];
  document
    .querySelectorAll('link[rel~="stylesheet"], link[rel="preload"][as="font"]')
    .forEach((l) => {
      const href = (l as HTMLLinkElement).href;
      if (href) fontUrls.push(href);
    });

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSFontFaceRule) {
          const src = rule.style.getPropertyValue('src');
          const matches = src.match(/url\(([^)]+)\)/g);
          if (matches) {
            for (const m of matches) fontUrls.push(m.replace(/url\(|\)|['"]/g, '').trim());
          }
        }
      }
    } catch {
      // Cross-origin stylesheet: reading cssRules throws a SecurityError.
      // Fall back to the sheet's own URL, which still hints at the font host.
      if (sheet.href) fontUrls.push(sheet.href);
    }
  }

  return { url: location.href, title: document.title, samples, fontUrls: [...new Set(fontUrls)] };
}
