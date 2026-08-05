import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CardView } from '@/entrypoints/library/CardView';
import { putThumbnail } from '@/lib/captureStore';
import { getCard, addCard } from '@/lib/storage';
import { richCard } from '../fixtures';
import { fakeChrome } from '../setup';

/**
 * CardView is where a capture becomes code: it renders the palette by role and
 * the typography with its source, and turns the card into any of the four
 * export formats. These tests exercise that seam through the DOM the user
 * actually clicks.
 */

function renderCard(card = richCard, onDelete = vi.fn()) {
  render(<CardView card={card} onDelete={onDelete} />);
  return { onDelete };
}

describe('CardView — capture summary', () => {
  it('groups colours under their role headings', () => {
    renderCard();

    expect(screen.getByText('Backgrounds')).toBeTruthy();
    expect(screen.getByText('Text')).toBeTruthy();
    expect(screen.getByText('Accents')).toBeTruthy();
    expect(screen.getByText('Borders')).toBeTruthy();
    expect(screen.getByText('#0a2540')).toBeTruthy();
    expect(screen.getByText('#635bff')).toBeTruthy();
  });

  it('omits a role heading when that role captured nothing', () => {
    renderCard({ ...richCard, palette: { ...richCard.palette, border: [] } });
    expect(screen.queryByText('Borders')).toBeNull();
  });

  it('labels each font with its identified source', () => {
    renderCard();

    expect(screen.getByText('Inter')).toBeTruthy();
    expect(screen.getByText('Google Fonts')).toBeTruthy();
    expect(screen.getByText('Georgia')).toBeTruthy();
    expect(screen.getByText('System')).toBeTruthy();
    expect(screen.getByText(/weights: 400, 600/)).toBeTruthy();
  });

  it('links out to the captured page', () => {
    renderCard();
    const link = screen.getByRole('link', { name: 'Stripe — Pricing' });
    expect(link.getAttribute('href')).toBe('https://stripe.com/pricing');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('shows a placeholder until a thumbnail exists, then the image', async () => {
    renderCard();
    expect(screen.getByText('no thumbnail')).toBeTruthy();

    await putThumbnail(richCard.id, new Blob([new Uint8Array([1])], { type: 'image/png' }));
    render(<CardView card={richCard} onDelete={vi.fn()} />);

    await waitFor(() => expect(document.querySelector('img')).toBeTruthy());
  });
});

describe('CardView — export', () => {
  it('previews CSS custom properties by default', () => {
    renderCard();

    const preview = document.querySelector('.export-preview') as HTMLTextAreaElement;
    expect(preview.value).toContain(':root {');
    expect(preview.value).toContain('--bg-1: #0a2540;');
    expect(preview.value).toContain('--font-inter: Inter, system-ui, sans-serif;');
  });

  it('re-renders the preview when another format is chosen', async () => {
    renderCard();
    const preview = document.querySelector('.export-preview') as HTMLTextAreaElement;

    await userEvent.selectOptions(screen.getByRole('combobox'), 'tailwind');
    await waitFor(() => expect(preview.value).toContain('module.exports = {'));

    await userEvent.selectOptions(screen.getByRole('combobox'), 'w3c');
    await waitFor(() => expect(JSON.parse(preview.value).color.background['1'].$value).toBe('#0a2540'));

    await userEvent.selectOptions(screen.getByRole('combobox'), 'scss');
    await waitFor(() => expect(preview.value).toContain('$bg-1: #0a2540;'));
  });

  it('offers all six formats', () => {
    renderCard();
    const options = [...screen.getByRole('combobox').querySelectorAll('option')];
    expect(options.map((o) => o.value)).toEqual([
      'css',
      'scss',
      'tailwind',
      'w3c',
      'agent',
      'tokens-studio',
    ]);
  });

  it('copies the current export and confirms it', async () => {
    const writeText = vi.fn(async (_text: string) => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderCard();

    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() => expect(screen.getByRole('button', { name: '✓ Copied' })).toBeTruthy());
    expect(writeText.mock.calls[0][0]).toContain('--bg-1: #0a2540;');
  });

  it('downloads the export under a filename derived from the host', async () => {
    const clicked: HTMLAnchorElement[] = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'a') {
        vi.spyOn(el as HTMLAnchorElement, 'click').mockImplementation(() => {
          clicked.push(el as HTMLAnchorElement);
        });
      }
      return el;
    });
    renderCard();

    await userEvent.selectOptions(screen.getByRole('combobox'), 'tailwind');
    await userEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe('stylegrab-stripe.com.js');
  });

  it('falls back to a safe filename when the card has no parseable URL', async () => {
    const clicked: HTMLAnchorElement[] = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'a') {
        vi.spyOn(el as HTMLAnchorElement, 'click').mockImplementation(() => {
          clicked.push(el as HTMLAnchorElement);
        });
      }
      return el;
    });
    renderCard({ ...richCard, url: '' });

    await userEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(clicked[0].download).toBe('stylegrab-capture.css');
  });

  it('names an eyedropper card after its pseudo-host', async () => {
    const clicked: HTMLAnchorElement[] = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'a') {
        vi.spyOn(el as HTMLAnchorElement, 'click').mockImplementation(() => {
          clicked.push(el as HTMLAnchorElement);
        });
      }
      return el;
    });
    renderCard({ ...richCard, url: 'eyedropper://picks' });

    await userEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(clicked[0].download).toBe('stylegrab-picks.css');
  });
});

