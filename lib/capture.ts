import { putThumbnail } from './captureStore';
import { aggregatePalette } from './extract/colors';
import { applyTokenNames } from './extract/customProps';
import { collectRawScan } from './extract/scanner';
import type { RawScan } from './extract/types';
import { aggregateTypography } from './extract/typography';
import type { CaptureResponse } from './messages';
import { isRestrictedUrl } from './messages';
import { addCard } from './storage';
import type { ScanResult } from './types';

/**
 * The capture flow, kept out of the service-worker entrypoint so it can be
 * exercised without a browser: inject the scanner into the active tab (access
 * granted by activeTab on the popup click), aggregate its raw output into a
 * role-grouped palette and typography set, save a card, grab a thumbnail with
 * captureVisibleTab, and open the library on the new card.
 */
export async function runCapture(): Promise<CaptureResponse> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || isRestrictedUrl(tab.url)) return { error: 'restricted' };
  const tabId = tab.id;

  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: collectRawScan,
  });
  const raw = injection?.result as RawScan | undefined;
  if (!raw || !raw.samples.length) return { error: 'scan-failed' };

  const scan: ScanResult = {
    url: raw.url,
    title: raw.title,
    palette: applyTokenNames(aggregatePalette(raw.samples), raw.rootProps),
    typography: aggregateTypography(raw.samples, raw.fontUrls),
  };
  const card = await addCard(scan);

  // Thumbnail is best-effort — a capture is still worth saving without it.
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    const blob = await (await fetch(dataUrl)).blob();
    await putThumbnail(card.id, blob);
  } catch (error) {
    console.warn('StyleGrab: thumbnail capture failed', error);
  }

  await chrome.tabs.create({ url: chrome.runtime.getURL('/library.html') });
  return { ok: true, cardId: card.id };
}
