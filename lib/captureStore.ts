/**
 * IndexedDB store for screenshot thumbnails, keyed by the owning card id.
 * Blobs are too large for chrome.storage, so the card metadata lives there
 * (storage.ts) and the image bytes live here. Both the background service
 * worker (writer) and the library page (reader) run on the extension origin.
 */

const DB_NAME = 'stylegrab';
const STORE = 'thumbnails';
const DB_VERSION = 1;

export interface ThumbnailRecord {
  /** Same id as the owning StyleCard. */
  id: string;
  blob: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putThumbnail(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ id, blob } satisfies ThumbnailRecord);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getThumbnail(id: string): Promise<Blob | undefined> {
  const db = await openDb();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as ThumbnailRecord | undefined)?.blob);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return blob;
}

export async function deleteThumbnail(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
