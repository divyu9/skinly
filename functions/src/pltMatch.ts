/**
 * Turning the cutting software's file names into models, and telling whether
 * the website already has each one.
 *
 * Two vendors' libraries, two layouts:
 *   Mobicare  Models\<type>\<Brand>.mcz, a zip of one .mdl per model part:
 *             "Mobile Skins/Samsung.mcz::Galaxy S24 Ultra (5G)-B1.mdl"
 *   TIA       GadgetPlotData\model.txt, one model per line (id~category~brandId~NAME~flag),
 *             brand.txt (id~category~BRAND), and Templates\<n>_<NAME> - B1.tc part files.
 *
 * Every part file of a model (-A, -B, -B1, Sides, (Top), (Inside With
 * Keyboard), (Mirror), (Without Logo), case versions…) folds into one model.
 * Matching tolerates the ways the same device gets written: brand repeated or
 * not ("OnePlus 9R" / One Plus "9R"), (5G) or not, words in another order, an
 * extra model code, laptops by model number, lenses by focal length and
 * aperture, iPads by line, size and year.
 *
 * Worked out on the Mobicare and TIA libraries on 25 Sep 2026 (scripts kept
 * out of the repo); this is the same set of rules.
 */

export type Gadget = "phone" | "tablet" | "laptop" | "camera" | "lens" | "dji" | "console";

export interface VendorModel {
  vendor: "mobicare" | "tia";
  gadget: Gadget;
  brand: string;
  group: string;
  model: string;
  key: string;
  parts: string[];
  folders: string[];
  firstAt: number;          // earliest part file, ms; 0 when unknown
  tiaId?: number;
}

