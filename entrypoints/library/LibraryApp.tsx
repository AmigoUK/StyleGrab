import { useEffect, useState } from 'preact/hooks';
import { AppFooter } from '@/components/AppFooter';
import { AppVersion } from '@/components/AppVersion';
import { loadCards } from '@/lib/storage';
import type { StyleCard } from '@/lib/types';

export function LibraryApp() {
  const [cards, setCards] = useState<StyleCard[] | null>(null);

  useEffect(() => {
    void loadCards().then(setCards);
  }, []);

  return (
    <div style="max-width: 960px; margin: 0 auto; padding: 24px 16px; min-height: 100vh; display: flex; flex-direction: column;">
      <header class="row" style="margin-bottom: 20px;">
        <h1 style="margin: 0;">
          StyleGrab Library
          <AppVersion />
        </h1>
      </header>

      <main style="flex: 1;">
        {cards === null && <p class="hint">Loading…</p>}

        {cards !== null && cards.length === 0 && (
          <div class="card" style="text-align: center; padding: 40px 20px;">
            <p style="margin: 0 0 6px; font-size: 15px;">Your library is empty.</p>
            <p class="hint" style="margin: 0;">
              Open StyleGrab on any page and hit <strong>Capture</strong> to save its
              palette and typography here.
            </p>
          </div>
        )}

        {cards !== null && cards.length > 0 && (
          <div class="hint">{cards.length} capture(s) — card view arrives in v0.1.</div>
        )}
      </main>

      <AppFooter />
    </div>
  );
}
