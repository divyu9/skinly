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
 *    the query, then names holding the query's words side by side in the
 *    order typed ("24 70 sigma" puts Sigma's 24-70 above its 24-105 and
 *    70-200), then the rest, shortest first.
 */

const ROMAN: Record<string, string> = { ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7" };

/**
 * Generation numbers written one way. Cameras print the same model as
 * "A7 III", "A7 Mark III", "A7M3" and "Alpha 7 III", and people type "a73",
 * "a7iii", "a7m3" or "a7miii". So, in names and queries alike:
 *  - a roman numeral right after a number, or after "mark"/"mk"/"m", is that
 *    number: A7 III → A7 3, Z6 II → Z6 2, 5D Mark IV → 5D 4, Xperia 1 V → 1 5,
 *    and after a model code's letter suffix: A7R V → A7R 5, A7S III → A7S 3;
 *  - "mark", "mk" and an "m" written onto a number drop out: A7 Mark 3, A7M3 → A7 3
 *    (but "iPad Pro 11 M4" keeps its M4);
 *  - "alpha" before a number is "a": Alpha 7 IV → a 7 4.
 * A lone "i" is left alone ("Xiaomi 11i" is not "111"), and a numeral after a
 * word stays a word ("Vivo V29" keeps its V). Separators are kept, so the
 * words a query was typed in stay its words.
 */
export function canonical(s: unknown): string {
  const str = String(s ?? "").toLowerCase();
  const toks: { t: string; at: number }[] = [];
  const re = /[a-z]+|\d+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str))) toks.push({ t: m[0], at: m.index });
  if (!toks.length) return str;
  const isNum = (t?: string) => !!t && /^\d+$/.test(t);
  const isMarkWord = (t?: string) => t === "mark" || t === "mk";
  const out: string[] = [];
  let last = 0;
  for (let i = 0; i < toks.length; i++) {
    const { t, at } = toks[i];
    const prev = toks[i - 1]?.t;
    const next = toks[i + 1]?.t;
    let rep = t;
    // "a7m3" (m written onto the number), not "iPad Pro 11 M4" (an M4 chip).
    const joined = at > 0 && /\d/.test(str[at - 1]);
    const nextIsGen = isNum(next) || (!!next && next in ROMAN);
    if (isMarkWord(t) && nextIsGen) rep = "";
    else if (t === "m" && joined && isNum(prev) && nextIsGen) rep = "";
    // …or after a model code's letter suffix: A7R V, A7S III (the "R" is written onto the 7).
    else if (t in ROMAN && !joined && !!prev && /^[a-z]{1,2}$/.test(prev) && isNum(toks[i - 2]?.t)
      && toks[i - 1].at === toks[i - 2].at + toks[i - 2].t.length) rep = ROMAN[t];
    else if (t in ROMAN && (isNum(prev) || isMarkWord(prev) || (prev === "m" && isNum(toks[i - 2]?.t)))) rep = ROMAN[t];
    else if (/^m(ii|iii|iv|v|vi|vii)$/.test(t) && joined && isNum(prev)) rep = ROMAN[t.slice(1)];
    // A suffix letter with "m" for Mark: "a7sm3", "a7rm4" → a7s 3, a7r 4.
    else if (joined && isNum(prev) && /^[a-ln-z]m$/.test(t) && nextIsGen) rep = t[0]; // not "mm" (millimetres)
    // …and the same with a numeral: "a7smiii" → a7s 3.
    else if (joined && isNum(prev) && /^[a-ln-z]m(ii|iii|iv|v|vi|vii)$/.test(t)) rep = `${t[0]} ${ROMAN[t.slice(2)]}`;
    // A suffix letter and the numeral typed as one: "a7siii", "a7rv" → a7s 3, a7r 5.
    else if (joined && isNum(prev) && /^[a-z]{1,2}?(ii|iii|iv|v|vi|vii)$/.test(t) && /^([a-z]{1,2})(ii|iii|iv|v|vi|vii)$/.test(t)) {
      const mm = /^([a-z]{1,2}?)(ii|iii|iv|v|vi|vii)$/.exec(t)!;
      rep = `${mm[1]} ${ROMAN[mm[2]]}`;
    }
    else if (t === "alpha" && isNum(next)) rep = "a";
    out.push(str.slice(last, at), rep);
    last = at + t.length;
  }
  out.push(str.slice(last));
  return out.join("");
}

/** Lowercase letters and digits only, with "+" spelled out and generations written one way. */
export const compact = (s: unknown): string =>
  canonical(String(s ?? "").replace(/\+/g, " plus ")).replace(/[^a-z0-9]/g, "");

/** The query as words, each compacted; "s24+" is ["s24", "plus"]. */
export const searchWords = (q: unknown): string[] =>
  canonical(String(q ?? "").toLowerCase().replace(/\+/g, " plus "))
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
  const s = canonical(String(haystack ?? "").toLowerCase().replace(/\+/g, " plus "));
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
  canonical(String(s ?? "").toLowerCase().replace(/\+/g, " plus "))
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
 * How many neighbouring query words sit side by side in the name, in the
 * order typed: "24 70" scores 1 against "24-70mm" and 0 against "24-105mm
 * … 70" — every word matches both, but only one is the 24-70.
 */
export function adjacency(haystack: string, words: string[]): number {
  if (words.length < 2) return 0;
  const tails = starts(haystack);
  let n = 0;
  for (let i = 0; i + 1 < words.length; i++) if (hasFrom(tails, words[i] + words[i + 1])) n++;
  return n;
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
    .map((r, i) => ({ r, i, rank: matchRank(name(r), full(r), query), adj: adjacency(full(r), words), len: compact(name(r)).length }))
    .sort((a, b) => a.rank - b.rank || b.adj - a.adj || a.len - b.len || a.i - b.i)
    .map((x) => x.r);
}
