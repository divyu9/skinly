import { useEffect, useMemo, useRef, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import { CheckCircle2Icon, LoaderIcon, XCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";

/**
 * Ship many orders with Delhivery Direct, after seeing what each costs.
 *
 * Opening it asks Delhivery, order by order, whether it delivers to the
 * pincode (and takes COD there) and what it would charge (delhiveryQuote) —
 * paced, because Delhivery's rate API allows 40 calls a minute. The admin
 * unticks any they would rather send another way; confirming books the rest
 * one at a time (createDelhiveryShipment), each row showing its AWB or why
 * it failed. Orders already shipped are not offered.
 */

type Quote = { serviceable: boolean; cod: boolean; codNeeded: boolean; charge: number | null; grams: number; note: string; missing: string[] };
type Row = {
  id: string; orderNumber: string; pin: string; city: string;
  quote?: Quote; quoteError?: string; picked: boolean;
  state?: "booking" | "done" | "failed"; awb?: string; error?: string;
};

const call = <T,>(name: string, data: unknown) => httpsCallable(getFunctions(), name)(data).then((r) => r.data as T);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const bookable = (q?: Quote) => !!q && q.serviceable && (!q.codNeeded || q.cod);

export function DelhiveryBulkDialog({ open, onOpenChange, orders }: { open: boolean; onOpenChange: (o: boolean) => void; orders: any[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [phase, setPhase] = useState<"quoting" | "ready" | "booking" | "finished">("quoting");
  const cancelled = useRef(false);

  const patch = (id: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  useEffect(() => {
    if (!open) return;
    cancelled.current = false;
    const initial: Row[] = orders
      .filter((o) => !o.awbNumber && !o.isDeleted)
      .map((o) => ({
        id: o._id, orderNumber: String(o.orderNumber || o._id), picked: false,
        pin: String(o.shippingAddress?.pincode || ""), city: String(o.shippingAddress?.city || ""),
      }));
    setRows(initial);
    setPhase("quoting");
    void (async () => {
      for (const [i, r] of initial.entries()) {
        if (cancelled.current) return;
        try {
          const q = await call<Quote>("delhiveryQuote", { orderId: r.id });
          patch(r.id, { quote: q, picked: bookable(q) });
        } catch (e: any) {
          patch(r.id, { quoteError: e?.message || "Could not check" });
        }
        // Delhivery's rate API: 40 a minute.
        if (i < initial.length - 1) await sleep(1600);
      }
      if (!cancelled.current) setPhase("ready");
    })();
    return () => { cancelled.current = true; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const picked = rows.filter((r) => r.picked && bookable(r.quote) && r.state !== "done");
  const total = useMemo(() => picked.reduce((s, r) => s + (r.quote?.charge || 0), 0), [picked]);
  const missing = rows.find((r) => r.quote?.missing?.length)?.quote?.missing || [];

  const book = async () => {
    if (!picked.length) return;
    if (!confirm(`Book ${picked.length} order${picked.length > 1 ? "s" : ""} with Delhivery Direct (about ₹${total.toFixed(0)})? The Delhivery wallet is charged.`)) return;
    setPhase("booking");
    let ok = 0;
    for (const r of picked) {
      patch(r.id, { state: "booking" });
      try {
        const res = await call<{ awbNumber: string }>("createDelhiveryShipment", { orderId: r.id });
        patch(r.id, { state: "done", awb: res.awbNumber });
        ok++;
      } catch (e: any) {
        patch(r.id, { state: "failed", error: e?.message || "Failed" });
      }
    }
    setPhase("finished");
    toast[ok === picked.length ? "success" : "error"](`${ok} of ${picked.length} booked with Delhivery`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (phase !== "booking") onOpenChange(o); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ship with Delhivery Direct</DialogTitle>
          <DialogDescription>
            {phase === "quoting" ? "Checking each order with Delhivery…" : "Untick any order you'd rather ship another way, then confirm."}
            {missing.length > 0 && <span className="block text-amber-700">Missing in Admin › Shipping: {missing.join(", ")}.</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-8 px-3 py-2" />
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Pincode</th>
                <th className="px-3 py-2">Delhivery</th>
                <th className="px-3 py-2 text-right">Charge</th>
                <th className="px-3 py-2">Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const q = r.quote;
                const can = bookable(q);
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">
                      <Checkbox checked={r.picked && can} disabled={!can || phase === "booking" || r.state === "done"}
                        onCheckedChange={(v) => patch(r.id, { picked: !!v })} />
                    </td>
                    <td className="px-3 py-2 font-medium">{r.orderNumber}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.pin}{r.city ? ` · ${r.city}` : ""}</td>
                    <td className="px-3 py-2">
                      {!q && !r.quoteError ? <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
                        : r.quoteError ? <span className="text-destructive">{r.quoteError}</span>
                        : !q!.serviceable ? <span className="text-destructive">Not serviceable{q!.note ? ` — ${q!.note}` : ""}</span>
                        : q!.codNeeded && !q!.cod ? <span className="text-destructive">No COD here</span>
                        : <span className="text-emerald-700">Delivers{q!.codNeeded ? " · COD ok" : ""} · {q!.grams} g</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{q?.charge ? `₹${q.charge.toFixed(2)}` : q ? "—" : ""}</td>
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
            {picked.length} selected · about <b className="text-foreground">₹{total.toFixed(0)}</b>
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={phase === "booking"}>
              {phase === "finished" ? "Close" : "Cancel"}
            </Button>
            {phase !== "finished" && (
              <Button onClick={() => void book()} disabled={phase !== "ready" || !picked.length}>
                {phase === "booking" ? <><LoaderIcon className="mr-2 size-4 animate-spin" /> Booking…</> : `Confirm & ship ${picked.length}`}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
