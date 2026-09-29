/**
 * Smart Setup: the add-ons offered beside a skin on its product page, picked
 * for the device the shopper chose.
 *
 * Every pick is something that fits that exact device — the same design's
 * charger skin for their brand's charger, the case and glass variant named
 * for their model, Magneto X only on a USB-C device — or it is not offered.
 * The one generic checkout rule offered iPhone glass to every cart, Samsung
 * included.
 *
 * Offer prices come from settings/smartUpsell, which the admin sets per kind
 * (Upsells › Smart setup). placeOrder charges them only for a line marked
 * `upsellRuleId: "smart:<kind>"` whose product really is that kind and whose
 * cart really holds a skin (functions/src/smartUpsell.ts, same arithmetic).
 */
import type { CatalogueModel, CatalogueProduct } from "@/lib/catalogue";
import { brandInScope } from "@/lib/device-fit";
import { designNameOf } from "@/lib/pack-list";

/**
 * A listing's design code: the catalogue's own field, else a bare-code SKU —
 * the older listings ("L-59") carry no suffix, which the build's reader of
 * "R-44-IPH" missed, so they looked like they had no design at all.
 */
export function designOfListing(p: Pick<CatalogueProduct, "variants"> & { design?: string }): string {
  if (p.design) return p.design;
  for (const v of p.variants || []) {
    const m = /^([A-Z]+-\d+)(?:-[A-Z][A-Z0-9]*)?$/.exec(String(v.sku || "").trim().toUpperCase());
    if (m) return m[1];
  }
  return "";
}

export type SetupKind = "chargerSkin" | "case" | "glass" | "cameraRing" | "membrane" | "magneto";
export type OfferRule = { enabled: boolean; type: "percent" | "flat"; value: number };
/** Spend this much on everything else and one add-on of `kind` is free. */
export type FreeGift = { enabled: boolean; threshold: number; kind: SetupKind };
export type SmartUpsellSettings = { enabled: boolean; offers: Record<SetupKind, OfferRule>; freeGift: FreeGift };

export const SETUP_KINDS: Array<{ kind: SetupKind; label: string; hint: string }> = [
  { kind: "chargerSkin", label: "Matching charger skin", hint: "Same design, for their brand's charger" },
  { kind: "case", label: "MagSafe case", hint: "iPhone & Samsung models" },
  { kind: "glass", label: "Tempered glass", hint: "iPhone models with stock" },
  { kind: "cameraRing", label: "Camera lens rings", hint: "iPhone & Samsung models" },
  { kind: "membrane", label: "Screen membrane", hint: "Any phone, when no glass fits" },
  { kind: "magneto", label: "Magneto X SSD enclosure", hint: "USB-C phones, laptops, tablets" },
];

export const DEFAULT_SMART_UPSELL: SmartUpsellSettings = {
  enabled: true,
  offers: {
    chargerSkin: { enabled: true, type: "flat", value: 40 },
    case: { enabled: true, type: "percent", value: 10 },
    glass: { enabled: true, type: "percent", value: 10 },
    cameraRing: { enabled: true, type: "percent", value: 10 },
    membrane: { enabled: true, type: "percent", value: 10 },
    magneto: { enabled: true, type: "flat", value: 200 },
  },
  // Off until the admin picks a threshold: it gives stock away.
  freeGift: { enabled: false, threshold: 599, kind: "chargerSkin" },
};

/** Stored settings over the defaults, so a kind added later is never undefined. */
export function withDefaults(raw: any): SmartUpsellSettings {
  const offers = { ...DEFAULT_SMART_UPSELL.offers };
  for (const { kind } of SETUP_KINDS) {
    const o = raw?.offers?.[kind];
    if (o) offers[kind] = { enabled: o.enabled !== false, type: o.type === "flat" ? "flat" : "percent", value: Math.max(0, Number(o.value) || 0) };
  }
  const g = raw?.freeGift;
  const freeGift: FreeGift = g
    ? { enabled: g.enabled === true, threshold: Math.max(0, Number(g.threshold) || 0), kind: SETUP_KINDS.some((k) => k.kind === g.kind) ? g.kind : "chargerSkin" }
    : DEFAULT_SMART_UPSELL.freeGift;
  return { enabled: raw?.enabled !== false, offers, freeGift };
}