// ── brands ───────────────────────────────────────────────────────────────────
const GROUP: Record<string, string> = {
  apple: "apple", macbook: "apple", samsung: "samsung", xiaomi: "xiaomi", poco: "xiaomi", redmi: "xiaomi", mi: "xiaomi",
  vivo: "vivo", iqoo: "vivo", oppo: "oppo", realme: "realme", "one plus": "oneplus", oneplus: "oneplus",
  motorola: "motorola", moto: "motorola", huawei: "huawei", honor: "huawei", nokia: "nokia", hmd: "nokia",
  google: "google", nothing: "nothing", cmf: "nothing", microsoft: "microsoft", surface: "microsoft",
  sonyericssion: "sony", "sony ericsson": "sony", snoy: "sony", feiyutech: "feiyu", feiyu: "feiyu", "feiyu tech": "feiyu",
  lenovo: "lenovo", lg: "lg", dji: "dji", ai: "aiplus", "ai+": "aiplus",
  playstation: "console", xbox: "console", nintendo: "console", valve: "console", "steam deck": "console",
};
const DROP: Record<string, string[]> = {
  apple: ["apple"], samsung: ["samsung", "galaxy"], xiaomi: ["xiaomi"], vivo: ["vivo"], oppo: ["oppo"], realme: ["realme"],
  oneplus: ["one plus", "oneplus"], motorola: ["motorola", "moto"], huawei: ["huawei"], nokia: ["nokia", "hmd"],
  google: ["google"], nothing: ["nothing"], microsoft: ["microsoft"], dji: ["dji"], aiplus: ["ai plus", "ai"],
  feiyu: ["feiyu tech", "feiyutech", "feiyu"], canon: ["canon", "eos"], nikon: ["nikon"], sony: ["sony"],
  fujifilm: ["fujifilm", "fuji"], console: ["sony", "playstation", "microsoft", "nintendo", "valve", "asus", "aus"],
};
export function groupOf(brand: string): string {
  const b = brand.toLowerCase().replace(/lens/g, "").replace(/\s+/g, " ").trim();
  return GROUP[b] || b;
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function dropWords(t: string, group: string): string {
  for (const w of DROP[group] || [group]) t = t.replace(new RegExp(`(?<![a-z0-9])${esc(w)}(?![a-z0-9])`, "g"), " ");
  return t;
}

// ── names ────────────────────────────────────────────────────────────────────
const PART_PAREN = /\s*\((?:top[^)]*|bottom[^)]*|inside[^)]*|split inside|keyboard[^)]*|screen[^)]*|sides?|mirror|squ?[ea]?re?r?(?: mirror)?|without logo|with logo|logo|ipaky[^)]*|doyacase|boom|concave case|parts?-?\s*\d+|type[- ]?\d+(?: mirror)?|smoke|\d|large|medium|small|full[^)]*|skin|back|front|camera[^)]*|esim|with pocket|glass(?: & logo)?|[^)]*concave[^)]*|electroplate[^)]*|flip cover|only back cover|no edgings|small size|\s*logo|console|controller|dock|charger|joy[^)]*|ac adapter|separate logo|simplified[^)]*)\)/gi;
export function cleanName(name: string): string {
  let n = name.replace(/\.(mdl|tc|plt)$/i, "").trim();
  for (let i = 0; i < 3; i++) {
    n = n.replace(/\s*-\s*(?:[A-E]\d{0,2}|AB\d?|\d{1,2}|Y?B\d?)$/i, "").trim();
    n = n.replace(/\s+(?:sides?|full(?: wrap| body)?|only camera|camera only|back|case)$/i, "").trim();
    n = n.replace(PART_PAREN, "").trim();
    n = n.replace(/\s*\(?\bwithout logo\b\)?/gi, "").trim();
    n = n.replace(/\s+-\s+(?:19|20)\d{2}$/, "").trim();
    n = n.replace(/\s*\((?:india|china|global|indian|international|intl)\)|\s+global$|\s*-\s*(?:full wrap|simple|full body)$/gi, "").trim();
  }
  return n.replace(/\s+/g, " ");
}
export function key(text: string, group: string): string {
  let t = " " + text.toLowerCase().replace(/(\d)(inch|in)\b/g, "$1 $2").replace(/\+/g, " plus ") + " ";
  t = dropWords(t, group);
  t = t.replace(/\(?\b[45]g\b\)?/g, " ");
  t = t.replace(/\b(lens|for|the|inch|in|gimbal|gmibal|drone|dron|stabilizer|handheld|smartphone|3.?axis|dual)\b/g, " ");
  t = t.replace(/\balpha\s*(?=\d)/g, "a");
  return t.replace(/[^a-z0-9]/g, "");
}
const STOP = new Set(["lens", "for", "the", "inch", "in", "with", "and"]);
export function tokens(text: string, group: string): Set<string> {
  let t = text.toLowerCase().replace(/(\d)(inch|in)\b/g, "$1 $2").replace(/\+/g, " plus ");
  t = dropWords(t, group).replace(/\(?\b[45]g\b\)?/g, " ");
  return new Set((t.match(/[a-z0-9]+/g) || []).filter((x) => !STOP.has(x)));
}
function lensSig(text: string): [string, string, string] | null {
  const t = text.toLowerCase();
  let fl = "", ap = "";
  const m = /(\d{1,3}(?:\s*-\s*\d{2,4})?)\s*(?:mm)?\s*f\s*\/?\s*(\d+(?:\.\d+)?)/.exec(t);
  if (m) { fl = m[1].replace(/\s/g, ""); ap = m[2]; } else {
    const m2 = /(\d{1,3}(?:-\d{2,4})?)\s*mm/.exec(t) || /\b(\d{2,3}-\d{2,4})\b/.exec(t);
    if (!m2) return null;
    fl = m2[1];
  }
  const ver = /(?<!di )(?<![a-z])(iii|ii|iv)(?![a-z])/.exec(t);
  return [fl, ap, ver ? ver[1] : ""];
}
function ipadSig(text: string): [string, string, string, string, string] | null {
  const t = text.toLowerCase();
  if (!t.includes("ipad")) return null;
  const line = t.includes(" pro") ? "pro" : t.includes(" air") ? "air" : t.includes(" mini") ? "mini" : "base";
  const size = /\b(\d{1,2}\.\d|1[0-3]|[7-9])\s*(?:-|\s)?(?:inch|in\b|"|\b)/.exec(t);
  const year = /\b(20[12]\d)\b/.exec(t), gen = /\b(\d{1,2})(?:st|nd|rd|th)\b/.exec(t), chip = /\b(m[1-5])\b/.exec(t);
  return [line, size?.[1] || "", year?.[1] || "", gen?.[1] || "", chip?.[1] || ""];
}
function candidates(model: string): string[] {
  const out = [model];
  const m = /^([A-Z]{1,5}[- ]?\d{2,5}[A-Z0-9-]*)\s*\(([^)]+)\)(.*)$/.exec(model);
  if (m) out.push(m[2] + m[3], m[1]);
  for (const p of model.match(/\(([^)]{3,})\)/g) || []) {
    const inner = p.slice(1, -1);
    if (/[a-z]/i.test(inner) && !/^\d{4}$/.test(inner)) out.push(inner);
  }
  return out;
}

