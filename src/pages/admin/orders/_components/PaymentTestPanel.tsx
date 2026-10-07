import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import { functions } from "@/lib/firebase";
import { trackPurchase } from "@/lib/analytics.ts";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";

/**
 * Payment test mode: a simulated successful payment for Meta, no money.
 *
 * Fires the browser Purchase (Pixel only, never GA4) and asks the server to
 * send the same Purchase through the Conversions API, both with one
 * `purchase-test-…` event_id, so Events Manager › Test Events shows Browser +
 * Server deduplicated. The order itself is not touched: marking it paid
 * would issue a GST invoice, reserve stock and message the customer.
 *
 * Shown only in a build with VITE_PAYMENT_TEST_MODE=true; the server also
 * needs PAYMENT_TEST_MODE=true and META_TEST_EVENT_CODE (functions/.env).
 * Open this page from Test Events' "Test browser events" so the Pixel's
 * event is tagged too.
 */
export const PAYMENT_TEST_MODE = import.meta.env.VITE_PAYMENT_TEST_MODE === "true";

export function PaymentTestPanel({ order }: { order: any }) {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string>("");
  if (!PAYMENT_TEST_MODE) return null;

  const run = async () => {
    setBusy(true);
    const eventId = `purchase-test-${String(order.orderNumber || order._id).replace(/[^A-Za-z0-9_-]/g, "")}-${Date.now()}`;
    try {
      const items = (Array.isArray(order.items) ? order.items : []).map((i: any) => ({
        id: String(i.productId || i.sku || ""), name: String(i.productTitle || ""), price: Number(i.price) || 0, quantity: Number(i.quantity) || 1,
      }));
      trackPurchase(String(order.orderNumber || order._id), Number(order.total ?? order.amountPayable) || 0, items, { eventId, skipGa: true });
      const r: any = (await httpsCallable(functions, "metaCapiTestPurchase")({ orderId: String(order._id), eventId })).data;
      setLast(`${eventId} · server ${r.ok ? `ok (${r.eventsReceived} received, test code ${r.testCode})` : `failed: ${r.error}`}`);
      if (r.ok) toast.success("Test Purchase sent from browser and server");
      else toast.error(r.error || "Server event failed");
    } catch (e: any) {
      toast.error(e?.message || "Test failed");
      setLast(`${eventId} · ${e?.message || "failed"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-dashed border-amber-500/60">
      <CardHeader className="pb-3"><CardTitle className="text-base">Payment test mode</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">
          Sends a test Purchase for ₹{Number(order.total ?? 0).toFixed(0)} to Meta from this browser and from the server with one event_id. No payment, and this order is not changed.
        </p>
        <Button size="sm" variant="outline" disabled={busy} onClick={run}>{busy ? "Sending…" : "Simulate successful payment"}</Button>
        {last && <p className="break-all text-xs text-muted-foreground">{last}</p>}
      </CardContent>
    </Card>
  );
}
