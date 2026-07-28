/**
 * Message contract between the popup, the background service worker and the
 * injected scanner. Kept deliberately small in the scaffold; the capture and
 * scan flows are filled in in v0.1.
 */

export type Message = { type: 'capture' } | { type: 'ping' };

export interface CaptureResponse {
  ok?: boolean;
  /** Id of the created card when a capture succeeds. */
  cardId?: string;
  /** Error code, e.g. 'restricted' | 'not-implemented'. */
  error?: string;
}

/** Chrome pages we can never inject into — capture is disabled for these. */
export function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('https://chrome.google.com/webstore') ||
    url.startsWith('https://chromewebstore.google.com')
  );
}

export function sendToBackground<T = CaptureResponse>(message: Message): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}
