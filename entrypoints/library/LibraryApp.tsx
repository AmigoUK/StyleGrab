import { useEffect, useMemo, useState } from 'preact/hooks';
import { AppFooter } from '@/components/AppFooter';
import { AppVersion } from '@/components/AppVersion';
import { deleteThumbnail } from '@/lib/captureStore';
import { filterCards } from '@/lib/search';
import { loadCards, removeCard } from '@/lib/storage';
import type { StyleCard } from '@/lib/types';
import { CardView } from './CardView';

export function LibraryApp() {
  const [cards, setCards] = useState<StyleCard[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void loadCards().then(setCards);
  }, []);

  const onDelete = async (id: string) => {
    await removeCard(id);
    await deleteThumbnail(id);
    setCards((prev) => (prev ? prev.filter((c) => c.id !== id) : prev));
  };

  const filtered = useMemo(() => (cards ? filterCards(cards, query) : []), [cards, query]);

  return (
    <div style="max-width: 860px; margin: 0 auto; padding: 24px 16px; min-height: 100vh; display: flex; flex-direction: column;">
      <header class="row" style="margin-bottom: 20px;">
        <h1 style="margin: 0;">
          StyleGrab Library
          <AppVersion />
        </h1>
        <span class="hint" style="flex: 0 0 auto;">
          {cards ? `${cards.length} capture${cards.length === 1 ? '' : 's'}` : ''}
        </span>
      </header>

      {cards !== null && cards.length > 0 && (
        <input
          type="search"
          placeholder="Search by URL, colour hex, font family, notes…"
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
          style="margin-bottom: 16px;"
        />
      )}

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

        {cards !== null && cards.length > 0 && filtered.length === 0 && (
          <p class="hint">No captures match “{query}”.</p>
        )}

        {filtered.map((card) => (
          <CardView key={card.id} card={card} onDelete={onDelete} />
        ))}
      </main>

      <AppFooter />
    </div>
  );
}
