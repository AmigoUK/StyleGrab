import { describe, expect, it, vi } from 'vitest';
import { runCapture } from '../lib/capture';
import { getThumbnail } from '../lib/captureStore';
import type { RawScan } from '../lib/extract/types';
import { loadCards } from '../lib/storage';
import { fakeChrome } from './setup';

const scan: RawScan = {
  url: 'https://example.com/pricing',
  title: 'Example — Pricing',
  samples: [
    {
      tag: 'div',
      color: 'rgb(226, 232, 240)',
      backgroundColor: 'rgb(15, 23, 42)',
      borderColor: 'rgb(51, 65, 85)',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontWeight: '700',
      fontSize: '32px',
    },
    {
      tag: 'a',
      color: 'rgb(37, 99, 235)',
      backgroundColor: 'rgba(0, 0, 0, 0)',
      borderColor: 'rgba(0, 0, 0, 0)',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontWeight: '400',
      fontSize: '16px',
    },
  ],
  fontUrls: ['https://fonts.googleapis.com/css2?family=Inter:wght@400;700'],
};

describe('runCapture — refusals', () => {
  it('refuses a browser page instead of injecting into it', async () => {
    fakeChrome.tabs = [{ id: 1, url: 'chrome://extensions', windowId: 10 }];
    expect(await runCapture()).toEqual({ error: 'restricted' });
    expect(await loadCards()).toEqual([]);
  });

  it('refuses when there is no addressable tab', async () => {
    fakeChrome.tabs = [];
    expect(await runCapture()).toEqual({ error: 'restricted' });
  });

  it('reports scan-failed when the page yields no samples', async () => {
    fakeChrome.scanResult = { ...scan, samples: [] } satisfies RawScan;
    expect(await runCapture()).toEqual({ error: 'scan-failed' });
    expect(await loadCards()).toEqual([]);
  });

  it('reports scan-failed when the injection returns nothing at all', async () => {
    fakeChrome.scanResult = undefined;
    expect(await runCapture()).toEqual({ error: 'scan-failed' });
  });
});

describe('runCapture — happy path', () => {
  it('aggregates the raw scan into a role-grouped card and opens the library', async () => {
    fakeChrome.scanResult = scan;

    const res = await runCapture();
    expect(res.ok).toBe(true);

    const [card] = await loadCards();
    expect(card.id).toBe(res.cardId);
    expect(card.url).toBe('https://example.com/pricing');
    expect(card.title).toBe('Example — Pricing');
    expect(card.palette.background[0].hex).toBe('#0f172a');
    expect(card.palette.border[0].hex).toBe('#334155');
    // The <a> sample contributes its colour as an accent, not just as text.
    expect(card.palette.accent.map((s) => s.hex)).toContain('#2563eb');
    expect(card.typography[0]).toMatchObject({
      family: 'Inter',
      source: 'google',
      weights: [400, 700],
    });

    expect(fakeChrome.createdTabs).toEqual(['chrome-extension://stylegrab-test/library.html']);
  });

  it('stores the visible-tab screenshot as the card thumbnail', async () => {
    fakeChrome.scanResult = scan;

    const { cardId } = await runCapture();

    const thumb = await getThumbnail(cardId!);
    expect(thumb).toBeInstanceOf(Blob);
    expect(thumb!.size).toBeGreaterThan(0);
  });
});

describe('runCapture — thumbnail is best-effort', () => {
  it('still saves the card and opens the library when captureVisibleTab throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fakeChrome.scanResult = scan;
    fakeChrome.captureError = new Error('activeTab not granted');

    const res = await runCapture();

    expect(res.ok).toBe(true);
    expect(await loadCards()).toHaveLength(1);
    expect(await getThumbnail(res.cardId!)).toBeUndefined();
    expect(fakeChrome.createdTabs).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
  });
});
