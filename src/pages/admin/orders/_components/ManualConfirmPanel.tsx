import { useState } from "react";
import { toast } from "sonner";
import { MailIcon, MessageCircleIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";

/**
 * "Order received" for a manual order, sent only when the admin presses a
 * button (functions: sendOrderConfirmation). A manual order sends nothing by
 * itself: it may be a call-in order, a repeat or a test. Each send shows in
 * the order's message history.
 */
export function ManualConfirmPanel({ order }: { order: any }) {
  const [busy, setBusy] = useState<"" | "whatsapp" | "email">("");
  const [savingAuto, setSavingAuto] = useState(false);
  if (order?.source !== "manual") return null;
  const sent = order?.confirmationSent || {};
  const phone = order?.shippingAddress?.phone || order?.phone || "";
  const email = order?.email || "";
  const numbered = !!order?.orderNumber;
  const when = (t?: number) => (t ? new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");

  // Shipped, out for delivery, delivered, review request: automatic for every
  // other order, and for a manual one only once the admin switches it on
  // (functions: orderStatus.notifyOrderStatus, reviewRequests).
  const autoOn = order?.autoUpdates === true;
  const setAuto = async (on: boolean) => {
    setSavingAuto(true);
    try {
      const { db, doc, updateDoc } = await (await import("@/lib/fs")).loadFs();
      await updateDoc(doc(db, "orders", String(order._id)), { autoUpdates: on, updatedAt: Date.now() });
      toast.success(on ? "Automatic updates on for this order" : "Automatic updates off for this order");
    } catch (e: any) {
      toast.error(e?.message || "Could not save");
    } finally {
      setSavingAuto(false);
    }
  };

  const send = async (channel: "whatsapp" | "email") => {
    setBusy(channel);
    try {
      const [{ functions }, { httpsCallable }] = await Promise.all([import("@/lib/firebase"), import("firebase/functions")]);
      await httpsCallable(functions, "sendOrderConfirmation")({ orderId: String(order._id), channel });
      toast.success(channel === "whatsapp" ? `WhatsApp sent to ${phone}` : `Email sent to ${email}`);
    } catch (e: any) {
      toast.error(e?.message || "Could not send");
    } finally {
      setBusy("");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Order confirmation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          Manual orders send nothing by themselves. Send the customer their "order received" message if you want to.
        </p>
        {!numbered && <p className="text-xs text-amber-700">Available once the order has its number (paid or COD).</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Button type="button" variant="outline" className="w-full" disabled={!numbered || !phone || !!busy} onClick={() => send("whatsapp")}>
              <MessageCircleIcon className="mr-2 size-4" />
              {busy === "whatsapp" ? "Sending…" : sent.whatsapp ? "Send WhatsApp again" : "Send WhatsApp"}
            </Button>
            <p className="text-xs text-muted-foreground">{phone || "No phone"}{sent.whatsapp ? ` · sent ${when(sent.whatsapp)}` : ""}</p>
          </div>
          <div className="space-y-1">
            <Button type="button" variant="outline" className="w-full" disabled={!numbered || !email || !!busy} onClick={() => send("email")}>
              <MailIcon className="mr-2 size-4" />
              {busy === "email" ? "Sending…" : sent.email ? "Send email again" : "Send email"}
            </Button>
            <p className="text-xs text-muted-foreground">{email || "No email"}{sent.email ? ` · sent ${when(sent.email)}` : ""}</p>
          </div>
        </div>
        <label className="flex items-start gap-2 border-t pt-3">
          <input type="checkbox" className="mt-1" checked={autoOn} disabled={savingAuto} onChange={(e) => setAuto(e.target.checked)} />
          <span>
            <b>Automatic updates</b> — shipped, out for delivery, delivered and the review request on WhatsApp and email, like a website order.
            <span className="block text-xs text-muted-foreground">{autoOn ? "On: each next status sends its message." : "Off: nothing is sent unless you tick this."}</span>
          </span>
        </label>
      </CardContent>
    </Card>
  );
}
