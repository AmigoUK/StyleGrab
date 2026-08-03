import { describe, expect, it, vi } from 'vitest';
import { isRestrictedUrl, sendToBackground } from '../lib/messages';
import { fakeChrome } from './setup';

describe('isRestrictedUrl — pages the scanner can never reach', () => {
  it('rejects every browser-internal scheme we know of', () => {
    for (const url of [
      'chrome://newtab',
      'chrome-extension://abc/popup.html',
      'edge://settings',
      'about:blank',
      'about:srcdoc',
      'https://chrome.google.com/webstore/category/extensions',
      'https://chromewebstore.google.com/',
    ]) {
      expect(isRestrictedUrl(url), url).toBe(true);
    }
  });

  it('allows http(s), localhost, file-ish and query-laden page URLs', () => {
    for (const url of [
      'https://example.com/a?b=c#d',
      'http://localhost:5173/',
      'https://chromewebstore.example.com/', // lookalike host, not the store
    ]) {
      expect(isRestrictedUrl(url), url).toBe(false);
    }
  });
});

describe('sendToBackground', () => {
  it('hands the message to the runtime and resolves with its answer', async () => {
    const handler = vi.fn(async () => ({ ok: true, cardId: 'abc' }));
    fakeChrome.onMessage = handler;

    await expect(sendToBackground({ type: 'capture' })).resolves.toEqual({
      ok: true,
      cardId: 'abc',
    });
    expect(handler).toHaveBeenCalledWith({ type: 'capture' });
  });

  it('surfaces an error response unchanged, so the popup can map the code', async () => {
    fakeChrome.onMessage = async () => ({ error: 'restricted' });
    await expect(sendToBackground({ type: 'capture' })).resolves.toEqual({ error: 'restricted' });
  });

  it('answers a ping', async () => {
    fakeChrome.onMessage = async () => ({ ok: true });
    await expect(sendToBackground({ type: 'ping' })).resolves.toEqual({ ok: true });
  });
});