// ── classifying vendor files ─────────────────────────────────────────────────
const PHONE_SKIP = new Set(["smoke cover", "soft transparent cover", "hd cover", "hd cover (mirror)", "soft transparent cover (mirror)", "camera cut",
  "acrylic mirror", "acrylic", "mobile decals", "car keys", "shape", "motomo back cover", "keychain", "mobile 2d cases", "deulec case", "cards",
  "charger", "macbook", "idea"]);
const TABLET = /\b(ipad|tab|pad|matepad|tablet|kindle)\b/i;
const WEARABLE = /watch|\bbuds?\b|\bband\b|airpods/i;
const CONSOLE_BRAND = (name: string) =>
  /\bps\d|playstation|psp/i.test(name) ? "PlayStation" : /xbox/i.test(name) ? "Xbox" : /steam deck/i.test(name) ? "Valve"
  : /rog ally|asus/i.test(name) ? "Asus" : /aya ?neo/i.test(name) ? "AYANEO" : "Nintendo";

function mobicareClass(cat: string, brand: string, model: string): { gadget: Gadget; brand: string; model: string } | null {
  const bl = brand.toLowerCase().trim();
  if (cat === "Mobile Skins" || cat === "Case Friendly Skins") {
    if (bl === "drone") return { gadget: "dji", brand: model.split(" ")[0] || "DJI", model };
    if (bl === "gaming consoles" || bl === "nintendo") return { gadget: "console", brand: CONSOLE_BRAND(`${brand} ${model}`), model };
    if (PHONE_SKIP.has(bl)) return null;
    if (bl === "other") {
      model = model.replace(/^ai\s*(?:\+|plus)\s+/i, "AI+ ");
      const first = model.split(" ")[0] || "";
      brand = first; model = model.slice(first.length).trim() || model;
    }
    if (WEARABLE.test(model)) return null;
    return { gadget: TABLET.test(model) ? "tablet" : "phone", brand, model };
  }
  if (cat === "Laptop") return { gadget: "laptop", brand: ({ MacBook: "Apple", Surface: "Microsoft" } as any)[brand] || brand, model };
  if (cat === "Digital Camera") {
    if (bl.endsWith(" lens")) return { gadget: "lens", brand: brand.slice(0, -5), model };
    if (bl === "gimbal stabilizers") return { gadget: "dji", brand: model.split(" ")[0] || brand, model };
    if (["canon", "sony", "nikon", "fujifilm", "panasonic", "olympus", "gopro", "insta360"].includes(bl))
      return { gadget: /\d+mm/i.test(model) ? "lens" : "camera", brand, model };
  }
  return null;
}

