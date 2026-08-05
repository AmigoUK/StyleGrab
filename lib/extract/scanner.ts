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

  // The page's own background usually sits on <body> and is the single most
  // important colour on the page, so sample <body> itself and not just its
  // descendants.
  const all: HTMLElement[] = document.body ? [document.body] : [];
  all.push(...(document.querySelectorAll('body *') as NodeListOf<HTMLElement>));
  const limit = Math.min(all.length, MAX_ELEMENTS);

  // When <body> is transparent the canvas colour comes from <html>. Contribute
  // only its background: the root's default text colour and UA font are not
  // things the page actually chose, and would pollute the palette and type list.
  const rootStyle = getComputedStyle(document.documentElement);
  samples.push({
    tag: 'html',
    color: 'transparent',
    backgroundColor: rootStyle.backgroundColor,
    borderColor: 'transparent',
    fontFamily: '',
    fontWeight: '',
    fontSize: '',
  });
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

  // Custom properties declared at the root are usually the site's real design
  // tokens (--color-primary and friends). Collect the declared names from
  // same-origin :root/html rules and resolve each through getComputedStyle so
  // var() chains and theme overrides land on the value actually in effect.
  const MAX_ROOT_PROPS = 400;
  const rootProps: Record<string, string> = {};
  let rootPropCount = 0;
  const isRootSelector = (sel: string | undefined): boolean =>
    !!sel &&
    sel.split(',').some((part) => {
      const t = part.trim();
      return t === ':root' || t === 'html';
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
        } else if (rule instanceof CSSStyleRule && isRootSelector(rule.selectorText)) {
          for (const prop of Array.from(rule.style)) {
            if (!prop.startsWith('--') || prop in rootProps) continue;
            if (rootPropCount >= MAX_ROOT_PROPS) break;
            const value = rootStyle.getPropertyValue(prop).trim();
            if (value) {
              rootProps[prop] = value;
              rootPropCount++;
            }
          }
        }
      }
    } catch {
      // Cross-origin stylesheet: reading cssRules throws a SecurityError.
      // Fall back to the sheet's own URL, which still hints at the font host.
      if (sheet.href) fontUrls.push(sheet.href);
    }
  }

  return {
    url: location.href,
    title: document.title,
    samples,
    fontUrls: [...new Set(fontUrls)],
    rootProps,
  };
}
