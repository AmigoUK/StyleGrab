import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LibraryApp } from '@/entrypoints/library/LibraryApp';
import { putThumbnail, getThumbnail } from '@/lib/captureStore';
import { addCard } from '@/lib/storage';
import { makeScan } from '../fixtures';

/**
 * The library is the whole product surface after a capture: it must show an
 * honest empty state, only offer search once there is something to search,
 * filter without losing data, and delete a card together with its thumbnail.
 */

async function seed() {
  const stripe = await addCard(
    makeScan({
      url: 'https://stripe.com/pricing',
      title: 'Stripe — Pricing',
      palette: {
        background: [{ hex: '#0a2540', count: 4 }],
        text: [],
        accent: [{ hex: '#635bff', count: 2 }],
        border: [],
      },
      typography: [
        {
          family: 'Inter',
          stack: 'Inter, sans-serif',
          weights: [400],
          sizes: [16],
          source: 'google',
          count: 3,
        },
      ],
    }),
  );
  const notion = await addCard(makeScan({ url: 'https://notion.so/', title: 'Notion' }), 'clean docs');
  return { stripe, notion };
}

describe('LibraryApp — empty library', () => {
  it('shows the empty state and no search box', async () => {
    render(<LibraryApp />);

    expect(await screen.findByText('Your library is empty.')).toBeTruthy();
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('shows a loading hint before storage answers', () => {
    render(<LibraryApp />);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });
});

describe('LibraryApp — populated library', () => {
  it('lists every capture, newest first, and counts them', async () => {
    await seed();
    render(<LibraryApp />);

    expect(await screen.findByText('2 captures')).toBeTruthy();
    const links = screen.getAllByRole('link', { name: /Stripe|Notion/ });
    expect(links.map((a) => a.textContent)).toEqual(['Notion', 'Stripe — Pricing']);
  });

  it('uses the singular form for one capture', async () => {
    await addCard(makeScan());
    render(<LibraryApp />);
    expect(await screen.findByText('1 capture')).toBeTruthy();
  });

  it('filters by any card field as the user types', async () => {
    await seed();
    render(<LibraryApp />);
    await screen.findByText('2 captures');

    const search = screen.getByRole('searchbox');
    await userEvent.type(search, 'inter');

    await waitFor(() => expect(screen.queryByText('Notion')).toBeNull());
    expect(screen.getByText('Stripe — Pricing')).toBeTruthy();
    // The header count reflects the library, not the filter.
    expect(screen.getByText('2 captures')).toBeTruthy();
  });

  it('explains an empty result instead of looking broken', async () => {
    await seed();
    render(<LibraryApp />);
    await screen.findByText('2 captures');

    await userEvent.type(screen.getByRole('searchbox'), 'zzz');

    expect(await screen.findByText(/No captures match/)).toBeTruthy();
  });

  it('restores the full list when the query is cleared', async () => {
    await seed();
    render(<LibraryApp />);
    await screen.findByText('2 captures');

    const search = screen.getByRole('searchbox');
    await userEvent.type(search, 'inter');
    await waitFor(() => expect(screen.queryByText('Notion')).toBeNull());
    await userEvent.clear(search);

    expect(await screen.findByText('Notion')).toBeTruthy();
  });
});

describe('LibraryApp — delete', () => {
  it('removes the card from the list, from storage and its thumbnail from IndexedDB', async () => {
    const { stripe, notion } = await seed();
    await putThumbnail(stripe.id, new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));
    await putThumbnail(notion.id, new Blob([new Uint8Array([4])], { type: 'image/png' }));

    render(<LibraryApp />);
    await screen.findByText('2 captures');

    // Cards render newest first, so the second Delete button belongs to Stripe.
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[1]);

    await waitFor(() => expect(screen.queryByText('Stripe — Pricing')).toBeNull());
    expect(screen.getByText('Notion')).toBeTruthy();
    expect(await getThumbnail(stripe.id)).toBeUndefined();
    expect(await getThumbnail(notion.id)).toBeInstanceOf(Blob);
  });

  it('falls back to the empty state after the last card is deleted', async () => {
    await addCard(makeScan());
    render(<LibraryApp />);
    await screen.findByText('1 capture');

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Your library is empty.')).toBeTruthy();
    expect(screen.queryByRole('searchbox')).toBeNull();
  });
});
