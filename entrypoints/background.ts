import { runCapture } from '@/lib/capture';
import type { CaptureResponse, Message } from '@/lib/messages';

/**
 * Background service worker. Nothing but message routing lives here — the
 * capture flow itself is in `lib/capture.ts` so it can be unit-tested without a
 * browser. Capture is always initiated from the popup: `captureVisibleTab`
 * works under `activeTab` only on a user gesture.
 */
export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    if (message?.type === 'ping') {
      sendResponse({ ok: true } satisfies CaptureResponse);
      return;
    }
    if (message?.type === 'capture') {
      runCapture()
        .then(sendResponse)
        .catch((error) => sendResponse({ error: String(error) } satisfies CaptureResponse));
      return true; // keep the message channel open for the async response
    }
  });
});
