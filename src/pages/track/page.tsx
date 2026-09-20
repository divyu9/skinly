import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { SiteHeader } from "@/components/site-header.tsx";
import { SiteFooter } from "@/components/site-footer.tsx";
import { orderStatusLabel } from "@/lib/order-label.ts";
import {
  PackageIcon, TruckIcon, CheckCircle2Icon, ExternalLinkIcon,
  SearchIcon, AlertCircleIcon, ClockIcon, HomeIcon,
} from "lucide-react";

/**
 * Where is my parcel, without an account.
 *
 * Most of this shop's orders are placed by guests, and every order screen the
 * site had was behind a login — so a guest's only way to ask was to email the
 * shop. Two fields answer it: the order number, which is printed on their
 * confirmation, and the email or phone they ordered with, which is the part
 * only they know. The server checks the pair; this page never sees an order it
 * was not given both halves for.
 */

type Result = {
  orderNumber: string;
  status: string;
  journey: string[];
  placedAt: number;
  deliveredAt: number;
  total: number;
  paymentMethod: string;
  items: Array<{ title: string; quantity: number; image: string; variant: string }>;
  history: Array<{ at: number; to: string }>;
  courierName: string;
  awbNumber: string;
  trackingUrl: string;
  shippingStatus: string;
  lastEventAt: number;
  city: string;
  creditOnDelivery: number;
  creditPaid: boolean;
};

const fmt = (ts: number) =>
  ts
    ? new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";

const fmtTime = (ts: number) =>
  ts
    ? new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";

/** Where a status sits on the journey, or -1 when it left it. */
const stepIndex = (journey: string[], status: string) => journey.indexOf(status);

