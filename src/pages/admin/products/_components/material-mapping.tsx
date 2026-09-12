import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { toast } from "sonner";
import {
  SearchIcon, ChevronRightIcon, AlertCircleIcon, LinkIcon, XIcon, PackageIcon,
} from "lucide-react";
import type { Id } from "@/lib/firebase-api";

/**
 * Which stock every variant is cut from — as a list you can read.
 *
 * This was a stack of cards, one per code, each with every one of its variants
 * expanded underneath. Across 147 stock codes and a thousand-odd matched
 * variants that is a page you scroll for a minute to reach the bottom of, and
 * the thing you came to check is never the thing in front of you.
 *
 * So: one line per code, closed. Open the one you want. Search narrows on code,
 * design name, SKU or product title, and the filters answer the two questions
 * worth asking of this screen — what has no stock behind it, and what stock has
 * nothing selling it.
 */

type Filter = "all" | "roll" | "cutout" | "empty";

export function MaterialMapping() {
  const mapping = useQuery(api.rollsManagement.getProductsByRNumber) as any;
  const assignRNumber = useMutation(api.rollsManagement.assignRNumber);
  const removeAssignment = useMutation(api.rollsManagement.removeRNumberAssignment);
  const updateMaterialMultiplier = useMutation(api.rollsManagement.updateMaterialMultiplier);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<{ variantId: string; sku: string; current: string } | null>(null);
  const [draftCode, setDraftCode] = useState("");

  const rows = useMemo(() => {
    if (!mapping?.groups) return [];
    const q = search.trim().toLowerCase();
    return Object.entries(mapping.groups as Record<string, any[]>)
      .map(([code, items]) => ({ code, items, meta: mapping.meta?.[code] || {} }))
      .filter((r) => {
        if (filter === "roll" && r.meta.kind !== "roll") return false;
        if (filter === "cutout" && r.meta.kind !== "cutout") return false;
        if (filter === "empty" && Number(r.meta.amount) > 0) return false;
        if (!q) return true;
        return (
          r.code.toLowerCase().includes(q) ||
          String(r.meta.designName || "").toLowerCase().includes(q) ||
          r.items.some(
            (i) =>
              String(i.sku || "").toLowerCase().includes(q) ||
              String(i.productTitle || "").toLowerCase().includes(q),
          )
        );
      })
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [mapping, search, filter]);

  /*
   * A prefix earns the task list by having siblings that do map. `R-` is at
   * 97% — 968 SKUs find a roll and 26 do not — so those 26 are the odd ones
   * out and worth a look. `TRIPOD-` is at 0%, which is not a mapping gap,
   * it is a tripod.
   */
  const { taskBuckets, inertBuckets } = useMemo(() => {
    const all = Object.entries(
      (mapping?.unmatchedByPrefix || {}) as Record<string, { count: number; matched: number; items: any[] }>,
    ).map(([prefix, b]) => ({
      prefix,
      ...b,
      coverage: b.matched + b.count > 0 ? b.matched / (b.matched + b.count) : 0,
    }));
    return {
      taskBuckets: all.filter((b) => b.matched > 0).sort((a, b) => b.coverage - a.coverage),
      inertBuckets: all.filter((b) => b.matched === 0).sort((a, b) => b.count - a.count),
    };
  }, [mapping]);

  if (!mapping) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  const t = mapping.totals;

  const submitAssign = async () => {
    if (!assigning || !draftCode.trim()) return;
    try {
      await assignRNumber({
        variantId: assigning.variantId as Id<"variants">,
        rNumber: draftCode.trim().toUpperCase(),
      });
      toast.success(`${assigning.sku} pinned to ${draftCode.trim().toUpperCase()}`);
      setAssigning(null);
      setDraftCode("");
    } catch {
      toast.error("Could not save that assignment");
    }
  };

  return (
    <div className="space-y-4">
      {t && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Variants matched" value={`${t.matched} / ${t.variants}`} />
          <Stat label="Not backed by stock" value={t.unmatched} tone={t.unmatched ? "warn" : undefined} />
          <Stat label="Rolls" value={t.rollCodes} />
          <Stat label="Cutout designs" value={t.cutoutRecords} />
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <LinkIcon className="size-4" />
            Material mapping
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Resolved by the rule checkout uses: a pinned code first, then the
            SKU&rsquo;s leading segments — <span className="font-mono">R-09-DRC</span> finds{" "}
            <span className="font-mono">R-09</span>.
          </p>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Code, design, SKU or product…"
                className="pl-9"
              />
            </div>
            <div className="flex gap-1">
              {([
                ["all", "All"],
                ["roll", "Rolls"],
                ["cutout", "Cutouts"],
                ["empty", "Out of stock"],
              ] as Array<[Filter, string]>).map(([k, label]) => (
                <Button
                  key={k}
                  size="sm"
                  variant={filter === k ? "default" : "outline"}
                  onClick={() => setFilter(k)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nothing matches that.
            </p>
          ) : (
            <div className="divide-y">
              {rows.map((r) => {
                const isOpen = open === r.code;
                const unit = r.meta.unit === "sheets" ? "sheets" : "m";
                return (
                  <div key={r.code}>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : r.code)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
                    >
                      <ChevronRightIcon
                        className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`}
                      />
                      <span className="w-28 shrink-0 font-mono text-sm font-semibold">{r.code}</span>
                      <Badge variant={r.meta.kind === "cutout" ? "secondary" : "default"} className="shrink-0">
                        {r.meta.kind === "cutout" ? "Cutout" : "Roll"}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                        {r.meta.designName || "—"}
                      </span>
                      <span
                        className={`shrink-0 font-mono text-sm ${Number(r.meta.amount) > 0 ? "" : "text-orange-600"}`}
                      >
                        {r.meta.amount ?? 0} {unit}
                      </span>
                      <Badge variant="outline" className="shrink-0">
                        {r.items.length}
                      </Badge>
                    </button>

                    {isOpen && (
                      <div className="space-y-1 bg-muted/30 px-4 pb-3 pt-1">
                        {r.items.map((item: any) => (
                          <div
                            key={item.variantId}
                            className="flex items-center gap-2 rounded-md bg-background px-3 py-1.5"
                          >
                            <span className="w-36 shrink-0 truncate font-mono text-xs">{item.sku}</span>
                            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                              {item.productTitle}
                              {item.variantTitle ? ` · ${item.variantTitle}` : ""}
                            </span>
                            {item.isManual && (
                              <Badge variant="outline" className="shrink-0 text-[10px]">
                                pinned
                              </Badge>
                            )}
                            <Input
                              type="number"
                              min="0.1"
                              step="0.1"
                              defaultValue={item.materialMultiplier}
                              onBlur={(e) => {
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v) && v > 0 && v !== item.materialMultiplier) {
                                  void updateMaterialMultiplier({
                                    variantId: item.variantId as Id<"variants">,
                                    multiplier: v,
                                  }).then(
                                    () => toast.success("Multiplier saved"),
                                    () => toast.error("Could not save multiplier"),
                                  );
                                }
                              }}
                              className="h-7 w-14 shrink-0 text-center text-xs"
                              title="Material multiplier"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 shrink-0 px-2 text-xs"
                              onClick={() => {
                                setAssigning({ variantId: item.variantId, sku: item.sku, current: r.code });
                                setDraftCode(r.code);
                              }}
                            >
                              Pin
                            </Button>
                            {item.isManual && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="size-7 shrink-0 p-0"
                                title="Remove the pin and fall back to the SKU"
                                onClick={() =>
                                  void removeAssignment({ variantId: item.variantId as Id<"variants"> }).then(
                                    () => toast.success("Pin removed"),
                                    () => toast.error("Could not remove the pin"),
                                  )
                                }
                              >
                                <XIcon className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* The work, separated from the noise. A prefix whose siblings mostly
          map has gaps worth chasing; one where nothing maps is a category
          that simply is not cut from stocked material. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <UnmatchedPanel
          title="Needs linking"
          subtitle="SKUs whose siblings resolve, but these don't"
          empty="Nothing outstanding — every family with stock is fully mapped."
          tone="warn"
          buckets={taskBuckets}
          onPin={(item, code) => { setAssigning({ variantId: item.variantId, sku: item.sku, current: code }); setDraftCode(""); }}
        />
        <UnmatchedPanel
          title="No material tracked"
          subtitle="Cases, accessories and one-off products — nothing to draw down"
          empty="Nothing here."
          buckets={inertBuckets}
          onPin={(item, code) => { setAssigning({ variantId: item.variantId, sku: item.sku, current: code }); setDraftCode(""); }}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <PackageIcon className="size-4 text-muted-foreground" />
            <div>
              <h4 className="text-sm font-semibold">Stock with nothing selling it</h4>
              <p className="text-xs text-muted-foreground">
                {(mapping.orphanStock || []).length} rolls and cutouts no variant resolves to
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(mapping.orphanStock || []).length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Every roll and cutout has variants behind it.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {((mapping.orphanStock || []) as any[]).map((o) => (
                <div key={`${o.kind}-${o.code}`} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-sm font-semibold">{o.code}</span>
                    <p className="truncate text-xs text-muted-foreground">{o.designName || "—"}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {o.amount}{o.kind === "cutout" ? " sheets" : " m"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!assigning} onOpenChange={(v) => !v && setAssigning(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{assigning?.current ? "Re-pin to another code" : "Link to stock"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {assigning?.current ? (
                <>
                  <span className="font-mono">{assigning.sku}</span> resolves to{" "}
                  <span className="font-mono">{assigning.current}</span> from its SKU already.
                  Pinning overrides that; removing the pin falls back to the SKU again.
                </>
              ) : (
                <>
                  <span className="font-mono">{assigning?.sku}</span> resolves to no stock.
                  Pin it to the roll or cutout it is actually cut from — an{" "}
                  <span className="font-mono">R-</span> code for a roll, or a cutout code
                  such as <span className="font-mono">LC-04</span>.
                </>
              )}
            </p>
            <div>
              <Label className="text-xs">Stock code</Label>
              <Input
                value={draftCode}
                onChange={(e) => setDraftCode(e.target.value)}
                className="font-mono"
                placeholder="R-30"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigning(null)}>Cancel</Button>
            <Button onClick={() => void submitAssign()}>{assigning?.current ? "Re-pin" : "Link"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: any; tone?: "warn" }) {
  return (
    <div className={`rounded-xl border p-3 ${tone === "warn" ? "border-orange-300 dark:border-orange-900" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-bold">{value}</p>
    </div>
  );
}


/**
 * One prefix per row, opening onto every SKU under it.
 *
 * It used to print eight sample SKUs and the count, which told an admin that
 * 245 things were wrong and gave them no way to look at 237 of them. The list
 * is the point: it is what someone works through.
 */
function UnmatchedPanel({
  title, subtitle, empty, buckets, tone, onPin,
}: {
  title: string;
  subtitle: string;
  empty: string;
  tone?: "warn";
  buckets: Array<{ prefix: string; count: number; matched: number; coverage: number; items: any[] }>;
  onPin: (item: any, code: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const total = buckets.reduce((n, b) => n + b.count, 0);

  return (
    <Card className={tone === "warn" && total > 0 ? "border-orange-300 dark:border-orange-900" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {tone === "warn" ? (
            <AlertCircleIcon className="size-4 text-orange-600" />
          ) : (
            <PackageIcon className="size-4 text-muted-foreground" />
          )}
          <div className="min-w-0">
            <h4 className="text-sm font-semibold">
              {title} {total > 0 && <span className="text-muted-foreground">· {total}</span>}
            </h4>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {buckets.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          buckets.map((b) => {
            const isOpen = open === b.prefix;
            const items = q.trim()
              ? b.items.filter(
                  (i) =>
                    String(i.sku || "").toLowerCase().includes(q.toLowerCase()) ||
                    String(i.productTitle || "").toLowerCase().includes(q.toLowerCase()),
                )
              : b.items;
            return (
              <div key={b.prefix} className="rounded-lg border">
                <button
                  type="button"
                  onClick={() => { setOpen(isOpen ? null : b.prefix); setQ(""); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50"
                >
                  <ChevronRightIcon
                    className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`}
                  />
                  <span className="font-mono text-sm font-semibold">{b.prefix}-</span>
                  {b.matched > 0 && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {Math.round(b.coverage * 100)}% of this family maps
                    </Badge>
                  )}
                  <span className="flex-1" />
                  <Badge variant="secondary" className="shrink-0">{b.count}</Badge>
                </button>

                {isOpen && (
                  <div className="border-t bg-muted/30 p-2">
                    {b.items.length > 12 && (
                      <div className="relative mb-2">
                        <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                          placeholder={`Search ${b.items.length} SKUs…`}
                          className="h-8 pl-8 text-xs"
                        />
                      </div>
                    )}
                    <div className="max-h-80 space-y-1 overflow-y-auto">
                      {items.length === 0 ? (
                        <p className="py-4 text-center text-xs text-muted-foreground">No match.</p>
                      ) : (
                        items.map((i: any) => (
                          <div
                            key={i.variantId}
                            className="flex items-center gap-2 rounded-md bg-background px-2.5 py-1.5"
                          >
                            <span className="w-32 shrink-0 truncate font-mono text-xs">{i.sku}</span>
                            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                              {i.productTitle}
                              {i.variantTitle ? ` · ${i.variantTitle}` : ""}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 shrink-0 px-2 text-xs"
                              onClick={() => onPin(i, "")}
                            >
                              Link
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                    {q && (
                      <p className="pt-1.5 text-center text-[11px] text-muted-foreground">
                        {items.length} of {b.items.length}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
