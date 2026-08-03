import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PopupApp } from '@/entrypoints/popup/PopupApp';
import { loadCards } from '@/lib/storage';
import { fakeChrome } from '../setup';

/**
 * The popup is the only place a capture can start (captureVisibleTab needs a
 * user gesture under activeTab), so its guard rails matter: it must refuse
 * unscannable pages, surface the background's error codes in plain language,
 * and disable the eyedropper where the native API is missing.
 */

interface FakeEyeDropper {
  open: () => Promise<{ sRGBHex: string }>;
}

function installEyeDropper(open: () => Promise<{ sRGBHex: string }>): void {
  Object.defineProperty(globalThis, 'EyeDropper', {
    configurable: true,
    writable: true,
    value: function EyeDropper(this: FakeEyeDropper) {
      this.open = open;
    } as unknown as new () => FakeEyeDropper,
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'EyeDropper');
});

const captureButton = () => screen.getByRole('button', { name: /Capture this page/ });

describe('PopupApp — page eligibility', () => {
  it('enables capture on an ordinary web page', async () => {
    render(<PopupApp />);
    await waitFor(() => expect(captureButton().hasAttribute('disabled')).toBe(false));
    expect(screen.queryByText(/can't be scanned \(browser or store page\)/)).toBeNull();
  });

  it('disables capture and explains why on a browser page', async () => {
    fakeChrome.tabs = [{ id: 1, url: 'chrome://extensions', windowId: 10 }];
    render(<PopupApp />);

    await waitFor(() =>
      expect(screen.getByText(/can't be scanned \(browser or store page\)/)).toBeTruthy(),
    );
    expect(captureButton().hasAttribute('disabled')).toBe(true);
  });
});

describe('PopupApp — capture', () => {
  it('asks the background to capture and closes itself on success', async () => {
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    const onMessage = vi.fn(async () => ({ ok: true, cardId: 'abc' }));
    fakeChrome.onMessage = onMessage;

    render(<PopupApp />);
    await waitFor(() => expect(captureButton().hasAttribute('disabled')).toBe(false));
    await userEvent.click(captureButton());

    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(onMessage).toHaveBeenCalledWith({ type: 'capture' });
  });

  it('translates known error codes instead of showing raw ones', async () => {
    fakeChrome.onMessage = async () => ({ error: 'scan-failed' });

    render(<PopupApp />);
    await waitFor(() => expect(captureButton().hasAttribute('disabled')).toBe(false));
    await userEvent.click(captureButton());

    expect(await screen.findByText('Nothing to scan on this page.')).toBeTruthy();
  });

  it('falls back to showing an unexpected error code rather than failing silently', async () => {
    fakeChrome.onMessage = async () => ({ error: 'Error: service worker asleep' });

    render(<PopupApp />);
    await waitFor(() => expect(captureButton().hasAttribute('disabled')).toBe(false));
    await userEvent.click(captureButton());

    expect(await screen.findByText(/Could not capture: Error: service worker asleep/)).toBeTruthy();
  });

  it('re-enables the button after a failed capture so the user can retry', async () => {
    fakeChrome.onMessage = async () => ({ error: 'scan-failed' });

    render(<PopupApp />);
    await waitFor(() => expect(captureButton().hasAttribute('disabled')).toBe(false));
    await userEvent.click(captureButton());

    await screen.findByText('Nothing to scan on this page.');
    expect(captureButton().hasAttribute('disabled')).toBe(false);
  });
});

describe('PopupApp — eyedropper', () => {
  it('disables the picker and says why when the native API is missing', async () => {
    render(<PopupApp />);

    const pick = screen.getByRole('button', { name: /Pick a colour/ });
    expect(pick.hasAttribute('disabled')).toBe(true);
    expect(pick.getAttribute('title')).toBe('EyeDropper API unavailable');
  });

  it('collects picked colours without repeating one already picked', async () => {
    installEyeDropper(async () => ({ sRGBHex: '#635BFF' }));
    render(<PopupApp />);

    const pick = screen.getByRole('button', { name: /Pick a colour/ });
    await userEvent.click(pick);
    expect(await screen.findByText('#635bff')).toBeTruthy();

    await userEvent.click(pick);
    expect(screen.getAllByText('#635bff')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Save 1 to library/ })).toBeTruthy();
  });

  it('ignores a cancelled pick', async () => {
    installEyeDropper(async () => {
      throw new DOMException('aborted', 'AbortError');
    });
    render(<PopupApp />);

    await userEvent.click(screen.getByRole('button', { name: /Pick a colour/ }));

    expect(screen.queryByRole('button', { name: /Save .* to library/ })).toBeNull();
  });

  it('saves picks as an accent-only card and opens the library', async () => {
    vi.spyOn(window, 'close').mockImplementation(() => {});
    installEyeDropper(async () => ({ sRGBHex: '#635bff' }));
    render(<PopupApp />);

    await userEvent.click(screen.getByRole('button', { name: /Pick a colour/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Save 1 to library/ }));

    await waitFor(async () => expect(await loadCards()).toHaveLength(1));
    const [card] = await loadCards();
    expect(card.title).toBe('Eyedropper picks');
    expect(card.palette.accent).toEqual([{ hex: '#635bff', count: 1 }]);
    expect(card.palette.background).toEqual([]);
    expect(fakeChrome.createdTabs).toEqual(['chrome-extension://stylegrab-test/library.html']);
  });

  it('clears the picks without touching the library', async () => {
    installEyeDropper(async () => ({ sRGBHex: '#635bff' }));
    render(<PopupApp />);

    await userEvent.click(screen.getByRole('button', { name: /Pick a colour/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Clear' }));

    expect(screen.queryByText('#635bff')).toBeNull();
    expect(await loadCards()).toEqual([]);
  });
});

describe('PopupApp — library shortcut', () => {
  it('opens the library page in a new tab', async () => {
    vi.spyOn(window, 'close').mockImplementation(() => {});
    render(<PopupApp />);

    await userEvent.click(screen.getByRole('button', { name: /Open library/ }));

    await waitFor(() =>
      expect(fakeChrome.createdTabs).toEqual(['chrome-extension://stylegrab-test/library.html']),
    );
  });
});
