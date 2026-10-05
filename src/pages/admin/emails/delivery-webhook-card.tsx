import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { Button } from "@/components/ui/button.tsx";
import { toast } from "sonner";

/**
 * The URL for MSG91 › Email › Webhook › Delivery Report. With it set, each
 * order's History shows whether its emails were delivered, opened or bounced
 * (functions/src/emailEvents.ts); without it, only that MSG91 accepted them.
 */
export function DeliveryWebhookCard() {
  const [url, setUrl] = useState("");
  useEffect(() => {
    httpsCallable(functions, "msg91EmailEventsUrl")({}).then((r: any) => setUrl(r.data?.url || "")).catch(() => {});
  }, []);
  if (!url) return null;
  return (
    <div className="rounded-xl border bg-card p-4 text-sm">
      <p className="font-medium">Delivery reports</p>
      <p className="mt-1 text-muted-foreground">
        Paste this in MSG91 → Email → Webhook → Delivery Report, so each order's History shows delivered / opened / bounced.
      </p>
      <code className="mt-2 block break-all rounded bg-muted p-2 text-xs">{url}</code>
      <Button size="sm" variant="outline" className="mt-2" onClick={() => { void navigator.clipboard.writeText(url); toast.success("Copied"); }}>Copy</Button>
    </div>
  );
}
