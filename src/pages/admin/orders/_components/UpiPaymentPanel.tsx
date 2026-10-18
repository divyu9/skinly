import { useState } from "react";
import { toast } from "sonner";
import { IndianRupeeIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";

/**
 * A clearance order paid straight to the owner's UPI (functions: clearance.ts).
 * The customer submits a UTR from the order page; the admin checks the bank
 * app and marks the money received — which numbers the order (CL- series,
 * no invoice) and sends "order received" — or not received, which cancels it
 * and puts the pieces back on sale.
 */
export function UpiPaymentPanel({ order }: { order: any }) {
  const [busy, setBusy] = useState(false);
  if (order?.paymentMethod !== "upi_direct") return null;
  const paid = order.paymentStatus === "success";
  const cancelled = order.status === "cancelled";
  const amount = Number(order.upiPay?.amount ?? order.amountPayable ?? order.total) || 0;

  const decide = async (received: boolean) => {
    if (!received && !window.confirm("Cancel this order and put its pieces back on sale?")) return;
    setBusy(true);
    try {
      const [{ functions }, { httpsCallable }] = await Promise.all([import("@/lib/firebase"), import("firebase/functions")]);
      await httpsCallable(functions, "confirmUpiPayment")({ orderId: String(order._id), received });
      toast.success(received ? "Payment confirmed — order is now processing" : "Order cancelled, pieces back on sale");
    } catch (e: any) {
      toast.error(e?.message || "Could not update");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={paid ? "" : "border-amber-400"}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><IndianRupeeIcon className="size-4" /> Direct UPI payment (personal sale)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>Amount: <b>₹{amount}</b> to <span className="font-mono">{order.upiPay?.vpa || "—"}</span> · note <span className="font-mono">{order.upiPay?.note || order.checkoutRef}</span></p>
        <p>
          Customer's UTR:{" "}
          {order.upiUtr ? <b className="font-mono">{order.upiUtr}</b> : <span className="text-muted-foreground">not submitted yet</span>}
          {order.upiSubmittedAt ? <span className="text-muted-foreground"> · {new Date(order.upiSubmittedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span> : null}
        </p>
        {order.upiLostPieces ? (
          <p className="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
            The UTR came after the 10 minutes and {order.upiLostPieces} piece(s) had already gone to another order — refund the customer instead of confirming.
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">Personal sale: numbered in the CL- series, no GST invoice.</p>
        {paid ? (
          <p className="font-semibold text-green-700">Payment confirmed{order.orderNumber ? ` · ${order.orderNumber}` : ""}.</p>
        ) : cancelled ? (
          <p className="font-semibold text-red-700">Cancelled — payment not received.</p>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" onClick={() => decide(true)} disabled={busy}>Money received — confirm order</Button>
            <Button type="button" variant="outline" className="text-red-600" onClick={() => decide(false)} disabled={busy}>Not received — cancel</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