/** The offer price: never above the real price, never below ₹1. */
export function offerPrice(full: number, rule: OfferRule | undefined): number {
  if (!rule?.enabled || !(full > 0)) return full;
  const off = rule.type === "flat" ? rule.value : (full * rule.value) / 100;
  return Math.max(1, Math.min(full, Math.round(full - off)));
}

/** Which kind of add-on a listing is — the server reads the same fields. */
export function kindOf(p: Pick<CatalogueProduct, "productCategory" | "gadgetCategory" | "title">): SetupKind | null {
  const cat = String(p.productCategory || "").toLowerCase();
  const title = String(p.title || "");
  if (cat === "skin" && p.gadgetCategory === "charger") return "chargerSkin";
  if (cat === "case-cover") return "case";
  if (cat === "glass") return "glass";
  if (cat === "camera-ring") return "cameraRing";
  if (cat === "magneto-x" && /enclosure/i.test(title)) return "magneto";
  if (/membrane/i.test(title)) return "membrane";
  return null;
}

// ─── Model matching ──────────────────────────────────────────────────────────

/** "Apple iPhone 15 Pro Max" / "Galaxy S24 Ultra (5G)" → "iphone15promax" / "s24ultra". */
export function modelKey(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/\(?\b5g\b\)?/g, "")
    .replace(/\b(apple|samsung|galaxy)\b/g, "")
    .replace(/(\d)\s*p\b/g, "$1plus")
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * The models a variant title names. Cases and glass pack several models
 * into one title — "iPhone 13/13 Pro/14", "Samsung Galaxy S24/25", "iPhone 7/8P"
 * — and rings add a colour after the last " / ". A part that starts with a
 * digit takes the family from the first part: "S24/25" is S24 and S25.
 */
export function modelsInTitle(title: string): string[] {
  const parts = String(title || "").split("/").map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return [];
  const base = parts[0];
  const cut = base.search(/\d/);
  const family = cut > 0 ? base.slice(0, cut) : "";
  // A one-word letter model takes the brand line too: "iPhone X/XS" is X and XS.
  const line = base.includes(" ") ? base.slice(0, base.lastIndexOf(" ") + 1) : "";
  return parts
    .map((p) => (/^\d/.test(p) && family ? family + p : /^[A-Za-z]+$/.test(p) && line && !/^(blue|black|white|red|green|pink|purple|silver|gold|grey|gray|clear|orange|yellow)$/i.test(p) ? line + p : p))
    .map(modelKey).filter(Boolean);
}

/** The colour at the end of a ring's variant ("iPhone 15 Pro / 15 Pro Max / Blue"), if any. */
function colourOf(title: string): string {
  const last = String(title || "").split("/").pop()?.trim() || "";
  return /\d/.test(last) ? "" : last;
}

const inStock = (v: { inventoryQuantity?: number; price?: number }) => (Number(v.inventoryQuantity) || 0) > 0 && (Number(v.price) || 0) > 0;

// ─── Chargers ────────────────────────────────────────────────────────────────

/** Brands whose chargers carry another brand's name in the model list. */
const CHARGER_BRANDS: Record<string, string[]> = {
  redmi: ["Xiaomi"], poco: ["Xiaomi"], xiaomi: ["Xiaomi"], mi: ["Xiaomi"],
  iqoo: ["iQOO", "Vivo"], vivo: ["Vivo", "iQOO"], oneplus: ["One Plus"], "one plus": ["One Plus"],
};
const bkey = (s: string) => String(s || "").toLowerCase().trim();

