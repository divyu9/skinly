import { GUIDES } from "@/content/guides.mjs";
import type { Guide } from "@/lib/guides.mjs";

/**
 * Every guide: the hand-written ones bundled with the page, plus the ones the
 * every-other-day writer published (functions/src/guidesAuto.ts), which the
 * build writes to /data/guides-auto.json. A hand-written guide wins a slug
 * clash. If the file can't be read, the hand-written ones still show.
 */
let pending: Promise<Guide[]> | null = null;

export function loadAutoGuides(): Promise<Guide[]> {
  if (!pending) {
    pending = fetch("/data/guides-auto.json", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : { guides: [] }))
      .then((j) => (Array.isArray(j?.guides) ? (j.guides as Guide[]) : []))
      .catch(() => []);
  }
  return pending;
}

export async function loadAllGuides(): Promise<Guide[]> {
  const auto = await loadAutoGuides();
  const own = new Set(GUIDES.map((g) => g.slug));
  return [...GUIDES, ...auto.filter((g) => !own.has(g.slug))];
}

export const staticGuide = (slug: string) => GUIDES.find((g) => g.slug === slug) || null;
export { GUIDES };
