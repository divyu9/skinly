/**
 * Each phone's own landing page, written by the build (scripts/prerender.mjs):
 * dist/data/model-pages.json = { pages: { "Brand|Model": slug }, buyBox: ["Brand|Model", ...] }.
 * Fetched only when needed (a model chosen in search, or "change model" in a
 * buy box), and once per visit.
 */
type ModelPages = { pages: Record<string, string>; buyBox: Set<string> };
let pending: Promise<ModelPages> | null = null;

export function loadModelPages(): Promise<ModelPages> {
  if (!pending) {
    pending = fetch("/data/model-pages.json", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d: any) => ({
        pages: (d && typeof d.pages === "object" && d.pages) || {},
        buyBox: new Set<string>(Array.isArray(d?.buyBox) ? d.buyBox : []),
      }));
  }
  return pending;
}
