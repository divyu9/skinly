/**
 * Writes rejected mockups to a folder on the admin's own machine.
 *
 * A browser cannot silently write to an arbitrary path, so the admin picks a
 * folder once and the handle is kept in IndexedDB. Chrome and Edge support
 * this; anywhere else — and any time permission has lapsed — it falls back to
 * an ordinary download, which lands in Downloads rather than nowhere.
 */

const DB_NAME = "skinly-local-backup";
const STORE = "handles";
const KEY = "rejects-dir";

type DirHandle = any; // FileSystemDirectoryHandle; not in the TS lib target here.

export const supportsDirectoryPicker = () =>
  typeof (globalThis as any).showDirectoryPicker === "function";

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readHandle(): Promise<DirHandle | null> {
  try {
    const db = await idb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      tx.onsuccess = () => resolve(tx.result ?? null);
      tx.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function writeHandle(handle: DirHandle | null): Promise<void> {
  try {
    const db = await idb();
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    if (handle) store.put(handle, KEY);
    else store.delete(KEY);
  } catch {
    // A lost handle just means the picker runs again; not worth surfacing.
  }
}

/** Prompts for a folder and remembers it. */
export async function chooseBackupFolder(): Promise<DirHandle | null> {
  if (!supportsDirectoryPicker()) return null;
  const handle = await (globalThis as any).showDirectoryPicker({ mode: "readwrite" });
  await writeHandle(handle);
  return handle;
}

export async function forgetBackupFolder(): Promise<void> {
  await writeHandle(null);
}

/**
 * The stored folder, if it is still usable.
 *
 * Permission does not survive a browser restart, so this re-requests it. When
 * `prompt` is false the request is silent and simply fails, which is what the
 * initial page load wants.
 */
export async function getBackupFolder(prompt = false): Promise<DirHandle | null> {
  const handle = await readHandle();
  if (!handle) return null;
  try {
    const opts = { mode: "readwrite" as const };
    if ((await handle.queryPermission(opts)) === "granted") return handle;
    if (!prompt) return null;
    return (await handle.requestPermission(opts)) === "granted" ? handle : null;
  } catch {
    return null;
  }
}

function download(bytes: Uint8Array, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked late so the download has definitely started.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export interface SaveResult {
  where: "folder" | "downloads";
  name: string;
}

/** Writes into the chosen folder, or falls back to a download. */
export async function saveLocally(
  base64: string,
  filename: string,
  contentType = "image/webp"
): Promise<SaveResult> {
  const binary = atob(base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const dir = await getBackupFolder(true);
  if (dir) {
    try {
      const file = await dir.getFileHandle(filename, { create: true });
      const writable = await file.createWritable();
      await writable.write(bytes);
      await writable.close();
      return { where: "folder", name: filename };
    } catch {
      // Fall through to a download rather than losing the image.
    }
  }
  download(bytes, filename, contentType);
  return { where: "downloads", name: filename };
}
