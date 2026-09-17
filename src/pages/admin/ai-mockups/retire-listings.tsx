import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { ArrowRightIcon, Loader2Icon } from "lucide-react";
import { GADGET_PAGES } from "@/lib/category-paths.mjs";
import { LISTING_SCOPES } from "@/lib/ai-mockup-shots.ts";

/**
 * Retires a design's old listings in favour of its studio-made ones.
 *
 * Nothing is deleted. An old listing becomes "archived" — off the storefront,
 * the catalogue and the sitemap — and remembers where it now points; the next
 * build writes that as a 301, so a crawled or shared URL lands on the new
 * listing instead of a 404. Orders keep their product. Anyone waiting for a
 * restock on the old listing is moved to the new one.
 */

type Listing = {
  id: string;
  title: string;
  slug: string;
  status: string;
  gadget: string;
  listingKind: string;
  variants: Array<{ id: string; title: string; materialMultiplier?: number }>;
};

async function listingsForDesign(code: string, gadgetNames: Record<string, string>): Promise<Listing[]> {
  const [range, bare] = await Promise.all([
    getDocs(query(collection(db, "variants"), where("sku", ">=", `${code}-`), where("sku", "<", `${code}-`))),
    getDocs(query(collection(db, "variants"), where("sku", "==", code))),
  ]);
  const byProduct = new Map<string, Listing["variants"]>();
  for (const d of [...range.docs, ...bare.docs]) {
    const v = d.data() as any;
    if (!v.productId) continue;
    const list = byProduct.get(v.productId) || [];
    list.push({ id: d.id, title: String(v.title || ""), materialMultiplier: v.materialMultiplier });
    byProduct.set(v.productId, list);
  }
  const out: Listing[] = [];
  for (const [id, variants] of byProduct) {
    const p = await getDoc(doc(db, "products", id));
    if (!p.exists()) continue;
    const d = p.data() as any;
    out.push({
      id,
      title: String(d.title || ""),
      slug: String(d.slug || ""),
      status: String(d.status || ""),
      gadget: gadgetNames[d.gadgetTypeId] || String(d.gadgetCategory || ""),
      listingKind: String(d.listingKind || ""),
      variants,
    });
  }
  return out;
}

/** The new listing an old one should point at: the gadget's catch-all brand listing first. */
function defaultTarget(old: Listing, fresh: Listing[]): string {
  const same = fresh.filter((f) => f.gadget === old.gadget && f.status === "active");
  const general = same.find((f) => LISTING_SCOPES[f.listingKind.toLowerCase()]?.modelBrandsExclude);
  const pick = general || same[0];
  if (pick) return `/products/${pick.slug}`;
  return (GADGET_PAGES as Record<string, string>)[old.gadget] || "/products";
}

