import { useMemo, useState } from "react";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { SearchIcon, ImageIcon, LayersIcon, ScissorsIcon, InfinityIcon, AlertCircleIcon } from "lucide-react";

/**
 * What a product is made of, and what that leaves you able to sell.
 *
 * This replaces a "Consumption Preset (2x)" dropdown beside a "Custom
 * Multiplier" box. Two abstract numbers, no indication of two times *what*, and
 * no way to tell what either did to stock. Here the design is picked by sight,
 * and every variant states its cost in the unit the shelf is counted in
 * alongside how many it yields at today's stock.
 */

const ROLL_WIDTH_CM = 29.5;

export interface MaterialDesign {
  _id: string;
  source: "roll" | "cutout";
  code: string;
  name: string;
  rawImageUrl?: string;
  finish?: string;
  /** Metres for a roll, sheets for a cutout. */
  stock: number;
  unit: "m" | "sheets";
}

export interface VariantLine {
  title: string;
  sku?: string;
  consumptionPresetId?: string;
  customMultiplier?: string;
}

/**
 * The design a SKU names, when nobody assigned one explicitly.
 *
 * LP-26-LPK was never given an rNumber but says LP-26 plainly enough. The
 * search runs right to left and stops at the first hit, because design codes
 * open with LP and LC — themselves view codes — and going the other way would
 * match the wrong half of the SKU.
 */
export function inferDesignCode(sku: string, designs: MaterialDesign[]): string {
  const known = new Map(designs.map((d) => [d.code.toUpperCase(), d.code]));
  const parts = String(sku || "").split("-");
  for (let k = parts.length; k >= 1; k--) {
    const hit = known.get(parts.slice(0, k).join("-").toUpperCase());
    if (hit) return hit;
  }
  return "";
}