export default function TrackOrderPage() {
  const [params] = useSearchParams();
  const track = useMutation(api.orders.trackOrder);

  const [orderNumber, setOrderNumber] = useState(params.get("order") || "");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    setResult(null);
    setBusy(true);
    try {
      const res = (await track({ orderNumber, contact })) as Result;
      setResult(res);
    } catch (err: any) {
      const msg = err?.message || err?.data?.message || "Something went wrong. Try again in a moment.";
      setError(String(msg).replace(/^.*?:\s*/, ""));
    } finally {
      setBusy(false);
    }
  };

  const done = result ? stepIndex(result.journey, result.status) : -1;
  const offJourney = result ? done === -1 : false;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="halftone flex-1 px-4 py-10">
        <div className="mx-auto w-full max-w-2xl">
          <header className="mb-6 text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Track your order</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              No account needed — just the order number and the email or phone you ordered with.
            </p>
          </header>

          <form onSubmit={submit} className="sticker rounded-2xl bg-card p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="track-number">Order number</Label>
                <Input
                  id="track-number"
                  className="mt-1.5 sticker-sm rounded-lg"
                  placeholder="#4025"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div>
                <Label htmlFor="track-contact">Email or phone</Label>
                <Input
                  id="track-contact"
                  className="mt-1.5 sticker-sm rounded-lg"
                  placeholder="you@email.com or 9876543210"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
            <Button type="submit" disabled={busy} className="sticker-sm sticker-press mt-4 w-full rounded-lg py-6 text-base font-semibold">
              {busy ? <Spinner className="mr-2 size-4" /> : <SearchIcon className="mr-2 size-4" />}
              {busy ? "Looking…" : "Find my order"}
            </Button>

            {error && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            )}
          </form>

          {result && (
            <div className="mt-6 space-y-4">
              {/* What it is and where it stands */}
              <section className="sticker rounded-2xl bg-card p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-lg font-bold">{result.orderNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      Placed {fmt(result.placedAt)}
                      {result.city ? ` · to ${result.city}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full border-2 border-ink bg-brand px-3 py-1 text-sm font-semibold text-brand-foreground">
                    {orderStatusLabel(result.status)}
                  </span>
                </div>

                {/*
                  The journey, drawn only when the order is still on it. A
                  cancelled or returned parcel has left the line, and drawing
                  it half-lit would say it was still coming.
                */}
                {!offJourney ? (
                  <ol className="mt-6 space-y-0">
                    {result.journey.map((step, i) => {
                      const reached = i <= done;
                      const current = i === done;
                      const at = result.history.find((h) => h.to === step)?.at;
                      return (
                        <li key={step} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <span
                              className={`grid size-6 shrink-0 place-items-center rounded-full border-2 border-ink ${
                                reached ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {reached ? <CheckCircle2Icon className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}
                            </span>
                            {i < result.journey.length - 1 && (
                              <span className={`w-0.5 flex-1 ${i < done ? "bg-brand" : "bg-border"}`} style={{ minHeight: "1.5rem" }} />
                            )}
                          </div>
                          <div className={`pb-5 ${current ? "" : "opacity-70"}`}>
                            <p className={`text-sm ${current ? "font-semibold" : "font-medium"}`}>
                              {orderStatusLabel(step)}
                            </p>
                            {at ? <p className="text-xs text-muted-foreground">{fmtTime(at)}</p> : null}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                    <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
                    This order is {orderStatusLabel(result.status).toLowerCase()}. If that does not look right,
                    write to us with the order number and we will sort it out.
                  </p>
                )}
              </section>

              {/* The courier's own page, which is always fresher than ours */}
              {result.awbNumber && (
                <section className="sticker rounded-2xl bg-card p-5">
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    <TruckIcon className="size-4" /> Shipment
                  </h2>
                  <p className="mt-2 text-sm">
                    <span className="font-medium">{result.courierName || "Courier"}</span>
                    <span className="ml-2 font-mono text-muted-foreground">{result.awbNumber}</span>
                  </p>
                  {result.shippingStatus && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <ClockIcon className="size-3.5" />
                      {result.shippingStatus}
                      {result.lastEventAt ? ` · ${fmtTime(result.lastEventAt)}` : ""}
                    </p>
                  )}
                  {result.trackingUrl && (
                    <a href={result.trackingUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block">
                      <Button variant="outline" className="sticker-sm sticker-press rounded-lg">
                        Live tracking <ExternalLinkIcon className="ml-2 size-4" />
                      </Button>
                    </a>
                  )}
                </section>
              )}

              {/* What is in the box */}
              <section className="sticker rounded-2xl bg-card p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <PackageIcon className="size-4" /> In this order
                </h2>
                <ul className="mt-3 space-y-3">
                  {result.items.map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      {item.image ? (
                        <img src={item.image} alt="" className="size-12 shrink-0 rounded-lg border-2 border-ink object-cover" />
                      ) : (
                        <span className="grid size-12 shrink-0 place-items-center rounded-lg border-2 border-ink bg-muted">
                          <PackageIcon className="size-5 text-muted-foreground" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        {item.variant && <p className="truncate text-xs text-muted-foreground">{item.variant}</p>}
                      </div>
                      <span className="text-sm tabular-nums text-muted-foreground">×{item.quantity}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center justify-between border-t-2 border-dashed border-ink/20 pt-3">
                  <span className="text-sm font-medium">Order total</span>
                  <span className="text-lg font-bold tabular-nums">₹{result.total.toFixed(0)}</span>
                </div>
                {result.paymentMethod?.toLowerCase() === "cod" && (
                  <p className="mt-1 text-xs text-muted-foreground">Cash on delivery</p>
                )}
                {result.creditOnDelivery > 0 && (
                  <p className="mt-3 rounded-lg bg-brand/10 p-2.5 text-sm">
                    {result.creditPaid
                      ? `₹${result.creditOnDelivery} has been added to your Skinly wallet.`
                      : `₹${result.creditOnDelivery} goes into your Skinly wallet once this is delivered.`}
                  </p>
                )}
              </section>

              <p className="text-center text-sm text-muted-foreground">
                Something not right?{" "}
                <Link to="/policies/contact" className="font-medium text-brand underline-offset-2 hover:underline">
                  Talk to us
                </Link>
              </p>
            </div>
          )}

          {!result && !error && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              <HomeIcon className="mr-1 inline size-3.5" />
              Have an account?{" "}
              <Link to="/orders" className="font-medium text-brand underline-offset-2 hover:underline">
                See all your orders
              </Link>
            </p>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
