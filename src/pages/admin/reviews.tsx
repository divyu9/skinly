import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircleIcon, CheckIcon, GiftIcon, MessageSquareIcon, StarIcon, TrashIcon, XIcon } from "lucide-react";
import { db } from "@/lib/firebase";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { DEFAULT_REVIEW_REWARDS, normaliseRules, type ReviewRewardRules } from "@/lib/review-rewards";

/**
 * Admin › Reviews: the moderation queue.
 *
 * Every review arrives pending (functions/src/reviews.ts) and is public only
 * once approved here. Approving also pays the order's review cashback into
 * the customer's wallet (functions/src/reviewRewards.ts), at the rules edited
 * at the top of this page. Rejecting keeps it off the site; nothing is paid.
 */

type Review = {
  _id: string; productId: string; productTitle?: string; productSlug?: string; orderId?: string; rating: number;
  title?: string; comment?: string; imageUrls?: string[]; userName?: string; device?: string; verified?: boolean;
  status?: "pending" | "approved" | "rejected"; createdAt?: number; _creationTime?: number;
};

const TABS = ["pending", "approved", "rejected", "all"] as const;
type Tab = (typeof TABS)[number];
const statusOf = (r: Review) => r.status || "approved";

function RewardRulesCard() {
  const [rules, setRules] = useState<ReviewRewardRules | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    getDoc(doc(db, "settings", "reviewRewards")).then((s) => setRules(normaliseRules(s.data()))).catch(() => setRules(DEFAULT_REVIEW_REWARDS));
  }, []);
  if (!rules) return <Skeleton className="h-32 w-full" />;
  const set = (patch: Partial<ReviewRewardRules>) => setRules({ ...rules, ...patch });
  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "reviewRewards"), { ...rules, updatedAt: Date.now() }, { merge: true });
      toast.success("Review rewards saved — the order page and review page show them now");
    } catch (e: any) { toast.error(e?.message || "Could not save"); }
    finally { setSaving(false); }
  };
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><GiftIcon className="size-4" /> Review cashback</CardTitle>
        <CardDescription>
          Paid into the customer's wallet when you approve their review — once per order, at the photo rate if any approved
          review of that order has a photo. Shown on delivered orders' pages and on the review page.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-4">
        <label className="flex items-center gap-2 text-sm font-medium sm:col-span-4">
          <input type="checkbox" checked={rules.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="size-4" />
          Reward approved reviews
        </label>
        <div className="space-y-1.5">
          <Label htmlFor="textPct">Written review (% of order)</Label>
          <Input id="textPct" type="number" min={0} max={100} value={rules.textPct} onChange={(e) => set({ textPct: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="photoPct">With photo (% of order)</Label>
          <Input id="photoPct" type="number" min={0} max={100} value={rules.photoPct} onChange={(e) => set({ photoPct: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="maxAmount">Most per order (₹)</Label>
          <Input id="maxAmount" type="number" min={0} value={rules.maxAmount} onChange={(e) => set({ maxAmount: Number(e.target.value) })} />
        </div>
        <div className="flex items-end">
          <Button onClick={save} disabled={saving} className="w-full">{saving ? "Saving…" : "Save"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminReviews() {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [tab, setTab] = useState<Tab>("pending");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => onSnapshot(collection(db, "reviews"),
    (s) => setReviews(s.docs.map((d) => ({ _id: d.id, ...d.data() } as Review))
      .sort((a, b) => (b.createdAt || b._creationTime || 0) - (a.createdAt || a._creationTime || 0))),
    (e) => { toast.error(e.message); setReviews([]); }), []);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { pending: 0, approved: 0, rejected: 0, all: 0 };
    for (const r of reviews || []) { c[statusOf(r) as Tab]++; c.all++; }
    return c;
  }, [reviews]);
  const shown = (reviews || []).filter((r) => tab === "all" || statusOf(r) === tab);

  const moderate = async (r: Review, action: "approve" | "reject") => {
    setBusy(r._id);
    try {
      const res: any = (await httpsCallable(getFunctions(), "moderateReview")({ reviewId: r._id, action })).data;
      const rw = res?.reward;
      if (action === "approve") {
        toast.success(
          rw?.paid > 0 ? `Approved — ₹${rw.paid} cashback added to the customer's wallet`
            : rw?.owed > 0 ? `Approved — ₹${rw.owed} owed: this guest has no account to pay into yet`
            : `Approved${rw?.note ? ` (${rw.note})` : ""}`,
          { duration: 7000 },
        );
      } else toast.success("Rejected — it stays off the site");
    } catch (e: any) { toast.error(e?.message || "Could not update the review"); }
    finally { setBusy(null); }
  };

  const remove = async (r: Review) => {
    if (!confirm("Delete this review for good?")) return;
    try { await deleteDoc(doc(db, "reviews", r._id)); toast.success("Review deleted"); }
    catch (e: any) { toast.error(e?.message || "Could not delete"); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reviews</h1>
          <p className="text-muted-foreground">Approve what customers wrote. Approved reviews go live and pay the review cashback.</p>
        </div>

        <RewardRulesCard />

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)} className="capitalize">
              {t} <Badge variant="secondary" className="ml-2">{counts[t]}</Badge>
            </Button>
          ))}
        </div>

        {reviews === null ? (
          <Skeleton className="h-40 w-full" />
        ) : shown.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <MessageSquareIcon className="size-8" />
            {tab === "pending" ? "Nothing waiting for approval" : "No reviews here"}
          </CardContent></Card>
        ) : (
          <div className="space-y-4">
            {shown.map((r) => {
              const st = statusOf(r);
              return (
                <Card key={r._id} className={st === "pending" ? "border-2 border-amber-400" : ""}>
                  <CardContent className="space-y-3 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{r.userName || "Customer"}</p>
                          {r.verified && <Badge className="gap-1"><CheckCircleIcon className="size-3" /> Verified purchase</Badge>}
                          <Badge variant={st === "approved" ? "default" : st === "rejected" ? "destructive" : "secondary"} className="capitalize">{st}</Badge>
                          {(r.imageUrls?.length || 0) > 0 && <Badge variant="outline">📷 {r.imageUrls!.length} photo{r.imageUrls!.length > 1 ? "s" : ""}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.createdAt || r._creationTime || 0).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                          {r.device ? ` · ${r.device}` : ""}
                          {r.orderId && <> · <Link className="underline" to={`/backend-skinly/orders/${r.orderId}`}>order</Link></>}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {st !== "approved" && (
                          <Button size="sm" onClick={() => void moderate(r, "approve")} disabled={busy === r._id}>
                            <CheckIcon className="mr-1 size-4" /> Approve
                          </Button>
                        )}
                        {st !== "rejected" && (
                          <Button size="sm" variant="outline" onClick={() => void moderate(r, "reject")} disabled={busy === r._id}>
                            <XIcon className="mr-1 size-4" /> Reject
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => void remove(r)} aria-label="Delete"><TrashIcon className="size-4" /></Button>
                      </div>
                    </div>
                    <p className="rounded-lg bg-muted/50 p-2 text-sm font-medium">{r.productTitle}</p>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <StarIcon key={n} className={`size-4 ${n <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                      ))}
                    </div>
                    {r.title && <p className="font-semibold">{r.title}</p>}
                    {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                    {(r.imageUrls?.length || 0) > 0 && (
                      <div className="flex gap-2 overflow-x-auto">
                        {r.imageUrls!.map((u) => (
                          <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="size-24 rounded-lg object-cover" /></a>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