/** "Mobile Skins/Samsung.mcz::Galaxy S24 Ultra (5G)-B1.mdl <TAB> bytes <TAB> unix" lines. */
export function parseMobicare(lines: string[]): VendorModel[] {
  const out = new Map<string, VendorModel>();
  for (const line of lines) {
    const [path, , when] = line.split("\t");
    const [archive, entry] = path.includes("::") ? path.split("::") : [path, path.split("/").pop() || ""];
    const cat = archive.split("/")[0] || "";
    const brandFile = (archive.split("/").pop() || "").replace(/\.mcz$/i, "").trim();
    const raw = cleanName(entry.split("/").pop() || "");
    if (!raw || /screen protector|\btest(ing)?\b|^x \d+ mm$/i.test(`${raw} ${brandFile}`) || /^\d+$/.test(raw.split(" ")[0] || "")) continue;
    const c = mobicareClass(cat, brandFile, raw);
    if (!c) continue;
    const group = c.gadget === "console" ? "console" : groupOf(c.brand);
    const k = key(c.model, group);
    if (!k) continue;
    const id = `${c.gadget}|${group}|${k}`;
    const at = (Number(when) || 0) * 1000;
    const m = out.get(id) || { vendor: "mobicare" as const, gadget: c.gadget, brand: c.brand.trim(), group, model: c.model, key: k, parts: [], folders: [], firstAt: 0 };
    m.parts.push(entry.replace(/\.mdl$/i, ""));
    const folder = archive.replace(/\.mcz$/i, "");
    if (!m.folders.includes(folder)) m.folders.push(folder);
    if (at && (!m.firstAt || at < m.firstAt)) m.firstAt = at;
    out.set(id, m);
  }
  return [...out.values()];
}

