import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAction, useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Loader2Icon, ArrowRightIcon, DownloadIcon } from "lucide-react";

/**
 * Puts every laptop listing's SKUs back in one shape, with the cutout (or roll)
 * record as the source of truth.
 *
 * Laptop SKUs were typed by hand over the years and drifted: "Only Top" sold as
 * L-3D-06 next to "Top + Keyboard Area" as L-3D-05, LPT on the keyboard view,
 * LAP on one listing and LP on the next, the keyboard view spending one sheet
 * instead of two. The design code decides which pile of sheets a sale draws on
 * and which listing an approved mockup lands on, so every one of those was a
 * stock or image bug waiting to happen.
 *
 * The shape every listing is put into:
 *
 *   <design code>-LP    "Only Top"              uses 1 sheet
 *   <design code>-LPK   "Top + Keyboard Area"   uses 2 sheets
 *
 * The design code is the stock record's own number (an alias is resolved to
 * it). Which view a variant is comes from its title, which was right on every
 * row where the SKU was wrong. A listing whose variants point at two different
 * designs is settled by the design name that best matches the listing title and
 * is left unticked for a human to confirm.
 *
 * Every laptop skin except Tranzy is sold in both views. A listing that has
 * only one gets the other created, with the SKU from the same rule and a price
 * the admin confirms (suggested from what listings of the same finish charge).
 * Tranzy is clear film for the lid alone, so it keeps Only Top only.
 */

type Design = { key: string; code: string; name: string; kind: "cutout" | "roll"; finish: string };

type VariantPlan = {
  id: string;
  before: { sku: string; title: string; materialMultiplier: number | null; rNumber: string | null };
  after: { sku: string; title: string; materialMultiplier: number; rNumber: string };
  changed: boolean;
};

/** A view the listing lacks, to be created. */
type MissingVariant = {
  tail: string;
  sku: string;
  title: string;
  materialMultiplier: number;
  suggestedPrice: number | null;
  /** Where the suggestion came from, in words: "18 matte laptop listings". */
  suggestedFrom: string;
  weight?: number;
  weightUnit?: string;
};

type ProductPlan = {
  productId: string;
  tranzy: boolean;
  missing: MissingVariant | null;
  title: string;
  status: string;
  design: Design | null;
  /** How the design was chosen, in words. */
  via: string;
  state: "ok" | "review" | "blocked" | "clean";
  problem?: string;
  variants: VariantPlan[];
};

const TOP = { tail: "LP", title: "Only Top", multiplier: 1 };
const KEYBOARD = { tail: "LPK", title: "Top + Keyboard Area", multiplier: 2 };

const viewOf = (title: string) => (/key\s*b?oa?r?d/i.test(title) ? KEYBOARD : TOP);

const words = (s: string) =>
  new Set(
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !["skin", "laptop", "textured", "the", "and", "with", "matte"].includes(w))
  );

const overlap = (a: string, b: string) => {
  const A = words(a);
  let n = 0;
  words(b).forEach((w) => { if (A.has(w)) n++; });
  return n;
};

async function chunked<T>(ids: string[], run: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 30) out.push(...(await run(ids.slice(i, i + 30))));
  return out;
}

