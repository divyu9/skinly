import * as admin from "firebase-admin";

/**
 * Smart Setup offer prices, as placeOrder charges them.
 *
 * The product page offers add-ons beside a skin (src/lib/smart-setup.ts) at
 * a price set per kind in settings/smartUpsell. A cart line carries
 * `upsellRuleId: "smart:<kind>"`; the offer price is charged only when the
 * product really is that kind (read here from its own document, not from the
 * line), the offer is switched on, and the rest of the cart holds a skin —
 * for a charger skin, a skin for some other device. Anything else pays full.
 * The arithmetic is the storefront's, line for line.
 */

type Kind = "chargerSkin" | "case" | "glass" | "cameraRing" | "membrane" | "magneto";
type Rule = { enabled: boolean; type: "percent" | "flat"; value: number };

const DEFAULTS: Record<Kind, Rule> = {
  chargerSkin: { enabled: true, type: "flat", value: 40 },
  case: { enabled: true, type: "percent", value: 10 },
  glass: { enabled: true, type: "percent", value: 10 },
  cameraRing: { enabled: true, type: "percent", value: 10 },
  membrane: { enabled: true, type: "percent", value: 10 },
  magneto: { enabled: true, type: "flat", value: 200 },
};

export function smartKindOf(p: any): Kind | null {
  const cat = String(p?.productCategory || "").toLowerCase();
  const title = String(p?.title || "");
  if (cat === "skin" && p?.gadgetCategory === "charger") return "chargerSkin";
  if (cat === "case-cover") return "case";
  // A refill is glass only: useless without the AutoApply tool, so never the add-on.
  if (cat === "glass") return /refill/i.test(title) ? null : "glass";
  if (cat === "camera-ring") return "cameraRing";
  if (cat === "magneto-x" && /enclosure/i.test(title)) return "magneto";
  if (/membrane/i.test(title)) return "membrane";
  return null;
}

export function smartOfferPrice(full: number, rule: Rule | undefined): number {
  if (!rule?.enabled || !(full > 0)) return full;
  const off = rule.type === "flat" ? rule.value : (full * rule.value) / 100;
  return Math.max(1, Math.min(full, Math.round(full - off)));
}

type Gift = { enabled: boolean; threshold: number; kind: Kind };
export type SmartRules = { enabled: boolean; offers: Record<Kind, Rule>; freeGift: Gift };

export async function loadSmartRules(db: admin.firestore.Firestore): Promise<SmartRules> {
  const raw = (await db.collection("settings").doc("smartUpsell").get()).data() as any;
  const offers = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS) as Kind[]) {
    const o = raw?.offers?.[k];
    if (o) offers[k] = { enabled: o.enabled !== false, type: o.type === "flat" ? "flat" : "percent", value: Math.max(0, Number(o.value) || 0) };
  }
  const g = raw?.freeGift;
  const freeGift: Gift = {
    enabled: g?.enabled === true,
    threshold: Math.max(0, Number(g?.threshold) || 0),
    kind: g?.kind && g.kind in DEFAULTS ? g.kind : "chargerSkin",
  };
  return { enabled: raw?.enabled !== false, offers, freeGift };
}

/**
 * The price of one smart line, or undefined to charge in full.
 * `restProducts` are the documents of the cart's ordinary (non-upsell) lines
 * and `restValue` what they cost. The first single gift-kind line is free once
 * `restValue` reaches the gift threshold; `state` carries that across lines.
 */
export function smartLinePrice(
  claimed: string,
  product: any,
  full: number,
  quantity: number,
  restProducts: any[],
  restValue: number,
  rules: SmartRules,
  state: { giftGiven: boolean },
): number | undefined {
  if (!rules.enabled) return undefined;
  const kind = smartKindOf(product);
  if (!kind || `smart:${kind}` !== claimed) return undefined;
  const anchors = restProducts.filter((p) => String(p?.productCategory || "").toLowerCase() === "skin" && (kind !== "chargerSkin" || p?.gadgetCategory !== "charger"));
  if (!anchors.length) return undefined;
  const g = rules.freeGift;
  if (g.enabled && g.kind === kind && !state.giftGiven && quantity === 1 && restValue >= g.threshold) {
    state.giftGiven = true;
    return 0;
  }
  const price = smartOfferPrice(full, rules.offers[kind]);
  return price < full ? price : undefined;
}
