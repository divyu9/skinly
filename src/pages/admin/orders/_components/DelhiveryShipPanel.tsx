import { useEffect, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { FileTextIcon, RefreshCwIcon, SendIcon, TruckIcon } from "lucide-react";

/**
 * Delhivery Direct, beside RapidShyp (functions/src/delhivery.ts).
 *
 * Before a shipment: whether Delhivery delivers there, whether it takes COD
 * there, and its own estimate of the charge — then one button. After one:
 * a fresh label (Delhivery's links expire) and a tracking refresh; tracking
 * also syncs by itself every 30 minutes. Cancelling uses the shipping panel's
 * usual button, which knows which courier to ask.
 */

type Quote = {
  serviceable: boolean; cod: boolean; prepaid: boolean; note: string; codNeeded: boolean;
  charge: number | null; grams: number; mode: string; pickup: string; missing: string[];
};

const call = <T,>(name: string, data: unknown) => httpsCallable(getFunctions(), name)(data).then((r) => r.data as T);
const messageOf = (e: any) => e?.message || e?.details || "Something went wrong";

export function DelhiveryShipPanel({ orderId, awbNumber, shippingProvider, orderStatus }: {
  orderId: string; awbNumber?: string; shippingProvider?: string; orderStatus?: string;
}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [busy, setBusy] = useState<"" | "ship" | "label" | "sync">("");

  const shipped = !!awbNumber;
  const ours = shippingProvider === "delhivery";
  const canShip = !shipped && (orderStatus === "processing" || orderStatus === "ready_to_ship" || orderStatus === "pending");

  useEffect(() => {
    if (!canShip) return;
    let live = true;
    setQuote(null); setQuoteError("");
    call<Quote>("delhiveryQuote", { orderId })
      .then((q) => { if (live) setQuote(q); })
      .catch((e) => { if (live) setQuoteError(messageOf(e)); });
    return () => { live = false; };
  }, [orderId, canShip]);

  if (shipped && !ours) return null;
  if (!shipped && !canShip) return null;

  const ship = async () => {
    const what = quote?.charge ? ` (about ₹${quote.charge})` : "";
    if (!confirm(`Book this order with Delhivery Direct${what}? The wallet on the Delhivery panel is charged.`)) return;
    setBusy("ship");
    try {
      const r = await call<{ awbNumber: string; pickup?: string; labelUrl?: string }>("createDelhiveryShipment", { orderId });
      toast.success(`Delhivery shipment created — AWB ${r.awbNumber}`, { description: r.pickup, duration: 10000 });
    } catch (e) {
      toast.error(messageOf(e), { duration: 12000 });
    } finally { setBusy(""); }
  };

  const label = async () => {
    setBusy("label");
    try { window.open((await call<{ url: string }>("delhiveryLabel", { orderId })).url, "_blank", "noopener"); }
    catch (e) { toast.error(messageOf(e)); }
    finally { setBusy(""); }
  };

  const sync = async () => {
    setBusy("sync");
    try {
      const r = await call<{ shippingStatus?: string; status?: string }>("refreshDelhiveryTracking", { orderId });
      toast.success(r.shippingStatus ? `Delhivery: ${r.shippingStatus}` : "Tracking is up to date");
    } catch (e) { toast.error(messageOf(e)); }
    finally { setBusy(""); }
  };

  const blocked = !!quote && (!quote.serviceable || (quote.codNeeded && !quote.cod) || !quote.pickup);

  return (
    <Card className="border-2 border-[#ED1C24]/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TruckIcon className="size-4" /> Delhivery Direct
          {shipped && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">AWB {awbNumber}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {shipped ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="flex-1" onClick={label} disabled={!!busy}>
              {busy === "label" ? <Spinner className="mr-2 size-4" /> : <FileTextIcon className="mr-2 size-4" />} Label (fresh link)
            </Button>
            <Button variant="outline" className="flex-1" onClick={sync} disabled={!!busy}>
              {busy === "sync" ? <Spinner className="mr-2 size-4" /> : <RefreshCwIcon className="mr-2 size-4" />} Refresh tracking
            </Button>
          </div>
        ) : (
          <>
            {!quote && !quoteError && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner className="size-4" /> Checking Delhivery…</p>}
            {quoteError && <p className="text-sm text-destructive">{quoteError}</p>}
            {quote && (
              <div className="space-y-1 text-sm">
                <p>
                  {quote.serviceable ? "✅ Delivers to this pincode" : `❌ ${quote.note || "Not serviceable"}`}
                  {quote.serviceable && quote.codNeeded && (quote.cod ? " · COD available" : " · ❌ no COD here")}
                </p>
                <p className="text-muted-foreground">
                  {quote.charge ? <>Estimated charge <b className="text-foreground">₹{quote.charge}</b> · </> : null}
                  {quote.grams} g · {quote.mode}
                </p>
                {quote.missing.length > 0 && (
                  <p className="text-xs text-amber-700">
                    Missing in <Link to="/backend-skinly/shipping" className="underline">Admin › Shipping</Link>: {quote.missing.join(", ")}
                    {quote.missing.includes("warehouse pincode") && " (needed for the rate)"}
                  </p>
                )}
              </div>
            )}
            <Button onClick={ship} disabled={!!busy || !quote || blocked} className="w-full">
              {busy === "ship" ? <><Spinner className="mr-2 size-4" /> Booking…</> : <><SendIcon className="mr-2 size-4" /> Ship via Delhivery Direct{quote?.charge ? ` (~₹${quote.charge})` : ""}</>}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