async function buildPlan(cutouts: any[]): Promise<ProductPlan[]> {
  const gadgets = await getDocs(query(collection(db, "gadgetTypes"), where("name", "==", "laptop")));
  const laptopIds = gadgets.docs.map((d) => d.id);
  if (!laptopIds.length) throw new Error("No gadget type called laptop");

  const [productSnap, rollSnap] = await Promise.all([
    getDocs(query(collection(db, "products"), where("gadgetTypeId", "in", laptopIds))),
    getDocs(collection(db, "rollInventory")),
  ]);
  const productIds = productSnap.docs.map((d) => d.id);
  const variants = await chunked(productIds, async (chunk) =>
    (await getDocs(query(collection(db, "variants"), where("productId", "in", chunk)))).docs.map((d) => ({
      _id: d.id,
      ...(d.data() as any),
    }))
  );

  // Every code a stock record answers to, pointing at the record.
  const stock = new Map<string, Design>();
  for (const d of rollSnap.docs) {
    const r = d.data() as any;
    const code = String(r.rNumber || "").trim().toUpperCase();
    if (code) stock.set(code, { key: `roll/${d.id}`, code, name: String(r.designName || ""), kind: "roll", finish: String(r.finish || "") });
  }
  for (const c of cutouts) {
    const code = String(c.cutoutNumber || "").trim().toUpperCase();
    if (!code) continue;
    const design: Design = { key: `cutout/${c._id}`, code, name: String(c.designName || ""), kind: "cutout", finish: String(c.finish || "") };
    for (const alias of [code, ...(c.aliases || []).map((a: string) => String(a).trim().toUpperCase())]) {
      if (alias) stock.set(alias, design);
    }
  }

  /** Every design a variant could be read as pointing at. */
  const designsFor = (v: any): Design[] => {
    const hits = new Map<string, Design>();
    const rn = String(v.rNumber || "").trim().toUpperCase();
    if (rn && stock.has(rn)) hits.set(stock.get(rn)!.key, stock.get(rn)!);
    const parts = String(v.sku || "").trim().toUpperCase().split("-");
    for (let k = parts.length; k >= 1; k--) {
      const code = parts.slice(0, k).join("-");
      const hit = stock.get(code);
      if (hit) { hits.set(hit.key, hit); break; }
    }
    return [...hits.values()];
  };

  const byProduct = new Map<string, any[]>();
  for (const v of variants) {
    if (!byProduct.has(v.productId)) byProduct.set(v.productId, []);
    byProduct.get(v.productId)!.push(v);
  }

  const isTranzy = (pdata: any, design?: Design | null) =>
    /tranz|transparent|membrane/i.test(`${pdata.finishType || ""} ${pdata.title || ""} ${design?.finish || ""}`);

  // The finish decides the price (3D costs more than matte), and many older
  // listings carry it only in the title.
  const finishKey = (pdata: any) => {
    const f = String(pdata.finishType || "").toLowerCase();
    if (f) return f;
    const t = String(pdata.title || "");
    return /3d|emboss|textur/i.test(t) ? "embossed" : /matte/i.test(t) ? "matte" : "";
  };

  // What listings of the same finish charge for each view, for the price the
  // admin is asked to confirm on a view being added.
  const priceVotes = new Map<string, Map<number, number>>();
  // Sharper: among listings of this finish whose other view costs the same as
  // this listing's, what does the missing view cost? A ₹249 matte lid sits in
  // a different price tier from a ₹399 one, and the plain finish average
  // would mix the two.
  const pairVotes = new Map<string, Map<number, number>>();
  const vote = (map: Map<string, Map<number, number>>, key: string, price: number) => {
    const votes = map.get(key) || new Map<number, number>();
    votes.set(price, (votes.get(price) || 0) + 1);
    map.set(key, votes);
  };
  for (const p of productSnap.docs) {
    const pdata = p.data() as any;
    if (isTranzy(pdata)) continue;
    const priced = (byProduct.get(p.id) || []).filter((v) => Number(v.price) > 0);
    const top = priced.find((v) => viewOf(String(v.title || "")) === TOP);
    const kb = priced.find((v) => viewOf(String(v.title || "")) === KEYBOARD);
    if (top && kb) {
      vote(pairVotes, `${finishKey(pdata)}|LP:${Number(top.price)}|LPK`, Number(kb.price));
      vote(pairVotes, `${finishKey(pdata)}|LPK:${Number(kb.price)}|LP`, Number(top.price));
    }
    for (const v of byProduct.get(p.id) || []) {
      const price = Number(v.price) || 0;
      if (price <= 0) continue;
      const key = `${finishKey(pdata)}|${viewOf(String(v.title || "")).tail}`;
      const votes = priceVotes.get(key) || new Map<number, number>();
      votes.set(price, (votes.get(price) || 0) + 1);
      priceVotes.set(key, votes);
    }
  }
  /** The price most laptop listings of this finish charge for this view. */
  const suggestPrice = (
    finishType: string,
    tail: string,
    have?: { tail: string; price: number }
  ): { price: number | null; from: string } => {
    const pick = (votes?: Map<number, number>) => {
      if (!votes || !votes.size) return null;
      const [price, count] = [...votes.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
      return { price, count };
    };
    if (have && have.price > 0) {
      const paired = pick(pairVotes.get(`${finishType}|${have.tail}:${have.price}|${tail}`));
      if (paired) {
        const other = have.tail === "LP" ? "Only Top" : "Top + Keyboard";
        return {
          price: paired.price,
          from: `${paired.count} ${finishType || ""} laptop listing${paired.count === 1 ? "" : "s"} with ${other} at ₹${have.price}`.replace("  ", " "),
        };
      }
    }
    const exact = finishType ? pick(priceVotes.get(`${finishType}|${tail}`)) : null;
    if (exact) return { price: exact.price, from: `${exact.count} ${finishType} laptop listing${exact.count === 1 ? "" : "s"}` };
    const any = new Map<number, number>();
    for (const [k, votes] of priceVotes) {
      if (!k.endsWith(`|${tail}`)) continue;
      votes.forEach((n, price) => any.set(price, (any.get(price) || 0) + n));
    }
    const fallback = pick(any);
    return fallback
      ? { price: fallback.price, from: `${fallback.count} laptop listings (finish unknown)` }
      : { price: null, from: "" };
  };

  const plans: ProductPlan[] = [];
  for (const p of productSnap.docs) {
    const pdata = p.data() as any;
    const list = byProduct.get(p.id) || [];
    if (!list.length) continue;

    const candidates = new Map<string, Design>();
    list.forEach((v) => designsFor(v).forEach((d) => candidates.set(d.key, d)));

    let design: Design | null = null;
    let via = "";
    let state: ProductPlan["state"] = "ok";
    let problem: string | undefined;

    if (candidates.size === 1) {
      design = [...candidates.values()][0];
      via = design.kind === "cutout" ? "cutout record" : "roll record";
    } else if (candidates.size > 1) {
      const ranked = [...candidates.values()]
        .map((d) => ({ d, score: overlap(pdata.title, d.name) }))
        .sort((a, b) => b.score - a.score);
      if (ranked[0].score > 0 && ranked[0].score > (ranked[1]?.score ?? 0)) {
        design = ranked[0].d;
        via = `name match over ${ranked.slice(1).map((r) => r.d.code).join(", ")}`;
        state = "review";
        problem = `Variants point at ${ranked.map((r) => r.d.code).join(" and ")} — picked by design name`;
      } else {
        state = "blocked";
        problem = `Variants point at ${ranked.map((r) => r.d.code).join(" and ")} and the names do not settle it — fix the cutout codes first`;
      }
    } else {
      state = "blocked";
      problem = "No stock record matches these SKUs — add the R- number under Rolls Management, or the cutout (or this code as an alias) under Cutouts, then reopen this";
    }

    const variantPlans: VariantPlan[] = list.map((v) => {
      const view = viewOf(String(v.title || ""));
      const before = {
        sku: String(v.sku || ""),
        title: String(v.title || ""),
        materialMultiplier: v.materialMultiplier ?? null,
        rNumber: v.rNumber ?? null,
      };
      const after = design
        ? { sku: `${design.code}-${view.tail}`, title: view.title, materialMultiplier: view.multiplier, rNumber: design.code }
        : { sku: before.sku, title: before.title, materialMultiplier: Number(before.materialMultiplier) || 1, rNumber: String(before.rNumber || "") };
      const changed =
        before.sku !== after.sku ||
        before.title !== after.title ||
        Number(before.materialMultiplier) !== after.materialMultiplier ||
        before.rNumber !== after.rNumber;
      return { id: v._id, before, after, changed };
    });

    if (design) {
      const skus = variantPlans.map((v) => v.after.sku);
      if (new Set(skus).size !== skus.length) {
        state = "blocked";
        problem = "Two variants read as the same view — check their titles";
      }
    }

    const tranzy = isTranzy(pdata, design);
    let missing: MissingVariant | null = null;
    if (design && state !== "blocked") {
      const views = new Set(variantPlans.map((v) => viewOf(v.after.title).tail));
      if (tranzy) {
        if (views.has(KEYBOARD.tail)) {
          state = "review";
          problem = "Tranzy is lid-only, but this listing sells a keyboard view — remove that variant by hand";
        }
      } else if (views.size === 1) {
        const want = views.has(TOP.tail) ? KEYBOARD : TOP;
        const sibling = list[0];
        missing = {
          tail: want.tail,
          sku: `${design.code}-${want.tail}`,
          title: want.title,
          materialMultiplier: want.multiplier,
          ...(() => {
            const sp = suggestPrice(finishKey(pdata), want.tail, {
              tail: want.tail === TOP.tail ? KEYBOARD.tail : TOP.tail,
              price: Number(sibling?.price) || 0,
            });
            return { suggestedPrice: sp.price, suggestedFrom: sp.from };
          })(),
          weight: Number(sibling?.weight) || undefined,
          weightUnit: sibling?.weightUnit || undefined,
        };
      }
    }
    if (state === "ok" && !missing && !variantPlans.some((v) => v.changed)) state = "clean";

    plans.push({
      productId: p.id,
      tranzy,
      missing,
      title: String(pdata.title || ""),
      status: String(pdata.status || ""),
      design,
      via,
      state,
      problem,
      variants: variantPlans,
    });
  }

  // A new SKU must not already belong to a variant this run is not renaming,
  // or to a variant in another listing being renamed to the same thing — two
  // listings for one design.
  const finalSku = new Map<string, string>();
  for (const v of variants) finalSku.set(v._id, String(v.sku || "").toUpperCase());
  for (const plan of plans) {
    if (plan.state === "blocked") continue;
    for (const vp of plan.variants) finalSku.set(vp.id, vp.after.sku.toUpperCase());
    if (plan.missing) finalSku.set(`new:${plan.productId}`, plan.missing.sku.toUpperCase());
  }
  const owners = new Map<string, string[]>();
  for (const [id, sku] of finalSku) owners.set(sku, [...(owners.get(sku) || []), id]);
  for (const plan of plans) {
    if (plan.state === "blocked" || plan.state === "clean") continue;
    const skus = [...plan.variants.map((vp) => vp.after.sku), ...(plan.missing ? [plan.missing.sku] : [])];
    const clash = skus.find((sku) => (owners.get(sku.toUpperCase()) || []).length > 1);
    if (clash) {
      const other = plans.find((o) => o !== plan && (
        o.variants.some((x) => x.after.sku.toUpperCase() === clash.toUpperCase()) ||
        o.missing?.sku.toUpperCase() === clash.toUpperCase()
      ));
      plan.state = "blocked";
      plan.problem = `${clash} would also be used by ${other ? `"${other.title}"` : "another variant"} — two listings for one design`;
    }
  }

  const order = { blocked: 0, review: 1, ok: 2, clean: 3 } as const;
  return plans.sort((a, b) => order[a.state] - order[b.state] || a.title.localeCompare(b.title));
}

export function LaptopSkuFix({ cutouts: given, onClose }: { cutouts?: any[]; onClose: () => void }) {
  const recalcStock = useAction(api.materials.recalcMaterialStock);
  // Opened from the Rolls tab there is no cutout list to hand in.
  const fetched = useQuery(api.aiMockups.getCutouts, given ? "skip" : {}) as any[] | undefined;
  const cutouts = given ?? fetched;
  const [plans, setPlans] = useState<ProductPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [showClean, setShowClean] = useState(false);
  // Price for each view being added, by product. Asked, never assumed.
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [bulkPrice, setBulkPrice] = useState<{ LP: string; LPK: string }>({ LP: "", LPK: "" });

  const load = async () => {
    if (!cutouts) return;
    setPlans(null);
    setError(null);
    try {
      const next = await buildPlan(cutouts);
      setPlans(next);
      setPicked(new Set(next.filter((p) => p.state === "ok").map((p) => p.productId)));
      // Rows start empty: the admin states each price, by hand or with one of
      // the fill buttons.
      setPrices({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the catalogue");
    }
  };

  useEffect(() => { if (cutouts) void load(); }, [!!cutouts]);

  const counts = useMemo(() => {
    const c = { ok: 0, review: 0, blocked: 0, clean: 0 };
    (plans || []).forEach((p) => { c[p.state]++; });
    return c;
  }, [plans]);

  const apply = async () => {
    if (!plans) return;
    const chosen = plans.filter((p) => picked.has(p.productId) && p.state !== "blocked" && p.state !== "clean");
    const writes = chosen.flatMap((p) => p.variants.filter((v) => v.changed).map((v) => ({ p, v })));
    const adds = chosen.filter((p) => p.missing);
    if (!writes.length && !adds.length) return toast.info("Nothing selected to change");
    const unpriced = adds.filter((p) => !(Number(prices[p.productId]) > 0));
    if (unpriced.length) {
      return toast.error(`Set a price for the new variant on ${unpriced.length} listing(s) — first: "${unpriced[0].title}"`);
    }
    if (!confirm(
      `Update ${writes.length} variant(s) and add ${adds.length} missing variant(s) across ${chosen.length} listing(s)? A backup file downloads first.`
    )) return;

    // Planned ids for the new variants, so the backup can name them.
    const newIds = new Map(adds.map((p) => [p.productId, doc(collection(db, "variants")).id]));

    // Backup first, so any row can be put back by hand (and any added row deleted).
    const backup = JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        variants: writes.map(({ p, v }) => ({ productId: p.productId, variantId: v.id, before: v.before, after: v.after })),
        added: adds.map((p) => ({
          productId: p.productId,
          variantId: newIds.get(p.productId),
          sku: p.missing!.sku,
          title: p.missing!.title,
          price: Number(prices[p.productId]),
        })),
      },
      null,
      1
    );
    const url = URL.createObjectURL(new Blob([backup], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `laptop-sku-fix-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    setRunning(true);
    try {
      for (let i = 0; i < writes.length; i += 400) {
        const batch = writeBatch(db);
        writes.slice(i, i + 400).forEach(({ v }) => {
          batch.update(doc(db, "variants", v.id), {
            sku: v.after.sku,
            title: v.after.title,
            materialMultiplier: v.after.materialMultiplier,
            rNumber: v.after.rNumber,
            skuFixedAt: Date.now(),
          });
        });
        await batch.commit();
      }
      const now = Date.now();
      for (let i = 0; i < adds.length; i += 200) {
        const batch = writeBatch(db);
        adds.slice(i, i + 200).forEach((p, k) => {
          const m = p.missing!;
          batch.set(doc(db, "variants", newIds.get(p.productId)!), {
            _creationTime: now + i + k,
            productId: p.productId,
            sku: m.sku,
            title: m.title,
            price: Number(prices[p.productId]),
            inventoryQuantity: 0,
            materialMultiplier: m.materialMultiplier,
            rNumber: p.design!.code,
            ...(m.weight ? { weight: m.weight } : {}),
            ...(m.weightUnit ? { weightUnit: m.weightUnit } : {}),
            isDefaultVariant: false,
            createdBySkuFix: now,
          });
          batch.update(doc(db, "products", p.productId), { hasMultipleVariants: true, updatedAt: now });
          p.variants.forEach((v) => batch.update(doc(db, "variants", v.id), { isDefaultVariant: false }));
        });
        await batch.commit();
      }
      // Stock follows the design code, so every design touched is recounted.
      const codes = [...new Set(chosen.map((p) => p.design!.code))];
      try {
        await recalcStock({ codes });
      } catch {
        toast.warning("SKUs saved, but recounting stock failed — edit a sheet count to retry");
      }
      toast.success(`Fixed ${writes.length} variant(s) and added ${adds.length} on ${chosen.length} listing(s)`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? `Stopped: ${e.message}` : "Stopped");
    } finally {
      setRunning(false);
    }
  };

  const visible = (plans || []).filter((p) => showClean || p.state !== "clean");
  const selectable = (p: ProductPlan) => p.state === "ok" || p.state === "review";

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !running) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Fix laptop SKUs</DialogTitle>
          <DialogDescription>
            Every laptop listing becomes <code>&lt;design&gt;-LP</code> for Only Top (1 sheet) and{" "}
            <code>&lt;design&gt;-LPK</code> for Top + Keyboard Area (2 sheets). The design code comes from the
            cutout or roll record; the view comes from the variant title. Every listing except Tranzy gets both
            views — a missing one is added at the price you set. Nothing changes until you press Apply.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : !plans ? (
          <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
            <Loader2Icon className="size-4 animate-spin" />
            Reading every laptop listing and matching it to its cutout — a few seconds…
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge className="bg-emerald-600">{counts.ok} ready</Badge>
              <Badge className="bg-amber-500">{counts.review} need a look</Badge>
              <Badge variant="destructive">{counts.blocked} blocked</Badge>
              <Badge variant="outline">{counts.clean} already correct</Badge>
              <Badge variant="outline" className="border-violet-300 text-violet-700 dark:text-violet-300">
                {(plans || []).filter((p) => p.missing).length} missing a view
              </Badge>
              <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={showClean} onChange={(e) => setShowClean(e.target.checked)} />
                show correct ones
              </label>
            </div>

            {(plans || []).some((p) => p.missing) && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 p-2 text-xs dark:border-violet-900 dark:bg-violet-950/30">
                <span className="font-medium">Price for added variants:</span>
                <span>Only Top ₹</span>
                <Input className="h-7 w-20" inputMode="numeric" value={bulkPrice.LP}
                  onChange={(e) => setBulkPrice({ ...bulkPrice, LP: e.target.value })} />
                <span>Top + Keyboard ₹</span>
                <Input className="h-7 w-20" inputMode="numeric" value={bulkPrice.LPK}
                  onChange={(e) => setBulkPrice({ ...bulkPrice, LPK: e.target.value })} />
                <Button size="sm" variant="outline" className="h-7"
                  disabled={!(Number(bulkPrice.LP) > 0 || Number(bulkPrice.LPK) > 0)}
                  onClick={() => {
                    const next = { ...prices };
                    (plans || []).forEach((p) => {
                      const v = p.missing ? bulkPrice[p.missing.tail as "LP" | "LPK"] : "";
                      if (p.missing && Number(v) > 0) next[p.productId] = v;
                    });
                    setPrices(next);
                  }}>
                  Apply to all
                </Button>
                <span className="text-muted-foreground">or</span>
                <Button size="sm" variant="outline" className="h-7"
                  onClick={() => {
                    const next = { ...prices };
                    (plans || []).forEach((p) => {
                      if (p.missing?.suggestedPrice && !(Number(next[p.productId]) > 0)) next[p.productId] = String(p.missing.suggestedPrice);
                    });
                    setPrices(next);
                  }}>
                  Use all suggested prices
                </Button>
                <span className="w-full text-muted-foreground">
                  A suggestion is the price most laptop listings of the same finish (matte, 3D) charge for that view.
                  Rows stay empty until you pick it, apply a price, or type one.
                </span>
              </div>
            )}

            <div className="space-y-2">
              {visible.map((p) => (
                <div
                  key={p.productId}
                  className={`rounded-lg border p-3 ${
                    p.state === "blocked" ? "border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20"
                    : p.state === "review" ? "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
                    : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      disabled={!selectable(p) || running}
                      checked={picked.has(p.productId)}
                      onChange={(e) => {
                        const next = new Set(picked);
                        if (e.target.checked) next.add(p.productId); else next.delete(p.productId);
                        setPicked(next);
                      }}
                    />
                    <a
                      href={`/backend-skinly/products/${p.productId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate font-medium hover:underline"
                    >
                      {p.title}
                    </a>
                    {p.status !== "active" && <Badge variant="outline" className="text-[10px]">{p.status}</Badge>}
                    {p.design && (
                      <span className="text-xs text-muted-foreground">
                        design <span className="font-mono font-semibold text-foreground">{p.design.code}</span>
                        {p.design.name && <> · {p.design.name}</>} · {p.via}
                      </span>
                    )}
                  </div>
                  {p.problem && (
                    <p className={`mt-1 text-xs ${p.state === "blocked" ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300"}`}>
                      {p.problem}
                    </p>
                  )}
                  <div className="mt-2 space-y-1">
                    {p.variants.map((v) => (
                      <div key={v.id} className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="w-44 truncate font-mono text-muted-foreground">
                          {v.before.sku} · {v.before.title} · ×{v.before.materialMultiplier ?? "—"}
                        </span>
                        {v.changed && p.design ? (
                          <>
                            <ArrowRightIcon className="size-3 text-muted-foreground" />
                            <span className="font-mono font-semibold">
                              {v.after.sku} · {v.after.title} · ×{v.after.materialMultiplier}
                            </span>
                          </>
                        ) : (
                          <span className="text-emerald-600">unchanged</span>
                        )}
                      </div>
                    ))}
                    {p.missing && (
                      <div className="flex flex-wrap items-center gap-2 rounded-md bg-violet-50 px-2 py-1 text-xs dark:bg-violet-950/30">
                        <Badge className="bg-violet-600 text-[10px]">new</Badge>
                        <span className="font-mono font-semibold">
                          {p.missing.sku} · {p.missing.title} · ×{p.missing.materialMultiplier}
                        </span>
                        <span className="ml-auto flex items-center gap-1">
                          ₹
                          <Input
                            className={`h-7 w-20 ${Number(prices[p.productId]) > 0 ? "" : "border-rose-400"}`}
                            inputMode="numeric"
                            placeholder="price"
                            value={prices[p.productId] ?? ""}
                            onChange={(e) => setPrices({ ...prices, [p.productId]: e.target.value })}
                          />
                          {p.missing.suggestedPrice ? (
                            <button
                              type="button"
                              disabled={running}
                              title={`Most common price on ${p.missing.suggestedFrom}`}
                              onClick={() => setPrices({ ...prices, [p.productId]: String(p.missing!.suggestedPrice) })}
                              className={`rounded border px-1.5 py-0.5 text-[11px] font-medium transition ${
                                prices[p.productId] === String(p.missing.suggestedPrice)
                                  ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "border-violet-300 bg-white text-violet-700 hover:bg-violet-100 dark:bg-transparent dark:text-violet-300"
                              }`}
                            >
                              Use suggested ₹{p.missing.suggestedPrice}
                            </button>
                          ) : (
                            <span className="text-muted-foreground">no price to suggest</span>
                          )}
                          {p.missing.suggestedFrom && (
                            <span className="text-[10px] text-muted-foreground">from {p.missing.suggestedFrom}</span>
                          )}
                        </span>
                      </div>
                    )}
                    {p.tranzy && <p className="text-[11px] text-muted-foreground">Tranzy — lid only, no keyboard view.</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <DownloadIcon className="size-3" /> A backup of every changed variant downloads before anything is written.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={running} onClick={onClose}>Close</Button>
            <Button disabled={running || !plans || !picked.size} onClick={() => void apply()}>
              {running && <Loader2Icon className="mr-1.5 size-4 animate-spin" />}
              Apply to {picked.size} listing{picked.size === 1 ? "" : "s"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
