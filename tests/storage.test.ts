import { describe, expect, it } from 'vitest';
import { addCard, getCard, loadCards, newId, removeCard, updateCard } from '../lib/storage';
import { fakeChrome } from './setup';
import { makeScan } from './fixtures';

describe('loadCards', () => {
  it('returns an empty library before anything is captured', async () => {
    expect(await loadCards()).toEqual([]);
  });

  it('reads back what was written under the `cards` key', async () => {
    await addCard(makeScan({ url: 'https://a.test/' }));
    expect(Object.keys(fakeChrome.storage)).toEqual(['cards']);
    expect(await loadCards()).toHaveLength(1);
  });
});

describe('addCard', () => {
  it('stamps an id and createdAt, and defaults notes to empty', async () => {
    const card = await addCard(makeScan({ title: 'Example' }));
    expect(card.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isNaN(Date.parse(card.createdAt))).toBe(false);
    expect(card.notes).toBe('');
    expect(card.title).toBe('Example');
  });

  it('keeps the notes it is given', async () => {
    const card = await addCard(makeScan(), 'from the eyedropper');
    expect(card.notes).toBe('from the eyedropper');
  });

  it('prepends, so the newest capture is first in the library', async () => {
    await addCard(makeScan({ url: 'https://first.test/' }));
    await addCard(makeScan({ url: 'https://second.test/' }));
    expect((await loadCards()).map((c) => c.url)).toEqual([
      'https://second.test/',
      'https://first.test/',
    ]);
  });
});

describe('updateCard', () => {
  it('applies a partial patch to the addressed card only', async () => {
    const a = await addCard(makeScan({ url: 'https://a.test/' }));
    const b = await addCard(makeScan({ url: 'https://b.test/' }));

    await updateCard(a.id, { notes: 'patched', color: '#635bff', icon: '🎨' });

    expect(await getCard(a.id)).toMatchObject({ notes: 'patched', color: '#635bff', icon: '🎨' });
    expect(await getCard(b.id)).toMatchObject({ notes: '' });
  });

  it('refuses to let a patch overwrite the id', async () => {
    const card = await addCard(makeScan());
    await updateCard(card.id, { id: 'hijacked' } as never);
    expect((await loadCards()).map((c) => c.id)).toEqual([card.id]);
  });

  it('is a no-op for an unknown id', async () => {
    const card = await addCard(makeScan());
    await updateCard('does-not-exist', { notes: 'nope' });
    expect(await getCard(card.id)).toMatchObject({ notes: '' });
  });
});

describe('removeCard', () => {
  it('drops just the addressed card', async () => {
    const a = await addCard(makeScan({ url: 'https://a.test/' }));
    const b = await addCard(makeScan({ url: 'https://b.test/' }));

    await removeCard(a.id);

    expect((await loadCards()).map((c) => c.id)).toEqual([b.id]);
  });

  it('leaves the library untouched for an unknown id', async () => {
    await addCard(makeScan());
    await removeCard('does-not-exist');
    expect(await loadCards()).toHaveLength(1);
  });
});

describe('getCard', () => {
  it('resolves to undefined when the id is not in the library', async () => {
    expect(await getCard('missing')).toBeUndefined();
  });
});

describe('newId', () => {
  it('produces distinct uuids', () => {
    expect(newId()).not.toBe(newId());
  });
});