/** Rolls and cutouts in one list — the code already says which kind it is. */
export function useMaterialDesigns(): MaterialDesign[] | undefined {
  const rolls = useQuery(api.rollsManagement.getRollInventory) as any[] | undefined;
  const cutouts = useQuery(api.aiMockups.getCutouts) as any[] | undefined;
  return useMemo(() => {
    if (rolls === undefined || cutouts === undefined) return undefined;
    return [
      ...rolls.map((r): MaterialDesign => ({
        _id: r._id, source: "roll", code: String(r.rNumber || "").trim(), name: r.designName || "",
        rawImageUrl: r.rawImageUrl, stock: Number(r.metersAvailable) || 0, unit: "m",
      })),
      ...cutouts.map((c): MaterialDesign => ({
        _id: c._id, source: "cutout", code: String(c.cutoutNumber || "").trim(), name: c.designName || "",
        rawImageUrl: c.rawImageUrl, finish: c.finish, stock: Number(c.sheetsAvailable) || 0, unit: "sheets",
      })),
    ]
      .filter((d) => d.code)
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [rolls, cutouts]);
}

/** How many of this variant today's stock yields. */
function unitsFrom(design: MaterialDesign, multiplier: number, gadget: any): number | null {
  const m = Math.max(multiplier, 0.01);
  if (design.source === "cutout") return Math.floor(design.stock / m);
  if (!gadget || !(gadget.lengthCm > 0) || !(gadget.widthCm > 0)) return null;
  const areaPerUnit = Number(gadget.lengthCm) * Number(gadget.widthCm) * m;
  return Math.floor((ROLL_WIDTH_CM * design.stock * 100) / areaPerUnit);
}

/** A roll unit is priced in centimetres of length off a 29.5 cm web. */
function costLabel(design: MaterialDesign, multiplier: number, gadget: any): string {
  if (design.source === "cutout") {
    const n = Number(multiplier.toFixed(2));
    return `${n} sheet${n === 1 ? "" : "s"}`;
  }
  if (!gadget || !(gadget.lengthCm > 0)) return "—";
  const cm = (Number(gadget.lengthCm) * Number(gadget.widthCm) * multiplier) / ROLL_WIDTH_CM;
  return `${cm.toFixed(1)} cm of roll`;
}

export function MaterialSection({
  gadgetTypeId,
  designCode,
  onDesignChange,
  variants,
  onVariantChange,
}: {
  gadgetTypeId?: string;
  designCode: string;
  onDesignChange: (code: string) => void;
  variants: VariantLine[];
  onVariantChange: (index: number, field: "consumptionPresetId" | "customMultiplier", value: string) => void;
}) {
  const designs = useMaterialDesigns();
  const presets = useQuery(
    api.variantConsumptionPresets.listByGadgetType,
    gadgetTypeId ? { gadgetTypeId } : "skip"
  ) as any[] | undefined;
  const consumption = useQuery(api.rollsManagement.getGadgetConsumption) as any[] | undefined;
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);

  const gadget = useMemo(
    () => (consumption || []).find((c) => c.gadgetTypeId === gadgetTypeId),
    [consumption, gadgetTypeId]
  );
  const forGadget = presets || [];
  // Fall back to what the SKUs already say, so a product nobody formally
  // assigned still shows its material instead of an empty prompt.
  const inferred = useMemo(() => {
    if (designCode.trim() || !designs) return "";
    for (const v of variants) {
      const hit = inferDesignCode(v.sku || "", designs);
      if (hit) return hit;
    }
    return "";
  }, [designCode, designs, variants]);
  const effectiveCode = designCode.trim() || inferred;
  const selected = (designs || []).find((d) => d.code.toUpperCase() === effectiveCode.toUpperCase());

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (designs || [])
      .filter((d) => !q || d.code.toLowerCase().includes(q) || d.name.toLowerCase().includes(q))
      .slice(0, 60);
  }, [designs, query]);

  const multiplierOf = (v: VariantLine) => {
    if (v.customMultiplier) return Number(v.customMultiplier) || 1;
    const p = (presets || []).find((x) => x._id === v.consumptionPresetId);
    return Number(p?.multiplier) || 1;
  };

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <LayersIcon className="size-4 text-muted-foreground" />
        <h5 className="text-sm font-semibold">Material</h5>
      </div>

      {/* ── which design this product is printed from ── */}
      {selected ? (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2.5">
          <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted">
            {selected.rawImageUrl ? (
              <img src={selected.rawImageUrl} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center"><ImageIcon className="size-4 text-muted-foreground/40" /></div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-sm font-semibold">{selected.code}</span>
              <Badge variant="outline" className="gap-1 text-[10px]">
                {selected.source === "cutout" ? <ScissorsIcon className="size-2.5" /> : <InfinityIcon className="size-2.5" />}
                {selected.source}
              </Badge>
              {selected.finish && <Badge variant="outline" className="text-[10px]">{selected.finish}</Badge>}
            </div>
            <p className="truncate text-xs text-muted-foreground">{selected.name || "Untitled"}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm font-semibold tabular-nums">{selected.stock}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{selected.unit} in stock</div>
          </div>
          <div className="flex shrink-0 flex-col items-end">
            {!designCode.trim() && inferred && (
              <span className="text-[10px] text-muted-foreground">read from SKU</span>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={() => setPicking((p) => !p)}>Change</Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed p-3 text-left text-sm text-muted-foreground hover:bg-muted/40"
        >
          <ImageIcon className="size-4" />
          {effectiveCode
            ? <span className="text-amber-600">
                <strong className="font-mono">{effectiveCode}</strong> is not in roll or cutout inventory — stock will never move for it
              </span>
            : "Pick the roll or cutout this product is printed from"}
        </button>
      )}

      {picking && (
        <div className="space-y-2 rounded-lg border p-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code or design name" className="h-8 pl-8 text-sm" />
          </div>
          <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
            {designs === undefined && <p className="p-2 text-xs text-muted-foreground">Loading…</p>}
            {shown.map((d) => (
              <button
                key={d._id}
                type="button"
                onClick={() => { onDesignChange(d.code); setPicking(false); setQuery(""); }}
                className="flex items-center gap-2 rounded-md border p-1.5 text-left hover:bg-muted/60"
              >
                <div className="size-8 shrink-0 overflow-hidden rounded bg-muted">
                  {d.rawImageUrl ? <img src={d.rawImageUrl} alt="" className="size-full object-cover" />
                    : <div className="flex size-full items-center justify-center"><ImageIcon className="size-3 text-muted-foreground/40" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[11px] font-semibold">{d.code}</span>
                    {d.source === "cutout" && <span className="rounded bg-sky-100 px-1 text-[9px] text-sky-700 dark:bg-sky-950 dark:text-sky-300">cut</span>}
                  </div>
                  <p className="truncate text-[10px] text-muted-foreground">{d.name}</p>
                </div>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{d.stock}{d.unit === "m" ? "m" : ""}</span>
              </button>
            ))}
            {designs !== undefined && !shown.length && (
              <p className="p-2 text-xs text-muted-foreground">Nothing matches. Add it in Roll Management first.</p>
            )}
          </div>
        </div>
      )}

      {/* ── what each variant costs, and what that yields ── */}
      {!gadgetTypeId ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertCircleIcon className="size-3.5" />
          Pick a gadget type above to work out material use.
        </p>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-xs">Each variant uses</Label>
          {variants.map((v, i) => {
            const mult = multiplierOf(v);
            const units = selected ? unitsFrom(selected, mult, gadget) : null;
            return (
              <div key={i} className="flex items-center gap-2 rounded-lg border p-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{v.title || `Variant ${i + 1}`}</span>
                <Select
                  value={v.consumptionPresetId || "none"}
                  onValueChange={(value) => onVariantChange(i, "consumptionPresetId", value === "none" ? "" : value)}
                >
                  <SelectTrigger className="h-8 w-[170px] shrink-0 text-xs"><SelectValue placeholder="Pick the view" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set (counts as 1)</SelectItem>
                    {forGadget.map((p) => (
                      <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                  {selected ? costLabel(selected, mult, gadget) : `${Number(mult.toFixed(2))}×`}
                </span>
                {selected && (
                  <Badge variant="outline" className="shrink-0 tabular-nums">
                    {units === null ? "no size set" : `makes ${units}`}
                  </Badge>
                )}
                <Input
                  type="number" step="0.1" min="0"
                  className="h-8 w-14 shrink-0 px-2 text-xs"
                  placeholder="1×"
                  title="Override the preset for this variant only"
                  value={v.customMultiplier || ""}
                  onChange={(e) => onVariantChange(i, "customMultiplier", e.target.value)}
                />
              </div>
            );
          })}
          {selected?.source === "cutout" && (
            <p className="text-[11px] text-muted-foreground">
              Sheets are shared: {selected.stock} sheets is {selected.stock} lids, or {Math.floor(selected.stock / 2)}{" "}
              lid-plus-keyboards, or any mix — whichever sells first. Every product printed from{" "}
              <span className="font-mono">{selected.code}</span> draws on the same pile.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
