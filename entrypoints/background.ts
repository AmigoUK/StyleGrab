import { putThumbnail } from '@/lib/captureStore';
import { aggregatePalette } from '@/lib/extract/colors';
import { collectRawScan } from '@/lib/extract/scanner';
import type { RawScan } from '@/lib/extract/types';
import { aggregateTypography } from '@/lib/extract/typography';
import type { CaptureResponse, Message } from '@/lib/messages';
import { isRestrictedUrl } from '@/lib/messages';
import { addCard } from '@/lib/storage';
import type { ScanResult } from '@/lib/types';

/**
 * Background service worker. Orchestrates a capture: inject the scanner into the
 * active tab (granted by activeTab on the popup click), aggregate its raw output
 * into a role-grouped palette and typography set, save a card, grab a thumbnail
 * with captureVisibleTab, and open the library on the new card.
 */
export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    if (message?.type === 'ping') {
      sendResponse({ ok: true } satisfies CaptureResponse);
      return;
    }
    if (message?.type === 'capture') {
      handleCapture()
        .then(sendResponse)
        .catch((error) => sendResponse({ error: String(error) } satisfies CaptureResponse));
      return true; // keep the message channel open for the async response
    }
  });
});

async function handleCapture(): Promise<CaptureResponse> {
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
    palette: aggregatePalette(raw.samples),
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
