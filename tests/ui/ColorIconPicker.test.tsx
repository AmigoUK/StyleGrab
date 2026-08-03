import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ColorIconPicker } from '@/components/ColorIconPicker';

/**
 * The project convention is that a colour/icon is always *picked*, never typed.
 * These tests lock that in: the picker must expose clickable options, mark the
 * current one, and toggle it off on a second click.
 */

function colorButtons() {
  return screen.getByRole('group', { name: 'Tag colour' }).querySelectorAll('button');
}

describe('ColorIconPicker', () => {
  it('offers clickable swatches and emoji — never a text field', () => {
    render(<ColorIconPicker onChange={() => {}} />);

    expect(colorButtons().length).toBeGreaterThan(8);
    expect(screen.getByRole('button', { name: '🎨' })).toBeTruthy();
    expect(document.querySelector('input[type="text"]')).toBeNull();
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('reports the picked colour', async () => {
    const onChange = vi.fn();
    render(<ColorIconPicker onChange={onChange} />);

    await userEvent.click(screen.getByTitle('#3b82f6'));

    expect(onChange).toHaveBeenCalledWith({ color: '#3b82f6' });
  });

  it('reports the picked icon', async () => {
    const onChange = vi.fn();
    render(<ColorIconPicker onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: '⭐' }));

    expect(onChange).toHaveBeenCalledWith({ icon: '⭐' });
  });

  it('marks the current selection as pressed', () => {
    render(<ColorIconPicker color="#3b82f6" icon="⭐" onChange={() => {}} />);

    expect(screen.getByTitle('#3b82f6').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTitle('#ef4444').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: '⭐' }).className).toContain('selected');
  });

  it('clears the value when the selected option is clicked again', async () => {
    const onChange = vi.fn();
    render(<ColorIconPicker color="#3b82f6" icon="⭐" onChange={onChange} />);

    await userEvent.click(screen.getByTitle('#3b82f6'));
    expect(onChange).toHaveBeenCalledWith({ color: undefined });

    await userEvent.click(screen.getByRole('button', { name: '⭐' }));
    expect(onChange).toHaveBeenCalledWith({ icon: undefined });
  });

  it('offers only distinct options', () => {
    render(<ColorIconPicker onChange={() => {}} />);

    const colors = [...colorButtons()].map((b) => b.getAttribute('title'));
    expect(new Set(colors).size).toBe(colors.length);
  });
});
