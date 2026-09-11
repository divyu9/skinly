import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useAction } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import {
  ScissorsIcon, SearchIcon, ImageIcon, UploadIcon, PlusIcon, TrashIcon,
  Loader2Icon, AlertTriangleIcon,
} from "lucide-react";

/**
 * Stock for designs that come as printed sheets rather than off a roll.
 *
 * The number that matters is one per design, not one per product: a cutout's
 * sheets are shared by every product printed from it, and a variant spends
 * `materialMultiplier` of them — one for a laptop lid, two for lid plus
 * keyboard. So the table shows what a given sheet count actually yields in each
 * view rather than leaving that arithmetic to the reader.
 *
 * A design is often sold under two SKU codes, one per view, and those are
 * aliases of one record. Splitting them would split the pile and let both be
 * sold at once.
 */

export function CutoutsManagement() {
  const cutouts = useQuery(api.aiMockups.getCutouts) as any[] | undefined;
  const variantIndex = useQuery(api.rollsManagement.getProductsByRNumber) as
    { groups?: Record<string, any[]>; unmapped?: any[] } | undefined;
  const createCutout = useMutation(api.aiMockups.createCutoutInventory);
  const updateCutout = useMutation(api.aiMockups.updateCutoutInventory);
  const deleteCutout = useMutation(api.aiMockups.deleteCutoutInventory);
  const uploadToLibrary = useAction(api.mediaLibrary.uploadAndAddToLibrary);

  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ cutoutNumber: "", designName: "", sheetsAvailable: "0", finish: "3D Textured", aliases: "" });
  const uploadFor = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Views this cutout is used in, and what one sheet-pile yields in each. */
  const usage = useMemo(() => {
    const rows = [
      ...Object.values(variantIndex?.groups || {}).flat(),
      ...(variantIndex?.unmapped || []),
    ];
    const byCode: Record<string, { title: string; multiplier: number }[]> = {};
    for (const row of rows) {
      const sku = String(row.sku || "").trim();
      if (!sku) continue;
      // Index both readings: most SKUs are <design>-<view>, but the single-view
      // ones are the bare design code with nothing trailing it.
      const parts = sku.split("-");
      const entry = {
        title: String(row.variantTitle || ""),
        multiplier: Number(row.materialMultiplier) || 1,
      };
      (byCode[sku.toUpperCase()] ||= []).push(entry);
      if (parts.length >= 2) (byCode[parts.slice(0, -1).join("-").toUpperCase()] ||= []).push(entry);
    }
    return byCode;
  }, [variantIndex]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (cutouts || [])
      .filter((c) =>
        !q ||
        String(c.cutoutNumber || "").toLowerCase().includes(q) ||
        String(c.designName || "").toLowerCase().includes(q) ||
        (c.aliases || []).some((a: string) => a.toLowerCase().includes(q))
      )
      .sort((a, b) => String(a.cutoutNumber).localeCompare(String(b.cutoutNumber), undefined, { numeric: true }));
  }, [cutouts, search]);

  const totals = useMemo(() => {
    const list = cutouts || [];
    return {
      designs: list.length,
      sheets: list.reduce((n, c) => n + (Number(c.sheetsAvailable) || 0), 0),
      noPhoto: list.filter((c) => !c.rawImageUrl).length,
      noStock: list.filter((c) => !(Number(c.sheetsAvailable) > 0)).length,
    };
  }, [cutouts]);

  const onPickFile = async (file: File) => {
    const id = uploadFor.current;
    if (!id) return;
    const cutout = (cutouts || []).find((c) => c._id === id);
    setBusy(id);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const stem = String(cutout?.cutoutNumber || id).toUpperCase().replace(/[^A-Z0-9-]/g, "");
      const result: any = await uploadToLibrary({
        fileBase64: base64,
        key: `design-raw/${stem}.webp`,
        filename: `${stem}.webp`,
        folder: "design-raw",
        contentType: file.type || "image/jpeg",
        tags: ["raw-design", "cutout", stem],
      });
      const url = result?.url || result?.publicUrl;
      if (!url) throw new Error(result?.error || "Upload failed");
      await updateCutout({ id, rawImageUrl: url });
      toast.success("Design photo saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
      uploadFor.current = null;
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (cutouts === undefined || variantIndex === undefined) {
    return <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <ScissorsIcon className="size-5 text-sky-600" />
            Cutouts
          </h3>
          <p className="text-sm text-muted-foreground">
            Designs printed as sheets. Stock is held once per design and shared by every product made from it.
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <PlusIcon className="mr-1.5 size-4" />
          Add cutout
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <Stat label="Designs" value={totals.designs} />
        <Stat label="Sheets in stock" value={totals.sheets} />
        <Stat label="Without stock" value={totals.noStock} tone={totals.noStock ? "amber" : undefined} />
        <Stat label="Without a photo" value={totals.noPhoto} tone={totals.noPhoto ? "amber" : undefined} />
      </div>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code, alias or design name" className="pl-9" />
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPickFile(f); }} />

      <div className="space-y-2">
        {rows.map((c) => {
          const codes = [c.cutoutNumber, ...(c.aliases || [])];
          const uses = codes.flatMap((code: string) => usage[String(code).toUpperCase()] || []);
          const byView = new Map<string, number>();
          uses.forEach((u) => { if (u.title) byView.set(u.title, u.multiplier); });
          const sheets = Number(c.sheetsAvailable) || 0;
          return (
            <Card key={c._id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-3">
                <button
                  type="button"
                  onClick={() => { uploadFor.current = c._id; fileRef.current?.click(); }}
                  className="group relative size-14 shrink-0 overflow-hidden rounded-lg border bg-muted"
                  title={c.rawImageUrl ? "Replace design photo" : "Upload design photo"}
                >
                  {busy === c._id ? (
                    <div className="flex size-full items-center justify-center"><Loader2Icon className="size-4 animate-spin" /></div>
                  ) : c.rawImageUrl ? (
                    <>
                      <img src={c.rawImageUrl} alt="" className="size-full object-cover" />
                      <span className="absolute inset-0 hidden items-center justify-center bg-black/50 group-hover:flex">
                        <UploadIcon className="size-4 text-white" />
                      </span>
                    </>
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-0.5 text-muted-foreground/60">
                      <ImageIcon className="size-4" />
                      <span className="text-[9px]">add</span>
                    </div>
                  )}
                </button>

                <div className="min-w-[11rem] flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-sm font-semibold">{c.cutoutNumber}</span>
                    {(c.aliases || []).map((a: string) => (
                      <span key={a} className="rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground">{a}</span>
                    ))}
                    {c.finish && <Badge variant="outline" className="text-[10px]">{c.finish}</Badge>}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{c.designName || "Untitled"}</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">Sheets</Label>
                  <Input
                    type="number" min="0" step="1"
                    className="h-8 w-20 text-sm"
                    defaultValue={sheets}
                    onBlur={(e) => {
                      const next = Math.max(0, parseInt(e.target.value) || 0);
                      if (next !== sheets) void updateCutout({ id: c._id, sheetsAvailable: next }).then(() => toast.success(`${c.cutoutNumber}: ${next} sheets`));
                    }}
                  />
                </div>

                {/* The whole point: what that pile actually makes. */}
                <div className="flex min-w-[12rem] flex-wrap gap-1.5">
                  {byView.size === 0 ? (
                    <span className="flex items-center gap-1 text-[11px] text-amber-600">
                      <AlertTriangleIcon className="size-3" /> no product uses this code yet
                    </span>
                  ) : (
                    [...byView.entries()].map(([view, mult]) => (
                      <Badge key={view} variant="outline" className="gap-1 text-[10px] tabular-nums">
                        {view}
                        <span className="font-semibold">{Math.floor(sheets / Math.max(mult, 1))}</span>
                      </Badge>
                    ))
                  )}
                </div>

                <Button
                  size="sm" variant="ghost" className="shrink-0 text-rose-600"
                  onClick={async () => {
                    if (!confirm(`Delete cutout ${c.cutoutNumber}? Products using it will stop tracking stock.`)) return;
                    await deleteCutout({ id: c._id });
                    toast.success("Cutout deleted");
                  }}
                >
                  <TrashIcon className="size-3.5" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {!rows.length && (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            {search ? "Nothing matches that search." : "No cutouts yet."}
          </CardContent></Card>
        )}
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a cutout</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Cutout number *</Label>
                <Input value={draft.cutoutNumber} onChange={(e) => setDraft({ ...draft, cutoutNumber: e.target.value })} placeholder="407" className="font-mono" />
              </div>
              <div>
                <Label className="text-xs">Sheets in stock</Label>
                <Input type="number" min="0" value={draft.sheetsAvailable} onChange={(e) => setDraft({ ...draft, sheetsAvailable: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Design name</Label>
              <Input value={draft.designName} onChange={(e) => setDraft({ ...draft, designName: e.target.value })} placeholder="Joker With Gun" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Finish</Label>
                <Input value={draft.finish} onChange={(e) => setDraft({ ...draft, finish: e.target.value })} placeholder="3D Textured" />
              </div>
              <div>
                <Label className="text-xs">Other SKU codes</Label>
                <Input value={draft.aliases} onChange={(e) => setDraft({ ...draft, aliases: e.target.value })} placeholder="LP-3D-06, LC-07" className="font-mono text-xs" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Add every code this design is sold under. One design sold as "Only Top" and "Top + Keyboard Area"
              under two numbers is still one pile of sheets &mdash; listing both here keeps it that way.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            <Button
              disabled={!draft.cutoutNumber.trim()}
              onClick={async () => {
                try {
                  await createCutout({
                    cutoutNumber: draft.cutoutNumber.trim().toUpperCase(),
                    designName: draft.designName.trim(),
                    sheetsAvailable: Math.max(0, parseInt(draft.sheetsAvailable) || 0),
                    finish: draft.finish.trim(),
                    aliases: draft.aliases.split(",").map((a) => a.trim().toUpperCase()).filter(Boolean),
                    isActive: true,
                    createdAt: Date.now(),
                  });
                  toast.success("Cutout added");
                  setAdding(false);
                  setDraft({ cutoutNumber: "", designName: "", sheetsAvailable: "0", finish: "3D Textured", aliases: "" });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not add");
                }
              }}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "amber" }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${tone === "amber" ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40" : ""}`}>
      <div className="text-lg font-semibold tabular-nums">{value.toLocaleString()}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
