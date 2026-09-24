/**
 * Matching for the header search and "Find your device".
 *
 * Each word of the query used to be looked for, as typed, inside the model's
 * name. People do not type model names the way brands print them: "s24fe"
 * found nothing while "s24 fe" found the Galaxy S24 FE, and customers asked
 * for models that were already on sale because the search told them no. The
 * rules now:
 *
 *  - spacing and punctuation do not count: s24fe = s24 fe = S24-FE, and
 *    "iphone15promax" finds the iPhone 15 Pro Max — but each word must start
 *    where a word or number of the name starts, so "neo" does not match
 *    "Canon EOS";
 *  - words like 5G, phone or skin are dropped if keeping them finds nothing,
 *    so "motorola g32 5g" still finds the G32;
 *  - "+" reads as "plus", both ways: "s24+" finds the S24 Plus and the S24+;
 *  - words still match in any order ("fe s24", "samsung s24fe");
 *  - if nothing matches exactly, one wrong, missing or extra letter per word is
 *    forgiven (samsng, galxy), for words of four letters or more;
 *  - the closest names come first: the exact model, then models starting with
 *    the query, then the rest, shortest first.
 */

/** Lowercase letters and digits only, with "+" spelled out. */
export const compact = (s: unknown): string =>
  String(s ?? "").toLowerCase().replace(/\+/g, "plus").replace(/[^a-z0-9]/g, "");

/** The query as words, each compacted; "s24+" is ["s24", "plus"]. */
export const searchWords = (q: unknown): string[] =>
  String(q ?? "")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .split(/[\s,/|]+/)
    .map(compact)
    .filter(Boolean);

/**
 * Where a word may begin inside a name: the start of each word, and each
 * point where letters meet digits. "Galaxy S24 FE" has starts at galaxy, s,
 * 24 and fe. Matching only from these keeps "neo" out of "Canon EOS", which
 * spells c-a-n-o-n-e-o-s once the spaces are gone.
 */
function starts(haystack: string): string[] {
  const s = String(haystack ?? "").toLowerCase().replace(/\+/g, " plus ");
  const out: string[] = [];
  const re = /[a-z]+|\d+/g;
  const flat = compact(s);
  let m: RegExpExecArray | null;
  // Walk the compacted string alongside the tokens to know each token's offset.
  let offset = 0;
  while ((m = re.exec(s))) {
    const at = flat.indexOf(m[0], offset);
    if (at < 0) continue;
    out.push(flat.slice(at));
    offset = at + m[0].length;
  }
  return out;
}

const hasFrom = (tails: string[], w: string) => tails.some((t) => t.startsWith(w));

/** True when every word starts somewhere in the name, spacing and punctuation ignored. */
export function matchesQuery(haystack: string, words: string[]): boolean {
  if (!words.length) return false;
  const tails = starts(haystack);
  if (hasFrom(tails, words.join(""))) return true;
  return words.every((w) => hasFrom(tails, w));
}

/** Words that describe rather than name — dropped only when the search would otherwise come back empty. */
const FILLER = new Set(["5g", "4g", "lte", "mobile", "phone", "smartphone", "skin", "skins", "cover", "case", "back", "wrap", "new"]);

/** Levenshtein distance, stopping early once it passes `max`. */
function within(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

/** Words of a name, split where letters meet digits too: "s24fe" gives s, 24, fe. */
const nameTokens = (s: string): string[] =>
  String(s ?? "")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .split(/[^a-z0-9]+/)
    .flatMap((t) => [t, ...t.split(/(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])/)])
    .filter(Boolean);

/** matchesQuery, forgiving one typo in each word of four letters or more. */
export function matchesQueryLoosely(haystack: string, words: string[]): boolean {
  if (matchesQuery(haystack, words)) return true;
  if (!words.length) return false;
  const tails = starts(haystack);
  const tokens = nameTokens(haystack);
  return words.every((w) =>
    hasFrom(tails, w) ||
    (w.length >= 4 && tokens.some((t) => t.length >= 3 && within(w, t, 1))));
}

/** Lower is closer. */
export function matchRank(name: string, fullName: string, query: string): number {
  const q = compact(query);
  const n = compact(name);
  const f = compact(fullName);
  if (!q) return 3;
  if (n === q || f === q) return 0;
  if (n.startsWith(q) || f.startsWith(q)) return 1;
  if (n.includes(q) || f.includes(q)) return 2;
  return 3;
}

/**
 * The rows that match, closest first. `name` is what the row is called
 * (model name, product title); `full` adds whatever else may be searched
 * (brand, tags).
 */
export function searchRows<T>(
  rows: T[],
  query: string,
  name: (row: T) => string,
  full: (row: T) => string,
): T[] {
  const words = searchWords(query);
  if (!words.length) return [];
  let hits = rows.filter((r) => matchesQuery(full(r), words));
  const core = words.filter((w) => !FILLER.has(w));
  if (!hits.length && core.length && core.length < words.length) hits = rows.filter((r) => matchesQuery(full(r), core));
  if (!hits.length) hits = rows.filter((r) => matchesQueryLoosely(full(r), core.length ? core : words));
  return hits
    .map((r, i) => ({ r, i, rank: matchRank(name(r), full(r), query), len: compact(name(r)).length }))
    .sort((a, b) => a.rank - b.rank || a.len - b.len || a.i - b.i)
    .map((x) => x.r);
}