export function RetireListings({ design, onClose }: { design: { code: string; name: string }; onClose: () => void }) {
  const [rows, setRows] = useState<Listing[] | null>(null);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const gts = await getDocs(collection(db, "gadgetTypes"));
        const names = Object.fromEntries(gts.docs.map((g) => [g.id, String((g.data() as any).name || "").toLowerCase()]));
        const all = await listingsForDesign(design.code, names);
        setRows(all);
        const fresh = all.filter((l) => l.listingKind);
        setTargets(Object.fromEntries(
          all.filter((l) => !l.listingKind && l.status !== "archived").map((l) => [l.id, defaultTarget(l, fresh)])
        ));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not read the listings");
        setRows([]);
      }
    })();
  }, [design.code]);

  const old = useMemo(() => (rows || []).filter((l) => !l.listingKind && l.status !== "archived"), [rows]);
  const fresh = useMemo(() => (rows || []).filter((l) => l.listingKind), [rows]);
  const liveSlugs = new Set(fresh.filter((f) => f.status === "active").map((f) => `/products/${f.slug}`));
  const pages = [...new Set([...Object.values(GADGET_PAGES as Record<string, string>), "/products"])];
  const pointsAtDraft = (t: string) => t.startsWith("/products/") && !liveSlugs.has(t);
  const ready = old.filter((l) => targets[l.id] && !pointsAtDraft(targets[l.id]));

  const apply = async () => {
    if (!ready.length) return;
    if (!confirm(`Retire ${ready.length} old listing(s) of ${design.code}? They are archived and redirected, not deleted.`)) return;
    const backup = JSON.stringify({ createdAt: new Date().toISOString(), design: design.code, retired: ready.map((l) => ({ ...l, redirectTo: targets[l.id] })) }, null, 1);
    const url = URL.createObjectURL(new Blob([backup], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `retire-${design.code}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    setRunning(true);
    let moved = 0;
    try {
      for (const l of ready) {
        const target = targets[l.id];
        const targetListing = fresh.find((f) => `/products/${f.slug}` === target);
        // Waiting restock requests follow the design to its new listing, on the
        // variant that spends the same material (Only Top → Only Top).
        if (targetListing) {
          const waiting = await getDocs(query(collection(db, "stockNotifications"), where("productId", "==", l.id), where("status", "==", "waiting")));
          for (const n of waiting.docs) {
            const data = n.data() as any;
            const from = l.variants.find((v) => v.id === data.variantId);
            const to = targetListing.variants.find((v) => (Number(v.materialMultiplier) || 1) === (Number(from?.materialMultiplier) || 1)) || targetListing.variants[0];
            if (!to) continue;
            await setDoc(doc(db, "stockNotifications", `${to.id}_${data.phoneNumber}`), {
              ...data,
              variantId: to.id,
              variantTitle: to.title,
              productId: targetListing.id,
              productTitle: targetListing.title,
              productSlug: targetListing.slug,
              movedFrom: l.id,
            });
            await deleteDoc(n.ref);
            moved++;
          }
        }
        await updateDoc(doc(db, "products", l.id), {
          status: "archived",
          redirectTo: target,
          retiredAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      toast.success(`Retired ${ready.length} listing(s)${moved ? ` · moved ${moved} restock request(s)` : ""}. Redirects go live with the next build.`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? `Stopped: ${e.message}` : "Stopped");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !running) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Retire old listings of {design.code}</DialogTitle>
          <DialogDescription>
            Old listings are archived and their URLs redirected (301) to the listing or page you choose. Only a
            live listing can be a target — a draft would redirect to a page nobody can see.
          </DialogDescription>
        </DialogHeader>

        {!rows ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2Icon className="size-4 animate-spin" /> Reading this design's listings…</p>
        ) : !old.length ? (
          <p className="text-sm text-muted-foreground">No old listings left for this design.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {fresh.filter((f) => f.status === "active").length} new listing(s) live, {fresh.filter((f) => f.status !== "active").length} waiting for a picture.
            </p>
            {old.map((l) => {
              const options = [
                ...fresh.filter((f) => f.gadget === l.gadget).map((f) => ({ value: `/products/${f.slug}`, label: `${f.listingKind}${f.status === "active" ? "" : " (draft)"}` })),
                ...pages.map((p) => ({ value: p, label: `page ${p}` })),
              ];
              const t = targets[l.id] || "";
              return (
                <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{l.title}</p>
                    <p className="text-xs text-muted-foreground">/products/{l.slug} · <span className="capitalize">{l.gadget}</span> · {l.status}</p>
                  </div>
                  <ArrowRightIcon className="size-4 text-muted-foreground" />
                  <Select value={t} onValueChange={(v) => setTargets({ ...targets, [l.id]: v })}>
                    <SelectTrigger className="h-8 w-[240px] text-xs"><SelectValue placeholder="Redirect to…" /></SelectTrigger>
                    <SelectContent>
                      {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {pointsAtDraft(t) && <Badge variant="destructive" className="text-[10px]">target not live</Badge>}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={running} onClick={onClose}>Close</Button>
          <Button disabled={running || !ready.length} onClick={() => void apply()}>
            {running && <Loader2Icon className="mr-1.5 size-4 animate-spin" />}
            Retire {ready.length} listing{ready.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
