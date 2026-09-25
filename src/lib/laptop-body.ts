/**
 * Which laptops share a body.
 *
 * A skin only cares about the shell, and makers give one shell many model
 * numbers — one per processor, RAM or storage. HP's 15s-fq1107TU and
 * 15s-fq5111TU, Lenovo's IdeaPad 3 15ITL6 (Intel) and 15ALC6 (AMD), Asus's
 * X515JA / X515EA / X515MA are each the same laptop to a skin. A shopper types
 * the number on their sticker, the catalogue lists a sibling, and they leave
 * thinking we don't cut theirs.
 *
 * Each rule pulls out the part of a model number that names the shell:
 *   HP      size + two-letter family:   "15s-fq5111TU"  -> hp|15s-fq
 *   Lenovo  series + size + generation: "IdeaPad 3 15ALC6" -> lenovo|ideapad 3|15|g6
 *   Asus    the letters and digits before the variant letters: "X515EA" -> asus|x515
 *   Dell    the regulatory P-code, shared by every model on one chassis: "P112F"
 *   Acer    family + generation:        "A515-57"       -> acer|a515-57
 * Worked out against the 1,485 laptops on the site (Sep 2026).
 */

const SERIES = /(pavilion|envy|victus|omen|elitebook|probook|spectre|chromebook|notebook|ideapad(?: slim| gaming| flex)?(?: \d)?|thinkpad|thinkbook|legion|yoga|loq|vivobook(?: pro| go| s)?(?: \d{2})?|zenbook|tuf|rog|expertbook|inspiron|vostro|latitude|xps|precision|alienware|aspire|nitro|swift|predator|galaxy book\s?\d?|macbook (?:air|pro))/;

export function laptopBodyKeys(brand: string, model: string): string[] {
  const b = brand.toLowerCase().trim();
  const t = ` ${model.toLowerCase().replace(/_/g, " ")} `;
  const series = SERIES.exec(t)?.[1] || "";
  const keys = new Set<string>();
  if (b === "dell") {
    for (const m of t.matchAll(/\bp\d{2,3}[a-z]\b/g)) keys.add(`dell|${m[0]}`);
  }
  if (b === "hp") {
    for (const m of t.matchAll(/\b(1[3-7][st]?)[\s-]?([a-z]{2})\d{3,4}[a-z]{0,3}\b/g)) keys.add(`hp|${series}|${m[1]}-${m[2]}`);
  }
  if (b === "lenovo") {
    for (const m of t.matchAll(/\b(1[3-7])[a-z]{2,4}0?(\d)\b/g)) keys.add(`lenovo|${series}|${m[1]}|g${m[2]}`);
  }
  if (b === "asus") {
    for (const m of t.matchAll(/\b([a-z]{1,3}\d{3,4})[a-z]{0,3}\b/g)) {
      if (!/^(19|20)\d{2}$/.test(m[1])) keys.add(`asus|${m[1]}`);
    }
  }
  if (b === "acer") {
    for (const m of t.matchAll(/\b([a-z]{1,3}\d{3})[\s-](\d{2})\b/g)) keys.add(`acer|${m[1]}-${m[2]}`);
  }
  return [...keys];
}

/** Lower case, letters and digits only: "15S FQ1107TU" and "15s-fq1107tu" alike. */
export const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The models a search matches, and which of them match only by body.
 *
 * A model matches when every word of the query is in its name, or the query
 * with spaces and hyphens gone is inside the name with spaces and hyphens gone
 * ("15s fq" finds "15S FQ1107TU"). For laptops, a model also matches when it
 * shares a body with what was typed — those are returned in `sameBody` so the
 * list can say why they're there.
 */
export function searchModels(brand: string, models: string[], query: string, category: string): { models: string[]; sameBody: Set<string> } {
  const q = query.trim().toLowerCase();
  if (!q) return { models, sameBody: new Set() };
  const terms = q.split(/\s+/).filter(Boolean);
  const sq = squash(q);
  const direct = models.filter((m) => {
    const ml = m.toLowerCase();
    return terms.every((t) => ml.includes(t)) || (sq.length >= 3 && squash(m).includes(sq));
  });
  const sameBody = new Set<string>();
  if (category === "laptop") {
    const want = new Set(laptopBodyKeys(brand, query));
    if (want.size) {
      for (const m of models) {
        if (direct.includes(m)) continue;
        if (laptopBodyKeys(brand, m).some((k) => want.has(k))) sameBody.add(m);
      }
    }
  }
  return { models: [...direct, ...[...sameBody].sort()], sameBody };
}

/** Where each maker prints the model number a shopper should type. */
export const STICKER_HINT: Record<string, string> = {
  hp: "On the sticker under the laptop, next to “Product” or “Model”, e.g. 15s-fq5111TU.",
  lenovo: "Under the laptop: the line with the machine type, e.g. IdeaPad 3 15ALC6 or 82KU.",
  asus: "Under the laptop, “Model:”, e.g. X515EA — the letters after the number don't matter.",
  dell: "Under the laptop, the regulatory model, e.g. P112F — every Dell with the same P-code has the same body.",
  acer: "Under the laptop, “Model No.”, e.g. A515-57 or N20C5.",
};
