import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CheckCircle2Icon, LockIcon, XCircleIcon } from "lucide-react";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { BrandLogo } from "@/components/brand-logo.tsx";
import { ProductThumb } from "@/components/product-thumb.tsx";
import { resumePayment, paymentErrorMessage } from "@/lib/resume-payment.ts";
import { orderLabel } from "@/lib/order-label.ts";

/**
 * /pay/:orderId?t=… — finish paying for an order, from the reminder.
 *
 * The WhatsApp sent after a failed or abandoned PhonePe payment links here
 * (functions/src/payLink.ts). It shows what was ordered and what it costs,
 * and one button that opens PhonePe for that same order — no cart, no
 * address form, no second order.
 */
export default function PayPage() {
  const { orderId = "" } = useParams<{ orderId: string }>();
  const [params] = useSearchParams();
  const token = params.get("t");
  const order: any = useQuery(api.orders.getOrderPublic, orderId ? { orderId } : "skip");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await resumePayment(orderId, token);
      if (r.alreadyPaid) {
        setPaid(true);
        setBusy(false);
      }
      // Otherwise the browser is on its way to PhonePe; stay busy.
    } catch (e) {
      setError(paymentErrorMessage(e));
      setBusy(false);
    }
  };

  const amount = order ? Math.round(Number(order.amountPayable ?? order.total) || 0) : 0;
  const items: any[] = Array.isArray(order?.items) ? order.items : [];
  const isPaid = paid || order?.paymentStatus === "success";
  const closed = !!order && !isPaid && (order.isDeleted || String(order.status || "") === "cancelled");

  return (
    <div className="halftone min-h-screen px-4 py-8">
      <Helmet>
        <title>Complete your payment | GoSkinly</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="mx-auto max-w-md">
        <Link to="/" className="mb-6 flex justify-center"><BrandLogo /></Link>

        <div className="rounded-3xl border-2 border-ink/15 bg-card p-5 shadow-sm">
          {order === undefined ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : !order ? (
            <Message icon="x" title="We couldn't find this order">
              The link may be incomplete. Please use the link from our message, or{" "}
              <a className="underline" href="https://wa.me/919761011121">message us on WhatsApp</a>.
            </Message>
          ) : isPaid ? (
            <Message icon="ok" title="This order is paid">
              Thank you! Order {orderLabel(order)} is confirmed and we're getting it ready.
              <Link to={`/orders/${orderId}`} className="mt-4 block">
                <Button className="w-full">View order</Button>
              </Link>
            </Message>
          ) : closed ? (
            <Message icon="x" title="This order was closed">
              It can't be paid any more, but your design is still here.
              <Link to="/products" className="mt-4 block">
                <Button className="w-full">Shop again</Button>
              </Link>
            </Message>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {order.orderNumber ? `Order ${order.orderNumber}` : `Checkout ${order.checkoutRef || orderLabel(order)}`}
              </p>
              <h1 className="mt-1 text-2xl font-bold">Your payment didn't go through</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Your order is saved. Finish paying and we'll print and cut it for you.
              </p>

              <ul className="mt-5 space-y-3">
                {items.slice(0, 3).map((it, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="size-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                      <ProductThumb src={it.productImage} alt={it.productTitle || ""} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{it.productTitle}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[[it.phoneBrand, it.phoneModel].filter(Boolean).join(" "), it.variant, it.quantity > 1 ? `Qty ${it.quantity}` : ""].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </li>
                ))}
                {items.length > 3 && (
                  <li className="text-xs text-muted-foreground">+ {items.length - 3} more</li>
                )}
              </ul>

              <div className="mt-5 flex items-baseline justify-between border-t-2 border-dashed border-ink/10 pt-4">
                <span className="text-sm text-muted-foreground">To pay</span>
                <span className="text-2xl font-bold">₹{amount}</span>
              </div>

              <Button className="sticker mt-5 h-12 w-full text-base" onClick={pay} disabled={busy}>
                {busy ? <Spinner className="mr-2" /> : <LockIcon className="mr-2 size-4" />}
                {busy ? "Opening PhonePe…" : `Pay ₹${amount}`}
              </Button>
              {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Secure payment by PhonePe · UPI, cards, net banking
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Need help? <a className="underline" href="https://wa.me/919761011121">Chat with us on WhatsApp</a>
        </p>
      </div>
    </div>
  );
}

function Message({ icon, title, children }: { icon: "ok" | "x"; title: string; children: React.ReactNode }) {
  return (
    <div className="py-4 text-center">
      {icon === "ok"
        ? <CheckCircle2Icon className="mx-auto size-12 text-brand" />
        : <XCircleIcon className="mx-auto size-12 text-muted-foreground" />}
      <h1 className="mt-3 text-xl font-bold">{title}</h1>
      <div className="mt-2 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
