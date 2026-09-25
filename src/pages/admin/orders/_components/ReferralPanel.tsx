import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { GiftIcon } from "lucide-react";
import { toast } from "sonner";
import { db, functions } from "@/lib/firebase";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";

/**
 * Who referred this order and what they are owed. Kept in
 * orderReferrals/{orderId}, which only admins can read — the customer's
 * own order never says (functions/src/referrals.ts).
 */
const STATUS: Record<string, [string, string]> = {
  pending: ["Paid on delivery", "bg-amber-100 text-amber-800"],
  held: ["Held for your review", "bg-orange-100 text-orange-800"],
  rewarded: ["Reward paid", "bg-green-100 text-green-800"],
  cancelled: ["Cancelled — no reward", "bg-muted text-muted-foreground"],
  rejected: ["Refused — no reward", "bg-muted text-muted-foreground"],
  no_account: ["Referrer has no account", "bg-red-100 text-red-800"],
};

export function ReferralPanel({ orderId }: { orderId: string }) {
  const [r, setR] = useState<any | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => onSnapshot(doc(db, "orderReferrals", orderId), (s) => setR(s.exists() ? s.data() : null), () => setR(null)), [orderId]);
  if (!r) return null;

  const review = async (approve: boolean) => {
    setBusy(true);
    try {
      const res: any = (await httpsCallable(functions, "reviewReferral")({ orderId, approve })).data;
      toast.success(res.status === "rewarded" ? "Approved and paid" : approve ? "Approved — paid on delivery" : "Refused");
    } catch (e: any) {
      toast.error(e?.message || "Could not update");
    } finally {
      setBusy(false);
    }
  };
  const [label, cls] = STATUS[r.status] || [r.status, ""];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><GiftIcon className="size-4" /> Referral</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          <span className="text-muted-foreground">Referred by</span>
          <span>
            <b>{r.referrerName || "—"}</b>
            {r.referrerEmail && <span className="text-muted-foreground"> · {r.referrerEmail}</span>}
            {r.referrerPhone && <span className="text-muted-foreground"> · {r.referrerPhone}</span>}
            <span className="ml-1 font-mono text-xs text-muted-foreground">({r.code})</span>
          </span>
          <span className="text-muted-foreground">Friend's discount</span>
          <span>₹{Number(r.friendDiscount) || 0}</span>
          <span className="text-muted-foreground">Referrer earns</span>
          <span><b>₹{Number(r.reward) || 0}</b> into their wallet on delivery</span>
          <span className="text-muted-foreground">Status</span>
          <span><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span></span>
        </div>
        {r.status === "held" && (
          <div className="rounded-md bg-orange-50 p-3 dark:bg-orange-950/30">
            <p className="mb-2"><b>Why held:</b> {r.holdReason || "flagged"}. The friend kept their discount; the reward waits for you.</p>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => void review(true)}>Approve reward</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void review(false)}>Refuse</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