/**
 * The chargers a skin could be cut for, for this device, and the one to
 * preselect. An iPhone or iPad comes with the 20W adapter; a MacBook with one
 * of the MacBook adapters; Samsung with the 25W. Other brands pick theirs.
 */
export function chargerOptions(models: CatalogueModel[], brand: string, device: { category: string; model: string }) {
  const names = CHARGER_BRANDS[bkey(brand)] || [brand];
  const wanted = new Set(names.map(bkey));
  let list = models.filter((m) => m.category === "charger" && wanted.has(bkey(m.brandName)));
  const isApple = bkey(brand) === "apple";
  if (isApple) {
    const mac = /macbook|67w|140w/i;
    list = device.category === "laptop" ? list.filter((m) => mac.test(m.modelName)) : list.filter((m) => !mac.test(m.modelName) && !/ipad|magsafe|battery/i.test(m.modelName));
  }
  const pick =
    isApple && device.category !== "laptop" ? list.find((m) => /usb power adapter \(20w\)/i.test(m.modelName)) || list.find((m) => /20w/i.test(m.modelName))
    : isApple ? list.find((m) => /67w/i.test(m.modelName))
    : bkey(brand) === "samsung" ? list.find((m) => /25w/i.test(m.modelName))
    : undefined;
  return { options: list.map((m) => ({ brand: m.brandName, model: m.modelName })), preselect: pick ? { brand: pick.brandName, model: pick.modelName } : null };
}

// ─── USB-C ───────────────────────────────────────────────────────────────────

/**
 * Does this device have USB-C (so Magneto X plugs straight in)? Phones: every
 * iPhone from the 15, and Android phones. iPads: all but the Lightning ones.
 */
