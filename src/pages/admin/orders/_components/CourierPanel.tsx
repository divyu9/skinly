import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import { ArrowLeftRightIcon, LoaderIcon, ScaleIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { DelhiveryBulkDialog } from "./DelhiveryBulkDialog.tsx";

const REASONS = ["Courier never picked it up", "Courier refused the lane", "Cheaper or faster elsewhere", "Other"];
const LOCKED = ["delivered", "cancelled", "rto", "out_for_delivery"];

/**
 * One order's courier, from its page: Compare & ship (Delhivery Direct,
 * RapidShyp and Shipmozo priced side by side, the same dialog as the orders
 * list) when it has no shipment, and Change courier when it has one that has
 * to go another way — the same parcel, so no stock is taken
 * (functions/src/rapidshyp.ts rebookShipment). `?ship=1` opens Compare & ship
 * at once; a new replacement order lands here with it (ReshipPanel).
 */
export function CourierPanel({ order, orderId }: { order: any; orderId: string }) {
  const [params, setParams] = useSearchParams();
  const [compareOpen, setCompareOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [why, setWhy] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [skipCancel, setSkipCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  const status = String(order?.status || "");
  const awb = String(order?.awbNumber || "");
  const manual = String(order?.manualTrackingNumber || "");
  const hasShipment = !!(awb || manual);
  const viaApi = !!awb && order?.shippingProvider !== "manual";
  const confirmed = !!order?.orderNumber && status !== "pending_payment" && order?.paymentStatus !== "failed" && !order?.isDeleted;
  const history: any[] = Array.isArray(order?.shipmentHistory) ? order.shipmentHistory : [];

  useEffect(() => {
    if (params.get("ship") !== "1" || !confirmed || hasShipment) return;
    setCompareOpen(true);
    params.delete("ship");
    setParams(params, { replace: true });
  }, [params, confirmed, hasShipment]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!confirmed || order?.addOnTo || LOCKED.includes(status)) return null;

  const change = async () => {
    setBusy(true);
    try {
      await httpsCallable(getFunctions(), "rebookShipment")({
        orderId, reason: [why, note.trim()].filter(Boolean).join(": "), notifyCustomer: notify, skipCancel: viaApi && skipCancel,
      });
      toast.success("Old shipment removed — pick the new courier");
      setChangeOpen(false);
      setCompareOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Could not change the courier", { duration: 10000 });
    } finally { setBusy(false); }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><ScaleIcon className="size-4" /> Courier</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {hasShipment ? (
            <>
              <p className="text-muted-foreground">
                Booked with <b className="text-foreground">{order.courierName || order.manualCourierCompany || order.shippingProvider || "a courier"}</b> · {awb || manual}.
                Not picked up, or has to go another way? Change the courier — the same parcel, stock is not taken again.
              </p>
              <Button variant="outline" size="sm" onClick={() => { setWhy(REASONS[0]); setNote(""); setNotify(true); setSkipCancel(false); setChangeOpen(true); }}>
                <ArrowLeftRightIcon className="mr-1.5 size-4" />Change courier
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">Price it with Delhivery Direct, RapidShyp and Shipmozo, then book the one you pick.</p>
              <Button size="sm" onClick={() => setCompareOpen(true)}><ScaleIcon className="mr-1.5 size-4" />Compare & ship</Button>
            </>
          )}
          {history.length > 0 && (
            <div className="space-y-0.5 border-t pt-2 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Earlier shipments</p>
              {history.map((h, i) => (
                <p key={i}>
                  {new Date(h.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {h.courier || h.provider} {h.awb}
                  {h.shippingCost != null ? ` · ₹${h.shippingCost}` : ""}{h.cancelledWithCourier ? " · cancelled" : " · dropped"} · {h.reason}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={changeOpen} onOpenChange={(o) => { if (!busy) setChangeOpen(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Change courier for {order.orderNumber}</DialogTitle>
            <DialogDescription>
              The current shipment ({order.courierName || order.manualCourierCompany || order.shippingProvider} · {awb || manual}) is
              {viaApi ? " cancelled with the courier" : " removed from the order"} and kept in its history. The order goes back to
              processing and Compare & ship opens for the new label. Stock is not touched — it is the same piece.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <select value={why} onChange={(e) => setWhy(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
              {REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Details (Amazon ticket, courier said…)" />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
              <span>Send the customer the new tracking once it is booked</span>
            </label>
            {viaApi && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={skipCancel} onChange={(e) => setSkipCancel(e.target.checked)} />
                <span>Don't cancel with {order.shippingProvider || "the courier"} — just drop it here <span className="text-muted-foreground">(when their cancel keeps failing and the parcel is with you)</span></span>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void change()} disabled={busy || (why === "Other" && !note.trim())}>
              {busy && <LoaderIcon className="mr-1.5 size-4 animate-spin" />}Remove & pick new courier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {compareOpen && (
        // Rebooking just cleared the AWB; the dialog only reads the order once, so it is handed over cleared.
        <DelhiveryBulkDialog open={compareOpen} onOpenChange={setCompareOpen}
          orders={[{ ...order, _id: orderId, awbNumber: undefined, status: hasShipment ? "processing" : order.status }]} />
      )}
    </>
  );
}
