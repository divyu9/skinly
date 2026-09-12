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

      {/* The two coverage questions, kept out of the way until wanted. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Coverage
          icon={<AlertCircleIcon className="size-4 text-orange-600" />}
          title="Not backed by stock"
          subtitle={`${t?.unmatched ?? 0} variants, by SKU prefix`}
          empty="Every variant resolves to a roll or a cutout."
          rows={Object.entries(
            (mapping.unmatchedByPrefix || {}) as Record<string, { count: number; samples: string[] }>,
          )
            .sort((a, b) => b[1].count - a[1].count)
            .map(([prefix, info]) => ({
              key: prefix,
              left: `${prefix}-`,
              sub: info.samples.join(", "),
              right: String(info.count),
            }))}
        />
        <Coverage
          icon={<PackageIcon className="size-4 text-muted-foreground" />}
          title="Stock with nothing selling it"
          subtitle={`${(mapping.orphanStock || []).length} rolls and cutouts`}
          empty="Every roll and cutout has variants behind it."
          rows={((mapping.orphanStock || []) as any[]).map((o) => ({
            key: `${o.kind}-${o.code}`,
            left: o.code,
            sub: o.designName || "—",
            right: `${o.amount}${o.kind === "cutout" ? " sheets" : " m"}`,
          }))}
        />
      </div>

      <Dialog open={!!assigning} onOpenChange={(v) => !v && setAssigning(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pin to a stock code</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{assigning?.sku}</span> currently resolves to{" "}
              <span className="font-mono">{assigning?.current}</span> from its SKU. Pinning
              overrides that; removing the pin falls back to the SKU again.
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
            <Button onClick={() => void submitAssign()}>Pin</Button>
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

function Coverage({
  icon, title, subtitle, empty, rows,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  empty: string;
  rows: Array<{ key: string; left: string; sub: string; right: string }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, 5);
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h4 className="text-sm font-semibold">{title}</h4>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <>
            {shown.map((r) => (
              <div key={r.key} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-sm font-semibold">{r.left}</span>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{r.sub}</p>
                </div>
                <Badge variant="secondary" className="shrink-0">{r.right}</Badge>
              </div>
            ))}
            {rows.length > 5 && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setExpanded(!expanded)}>
                {expanded ? "Show less" : `Show all ${rows.length}`}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
