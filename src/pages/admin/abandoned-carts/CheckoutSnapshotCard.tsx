import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MapPinIcon, MessageSquareIcon, PhoneIcon, XIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

const COVERAGE: Record<string, string> = { only_back: "Back only", full_body_wrap: "Full body wrap" };

/**
 * One checkout left half-way (cartSnapshots), opened from the dashboard's
 * activity log (?checkout=<cartId>). The table below lists only the carts the
 * hourly detector has picked up, so a checkout left a minute ago wasn't in it.
 */
export function CheckoutSnapshotCard() {
  const [params, setParams] = useSearchParams();
  const id = params.get("checkout") || "";
  const [snap, setSnap] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let live = true;
    setSnap(null); setError("");
    (async () => {
      try {
        const [{ functions }, { httpsCallable }] = await Promise.all([import("@/lib/firebase"), import("firebase/functions")]);
        const r: any = await httpsCallable(functions, "getCheckoutSnapshot")({ id });
        if (live) setSnap(r.data);
      } catch (e: any) {
        if (live) setError(e?.message || "Could not load this checkout");
      }
    })();
    return () => { live = false; };
  }, [id]);

  if (!id) return null;
  const close = () => { params.delete("checkout"); setParams(params, { replace: true }); };
  const a = snap?.address || {};
  const addressLines = [a.line1, a.line2, [a.city, a.state].filter(Boolean).join(", "), a.pincode].filter(Boolean);
  const when = Number(snap?.checkoutAt || snap?.updatedAt) || 0;
  const firstName = String(snap?.name || "").split(" ")[0];
  const waText = `Hi ${firstName || "there"}, this is Skinly. We saw you were checking out and didn't finish — can we help with anything?`;

  return (
    <Card className="border-2 border-amber-400">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div>
          <CardTitle className="text-lg">Checkout left {snap?.name ? `by ${snap.name}` : ""}</CardTitle>
          {when > 0 && (
            <p className="text-sm text-muted-foreground">
              {new Date(when).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
              {snap?.stage === "ordered" ? " · ordered later" : ""}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={close} aria-label="Close"><XIcon className="size-4" /></Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : !snap ? (
          <Skeleton className="h-32" />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              {(snap.items || []).map((i: any, n: number) => (
                <div key={n} className="flex gap-3">
                  {i.productImage
                    ? <img src={i.productImage} alt="" className="size-14 shrink-0 rounded-md border object-cover" />
                    : <div className="size-14 shrink-0 rounded-md border bg-muted" />}
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold leading-snug">{i.productTitle || i.productId}</p>
                    <p className="text-xs text-muted-foreground">
                      {[i.variant, [i.phoneBrand, i.phoneModel].filter(Boolean).join(" "), COVERAGE[i.coverage] || "", i.lensModel ? `Lens: ${i.lensModel}` : ""].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-xs">₹{i.price} × {i.quantity}</p>
                  </div>
                </div>
              ))}
              <p className="border-t pt-2 text-sm font-bold">Total ₹{Number(snap.total || 0).toLocaleString("en-IN")}</p>
            </div>
            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <p className="font-semibold">{snap.name || "No name typed"}</p>
                {snap.phone && (
                  <p className="flex items-center gap-1.5">
                    <PhoneIcon className="size-3.5" /> <a href={`tel:+91${snap.phone}`} className="underline">{snap.phone}</a>
                    {snap.phoneVerified && <Badge variant="outline" className="border-green-500/40 text-green-700">verified</Badge>}
                  </p>
                )}
                {snap.email && <p className="text-muted-foreground">{snap.email}</p>}
              </div>
              <div className="flex gap-1.5">
                <MapPinIcon className="mt-0.5 size-3.5 shrink-0" />
                {addressLines.length
                  ? <p className="whitespace-pre-line">{addressLines.join("\n")}</p>
                  : <p className="text-muted-foreground">No address typed yet (or left before this was recorded)</p>}
              </div>
              {snap.phone && (
                <Button asChild size="sm" variant="outline">
                  <a href={`https://wa.me/91${snap.phone}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer">
                    <MessageSquareIcon className="mr-1.5 size-4" /> Open WhatsApp chat
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
