import { useEffect, useState } from 'preact/hooks';
import { AppVersion } from '@/components/AppVersion';
import { isEyeDropperSupported, pickColor } from '@/lib/eyedropper';
import { isRestrictedUrl, sendToBackground } from '@/lib/messages';
import { addCard } from '@/lib/storage';
import { emptyPalette } from '@/lib/types';

export function PopupApp() {
  const [restricted, setRestricted] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picks, setPicks] = useState<string[]>([]);
  const eyedropper = isEyeDropperSupported();

  useEffect(() => {
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => setRestricted(isRestrictedUrl(tab?.url)));
  }, []);

  const capture = async () => {
    setBusy(true);
    setHint(null);
    try {
      const res = await sendToBackground({ type: 'capture' });
      if (res.error) {
        const messages: Record<string, string> = {
          restricted: "This page can't be scanned.",
          'scan-failed': 'Nothing to scan on this page.',
        };
        setHint(messages[res.error] ?? `Could not capture: ${res.error}`);
        return;
      }
      window.close(); // background opens the library on the new card
    } finally {
      setBusy(false);
    }
  };

  const pick = async () => {
    const hex = await pickColor();
    if (hex) setPicks((prev) => (prev.includes(hex) ? prev : [...prev, hex]));
  };

  const savePicks = async () => {
    if (!picks.length) return;
    const palette = emptyPalette();
    palette.accent = picks.map((hex) => ({ hex, count: 1 }));
    await addCard({ url: 'eyedropper://picks', title: 'Eyedropper picks', palette, typography: [] });
    await chrome.tabs.create({ url: chrome.runtime.getURL('/library.html') });
    window.close();
  };

  const openLibrary = () => {
    void chrome.tabs.create({ url: chrome.runtime.getURL('/library.html') });
    window.close();
  };

  return (
    <div style="width: 320px; padding: 12px;">
      <div class="row" style="margin-bottom: 10px;">
        <strong style="font-size: 15px;">
          StyleGrab
          <AppVersion />
        </strong>
      </div>

      <p class="hint" style="margin: 0 0 12px;">
        Capture a page's colour palette and typography, then export them as code.
      </p>

      {restricted && (
        <div class="hint" style="margin-bottom: 8px;">
          This page can't be scanned (browser or store page).
        </div>
      )}

      <div style="display: grid; gap: 6px;">
        <button class="primary" disabled={restricted || busy} onClick={capture}>
          {busy ? '⏳ Capturing…' : '🎨 Capture this page'}
        </button>
        <button disabled={!eyedropper} onClick={pick} title={eyedropper ? '' : 'EyeDropper API unavailable'}>
          💧 Pick a colour
        </button>
        <button onClick={openLibrary}>📚 Open library</button>
      </div>

      {picks.length > 0 && (
        <div style="margin-top: 12px;">
          <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
            {picks.map((hex) => (
              <div key={hex} class="swatch" title={hex}>
                <span class="swatch-chip" style={`background:${hex}`} />
                <span class="swatch-hex">{hex}</span>
              </div>
            ))}
          </div>
          <div class="row" style="gap: 8px;">
            <button class="primary" style="flex: 0 0 auto;" onClick={savePicks}>
              Save {picks.length} to library
            </button>
            <button style="flex: 0 0 auto;" onClick={() => setPicks([])}>
              Clear
            </button>
          </div>
        </div>
      )}

      {hint && (
        <div class="hint" style="margin-top: 10px;">
          {hint}
        </div>
      )}

      <div class="app-footer" style="margin-top: 16px;">
        <a href="https://www.attv.uk" target="_blank" rel="noreferrer">
          attv.uk
        </a>
        <span class="sep">·</span>
        <a href="https://github.com/AmigoUK/StyleGrab" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </div>
    </div>
  );
}
