import { useEffect, useMemo, useRef, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import { CheckCircle2Icon, LoaderIcon, XCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";

/**
 * Compare & ship: every selected order priced three ways (Delhivery Direct,
 * RapidShyp, Shipmozo — whose courier can be picked), then booked.
 *
 * Opening it asks compareShipping, order by order, for Delhivery Direct's
 * serviceability and estimate and for RapidShyp's couriers on that lane —
 * paced, because Delhivery's rate API allows 40 calls a minute. Each order
 * starts on the cheaper route that can take it; the admin may switch any to
 * the other route or skip it. Confirming books each on its route, one at a
 * time: Delhivery Direct (createDelhiveryShipment) or RapidShyp
 * (createShipment), which books the courier RapidShyp's own priority rule
 * picks — "cheapest first" in its panel makes that the cheapest shown here.
 */

type Courier = { code: string; name: string; freight: number; mode: string; edd: string | null };
type SmzCourier = { id: number; name: string; freight: number; edd: string; auto: boolean };
type Compare = {
  pin: string; grams: number; codNeeded: boolean;
  delhivery: { serviceable: boolean; cod: boolean; charge: number | null; note: string; ready: boolean };
  rapidshyp: { couriers: Courier[]; error?: string };
  shipmozo?: { couriers: SmzCourier[]; error?: string; ready?: boolean };
  missing: string[];
};
type Route = "delhivery" | "rapidshyp" | "shipmozo" | "skip";
type Row = {
  id: string; orderNumber: string; city: string; pin: string;
  cmp?: Compare; cmpError?: string; route: Route; smzCourier?: number;
  state?: "booking" | "done" | "failed"; awb?: string; error?: string;
};

const call = <T,>(name: string, data: unknown) => httpsCallable(getFunctions(), name)(data).then((r) => r.data as T);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const dlvOk = (c?: Compare) => !!c && c.delhivery.ready && c.delhivery.serviceable && (!c.codNeeded || c.delhivery.cod);
const rsOk = (c?: Compare) => !!c && c.rapidshyp.couriers.length > 0;
const dlvCost = (c?: Compare) => (dlvOk(c) ? c!.delhivery.charge ?? Infinity : Infinity);
const rsCost = (c?: Compare) => (rsOk(c) ? c!.rapidshyp.couriers[0].freight : Infinity);
const smOk = (c?: Compare) => !!c?.shipmozo?.ready && (c?.shipmozo?.couriers.length || 0) > 0;
const smCost = (c?: Compare, id?: number) => {
  if (!smOk(c)) return Infinity;
  const list = c!.shipmozo!.couriers;
  return (list.find((x) => x.id === id) || list[0]).freight;
};
const best = (c?: Compare): Route => {
  const d = dlvCost(c), r = rsCost(c), m = smCost(c);
  const low = Math.min(d, r, m);
  if (low === Infinity) return "skip";
  return low === m ? "shipmozo" : low === d ? "delhivery" : "rapidshyp";
};
const costOf = (r: Row) => (r.route === "delhivery" ? dlvCost(r.cmp) : r.route === "rapidshyp" ? rsCost(r.cmp) : r.route === "shipmozo" ? smCost(r.cmp, r.smzCourier) : 0);

export function DelhiveryBulkDialog({ open, onOpenChange, orders }: { open: boolean; onOpenChange: (o: boolean) => void; orders: any[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [phase, setPhase] = useState<"quoting" | "ready" | "booking" | "finished">("quoting");
  const cancelled = useRef(false);
  const patch = (id: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  useEffect(() => {
    if (!open) return;
    cancelled.current = false;
    const initial: Row[] = orders.filter((o) => !o.awbNumber && !o.isDeleted && !o.addOnTo && !!o.orderNumber && o.status !== "pending_payment" && o.paymentStatus !== "failed").map((o) => ({
      id: o._id, orderNumber: String(o.orderNumber || o._id), route: "skip",
      pin: String(o.shippingAddress?.pincode || ""), city: String(o.shippingAddress?.city || ""),
    }));
    setRows(initial);
    setPhase("quoting");
    void (async () => {
      for (const [i, r] of initial.entries()) {
        if (cancelled.current) return;
        try {
          const cmp = await call<Compare>("compareShipping", { orderId: r.id });
          patch(r.id, { cmp, route: best(cmp), smzCourier: cmp.shipmozo?.couriers[0]?.id });
        } catch (e: any) {
          patch(r.id, { cmpError: e?.message || "Could not check" });
        }
        if (i < initial.length - 1) await sleep(1600); // Delhivery's rate API: 40 a minute
      }
      if (!cancelled.current) setPhase("ready");
    })();
    return () => { cancelled.current = true; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const toBook = rows.filter((r) => r.route !== "skip" && r.state !== "done");
  const total = useMemo(() => toBook.reduce((s, r) => s + (Number.isFinite(costOf(r)) ? costOf(r) : 0), 0), [toBook]);
  const counts = { delhivery: toBook.filter((r) => r.route === "delhivery").length, rapidshyp: toBook.filter((r) => r.route === "rapidshyp").length, shipmozo: toBook.filter((r) => r.route === "shipmozo").length };
  const missing = rows.find((r) => r.cmp?.missing?.length)?.cmp?.missing || [];

  const book = async () => {
    if (!toBook.length) return;
    if (!confirm(`Book ${toBook.length} order(s): ${counts.delhivery} with Delhivery Direct, ${counts.rapidshyp} with RapidShyp, ${counts.shipmozo} with Shipmozo (about ₹${total.toFixed(0)})?`)) return;
    setPhase("booking");
    let ok = 0;
    for (const r of toBook) {
      patch(r.id, { state: "booking" });
      try {
        const res = r.route === "shipmozo"
          ? await call<{ awbNumber: string }>("createShipmozoShipment", { orderId: r.id, courierId: r.smzCourier })
          : await call<{ awbNumber: string }>(r.route === "delhivery" ? "createDelhiveryShipment" : "createShipment", { orderId: r.id });
        patch(r.id, { state: "done", awb: res.awbNumber });
        ok++;
      } catch (e: any) {
        patch(r.id, { state: "failed", error: e?.message || "Failed" });
      }
    }
    setPhase("finished");
    toast[ok === toBook.length ? "success" : "error"](`${ok} of ${toBook.length} booked`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (phase !== "booking") onOpenChange(o); }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Compare & ship</DialogTitle>
          <DialogDescription>
            {phase === "quoting" ? "Pricing each order with Delhivery Direct, RapidShyp and Shipmozo…" : "Each order starts on its cheapest route. Change any, then confirm."}
            <span className="block text-xs">RapidShyp books the courier its own priority rule picks — set it to “cheapest first” in the RapidShyp panel so that is the one shown here.</span>
            {missing.length > 0 && <span className="block text-amber-700">Missing in Admin › Shipping: {missing.join(", ")}.</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[58vh] overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Delhivery Direct</th>
                <th className="px-3 py-2">RapidShyp (cheapest)</th>
                <th className="px-3 py-2">Shipmozo</th>
                <th className="px-3 py-2">Ship with</th>
                <th className="px-3 py-2">Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = r.cmp;
                const top = c?.rapidshyp.couriers[0];
                const cheaper = best(c);
                return (
                  <tr key={r.id} className="border-t align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium">{r.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">{r.pin}{r.city ? ` · ${r.city}` : ""}{c ? ` · ${c.grams} g${c.codNeeded ? " · COD" : ""}` : ""}</p>
                    </td>
                    <td className="px-3 py-2">
                      {!c && !r.cmpError ? <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
                        : r.cmpError ? <span className="text-destructive">{r.cmpError}</span>
                        : !c!.delhivery.serviceable ? <span className="text-destructive">✗ {c!.delhivery.note || "Not serviceable"}</span>
                        : c!.codNeeded && !c!.delhivery.cod ? <span className="text-destructive">✗ No COD</span>
                        : <span className={cheaper === "delhivery" ? "font-bold text-emerald-700" : ""}>{c!.delhivery.charge ? `₹${c!.delhivery.charge.toFixed(2)}` : "Serviceable"}</span>}
                    </td>
                    <td className="px-3 py-2">
                      {!c ? null : c.rapidshyp.error ? <span className="text-destructive">{c.rapidshyp.error}</span>
                        : !top ? <span className="text-destructive">✗ No courier</span>
                        : (
                          <div>
                            <p className={cheaper === "rapidshyp" ? "font-bold text-emerald-700" : ""}>₹{top.freight.toFixed(2)} · {top.name}</p>
                            <p className="text-xs text-muted-foreground">{top.mode}{top.edd ? ` · by ${top.edd}` : ""}</p>
                            {c.rapidshyp.couriers.length > 1 && (
                              <p className="text-xs text-muted-foreground" title={c.rapidshyp.couriers.slice(1).map((x) => `${x.name} ₹${x.freight}`).join("\n")}>
                                then {c.rapidshyp.couriers.slice(1, 3).map((x) => `${x.name.split(" ")[0]} ₹${Math.round(x.freight)}`).join(", ")}
                              </p>
                            )}
                          </div>
                        )}
                    </td>
                    <td className="px-3 py-2">
                      {!c ? null : !c.shipmozo ? <span className="text-muted-foreground">—</span>
                        : c.shipmozo.error ? <span className="text-destructive">{c.shipmozo.error}</span>
                        : !c.shipmozo.ready ? <span className="text-amber-700">Pickup warehouse not set</span>
                        : !c.shipmozo.couriers.length ? <span className="text-destructive">✗ No courier</span>
                        : (
                          <div className="space-y-1">
                            <p className={cheaper === "shipmozo" ? "font-bold text-emerald-700" : ""}>₹{smCost(c, r.smzCourier).toFixed(2)}</p>
                            <select value={r.smzCourier} disabled={phase === "booking" || r.state === "done"}
                              onChange={(e) => patch(r.id, { smzCourier: Number(e.target.value), route: "shipmozo" })}
                              className="h-7 max-w-[11rem] rounded-md border border-input bg-background px-1 text-xs">
                              {c.shipmozo.couriers.map((x) => (
                                <option key={x.id} value={x.id}>{x.name} · ₹{Math.round(x.freight)}{x.edd ? ` · ${x.edd}` : ""}</option>
                              ))}
                            </select>
                          </div>
                        )}
                    </td>
                    <td className="px-3 py-2">
                      <select value={r.route} disabled={!c || phase === "booking" || r.state === "done"}
                        onChange={(e) => patch(r.id, { route: e.target.value as Route })}
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                        <option value="delhivery" disabled={!dlvOk(c)}>Delhivery Direct</option>
                        <option value="rapidshyp" disabled={!rsOk(c)}>RapidShyp</option>
                        <option value="shipmozo" disabled={!smOk(c)}>Shipmozo</option>
                        <option value="skip">Skip</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      {r.state === "booking" && <LoaderIcon className="size-4 animate-spin" />}
                      {r.state === "done" && <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2Icon className="size-4" /> {r.awb}</span>}
                      {r.state === "failed" && <span className="flex items-center gap-1 text-destructive"><XCircleIcon className="size-4" /> {r.error}</span>}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">All selected orders already have a shipment.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <DialogFooter className="items-center gap-3 sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {counts.delhivery} Delhivery Direct · {counts.rapidshyp} RapidShyp · {counts.shipmozo} Shipmozo · about <b className="text-foreground">₹{total.toFixed(0)}</b>
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={phase === "booking"}>
              {phase === "finished" ? "Close" : "Cancel"}
            </Button>
            {phase !== "finished" && (
              <Button onClick={() => void book()} disabled={phase !== "ready" || !toBook.length}>
                {phase === "booking" ? <><LoaderIcon className="mr-2 size-4 animate-spin" /> Booking…</> : `Confirm & ship ${toBook.length}`}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
