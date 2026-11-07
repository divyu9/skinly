/**
 * "Do you mean this one?" — the models we already list that a customer's
 * request names.
 *
 * A request form used to take "Vivo | Vivo y1s" or "Vivo | V80" and send the
 * customer away to wait, though the site listed "Y1S" and "V80 5G" all along:
 * the admin saw "Already on site" the next evening, by which time the customer
 * had bought elsewhere. The same rules the admin's tags use
 * (functions/src/modelRequestsAdmin.ts) now run in the form, so the customer
 * is shown their phone while they are still here.
 *
 *  - exact:    the same model once the brand written in front, family words
 *              (Galaxy, Moto, Pixel, iPhone), spaces and punctuation are set aside.
 *  - possible: the same except for a 4G / 5G suffix.
 *  - similar:  one name contains the other.
 */

export type MatchLevel = "exact" | "possible" | "similar";

const sq = (s: unknown) => String(s || "").toLowerCase().replace(/\+/g, "plus").replace(/[^a-z0-9]/g, "");

// Brands sold under one another's names: a "Redmi" request finds Xiaomi's "Redmi Note 14".
const GROUPS = [["xiaomi", "redmi", "poco", "mi"], ["vivo", "iqoo"], ["oneplus", "oneplusnord"]];
const FAMILY: Record<string, string[]> = {
  samsung: ["galaxy"], motorola: ["moto"], google: ["pixel"], apple: ["iphone"], oneplus: ["one plus"],
};

export function sameBrand(a: unknown, b: unknown): boolean {
  const x = sq(a), y = sq(b);
  if (!x || !y || x === y) return true;
  return GROUPS.some((g) => g.includes(x) && g.includes(y));
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The model's name with the brand, family words and punctuation set aside. */
function core(brand: string, text: string, dropNetwork: boolean): string {
  let t = ` ${String(text || "").toLowerCase().replace(/\+/g, " plus ").replace(/[()\-_/,.|]/g, " ")} `;
  if (dropNetwork) t = t.replace(/\s[45]g\s/g, " ");
  const b = String(brand || "").toLowerCase().trim();
  for (const w of [b, ...(FAMILY[sq(b)] || [])]) {
    if (w) t = t.replace(new RegExp(`\\s${escape(w)}(?=\\s)`, "g"), " ");
  }
  return t.replace(/\s+/g, "");
}

export type ModelRow = { _id?: string; brandName?: string; modelName?: string; category?: string };

/**
 * How surely a listed model is the one asked for, or null. `reqBrand` may be
 * empty (a new brand typed, or none yet): then the brand is looked for in the
 * model text instead.
 */
export function matchLevel(m: ModelRow, reqBrand: string, reqModel: string): MatchLevel | null {
  const brand = String(m.brandName || ""), name = String(m.modelName || "");
  if (!name || !reqModel.trim()) return null;
  if (reqBrand && !sameBrand(reqBrand, brand)) return null;
  // No brand given: a bare "15" would meet every brand's 15.
  if (!reqBrand && core(brand, reqModel, true).length < 3) return null;
  // Read the request both as typed and with its brand in front, so
  // "Redmi | Note 14" meets Xiaomi's "Redmi Note 14" and "Vivo | Vivo Y1s" meets "Y1S".
  const asked = [reqModel, `${reqBrand} ${reqModel}`];
  const listed = core(brand, name, false);
  if (asked.some((a) => core(brand, a, false) === listed)) return "exact";
  const listedLoose = core(brand, name, true);
  if (asked.some((a) => core(brand, a, true) === listedLoose)) return "possible";
  const want = core(brand, reqModel, true);
  if (want.length >= 3 && reqBrand && (listedLoose.includes(want) || (listedLoose.length >= 3 && want.includes(listedLoose)))) return "similar";
  return null;
}

const RANK: Record<MatchLevel, number> = { exact: 0, possible: 1, similar: 2 };

/** The listed models a request names, surest first. */
export function suggestModels<T extends ModelRow>(rows: T[], reqBrand: string, reqModel: string, category?: string, limit = 5) {
  const out: Array<T & { level: MatchLevel }> = [];
  for (const m of rows) {
    if (category && m.category && m.category !== category) continue;
    const level = matchLevel(m, reqBrand, reqModel);
    if (level) out.push({ ...m, level });
  }
  return out
    .sort((a, b) => RANK[a.level] - RANK[b.level] || String(a.modelName).length - String(b.modelName).length)
    .slice(0, limit);
}
