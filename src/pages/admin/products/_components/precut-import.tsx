import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAction } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Loader2Icon } from "lucide-react";
import { isDeadImageUrl } from "@/lib/image-fallback.ts";

/**
 * Brings the pre-cut phone designs (L-, M-, T-, A-…) into the cutout shelf.
 *
 * Each of these designs has been a single phone listing whose stock lived on
 * that listing's one variant. Once a design has a listing per phone brand,
 * that number has to live somewhere all of them read — the cutout record,
 * exactly as for laptop sheets: one design, one pile of pieces, every listing
 * drawing on it through its SKU (L-239, L-239-IPH, L-239-SAM…).
 *
 * The import takes the pile from the listing's current stock, the name from
 * its title, the finish from the series (L 3D, M matte, T Tranzy) and marks
 * the record as usable for phones only, so the studio offers phone listings
 * for it and nothing else. Designs already on the shelf are left alone.
 */

type Candidate = {
  code: string;
  designName: string;
  finish: string;
  pieces: number;
  imageUrl?: string;
  listingTitle: string;
  status: string;
  exists: boolean;
};

const FINISH_BY_PREFIX: Record<string, string> = {
  L: "3D Textured",
  M: "Matte",
  T: "Tranzy (transparent)",
};

/** "Gojo Satoru evil eye 3D Finish Phone Skin" → "Gojo Satoru evil eye". */
const designNameFrom = (title: string) =>
  title
    .replace(/^tranzy series\s*/i, "")
    .replace(/\s*\((?:[A-Z]{1,2}-\d+)\)\s*/g, " ")
    // Only after the first word: "Embossed Topo Black 3D…" keeps "Embossed".
    .replace(/(?<=\S)\s+[-–]?\s*\b(3d|matte|tranzy|textured|embossed|finish|phone skin|mobile skin|skin)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

const finishFrom = (prefix: string, title: string) =>
  FINISH_BY_PREFIX[prefix] ||
  (/tranz|transparent|membrane/i.test(title) ? "Tranzy (transparent)" : /3d|textur|emboss/i.test(title) ? "3D Textured" : "Matte");

export function PrecutImport({ cutouts, onClose }: { cutouts: any[]; onClose: () => void }) {
  const recalcStock = useAction(api.materials.recalcMaterialStock);
  const [prefixes, setPrefixes] = useState("L, M, T, A");
  const [rows, setRows] = useState<Candidate[] | null>(null);
  const [running, setRunning] = useState(false);

  const known = useMemo(() => {
    const s = new Set<string>();
    cutouts.forEach((c) => [c.cutoutNumber, ...(c.aliases || [])].forEach((x: string) => x && s.add(String(x).toUpperCase())));
    return s;
  }, [cutouts]);

  const scan = async () => {
    setRows(null);
    const wanted = prefixes.split(",").map((p) => p.trim().toUpperCase()).filter(Boolean);
    const pattern = new RegExp(`^(${wanted.map((p) => p.replace(/[^A-Z]/g, "")).join("|")})-(\\d+[A-Z]?)$`, "i");
    const phone = await getDocs(query(collection(db, "gadgetTypes"), where("name", "==", "phone")));
    const phoneIds = phone.docs.map((d) => d.id);
    const products = await getDocs(query(collection(db, "products"), where("gadgetTypeId", "in", phoneIds)));
    const byId = new Map(products.docs.map((d) => [d.id, d.data() as any]));
    const ids = [...byId.keys()];
    const found = new Map<string, Candidate>();
    for (let i = 0; i < ids.length; i += 30) {
      const snap = await getDocs(query(collection(db, "variants"), where("productId", "in", ids.slice(i, i + 30))));
      for (const d of snap.docs) {
        const v = d.data() as any;
        const m = pattern.exec(String(v.sku || "").trim());
        const p = byId.get(v.productId);
        if (!m || !p) continue;
        const code = `${m[1]}-${m[2]}`.toUpperCase();
        const pieces = Math.max(0, Number(v.inventoryQuantity) || 0);
        const prev = found.get(code);
        // One code, one design: keep the listing that is live and holds most.
        if (prev && (prev.status === "active" && p.status !== "active" || prev.pieces >= pieces)) continue;
        const image = (p.images || []).map((x: any) => (typeof x === "string" ? x : x?.url)).find((u: string) => u && !isDeadImageUrl(u));
        found.set(code, {
          code,
          designName: designNameFrom(String(p.title || "")) || code,
          finish: finishFrom(m[1].toUpperCase(), String(p.title || "")),
          pieces,
          imageUrl: image,
          listingTitle: String(p.title || ""),
          status: String(p.status || ""),
          exists: known.has(code),
        });
      }
    }
    setRows([...found.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })));
  };

  useEffect(() => { void scan().catch((e) => { toast.error(e instanceof Error ? e.message : "Scan failed"); setRows([]); }); }, []);

  const toAdd = (rows || []).filter((r) => !r.exists);
  const set = (code: string, patch: Partial<Candidate>) =>
    setRows((prev) => (prev || []).map((r) => (r.code === code ? { ...r, ...patch } : r)));

  const apply = async () => {
    if (!toAdd.length) return;
    if (!confirm(`Add ${toAdd.length} pre-cut phone design(s) to the cutout shelf?`)) return;
    setRunning(true);
    try {
      const now = Date.now();
      for (let i = 0; i < toAdd.length; i += 400) {
        const batch = writeBatch(db);
        toAdd.slice(i, i + 400).forEach((r, k) => {
          batch.set(doc(collection(db, "cutoutInventory")), {
            cutoutNumber: r.code,
            designName: r.designName,
            finish: r.finish,
            sheetsAvailable: r.pieces,
            aliases: [],
            kind: "precut",
            usableFor: ["phone"],
            ...(r.imageUrl ? { rawImageUrl: r.imageUrl } : {}),
            isActive: true,
            createdAt: now,
            _creationTime: now + i + k,
            importedFrom: "phone-listing",
          });
        });
        await batch.commit();
      }
      // The listings already show these numbers; recounting makes the shelf the
      // one source from here on.
      for (let i = 0; i < toAdd.length; i += 50) {
        try { await recalcStock({ codes: toAdd.slice(i, i + 50).map((r) => r.code) }); } catch { /* recounted on the next sheet edit */ }
      }
      toast.success(`${toAdd.length} pre-cut designs added`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? `Stopped: ${e.message}` : "Stopped");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !running) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import pre-cut phone designs</DialogTitle>
          <DialogDescription>
            Each pre-cut design becomes one cutout record holding its pieces, used for phones only. Every phone
            listing of that design — old or per brand — then draws on the same count. Names and piece counts come
            from the current listings; edit any before adding.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">Series prefixes</Label>
            <Input className="h-8 w-40 font-mono text-xs" value={prefixes} onChange={(e) => setPrefixes(e.target.value)} />
          </div>
          <Button size="sm" variant="outline" disabled={!rows || running} onClick={() => void scan()}>Rescan</Button>
          {rows && (
            <>
              <Badge className="bg-emerald-600">{toAdd.length} to add</Badge>
              <Badge variant="outline">{rows.length - toAdd.length} already on the shelf</Badge>
              <Badge variant="outline">{toAdd.reduce((n, r) => n + r.pieces, 0)} pieces</Badge>
            </>
          )}
        </div>

        {!rows ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2Icon className="size-4 animate-spin" /> Reading the phone listings…</p>
        ) : (
          <div className="max-h-[55vh] overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted text-left">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Code</th>
                  <th className="px-2 py-1.5 font-medium">Design name</th>
                  <th className="px-2 py-1.5 font-medium">Finish</th>
                  <th className="px-2 py-1.5 text-right font-medium">Pieces</th>
                  <th className="px-2 py-1.5 font-medium">From listing</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code} className={`border-t ${r.exists ? "text-muted-foreground" : ""}`}>
                    <td className="px-2 py-1 font-mono font-semibold">{r.code}</td>
                    <td className="px-2 py-1">
                      {r.exists ? r.designName : (
                        <Input className="h-7 text-xs" value={r.designName} onChange={(e) => set(r.code, { designName: e.target.value })} />
                      )}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">{r.finish}</td>
                    <td className="px-2 py-1 text-right">
                      {r.exists ? "on shelf" : (
                        <Input className="ml-auto h-7 w-16 text-right text-xs" inputMode="numeric" value={String(r.pieces)}
                          onChange={(e) => set(r.code, { pieces: Math.max(0, parseInt(e.target.value) || 0) })} />
                      )}
                    </td>
                    <td className="max-w-[16rem] truncate px-2 py-1 text-muted-foreground" title={r.listingTitle}>
                      {r.listingTitle} {r.status !== "active" && <span className="italic">({r.status})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={running} onClick={onClose}>Cancel</Button>
          <Button disabled={running || !toAdd.length} onClick={() => void apply()}>
            {running && <Loader2Icon className="mr-1.5 size-4 animate-spin" />}
            Add {toAdd.length} design{toAdd.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
