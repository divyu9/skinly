import { useMemo, useState } from "react";
import { writeBatch, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx";
import { Loader2Icon, CheckIcon, ZapIcon } from "lucide-react";
import { toast } from "sonner";

interface Product {
  _id: string;
  status: string;
  gadgetTypeId?: string;
  finishType?: string;
  variants: Array<{ _id: string; title: string; price: number }>;
}

interface Row {
  key: string;
  gadgetTypeId: string;
  gadgetLabel: string;
  finishLabel: string;
  variantTitle: string;
  variantIds: string[];
  productIds: Set<string>;
  min: number;
  max: number;
}

/**
 * One price rule per (gadget type, finish, variant tier) — "Matte Phone Skin",
 * "3D Phone Skin", "Matte Laptop — Only Top" — instead of per listing. Set a
 * price once here and every eligible variant across the whole store takes it
 * immediately, the way the store is actually priced day to day: by what kind
 * of skin it is, not by which of 400 listings happens to carry it.
 *
 * The tier stays in the grouping key on purpose. A laptop's "Only Top" and
 * "Top + Keyboard Area" are priced apart for a reason — collapsing them to
 * one row would let one price overwrite the other.
 */
export function PriceRulesDialog({
  open,
  onOpenChange,
  products,
  gadgetTypes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[] | undefined;
  gadgetTypes: Array<{ _id: string; displayName: string }> | undefined;
}) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const gadgetLabel = useMemo(() => {
    const m = new Map((gadgetTypes || []).map((g) => [g._id, g.displayName]));
    return (id?: string) => (id && m.get(id)) || "No gadget type";
  }, [gadgetTypes]);

  const rows = useMemo<Row[]>(() => {
    const groups = new Map<string, Row>();
    for (const p of products || []) {
      if (p.status === "archived") continue;
      const gLabel = gadgetLabel(p.gadgetTypeId);
      const fLabel = (p.finishType || "").trim() || "No finish set";
      for (const v of p.variants || []) {
        const title = (v.title || "").trim() || "Default";
        const key = `${p.gadgetTypeId || ""}|${fLabel}|${title.toLowerCase()}`;
        const price = Number(v.price) || 0;
        const row = groups.get(key);
        if (row) {
          row.variantIds.push(v._id);
          row.productIds.add(p._id);
          row.min = Math.min(row.min, price);
          row.max = Math.max(row.max, price);
        } else {
          groups.set(key, {
            key,
            gadgetTypeId: p.gadgetTypeId || "",
            gadgetLabel: gLabel,
            finishLabel: fLabel,
            variantTitle: title,
            variantIds: [v._id],
            productIds: new Set([p._id]),
            min: price,
            max: price,
          });
        }
      }
    }
    return [...groups.values()].sort((a, b) =>
      a.gadgetLabel.localeCompare(b.gadgetLabel) ||
      a.finishLabel.localeCompare(b.finishLabel) ||
      a.variantTitle.localeCompare(b.variantTitle)
    );
  }, [products, gadgetLabel]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.gadgetLabel} ${r.finishLabel} ${r.variantTitle}`.toLowerCase().includes(q));
  }, [rows, query]);

  const applyRow = async (row: Row) => {
    const raw = edits[row.key];
    const price = Number(raw);
    if (!raw || !(price >= 0)) {
      toast.error("Enter a valid price first");
      return;
    }
    setApplying(row.key);
    try {
      for (let i = 0; i < row.variantIds.length; i += 450) {
        const batch = writeBatch(db);
        for (const id of row.variantIds.slice(i, i + 450)) {
          batch.update(doc(db, "variants", id), { price, updatedAt: Date.now() });
        }
        await batch.commit();
      }
      toast.success(
        `₹${price} set on ${row.variantIds.length} variant${row.variantIds.length === 1 ? "" : "s"} across ${row.productIds.size} listing${row.productIds.size === 1 ? "" : "s"}`
      );
      setEdits((prev) => { const next = { ...prev }; delete next[row.key]; return next; });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update this price");
    } finally {
      setApplying(null);
    }
  };

  const pendingCount = Object.keys(edits).filter((k) => edits[k]?.trim()).length;
  const applyAllPending = async () => {
    const toApply = filteredRows.filter((r) => edits[r.key]?.trim());
    for (const row of toApply) await applyRow(row);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Price rules by gadget &amp; finish</DialogTitle>
          <DialogDescription>
            One row per gadget type, finish and tier. Type a price and apply it — every variant in that row,
            on every listing, updates immediately. {rows.length} rows from {products?.length ?? "…"} listings.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Filter — e.g. matte phone, laptop, 3d…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-xs"
          />
          {pendingCount > 1 && (
            <Button size="sm" onClick={() => void applyAllPending()} disabled={!!applying}>
              <ZapIcon className="mr-1.5 size-3.5" />
              Apply all {pendingCount} edited rows
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>Gadget</TableHead>
                <TableHead>Finish</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead className="text-right">Reach</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="w-40 text-right">New price</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => {
                const mixed = row.min !== row.max;
                const dirty = !!edits[row.key]?.trim();
                return (
                  <TableRow key={row.key} className={dirty ? "bg-amber-50 dark:bg-amber-950/20" : undefined}>
                    <TableCell className="font-medium">{row.gadgetLabel}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.finishLabel}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.variantTitle}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                      {row.variantIds.length} var · {row.productIds.size} listing{row.productIds.size === 1 ? "" : "s"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {mixed ? (
                        <span className="text-amber-600">₹{row.min}–₹{row.max}</span>
                      ) : (
                        <>₹{row.min}</>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step="1"
                        placeholder={String(row.min)}
                        value={edits[row.key] || ""}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [row.key]: e.target.value }))}
                        className="h-8 text-right tabular-nums"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={dirty ? "default" : "outline"}
                        className="h-8 w-full px-2"
                        disabled={!dirty || applying === row.key}
                        onClick={() => void applyRow(row)}
                      >
                        {applying === row.key ? <Loader2Icon className="size-3.5 animate-spin" /> : <CheckIcon className="size-3.5" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!filteredRows.length && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    {rows.length ? "No rows match that filter" : "No active listings yet"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
