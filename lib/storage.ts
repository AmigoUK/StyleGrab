import type { ScanResult, StyleCard } from './types';

/**
 * Local library persistence. Card metadata (palette, typography, url, notes)
 * lives in chrome.storage.local; screenshot thumbnails live in IndexedDB
 * (see captureStore.ts). Nothing is ever sent off the machine.
 */

const CARDS_KEY = 'cards';

export function newId(): string {
  return crypto.randomUUID();
}

export async function loadCards(): Promise<StyleCard[]> {
  const stored = await chrome.storage.local.get(CARDS_KEY);
  return (stored[CARDS_KEY] as StyleCard[] | undefined) ?? [];
}

export async function getCard(id: string): Promise<StyleCard | undefined> {
  const cards = await loadCards();
  return cards.find((c) => c.id === id);
}

/** Creates a card from a fresh scan, prepends it to the library, returns it. */
export async function addCard(scan: ScanResult, notes = ''): Promise<StyleCard> {
  const card: StyleCard = { ...scan, id: newId(), createdAt: new Date().toISOString(), notes };
  const cards = await loadCards();
  cards.unshift(card);
  await chrome.storage.local.set({ [CARDS_KEY]: cards });
  return card;
}

/** Applies a partial update to a card by id and persists the library. */
export async function updateCard(id: string, patch: Partial<StyleCard>): Promise<void> {
  const cards = await loadCards();
  const next = cards.map((c) => (c.id === id ? { ...c, ...patch, id: c.id } : c));
  await chrome.storage.local.set({ [CARDS_KEY]: next });
}

export async function removeCard(id: string): Promise<void> {
  const cards = await loadCards();
  await chrome.storage.local.set({ [CARDS_KEY]: cards.filter((c) => c.id !== id) });
}
