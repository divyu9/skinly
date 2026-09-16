import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAction } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
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
 */

type Design = { key: string; code: string; name: string; kind: "cutout" | "roll" };

type VariantPlan = {
  id: string;
  before: { sku: string; title: string; materialMultiplier: number | null; rNumber: string | null };
  after: { sku: string; title: string; materialMultiplier: number; rNumber: string };
  changed: boolean;
};

type ProductPlan = {
  productId: string;
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
    if (code) stock.set(code, { key: `roll/${d.id}`, code, name: String(r.designName || ""), kind: "roll" });
  }
  for (const c of cutouts) {
    const code = String(c.cutoutNumber || "").trim().toUpperCase();
    if (!code) continue;
    const design: Design = { key: `cutout/${c._id}`, code, name: String(c.designName || ""), kind: "cutout" };
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
      problem = "No cutout or roll record matches these SKUs — add the design (or its code as an alias) first";
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
    if (state === "ok" && !variantPlans.some((v) => v.changed)) state = "clean";

    plans.push({
      productId: p.id,
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
  }
  const owners = new Map<string, string[]>();
  for (const [id, sku] of finalSku) owners.set(sku, [...(owners.get(sku) || []), id]);
  for (const plan of plans) {
    if (plan.state === "blocked" || plan.state === "clean") continue;
    const clash = plan.variants.find((vp) => (owners.get(vp.after.sku.toUpperCase()) || []).length > 1);
    if (clash) {
      const other = plans.find((o) => o !== plan && o.variants.some((x) => x.after.sku.toUpperCase() === clash.after.sku.toUpperCase()));
      plan.state = "blocked";
      plan.problem = `${clash.after.sku} would also be used by ${other ? `"${other.title}"` : "another variant"} — two listings for one design`;
    }
  }

  const order = { blocked: 0, review: 1, ok: 2, clean: 3 } as const;
  return plans.sort((a, b) => order[a.state] - order[b.state] || a.title.localeCompare(b.title));
}

export function LaptopSkuFix({ cutouts, onClose }: { cutouts: any[]; onClose: () => void }) {
  const recalcStock = useAction(api.materials.recalcMaterialStock);
  const [plans, setPlans] = useState<ProductPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [showClean, setShowClean] = useState(false);

  const load = async () => {
    setPlans(null);
    setError(null);
    try {
      const next = await buildPlan(cutouts);
      setPlans(next);
      setPicked(new Set(next.filter((p) => p.state === "ok").map((p) => p.productId)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the catalogue");
    }
  };

  useEffect(() => { void load(); }, []);

  const counts = useMemo(() => {
    const c = { ok: 0, review: 0, blocked: 0, clean: 0 };
    (plans || []).forEach((p) => { c[p.state]++; });
    return c;
  }, [plans]);

  const apply = async () => {
    if (!plans) return;
    const chosen = plans.filter((p) => picked.has(p.productId) && p.state !== "blocked" && p.state !== "clean");
    const writes = chosen.flatMap((p) => p.variants.filter((v) => v.changed).map((v) => ({ p, v })));
    if (!writes.length) return toast.info("Nothing selected to change");
    if (!confirm(`Update ${writes.length} variant(s) across ${chosen.length} listing(s)? A backup file downloads first.`)) return;

    // Backup first, so any row can be put back by hand.
    const backup = JSON.stringify(
      { createdAt: new Date().toISOString(), variants: writes.map(({ p, v }) => ({ productId: p.productId, variantId: v.id, before: v.before, after: v.after })) },
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
      // Stock follows the design code, so every design touched is recounted.
      const codes = [...new Set(chosen.map((p) => p.design!.code))];
      try {
        await recalcStock({ codes });
      } catch {
        toast.warning("SKUs saved, but recounting stock failed — edit a sheet count to retry");
      }
      toast.success(`Fixed ${writes.length} variant(s) on ${chosen.length} listing(s)`);
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
            cutout or roll record; the view comes from the variant title. Nothing changes until you press Apply.
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
              <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={showClean} onChange={(e) => setShowClean(e.target.checked)} />
                show correct ones
              </label>
            </div>

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