describe('CardView — contrast readout', () => {
  it('shows text-on-background pairs with a WCAG verdict', () => {
    renderCard();

    expect(screen.getByText('Contrast')).toBeTruthy();
    // richCard: text #425466 crossed with backgrounds #0a2540 and #ffffff.
    expect(screen.getByText('#425466 on #ffffff')).toBeTruthy();
    expect(screen.getByText('#425466 on #0a2540')).toBeTruthy();
    // Dark slate on white passes AA; the same slate on near-navy fails.
    expect(screen.getAllByText(/^(AAA|AA|AA Large|Fail)$/).length).toBe(2);
    expect(screen.getByText('Fail')).toBeTruthy();
  });

  it('drops the section when a curated palette leaves nothing to compare', async () => {
    renderCard();

    await userEvent.click(screen.getByRole('button', { name: 'Remove text #425466' }));

    expect(screen.queryByText('Contrast')).toBeNull();
  });
});

describe('CardView — palette curation', () => {
  it('removes a swatch and persists the curated palette', async () => {
    const card = await addCard({ ...richCard }, '');
    render(<CardView card={card} onDelete={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove background #ffffff' }));

    expect(screen.queryByText('#ffffff')).toBeNull();
    await waitFor(async () =>
      expect((await getCard(card.id))?.palette.background.map((s) => s.hex)).toEqual(['#0a2540']),
    );
  });

  it('drops a role section entirely when its last swatch is removed', async () => {
    const card = await addCard({ ...richCard }, '');
    render(<CardView card={card} onDelete={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove accent #635bff' }));

    expect(screen.queryByText('Accents')).toBeNull();
  });

  it('feeds the curated palette into the export preview', async () => {
    const card = await addCard({ ...richCard }, '');
    render(<CardView card={card} onDelete={vi.fn()} />);
    const preview = document.querySelector('.export-preview') as HTMLTextAreaElement;
    expect(preview.value).toContain('--bg-2: #ffffff;');

    await userEvent.click(screen.getByRole('button', { name: 'Remove background #ffffff' }));

    await waitFor(() => expect(preview.value).not.toContain('#ffffff'));
    expect(preview.value).toContain('--bg-1: #0a2540;');
  });

  it('splits a perceptual merge back into its member swatches', async () => {
    const card = await addCard(
      {
        ...richCard,
        palette: {
          ...richCard.palette,
          background: [
            { hex: '#ffffff', count: 5, merged: [{ hex: '#fefefe', count: 2 }] },
            { hex: '#0a2540', count: 4 },
          ],
        },
      },
      '',
    );
    render(<CardView card={card} onDelete={vi.fn()} />);
    expect(screen.queryByText('#fefefe')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Split background #ffffff' }));

    // 5 = 3 own + 2 absorbed, so after the split the canonical keeps 3.
    expect(screen.getByText('#fefefe')).toBeTruthy();
    await waitFor(async () =>
      expect((await getCard(card.id))?.palette.background).toEqual([
        { hex: '#0a2540', count: 4 },
        { hex: '#ffffff', count: 3 },
        { hex: '#fefefe', count: 2 },
      ]),
    );
    // The split is gone for good — no dangling split button.
    expect(screen.queryByRole('button', { name: 'Split background #ffffff' })).toBeNull();
  });

  it('shows no split affordance on swatches that merged nothing', () => {
    renderCard();
    expect(screen.queryByRole('button', { name: /^Split / })).toBeNull();
  });
});

describe('CardView — notes and tagging', () => {
  it('persists edited notes when the field loses focus', async () => {
    const card = await addCard({ ...richCard }, '');
    render(<CardView card={card} onDelete={vi.fn()} />);

    const notes = screen.getByPlaceholderText('Your notes about this capture…');
    await userEvent.type(notes, 'reuse the gradient');
    await userEvent.tab();

    await waitFor(async () =>
      expect((await getCard(card.id))?.notes).toBe('reuse the gradient'),
    );
  });

  it('does not write to storage when the notes are unchanged', async () => {
    const card = await addCard({ ...richCard }, 'unchanged');
    const set = vi.spyOn(chrome.storage.local, 'set');
    render(<CardView card={card} onDelete={vi.fn()} />);

    await userEvent.click(screen.getByPlaceholderText('Your notes about this capture…'));
    await userEvent.tab();

    expect(set).not.toHaveBeenCalled();
  });

  it('reveals the picker on demand and saves the chosen tag', async () => {
    const card = await addCard({ ...richCard }, '');
    render(<CardView card={card} onDelete={vi.fn()} />);

    expect(screen.queryByRole('group', { name: 'Tag colour' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Tag/ }));

    await userEvent.click(screen.getByTitle('#3b82f6'));
    await userEvent.click(screen.getByRole('button', { name: '🎨' }));

    await waitFor(async () =>
      expect(await getCard(card.id)).toMatchObject({ color: '#3b82f6', icon: '🎨' }),
    );
    expect(fakeChrome.storage.cards).toBeDefined();
  });

  it('asks its parent to delete, rather than deleting behind its back', async () => {
    const { onDelete } = renderCard();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onDelete).toHaveBeenCalledWith(richCard.id);
  });
});