export function hasUsbC(category: string, brand: string, model: string): boolean {
  const m = String(model || "");
  if (category === "laptop" || category === "mac-mini") return true;
  if (category === "tablet") {
    if (!/ipad/i.test(m)) return true;
    // USB-C iPads: Air 4 on, every Pro 11/13, Pro 12.9 from 2018, iPad 10th/11th/A16, mini 6 on.
    return /air\s*\(?(m\d|[4-9]\b|1[013]\b)|air 10\.9|pro\s*11|pro\s*13|pro 12\.9.*20(1[89]|2\d)|10th|11th|a16|ipad 11\b|ipad 2022|mini\s*\(?6/i.test(m);
  }
  if (category !== "phone") return false;
  const iphone = /iphone\s*(\d+)/i.exec(m);
  if (bkey(brand) === "apple" || iphone) return !!iphone && Number(iphone[1]) >= 15;
  return true;
}

// ─── The picks ───────────────────────────────────────────────────────────────

export type SetupOption = { productId: string; variantId: string; variant: string; label: string; price: number; image: string; title: string; slug: string };
export type SetupPick = {
  kind: SetupKind;
  heading: string;
  /** "Fits your iPhone 15" — only when the variant names that model. */
  fit: string;
  options: SetupOption[];
  /** For a charger skin: the chargers it can be cut for, and which is preselected. */
  chargers?: { options: Array<{ brand: string; model: string }>; preselect: { brand: string; model: string } | null };
};

type Device = { brand: string; model: string; category: string };

function optionsFor(p: CatalogueProduct, variants: CatalogueProduct["variants"], label: (v: { title: string }) => string): SetupOption[] {
  return (variants || []).map((v) => ({
    productId: p._id, variantId: v._id, variant: v.title, label: label(v), price: Number(v.price) || 0,
    image: p.images?.[0]?.url || "", title: p.title, slug: p.slug,
  }));
}

/** Variants of `p` that name the device's model and are in stock. */
function fitting(p: CatalogueProduct, device: Device) {
  const key = modelKey(device.model);
  return (p.variants || []).filter((v) => inStock(v) && modelsInTitle(v.title).includes(key));
}

/** Title words before "Magsafe"/"Cover" — "Navy Blue", "Transparent" — as the colour of a case listing. */
const caseColour = (title: string) => title.replace(/\s*(magsafe|cover|&|case).*$/i, "").trim() || title;

export function buildSetupPicks(
  product: Pick<CatalogueProduct, "_id" | "gadgetCategory" | "design"> & { design?: string },
  device: Device,
  catalogue: CatalogueProduct[],
  models: CatalogueModel[],
  settings: SmartUpsellSettings,
): SetupPick[] {
  if (!settings.enabled || !device.model) return [];
  const on = (k: SetupKind) => settings.offers[k]?.enabled;
  const fitText = `Fits your ${device.model}`;
  const picks: SetupPick[] = [];
  const byKind = (k: SetupKind) => catalogue.filter((p) => p.status !== "draft" && kindOf(p) === k);
  const category = device.category || "phone";

  // Same design, for the charger that came with their device — or, when this
  // design has no charger version (most older listings), the charger skins
  // made for their brand, closest finish first, to choose from.
  const design = designOfListing(product as any);
  if (on("chargerSkin") && category !== "charger" && ["phone", "tablet", "laptop"].includes(category)) {
    const chargerBrand = CHARGER_BRANDS[bkey(device.brand)]?.[0] || device.brand;
    const chargers = chargerOptions(models, device.brand, { category, model: device.model });
    const stocked = byKind("chargerSkin").filter((p) => (p.variants || []).some(inStock));
    const forBrand = (p: CatalogueProduct) => (p.modelBrands || []).length > 0 && brandInScope(p, chargerBrand);
    const sameDesign = design ? stocked.filter((p) => designOfListing(p) === design) : [];
    const listing = sameDesign.find(forBrand) || sameDesign.find((p) => !(p.modelBrands || []).length);
    if (listing && chargers.options.length) {
      picks.push({
        kind: "chargerSkin", heading: "Matching charger skin", fit: "Same design as your skin",
        options: optionsFor(listing, (listing.variants || []).filter(inStock).slice(0, 1), () => "Charger skin"),
        chargers,
      });
    } else if (chargers.options.length) {
      const finish = String((product as any).finishType || "").toLowerCase();
      const pool = stocked.filter(forBrand)
        .sort((a, b) => Number(String(b.finishType || "").toLowerCase() === finish) - Number(String(a.finishType || "").toLowerCase() === finish)
          || (b._creationTime || 0) - (a._creationTime || 0))
        .slice(0, 4);
      if (pool.length) {
        picks.push({
          kind: "chargerSkin", heading: "Charger skin", fit: `Made for your ${chargerBrand} charger`,
          options: pool.map((p) => optionsFor(p, (p.variants || []).filter(inStock).slice(0, 1), () => designNameOf(p.title).replace(/\s+(apple|samsung|oneplus|xiaomi|realme|oppo|vivo)$/i, ""))[0]),
          chargers,
        });
      }
    }
  }

  if (category === "phone") {
    if (on("case")) {
      const opts = byKind("case").flatMap((p) => fitting(p, device).slice(0, 1).map((v) => ({ p, v })))
        .map(({ p, v }) => optionsFor(p, [v], () => caseColour(p.title))[0]);
      if (opts.length) picks.push({ kind: "case", heading: "MagSafe case", fit: fitText, options: opts.sort((a, b) => a.price - b.price) });
    }
    let glass = false;
    if (on("glass")) {
      const opts = byKind("glass").flatMap((p) => fitting(p, device).slice(0, 1).map((v) => optionsFor(p, [v], () => /privacy/i.test(p.title) ? "HD + Privacy" : "2× HD glass")[0]));
      if (opts.length) { glass = true; picks.push({ kind: "glass", heading: "Tempered glass", fit: fitText, options: opts }); }
    }
    if (on("cameraRing")) {
      const opts = byKind("cameraRing").flatMap((p) => optionsFor(p, fitting(p, device), (v) => colourOf(v.title) || "Standard"));
      if (opts.length) picks.push({ kind: "cameraRing", heading: "Camera lens rings", fit: fitText, options: opts.slice(0, 6) });
    }
    // The skin already covers the back, so the membrane offered is for the screen.
    if (on("membrane") && !glass) {
      const opts = byKind("membrane").flatMap((p) => optionsFor(p, (p.variants || []).filter((v) => inStock(v) && /screen only/i.test(v.title)), () => (/matte/i.test(p.title) ? "Matte (anti-glare)" : "Gloss (clear)")));
      if (opts.length) picks.push({ kind: "membrane", heading: "Screen membrane", fit: "Cut for every phone", options: opts });
    }
  }

  if (on("magneto") && hasUsbC(category, device.brand, device.model)) {
    const opts = byKind("magneto").flatMap((p) => optionsFor(p, (p.variants || []).filter(inStock).slice(0, 1), () => "Without SSD"));
    if (opts.length) picks.push({ kind: "magneto", heading: "Magneto X (SSD)", fit: `Plugs into your ${device.model} (USB-C)`, options: opts.slice(0, 1) });
  }

  return picks.filter((p) => p.options.length && p.kind !== undefined && product._id !== p.options[0].productId);
}


// ─── Cart pricing ────────────────────────────────────────────────────────────

export type CartLine = {
  _id?: string; productId: string; variant: string; price: number; quantity: number;
  upsellRuleId?: string; phoneBrand?: string; phoneModel?: string;
};

/**
 * What each Smart Setup line in a cart costs, by the rules placeOrder applies
 * (functions/src/smartUpsell.ts): the offer price while the cart holds a skin
 * (for a charger skin, a skin for another device), the full price otherwise,
 * and ₹0 for the first single gift-kind line once everything else in the cart
 * reaches the free-gift threshold. Keyed by line index.
 */
export function smartCartPrices(lines: CartLine[], byId: Map<string, CatalogueProduct>, settings: SmartUpsellSettings): Map<number, number> {
  const out = new Map<number, number>();
  const fullOf = (l: CartLine) => {
    const v = byId.get(l.productId)?.variants?.find((x) => x.title === l.variant);
    return Number(v?.price) || 0;
  };
  const rest = lines.filter((l) => !l.upsellRuleId);
  const restValue = rest.reduce((s, l) => s + fullOf(l) * (Number(l.quantity) || 1), 0);
  const restProducts = rest.map((l) => byId.get(l.productId)).filter(Boolean) as CatalogueProduct[];
  let giftGiven = false;
  lines.forEach((l, i) => {
    if (!String(l.upsellRuleId || "").startsWith("smart:")) return;
    const p = byId.get(l.productId);
    const full = fullOf(l);
    if (!p || !full) return;
    const kind = kindOf(p);
    const anchored = restProducts.some((r) => r.productCategory === "skin" && (kind !== "chargerSkin" || r.gadgetCategory !== "charger"));
    let price = full;
    if (settings.enabled && kind && l.upsellRuleId === `smart:${kind}` && anchored) {
      const g = settings.freeGift;
      if (g.enabled && g.kind === kind && !giftGiven && (Number(l.quantity) || 1) === 1 && restValue >= g.threshold) {
        price = 0;
        giftGiven = true;
      } else {
        price = offerPrice(full, settings.offers[kind]);
      }
    }
    out.set(i, price);
  });
  return out;
}

/** Flagships worth pitching Magneto X to as a creator's kit: recent Pro iPhones, Galaxy S Ultra and the folds. */
export function isFlagship(brand: string, model: string): boolean {
  const m = `${brand} ${model}`;
  const ip = /iphone\s*(\d+)\s*pro/i.exec(m);
  return (!!ip && Number(ip[1]) >= 15) || /s2[3-9]\s*ultra|fold|flip|pixel\s*\d+\s*pro/i.test(m);
}
