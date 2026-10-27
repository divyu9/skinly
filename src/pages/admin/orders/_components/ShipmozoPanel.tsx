import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { PrinterIcon, RefreshCwIcon, TruckIcon } from "lucide-react";

/**
 * A parcel booked through Shipmozo (functions/src/shipmozo.ts): the courier and
 * AWB, the label (Shipmozo sends a PNG — opened in its own tab, ready to print
 * on the 4×6 thermal printer) and a tracking refresh; tracking also syncs by
 * itself every 30 minutes. Booking happens in Compare & ship; cancelling uses
 * the shipping panel's usual button, which knows to ask Shipmozo.
 */
const call = <T,>(name: string, data: unknown) => httpsCallable(getFunctions(), name)(data).then((r) => r.data as T);

export function ShipmozoPanel({ order }: { order: any }) {
  const [busy, setBusy] = useState<"" | "label" | "sync">("");
  if (order?.shippingProvider !== "shipmozo" || !order?.awbNumber) return null;
  const orderId = String(order._id);

  const printLabel = async () => {
    // The tab opens on the click itself (a popup blocker allows it), then gets the label.
    const w = window.open("", "_blank");
    setBusy("label");
    try {
      const r = await call<{ label: string; awb: string }>("shipmozoLabel", { orderId });
      if (w) {
        w.document.title = `Label ${r.awb}`;
        w.document.body.style.margin = "0";
        const img = w.document.createElement("img");
        img.src = r.label;
        img.style.width = "100%";
        img.onload = () => setTimeout(() => w.print(), 200);
        w.document.body.appendChild(img);
      }
    } catch (e: any) {
      w?.close();
      toast.error(e?.message || "Could not get the label");
    } finally {
      setBusy("");
    }
  };

  const refresh = async () => {
    setBusy("sync");
    try {
      const r = await call<{ shippingStatus?: string; status?: string; error?: string }>("refreshShipmozoTracking", { orderId });
      if (r.error) toast.error(r.error);
      else toast.success(`Tracking: ${r.shippingStatus || "no new scan yet"}`);
    } catch (e: any) {
      toast.error(e?.message || "Could not refresh tracking");
    } finally {
      setBusy("");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <TruckIcon className="size-4" /> Shipmozo · {order.courierName || "courier"}
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs">AWB {order.awbNumber}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {order.shippingStatus && <p className="text-muted-foreground">Status: {order.shippingStatus}</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={printLabel} disabled={!!busy}>
            <PrinterIcon className="mr-2 size-4" /> {busy === "label" ? "Getting label…" : "Print label"}
          </Button>
          <Button type="button" variant="outline" onClick={refresh} disabled={!!busy}>
            <RefreshCwIcon className={`mr-2 size-4 ${busy === "sync" ? "animate-spin" : ""}`} /> Refresh tracking
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
