import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownIcon, ArrowUpIcon, HistoryIcon, RefreshCwIcon, RotateCcwIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { cn } from "@/lib/utils.ts";

type Ev = {
  type: string; at: number; design: string; delta: number; unit: string;
  before?: number; after?: number; short?: boolean;
  orderId?: string; orderNumber?: string; customer?: string; city?: string; status?: string;
  released?: boolean; releasedAt?: number; lines?: string[];
};
type Result = {
  designs: { code: string; designName: string; kind: string; onHand: number; unit: string; aliases: string[] }[];
  events: Ev[];
  totals?: { allocated: number; orders: number; restocked: number; ledgerSince: number };
  note?: string;
};

const qty = (n: number, unit: string) => {
  const v = Math.abs(n);
  return unit === "m" ? `${v.toFixed(2)} m` : `${Number(v.toFixed(2))} ${unit === "sheets" ? (v === 1 ? "sheet" : "sheets") : unit}`;
};
const day = (t: number) => new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const LABEL: Record<string, string> = { restock: "Stocked", created: "First stocked", adjust: "Adjusted", deleted: "Stock record deleted" };

/**
 * The design's stock history on its product page (functions:
 * productStockHistory): on hand now, every restock and adjustment since the
 * ledger began (18 Oct 2026), and every order that took from it — with the
 * buyer, the device and a link — back to the first sale.
 */
export function StockHistory({ productId }: { productId: string }) {
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "in" | "out">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ functions }, { httpsCallable }] = await Promise.all([import("@/lib/firebase"), import("firebase/functions")]);
      const res: any = await httpsCallable(functions, "productStockHistory")({ productId });
      setData(res.data);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Could not load stock history");
    } finally {
      setLoading(false);
    }
  }, [productId]);
  useEffect(() => { void load(); }, [load]);

  const events = (data?.events || []).filter((e) => filter === "all" || (filter === "in" ? e.type !== "order" : e.type === "order"));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2"><HistoryIcon className="size-5" /> Stock history</CardTitle>
        <button type="button" onClick={() => void load()} disabled={loading} className="grid size-8 place-items-center rounded-md border hover:bg-muted" aria-label="Refresh stock history">
          <RefreshCwIcon className={cn("size-4", loading && "animate-spin")} />
        </button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!data && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
        {data?.note && <p className="text-sm text-muted-foreground">{data.note}</p>}

        {data && data.designs.length > 0 && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {data.designs.map((d) => (
                <div key={d.code} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{d.kind === "cutout" ? "Cutout" : "Roll"} · {d.aliases.join(", ")}</p>
                  <p className="font-semibold">{d.designName || d.code}</p>
                  <p className="text-sm">On hand: <b>{qty(d.onHand, d.unit)}</b></p>
                </div>
              ))}
              {data.totals && (
                <div className="rounded-lg border p-3 text-sm">
                  <p>Sold: <b>{data.totals.orders} order{data.totals.orders === 1 ? "" : "s"}</b> · {qty(data.totals.allocated, data.designs[0].unit)}</p>
                  <p>Stocked (logged): <b>{data.totals.restocked ? qty(data.totals.restocked, data.designs[0].unit) : "—"}</b></p>
                  <p className="mt-1 text-xs text-muted-foreground">Restocks are logged from 18 Oct 2026; sales go back to the first order.</p>
                </div>
              )}
            </div>

            <div className="flex gap-1 text-xs font-semibold">
              {(["all", "in", "out"] as const).map((f) => (
                <button key={f} type="button" onClick={() => setFilter(f)}
                  className={cn("rounded-md border px-2.5 py-1", filter === f ? "bg-foreground text-background" : "hover:bg-muted")}>
                  {f === "all" ? "All" : f === "in" ? "Stock in / adjustments" : "Orders"}
                </button>
              ))}
            </div>

            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <ul className="max-h-[520px] divide-y overflow-y-auto rounded-lg border">
                {events.map((e, i) => {
                  const isOrder = e.type === "order";
                  const up = e.delta > 0;
                  return (
                    <li key={i} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                      <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-md",
                        isOrder ? (e.released ? "bg-muted text-muted-foreground" : "bg-red-50 text-red-700") : up ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700")}>
                        {isOrder && e.released ? <RotateCcwIcon className="size-4" /> : up ? <ArrowUpIcon className="size-4" /> : <ArrowDownIcon className="size-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        {isOrder ? (
                          <>
                            <p className={cn(e.released && "line-through decoration-muted-foreground")}>
                              <b>−{qty(e.delta, e.unit)}</b> to{" "}
                              {e.orderId ? <Link to={`/backend-skinly/orders/${e.orderId}`} className="font-semibold text-primary hover:underline">{e.orderNumber || "order"}</Link> : "an order"}
                              {e.customer && <> · {e.customer}</>}{e.city && <span className="text-muted-foreground"> · {e.city}</span>}
                              {e.short && <span className="ml-1 text-xs font-semibold text-red-600">(stock ran short)</span>}
                            </p>
                            {(e.lines || []).map((l, j) => <p key={j} className="truncate text-xs text-muted-foreground">{l}</p>)}
                            {e.released && <p className="text-xs text-muted-foreground">Returned to stock {e.releasedAt ? day(e.releasedAt) : ""} (order cancelled or returned)</p>}
                          </>
                        ) : (
                          <p>
                            <b>{LABEL[e.type] || e.type}: {up ? "+" : "−"}{qty(e.delta, e.unit)}</b>
                            {e.before !== undefined && e.after !== undefined && (
                              <span className="text-muted-foreground"> · {qty(e.before, e.unit)} → {qty(e.after, e.unit)}</span>
                            )}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground">{day(e.at)}{data.designs.length > 1 ? ` · ${e.design}` : ""}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
