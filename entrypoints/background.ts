import type { CaptureResponse, Message } from '@/lib/messages';

/**
 * Background service worker. In the v0.0.1 scaffold it only answers a ping and
 * reports capture as not-yet-implemented; the real capture/scan orchestration
 * (inject scanner → aggregate styles → captureVisibleTab → save card) lands in
 * v0.1.
 */
export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    if (message?.type === 'ping') {
      sendResponse({ ok: true } satisfies CaptureResponse);
      return;
    }
    if (message?.type === 'capture') {
      sendResponse({ error: 'not-implemented' } satisfies CaptureResponse);
      return;
    }
  });
});
