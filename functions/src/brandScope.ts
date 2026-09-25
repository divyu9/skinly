import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";

/**
 * A catch-all listing leaves out only the brands that really have a listing
 * of their own.
 *
 * Each design is launched as brand listings (MacBook, Apple iPad, Samsung
 * Galaxy…) plus catch-alls (Laptop, Tablet, Camera Lens…) for every other
 * brand. The launch plan wrote each catch-all's modelBrandsExclude from the
 * brands it *meant* to give listings — for laptops HP, Dell, Lenovo, Asus,
 * Acer, MSI, Alienware and Apple — but only MacBook listings were ever made.
 * So on the Laptop listing an HP or Dell owner found no HP or Dell in the
 * model picker, and no HP listing anywhere: 164 catch-alls turned whole
 * brands away. Laptop owners who couldn't find their model were most of it.
 *
 * Now a catch-all's exclusions are worked out from its design's live brand
 * listings for the same gadget, and kept that way: whenever a listing is
 * added, archived or re-scoped, its design's catch-alls are recomputed.
 */

const CATCH_ALL_KINDS: Record<string, string> = {
  "laptop": "laptop", "tablet": "tablet", "camera lens": "lens", "charger": "charger",
  "gimbal": "gimbals", "android phone": "phone", "camera": "camera", "drone": "drone",
};

/** The gadget a listing is for: its own field, else read off its kind ("Sony Lens" -> lens). */
export function gadgetOf(p: any): string {
  const kind = String(p.listingKind || "").toLowerCase();
  if (CATCH_ALL_KINDS[kind]) return CATCH_ALL_KINDS[kind];
  // The kind first: some brand listings carry a gadgetCategory that is wrong.
  if (/controller/.test(kind)) return "controller";
  if (/ps5|xbox series|nintendo/.test(kind)) return "console";
  if (/lens/.test(kind)) return "lens";
  if (/charger/.test(kind)) return "charger";
  if (/gimbal/.test(kind)) return "gimbals";
  if (/ipad|galaxy tab|\bpad\b|tab\b/.test(kind)) return "tablet";
  if (/macbook|laptop/.test(kind)) return "laptop";
  if (/camera/.test(kind)) return "camera";
  if (/drone/.test(kind)) return "drone";
  if (/mac mini/.test(kind)) return "mac-mini";
  if (p.gadgetCategory) return String(p.gadgetCategory);
  return "phone";
}

/** The design a listing prints: its upload if it has one, else its title without the listing's own name. */
export function designOf(p: any): string {
  const up = /\/design-raw\/([A-Z]+-\d+)-/.exec(String(p.designImageUrl || ""))?.[1];
  if (up) return up;
  const kind = String(p.listingKind || "").toLowerCase();
  let t = String(p.title || "").toLowerCase();
  if (kind) t = t.replace(new RegExp(`\\s*\\b${kind.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b.*$`), "");
  return t.replace(/\s+skins?$/, "").replace(/\bfinish\b/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export async function reconcileBrandScopes(db: admin.firestore.Firestore, opts: { dryRun?: boolean; only?: string } = {}) {
  const snap = await db.collection("products").where("listingKind", ">", "").get();
  const rows = snap.docs.map((d) => ({ ref: d.ref, id: d.id, ...(d.data() as any) }));
  // Two keys per listing, so a catch-all without a design upload still finds
  // siblings that have one: the upload's code and the title's design name.
  const byDesign = new Map<string, any[]>();
  const keysOf = (p: any) => [...new Set([designOf(p), designOf({ ...p, designImageUrl: "" })])].filter(Boolean);
  for (const p of rows) for (const k of keysOf(p)) byDesign.set(k, [...(byDesign.get(k) || []), p]);

  const out = { checked: 0, changed: 0, changes: [] as string[] };
  for (const p of rows) {
    if (!CATCH_ALL_KINDS[String(p.listingKind || "").toLowerCase()] || p.status === "archived") continue;
    if (opts.only && !keysOf(p).includes(opts.only)) continue;
    out.checked++;
    const g = gadgetOf(p);
    const siblings = new Map<string, any>();
    for (const k of keysOf(p)) for (const s of byDesign.get(k) || []) siblings.set(s.id, s);
    const own = new Map<string, string>();   // brand key -> spelling, from live brand listings for this gadget
    for (const s of siblings.values()) {
      if (s.id === p.id || s.status !== "active" || !Array.isArray(s.modelBrands) || !s.modelBrands.length) continue;
      if (gadgetOf(s) !== g) continue;
      for (const b of s.modelBrands) own.set(String(b).toLowerCase().replace(/[^a-z0-9]/g, ""), String(b));
    }
    const want = [...own.values()].sort();
    const have = [...new Set((p.modelBrandsExclude || []).map(String))].sort();
    if (want.join("|") === have.join("|")) continue;
    out.changed++;
    out.changes.push(`${p.title}: [${have.join(", ")}] -> [${want.join(", ")}]`);
    if (!opts.dryRun) {
      await p.ref.update({ modelBrandsExclude: want.length ? want : admin.firestore.FieldValue.delete(), brandScopeCheckedAt: Date.now() });
    }
  }
  return out;
}

/** Keep a design's catch-alls right when any of its listings is added, archived or re-scoped. */
export const onListingScopeChange = functionsV1
  .runWith({ memory: "512MB", timeoutSeconds: 120 })
  .firestore.document("products/{id}")
  .onWrite(async (change) => {
    const before = change.before.exists ? (change.before.data() as any) : null;
    const after = change.after.exists ? (change.after.data() as any) : null;
    const p = after || before;
    if (!p?.listingKind) return null;
    const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    if (before && after && same(before.status, after.status) && same(before.modelBrands, after.modelBrands)
        && same(before.title, after.title)) return null;   // our own exclusion writes stop here
    await reconcileBrandScopes(admin.firestore(), { only: designOf(p) });
    return null;
  });
