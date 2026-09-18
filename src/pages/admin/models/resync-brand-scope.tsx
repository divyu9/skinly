import { useState } from "react";
import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { scopeFor } from "@/lib/ai-mockup-shots.ts";
import { Button } from "@/components/ui/button.tsx";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

/**
 * A listing's brand scope (`modelBrands` / `modelBrandsExclude`) is computed
 * once, at the moment a listing is created or revised, and then frozen onto
 * that product document — so a fix to the scope rules in ai-mockup-shots.ts
 * (Android Phone used to exclude every named phone brand; it should exclude
 * only Apple) reaches only listings made after the fix, not the ones already
 * sitting in the catalogue.
 *
 * This walks every studio listing and brings its stored scope in line with
 * what the code says it should be right now, so a scope-rule fix reaches the
 * whole catalogue in one click instead of only new launches.
 */
const sameSet = (a?: string[], b?: string[]) => {
  const x = [...new Set(a || [])].sort();
  const y = [...new Set(b || [])].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

export function ResyncBrandScopeButton() {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const snap = await getDocs(query(collection(db, "products"), where("listingKind", ">", "")));
      let changed = 0, checked = 0;
      const updates: Array<{ id: string; modelBrands?: string[]; modelBrandsExclude?: string[]; clearBrands: boolean; clearExclude: boolean }> = [];

      for (const d of snap.docs) {
        const p: any = d.data();
        if (p.status === "archived") continue;
        checked++;
        const wanted = scopeFor(String(p.listingKind || ""));
        if (!wanted) continue; // Not a kind the code assigns a scope to — leave whatever it has.
        const haveBrands: string[] = Array.isArray(p.modelBrands) ? p.modelBrands : [];
        const haveExclude: string[] = Array.isArray(p.modelBrandsExclude) ? p.modelBrandsExclude : [];
        const wantBrands = wanted.modelBrands || [];
        const wantExclude = wanted.modelBrandsExclude || [];
        if (sameSet(haveBrands, wantBrands) && sameSet(haveExclude, wantExclude)) continue;

        updates.push({
          id: d.id,
          modelBrands: wantBrands.length ? wantBrands : undefined,
          modelBrandsExclude: wantExclude.length ? wantExclude : undefined,
          clearBrands: !wantBrands.length && haveBrands.length > 0,
          clearExclude: !wantExclude.length && haveExclude.length > 0,
        });
      }

      for (let i = 0; i < updates.length; i += 450) {
        const batch = writeBatch(db);
        for (const u of updates.slice(i, i + 450)) {
          const patch: Record<string, unknown> = { updatedAt: Date.now() };
          if (u.modelBrands) patch.modelBrands = u.modelBrands;
          else if (u.clearBrands) patch.modelBrands = [];
          if (u.modelBrandsExclude) patch.modelBrandsExclude = u.modelBrandsExclude;
          else if (u.clearExclude) patch.modelBrandsExclude = [];
          batch.update(doc(db, "products", u.id), patch);
        }
        await batch.commit();
      }
      changed = updates.length;

      toast.success(
        changed
          ? `${changed} listing${changed === 1 ? "" : "s"} updated to match the current brand scope (${checked} checked)`
          : `Already in sync (${checked} listings checked)`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not resync brand scope");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" disabled={busy} onClick={() => void run()} title="Brings every listing's device-brand scope in line with the current rules — needed after a rule like Android Phone's changes">
      {busy ? <Loader2Icon className="size-4 mr-2 animate-spin" /> : <RefreshCwIcon className="size-4 mr-2" />}
      Resync brand scope
    </Button>
  );
}
