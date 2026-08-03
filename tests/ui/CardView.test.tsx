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

  it('offers all four formats', () => {
    renderCard();
    const options = [...screen.getByRole('combobox').querySelectorAll('option')];
    expect(options.map((o) => o.value)).toEqual(['css', 'scss', 'tailwind', 'w3c']);
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
