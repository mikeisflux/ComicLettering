/* Artwork store for the local autosave.

   A 140-page book of 30–40MB scans is several gigabytes of artwork, and it all
   lives on the reader's own machine. Two things make that workable:

   * Artwork is kept as Blobs, not base64 data URLs. Base64 inflates by a third
     AND lands in the JavaScript heap — a few hundred megabytes of it will take
     the tab down. A Blob is backed by disk and costs almost nothing until it is
     decoded, and `URL.createObjectURL` hands back a plain string that <img> and
     canvas accept exactly like a data URL.
   * Nothing is read up front. Boot reads the id list only; pages materialise
     their own artwork as the reader arrives at them.

   localStorage is nowhere near this scale (~5MB total), which is why a single
   dropped photo used to wipe the artwork out of the autosave entirely. */

const DB_NAME = "lettermycomic";
const STORE = "art";
const VERSION = 2;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") { resolve(null); return; }
    let req: IDBOpenDBRequest;
    try { req = indexedDB.open(DB_NAME, VERSION); } catch { resolve(null); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      /* v1 kept data-URL strings under "assets"; the blob store replaces it */
      if (db.objectStoreNames.contains("assets")) db.deleteObjectStore("assets");
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    /* private browsing and locked-down profiles can refuse outright */
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function store(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function wrap<T>(run: (s: IDBObjectStore) => IDBRequest<T>, fallback: T): Promise<T> {
  return openDb().then((db) => {
    if (!db) return fallback;
    return new Promise<T>((resolve) => {
      let req: IDBRequest<T>;
      try { req = run(store(db, "readonly")); } catch { resolve(fallback); return; }
      req.onsuccess = () => resolve(req.result ?? fallback);
      req.onerror = () => resolve(fallback);
    });
  });
}

export async function putArt(id: string, blob: Blob): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    let s: IDBObjectStore;
    try { s = store(db, "readwrite"); } catch { resolve(false); return; }
    s.transaction.oncomplete = () => resolve(true);
    /* the usual failure here is the origin running out of its storage
       allowance — the caller surfaces that rather than failing silently */
    s.transaction.onerror = () => resolve(false);
    s.transaction.onabort = () => resolve(false);
    s.put(blob, id);
  });
}

export function getArt(id: string): Promise<Blob | null> {
  return wrap<Blob | null>((s) => s.get(id) as IDBRequest<Blob | null>, null);
}

export function listArtIds(): Promise<string[]> {
  return wrap<string[]>((s) => s.getAllKeys() as unknown as IDBRequest<string[]>, [])
    .then((keys) => keys.map(String));
}

export async function deleteArt(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    let s: IDBObjectStore;
    try { s = store(db, "readwrite"); } catch { resolve(); return; }
    s.transaction.oncomplete = () => resolve();
    s.transaction.onerror = () => resolve();
    for (const id of ids) s.delete(id);
  });
}

export async function clearArt(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const s = store(db, "readwrite");
      s.transaction.oncomplete = () => resolve();
      s.transaction.onerror = () => resolve();
      s.clear();
    } catch { resolve(); }
  });
}

/* Ask the browser to stop treating this origin's storage as evictable. Without
   it a large book can be cleared out from under the user when the disk fills. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch { return false; }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e) return null;
    return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
  } catch { return null; }
}

export const fmtBytes = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${Math.round(n / 1e6)} MB` : `${Math.round(n / 1e3)} KB`;

/* ---- object-URL lifecycle ----
   assetsRef holds URL strings, so blob: URLs drop straight into every existing
   <img src> and canvas path. They have to be revoked by hand, though, or the
   backing blobs are pinned for the life of the tab. */

const urls = new Map<string, string>();
/* which blob each live URL was made from, so a reused id cannot serve stale art */
const held = new Map<string, Blob>();

/* Every id this browser has artwork stored under, including ids belonging to
   other projects. New ids are allocated around this set — without it, opening
   a second book can hand out an id the first book is already using and
   overwrite its artwork on save. */
const knownIds = new Set<string>();
export const noteArtId = (id: string) => { knownIds.add(id); };
export const artIdTaken = (id: string) => knownIds.has(id);
export async function primeArtIds(): Promise<number> {
  for (const id of await listArtIds()) knownIds.add(id);
  return knownIds.size;
}

export function artUrl(id: string): string | undefined {
  return urls.get(id);
}

export function holdArt(id: string, blob: Blob): string {
  const existing = urls.get(id);
  /* Only reuse the URL when it is a URL for THIS blob. Returning the cached
     one for a different blob is how a freshly imported page came up showing
     some other page's artwork: the new bytes went into the store, but the
     caller got handed the old page's object URL. */
  if (existing && held.get(id) === blob) return existing;
  if (existing) URL.revokeObjectURL(existing);
  const url = URL.createObjectURL(blob);
  held.set(id, blob);
  urls.set(id, url);
  return url;
}

export function releaseArt(ids: Iterable<string>) {
  for (const id of ids) {
    const url = urls.get(id);
    if (url) { URL.revokeObjectURL(url); urls.delete(id); held.delete(id); }
  }
}

export function releaseAllArt() {
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
  held.clear();
}

/** Materialise the artwork these ids need. Returns the ids newly made available. */
export async function ensureArt(ids: string[]): Promise<string[]> {
  const want = [...new Set(ids)].filter((id) => id && !urls.has(id));
  if (!want.length) return [];
  const got: string[] = [];
  for (const id of want) {
    const blob = await getArt(id);
    if (blob) { holdArt(id, blob); got.push(id); }
  }
  return got;
}