/** TIA lines: "B<TAB>id<TAB>cat<TAB>BRAND", "M<TAB>id<TAB>cat<TAB>brandId<TAB>NAME<TAB>flag", "T<TAB>file.tc<TAB>unix". */
export function parseTia(lines: string[]): VendorModel[] {
  const brands = new Map<string, string>();
  const models: string[][] = [];
  const templates = new Map<string, { at: number; names: string[] }>();
  const tbase = (n: string) => {
    let b = n.toUpperCase().replace(/^\d+_/, "").replace(/\.TC$/, "").replace(/\s*-\s*[A-Z]{0,2}\d{0,2}$/, "").trim();
    b = b.replace(/\s*\((?:9H GLASS|SCREEN PROTECTOR|CAMERA CUT|CASE FRIENDLY[^)]*|WITH LOGO|WITHOUT LOGO|TOP|BOTTOM|INSIDE[^)]*|SCREEN[^)]*|KEYBOARD[^)]*|SIDES?|FULL[^)]*)\)/g, "").trim();
    return b.replace(/\s*-\s*[A-Z]{0,2}\d{0,2}$/, "").trim();
  };
  for (const line of lines) {
    const f = line.split("\t");
    if (f[0] === "B" && f.length >= 4) brands.set(f[1], f[3].trim());
    else if (f[0] === "M" && f.length >= 5) models.push(f);
    else if (f[0] === "T" && f.length >= 3) {
      if (/SCREEN PROTECTOR|9H GLASS/i.test(f[1])) continue;
      const b = tbase(f[1]);
      const t = templates.get(b) || { at: 0, names: [] };
      const at = (Number(f[2]) || 0) * 1000;
      if (at && (!t.at || at < t.at)) t.at = at;
      t.names.push(f[1].replace(/^\d+_/, "").replace(/\.tc$/i, ""));
      templates.set(b, t);
    }
  }
  const GENERIC = /(\bskins?|9h glass|case friendly|screen protector|camera cut|\btest)$/i;
  const out = new Map<string, VendorModel>();
  for (const [, id, cat, bid, rawName] of models) {
    const raw = rawName.replace(/\s+/g, " ").trim();
    const name = cleanName(raw);
    const brand = brands.get(bid) || "";
    let gadget: Gadget | null = null;
    if (cat === "1") gadget = WEARABLE.test(name) ? null : TABLET.test(name) ? "tablet" : "phone";
    else if (cat === "6") gadget = "tablet";
    else if (cat === "10") gadget = "laptop";
    else if (cat === "12") gadget = "dji";
    else if (cat === "5") gadget = "console";
    else if (cat === "15") gadget = ({ "CAMERA LENS": "lens", "CAMERA BODY": "camera", GIMBAL: "dji" } as Record<string, Gadget>)[brand.toUpperCase()] || null;
    if (!gadget || !name || GENERIC.test(name) || name.toUpperCase() === brand.toUpperCase()) continue;
    let maker = gadget === "console" ? CONSOLE_BRAND(`${brand} ${name}`) : cat === "15" ? name.split(" ")[0] : brand;
    // Filed under one brand, named after another: "REALME C75X" under XIAOMI.
    const firstWord = (name.split(" ")[0] || "").toLowerCase();
    if (gadget !== "console" && GROUP[firstWord] && GROUP[firstWord] !== groupOf(maker)) maker = name.split(" ")[0];
    const group = gadget === "console" ? "console" : groupOf(maker);
    // The parent brand's name off the front ("VIVO IQOO NEO 9S" -> "IQOO NEO 9S", "XIAOMI REDMI 15" -> "REDMI 15"); sub-brands stay.
    let model = name;
    for (let i = 0; i < 2; i++) {
      const w = (model.split(" ")[0] || "").toLowerCase();
      // Brand words only: "Galaxy", "EOS", "Moto" are part of the model's name on the site.
      const brandWords = (DROP[group] || [group]).filter((x) => !["galaxy", "eos", "moto", "fuji", "hmd", "ai"].includes(x));
      if (brandWords.includes(w) && model.includes(" ")) model = model.slice(model.indexOf(" ") + 1).trim();
    }
    const k = key(model, group);
    if (!k) continue;
    const t = templates.get(raw.toUpperCase()) || templates.get(name.toUpperCase());
    const idKey = `${gadget}|${group}|${k}`;
    const m = out.get(idKey) || { vendor: "tia" as const, gadget, brand: maker, group, model, key: k, parts: [], folders: ["TIA Templates"], firstAt: 0, tiaId: 0 };
    if (t) { m.parts.push(...t.names); if (t.at && (!m.firstAt || t.at < m.firstAt)) m.firstAt = t.at; }
    m.tiaId = Math.max(m.tiaId || 0, Number(id) || 0);
    out.set(idKey, m);
  }
  return [...out.values()];
}

