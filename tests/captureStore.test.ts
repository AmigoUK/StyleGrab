import { describe, expect, it } from 'vitest';
import { deleteThumbnail, getThumbnail, putThumbnail } from '../lib/captureStore';

const png = () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });

async function bytes(blob: Blob): Promise<number[]> {
  return [...new Uint8Array(await blob.arrayBuffer())];
}

describe('captureStore', () => {
  it('round-trips a thumbnail blob by card id', async () => {
    await putThumbnail('card-1', png());

    const stored = await getThumbnail('card-1');
    expect(stored).toBeInstanceOf(Blob);
    expect(stored!.type).toBe('image/png');
    expect(await bytes(stored!)).toEqual([137, 80, 78, 71]);
  });

  it('resolves to undefined for a card that has no thumbnail', async () => {
    expect(await getThumbnail('never-captured')).toBeUndefined();
  });

  it('overwrites on a repeat put for the same id', async () => {
    await putThumbnail('card-1', png());
    await putThumbnail('card-1', new Blob([new Uint8Array([1, 2])], { type: 'image/png' }));

    expect(await bytes((await getThumbnail('card-1'))!)).toEqual([1, 2]);
  });

  it('keeps thumbnails of different cards apart', async () => {
    await putThumbnail('a', new Blob([new Uint8Array([1])]));
    await putThumbnail('b', new Blob([new Uint8Array([2])]));

    expect(await bytes((await getThumbnail('a'))!)).toEqual([1]);
    expect(await bytes((await getThumbnail('b'))!)).toEqual([2]);
  });

  it('deletes a thumbnail without touching the others', async () => {
    await putThumbnail('a', png());
    await putThumbnail('b', png());

    await deleteThumbnail('a');

    expect(await getThumbnail('a')).toBeUndefined();
    expect(await getThumbnail('b')).toBeInstanceOf(Blob);
  });

  it('tolerates deleting a thumbnail that was never stored', async () => {
    await expect(deleteThumbnail('ghost')).resolves.toBeUndefined();
  });

  it('reopens the database on every call rather than holding a connection', async () => {
    // The library page and the service worker both touch the store; each helper
    // must open and close its own connection or a version change would block.
    await putThumbnail('a', png());
    await getThumbnail('a');
    await deleteThumbnail('a');
    await expect(putThumbnail('a', png())).resolves.toBeUndefined();
  });
});
