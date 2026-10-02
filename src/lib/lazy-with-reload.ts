import { lazy, type ComponentType } from "react";

const FLAG_PREFIX = "chunk-reload:";

function readFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(FLAG_PREFIX + key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    if (on) sessionStorage.setItem(FLAG_PREFIX + key, "1");
    else sessionStorage.removeItem(FLAG_PREFIX + key);
  } catch {
    // Private mode or storage disabled. Without the flag the worst case is a
    // second reload rather than a loop, because a reload fetches a fresh
    // index.html and that one asks for a filename that exists.
  }
}

/**
 * Reload into the current build, once per key per tab. The page itself is
 * cached at the edge for a couple of minutes after a deploy, so a plain reload
 * could get the same old HTML again; a query string the edge has not seen
 * fetches the new one (index.html removes `_v` from the address afterwards).
 * Returns false when this key already reloaded, so the caller shows its error.
 */
export function reloadForFreshBuild(key: string): boolean {
  if (readFlag(key)) return false;
  writeFlag(key, true);
  const u = new URL(window.location.href);
  u.searchParams.set("_v", String(Date.now()));
  window.location.replace(u.toString());
  return true;
}

/** Clears reloadForFreshBuild's flag once the thing it was for has loaded. */
export function freshBuildLoaded(key: string): void {
  if (readFlag(key)) writeFlag(key, false);
}

/**
 * `lazy()` that survives a deploy happening under an open tab.
 *
 * Every build gives its chunks new content-hashed names and the old ones stop
 * existing. A tab opened before a deploy still holds the previous index.html,
 * so the first route it lazily loads asks for a filename that is gone — and the
 * host answers with the SPA fallback, handing the browser `text/html` where it
 * expected a module. The import rejects, React unmounts the tree, and the user
 * gets a white screen with nothing in the UI to explain it. Reloading fixes it,
 * but only if you know to.
 *
 * So: one retry in case the request was merely dropped, then a single reload to
 * pick up the new index.html. The route is preserved, so the user lands on the
 * page they were opening.
 *
 * The flag is cleared on a *successful* load rather than on mount. Clearing it
 * when the app mounts would be a loop: the reloaded page mounts before the
 * import it is retrying has had time to fail, so the flag would be gone again
 * by the time the second failure read it, and a chunk that is genuinely broken
 * would reload for ever.
 */
export function lazyWithReload<T extends ComponentType<any>>(
  load: () => Promise<{ default: T }>,
  key: string
) {
  return lazy(async () => {
    try {
      const mod = await load();
      // This chunk is current again, so spend nothing on it next time.
      if (readFlag(key)) writeFlag(key, false);
      return mod;
    } catch (error) {
      try {
        const mod = await load();
        if (readFlag(key)) writeFlag(key, false);
        return mod;
      } catch {
        if (!reloadForFreshBuild(key)) throw error;  // Already reloaded for this one.
        // Never resolves; the reload is already under way.
        return await new Promise<{ default: T }>(() => {});
      }
    }
  });
}