// ── matching against a list (the site, the admin list, the other vendor) ────
const SITE_SCOPE: Record<Gadget, string[]> = {
  phone: ["phone", "tablet"], tablet: ["tablet", "phone"], laptop: ["laptop"], camera: ["camera"], lens: ["lens"],
  dji: ["drone", "gimbals", "controller"], console: ["console", "controller"],
};
type Entry = { k: string; tk: Set<string>; name: string };
export class ModelIndex {
  private byCat = new Map<string, Entry[]>();
  /** `category` is a site category (phone, drone, gimbals…); `full` the name as a person reads it. */
  add(category: string, brand: string, full: string) {
    const group = category === "console" || category === "controller" ? "console" : groupOf(brand);
    const list = this.byCat.get(`${category}|${group}`) || [];
    list.push({ k: key(full, group), tk: tokens(full, group), name: full });
    this.byCat.set(`${category}|${group}`, list);
  }
  static fullName(brand: string, model: string) {
    return model.toLowerCase().replace(/\s/g, "").includes(brand.toLowerCase().replace(/\s/g, "")) ? model : `${brand} ${model}`;
  }
  /** "on site" | "maybe" | "no", with the matching name. */
  find(m: { gadget: Gadget; group: string; model: string }): { status: "yes" | "maybe" | "no"; name: string } {
    const pool: Entry[] = [];
    for (const c of SITE_SCOPE[m.gadget]) pool.push(...(this.byCat.get(`${c}|${m.group}`) || []));
    if (!pool.length) return { status: "no", name: "" };
    const keys = new Set(candidates(m.model).map((c) => key(c, m.group)));
    for (const e of pool) if (keys.has(e.k)) return { status: "yes", name: e.name };
    const mt = tokens(m.model, m.group);
    const ip = ipadSig(m.model);
    if (ip) for (const e of pool) {
      const o = ipadSig(e.name);
      if (!o || o[0] !== ip[0]) continue;
      const sameSize = ip[1] && ip[1] === o[1];
      if (sameSize && ((ip[2] && ip[2] === o[2]) || (ip[3] && ip[3] === o[3]) || (ip[4] && ip[4] === o[4]))) return { status: "yes", name: e.name };
      if ((!ip[1] || !o[1]) && ip[3] && ip[3] === o[3] && (!ip[2] || !o[2] || ip[2] === o[2])) return { status: "yes", name: e.name };
    }
    const noise = (t: string) => /^((19|20)\d{2}|[a-z]{0,4}\d{3,}[a-z0-9]*|lte|wifi|wi|fi|edition|ktc|dron|full)$/.test(t);
    for (const e of pool) {
      const inter = [...mt].filter((t) => e.tk.has(t));
      const sub = [...mt].every((t) => e.tk.has(t)) || [...e.tk].every((t) => mt.has(t));
      const diff = [...mt].filter((t) => !e.tk.has(t)).concat([...e.tk].filter((t) => !mt.has(t)));
      const onlyYears = diff.length > 0 && diff.every((t) => /^(19|20)\d{2}$/.test(t));
      if (mt.size && e.tk.size && sub && inter.length && diff.every(noise) && (inter.some((t) => /\d/.test(t)) || diff.length === 0 || onlyYears)) return { status: "yes", name: e.name };
    }
    if (m.gadget === "lens") {
      const sig = lensSig(m.model);
      if (sig) {
        let loose = "";
        for (const e of pool) {
          const s2 = lensSig(e.name);
          if (!s2 || s2[0] !== sig[0]) continue;
          if ((s2[1] === sig[1] || !sig[1] || !s2[1]) && (s2[2] === sig[2] || !sig[2] || !s2[2])) {
            if (sig[1] && s2[1] === sig[1]) return { status: "yes", name: e.name };
            loose = loose || e.name;
          }
        }
        if (loose) return { status: "maybe", name: loose };
      }
    }
    if (m.gadget === "laptop") {
      const codes = (s: Set<string>) => new Set([...s].filter((t) => /\d/.test(t) && t.length >= 3 && !/^(19|20)\d{2}$/.test(t)));
      const mc = codes(mt);
      const series = new Set([...mt].filter((t) => !/\d/.test(t) && !["notebook", "laptop", "pc", "gen", "inch", "series"].includes(t)));
      const pcode = new Set([...mc].filter((t) => /^p\d{2,3}[a-z]$/.test(t)));
      let maybe = "";
      for (const e of pool) {
        const shared = [...mc].filter((t) => codes(e.tk).has(t));
        const modelCodes = shared.filter((t) => !pcode.has(t));
        if (modelCodes.length && ([...series].some((t) => e.tk.has(t)) || !series.size || modelCodes.length >= 2)) return { status: "yes", name: e.name };
        if (shared.some((t) => pcode.has(t))) maybe = maybe || e.name;
      }
      if (maybe) return { status: "maybe", name: maybe };
    }
    return { status: "no", name: "" };
  }
}

/** The site category a vendor gadget goes under. */
export function siteCategory(g: Gadget, model: string): string {
  if (g === "dji") return /ronin|\brs ?\d|osmo|gimbal|stabili|weebill|crane|smooth/i.test(model) ? "gimbals" : /controller|\brc\b/i.test(model) ? "controller" : "drone";
  return g;
}
