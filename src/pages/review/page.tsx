import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { httpsCallable } from "firebase/functions";
import { CameraIcon, CheckCircle2Icon, ImageIcon, StarIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { functions } from "@/lib/firebase";
import { orderGoodsValue, rewardAmount, useReviewRewardRules } from "@/lib/review-rewards";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { BrandLogo } from "@/components/brand-logo.tsx";
import { ProductThumb } from "@/components/product-thumb.tsx";

/**
 * /review/:orderId?t=… — rate what you bought.
 *
 * Linked from the WhatsApp sent a few days after delivery
 * (functions/src/reviewRequests.ts), and from a delivered order's page. One
 * card per product in the order: stars, a line or two, up to three photos.
 * The server (submitOrderReview) checks the link or the sign-in, that the
 * order was delivered and the product was in it, and publishes the review
 * as a verified purchase. Sending again edits it.
 */

type Draft = { rating: number; comment: string; photos: string[]; kept: string[]; saved: boolean };

const MAX_PHOTOS = 3;

/** A phone photo, down to 1200px JPEG in the browser — 4 MB becomes ~200 KB. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Could not read that photo"));
      i.src = url;
    });
    const scale = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ReviewPage() {
  const { orderId = "" } = useParams<{ orderId: string }>();
  const [params] = useSearchParams();
  const token = params.get("t");
  // The customer's own order link carries ?k=; it opens this page too.
  const viewKey = params.get("k");
  const rules = useReviewRewardRules();
  const order: any = useQuery(api.orders.getOrderPublic, orderId ? { orderId, withReviews: true } : "skip");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState<string | null>(null);

  // One card per product, whatever the quantities or devices.
  const products = useMemo(() => {
    const seen = new Map<string, any>();
    for (const it of Array.isArray(order?.items) ? order.items : []) {
      if (it?.productId && !seen.has(it.productId)) seen.set(it.productId, it);
    }
    return [...seen.values()];
  }, [order]);

  // Reviews already left for this order come back filled in, to edit. They
  // arrive with the order (viewOrder), pending ones included — the public can
  // read only approved reviews.
  useEffect(() => {
    const mine: any[] = Array.isArray(order?.myReviews) ? order.myReviews : [];
    if (!mine.length) return;
    const next: Record<string, Draft> = {};
    for (const r of mine) {
      next[r.productId] = { rating: r.rating, comment: r.comment || "", photos: [], kept: r.imageUrls || [], saved: true };
    }
    setDrafts((cur) => ({ ...next, ...cur }));
  }, [order]);

  const draft = (id: string): Draft => drafts[id] || { rating: 0, comment: "", photos: [], kept: [], saved: false };
  const update = (id: string, patch: Partial<Draft>) =>
    setDrafts((cur) => ({ ...cur, [id]: { ...draft(id), ...patch, saved: false } }));

  const addPhotos = async (id: string, files: FileList | null) => {
    if (!files?.length) return;
    const d = draft(id);
    const room = MAX_PHOTOS - d.kept.length - d.photos.length;
    try {
      const shrunk = await Promise.all([...files].slice(0, room).map(shrink));
      update(id, { photos: [...d.photos, ...shrunk] });
    } catch (e: any) {
      toast.error(e?.message || "Could not read that photo");
    }
  };

  const submit = async (item: any) => {
    const id = item.productId;
    const d = draft(id);
    if (!d.rating) {
      toast.error("Tap the stars to rate it first");
      return;
    }
    setBusy(id);
    try {
      await httpsCallable(functions, "submitOrderReview")({
        orderId,
        ...(token ? { t: token } : {}),
        ...(viewKey ? { k: viewKey } : {}),
        reviews: [{ productId: id, rating: d.rating, comment: d.comment, photos: d.photos, keepImageUrls: d.kept }],
      });
      setDrafts((cur) => ({ ...cur, [id]: { ...d, saved: true } }));
      toast.success("Thank you! We'll publish it after a quick check — your cashback follows.");
    } catch (e: any) {
      const code = e?.code || "";
      toast.error(
        code === "functions/permission-denied"
          ? (token || viewKey ? "This link isn't valid. Please use the link we sent you."
            : "Please sign in with the account you ordered from, or use the review link we sent on WhatsApp.")
          : code === "functions/failed-precondition" || code === "functions/invalid-argument" ? e.message
          : "Couldn't send your review. Please try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  const firstName = String(order?.shippingAddress?.fullName || "").trim().split(/\s+/)[0];

  return (
    <div className="halftone min-h-screen px-4 py-8">
      <Helmet>
        <title>Rate your order | GoSkinly</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="mx-auto max-w-md">
        <Link to="/" className="mb-6 flex justify-center"><BrandLogo /></Link>

        {order === undefined ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !order ? (
          <Card><p className="py-6 text-center text-sm text-muted-foreground">We couldn't find this order. Please use the link from our message.</p></Card>
        ) : order.status !== "delivered" ? (
          <Card><p className="py-6 text-center text-sm text-muted-foreground">You can review this order once it has been delivered.</p></Card>
        ) : (
          <>
            <h1 className="text-center text-2xl font-bold">
              {firstName ? `How's it looking, ${firstName}?` : "How's it looking?"}
            </h1>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              A photo of the skin on your device helps the next person choose.
            </p>
            {rules?.enabled && rewardAmount(rules, orderGoodsValue(order), true) > 0 && (
              <div className="mt-4 rounded-2xl border-2 border-ink bg-sunny/40 p-3 text-center text-sm">
                <p className="font-bold">
                  Get up to ₹{rewardAmount(rules, orderGoodsValue(order), true)} back in your wallet
                </p>
                <p className="text-xs">
                  {rules.photoPct}% of your order with a photo · {rules.textPct}% for a written review · max ₹{rules.maxAmount}, once it's approved
                </p>
              </div>
            )}

            <div className="mt-6 space-y-4">
              {products.map((item) => {
                const id = item.productId;
                const d = draft(id);
                const device = [item.phoneBrand, item.phoneModel].filter(Boolean).join(" ");
                const photoCount = d.kept.length + d.photos.length;
                return (
                  <Card key={id}>
                    <div className="flex items-center gap-3">
                      <div className="size-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                        <ProductThumb src={item.productImage} alt={item.productTitle || ""} />
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold">{item.productTitle}</p>
                        {device && <p className="text-xs text-muted-foreground">{device}</p>}
                      </div>
                    </div>

                    <div className="mt-4 flex justify-center gap-1.5" role="radiogroup" aria-label="Rating">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={d.rating === n}
                          aria-label={`${n} star${n > 1 ? "s" : ""}`}
                          onClick={() => update(id, { rating: n })}
                          className="p-1"
                        >
                          <StarIcon className={`size-9 ${n <= d.rating ? "fill-yellow-400 text-yellow-400" : "fill-muted text-muted-foreground/30"}`} />
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={d.comment}
                      onChange={(e) => update(id, { comment: e.target.value.slice(0, 1000) })}
                      placeholder="How's the fit and finish? (optional)"
                      rows={3}
                      className="mt-3 w-full resize-none rounded-xl border-2 border-ink/10 bg-background p-3 text-sm outline-none focus:border-brand"
                    />

                    <div className="mt-3 flex flex-wrap gap-2">
                      {d.kept.map((u) => (
                        <Thumb key={u} src={u} onRemove={() => update(id, { kept: d.kept.filter((x) => x !== u) })} />
                      ))}
                      {d.photos.map((u, i) => (
                        <Thumb key={i} src={u} onRemove={() => update(id, { photos: d.photos.filter((_, j) => j !== i) })} />
                      ))}
                      {photoCount < MAX_PHOTOS && (
                        <>
                          {/* Two doors, because a phone's single picker hides one of them. */}
                          <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-ink/25 text-xs font-medium text-muted-foreground">
                            <CameraIcon className="size-5" />
                            Camera
                            <input type="file" accept="image/*" capture="environment" className="hidden"
                              onChange={(e) => { void addPhotos(id, e.target.files); e.target.value = ""; }} />
                          </label>
                          <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-ink/25 text-xs font-medium text-muted-foreground">
                            <ImageIcon className="size-5" />
                            Gallery
                            <input type="file" accept="image/*" multiple className="hidden"
                              onChange={(e) => { void addPhotos(id, e.target.files); e.target.value = ""; }} />
                          </label>
                        </>
                      )}
                    </div>

                    {d.saved ? (
                      <p className="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold text-brand-deep">
                        <CheckCircle2Icon className="size-4" /> Review sent — thank you!
                      </p>
                    ) : (
                      <Button className="sticker mt-4 h-11 w-full" onClick={() => submit(item)} disabled={busy === id}>
                        {busy === id ? <Spinner className="mr-2" /> : null}
                        {busy === id ? "Sending…" : "Post review"}
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Reviews appear after a quick check. Your first name and last initial are shown with your review, marked as a verified purchase.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border-2 border-ink/15 bg-card p-5 shadow-sm">{children}</div>;
}

function Thumb({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="relative size-20 overflow-hidden rounded-xl border border-border">
      <img src={src} alt="" className="h-full w-full object-cover" />
      <button type="button" onClick={onRemove} aria-label="Remove photo"
        className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white">
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
}
