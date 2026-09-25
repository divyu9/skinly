import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import { db, functions } from "@/lib/firebase";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx";

/**
 * Admin › Referrals: what a friend gets, what the referrer earns, and every
 * order a referral brought. The amounts are read by the server at checkout
 * and at delivery (functions/src/referrals.ts); nothing here is decided in
 * the browser. Who referred each order lives in orderReferrals, which only
 * admins can read.
 */

type Settings = {
  enabled: boolean; friendType: "flat" | "percent"; friendValue: number;
  friendMaxDiscount: number; friendMinOrder: number;
  referrerType: "flat" | "percent"; referrerReward: number; referrerMaxReward: number; monthlyCap: number;
};
type Row = {
  _id: string; code: string; referrerName?: string; referrerEmail?: string; friendName?: string; friendDiscount?: number;
  reward?: number; status: string; holdReason?: string; createdAt?: number;
  order?: { orderNumber?: string; checkoutRef?: string; status?: string; paymentStatus?: string; paymentMethod?: string };
};

const BLANK: Settings = {
  enabled: false, friendType: "flat", friendValue: 0, friendMaxDiscount: 0, friendMinOrder: 0,
  referrerType: "flat", referrerReward: 0, referrerMaxReward: 0, monthlyCap: 10,
};
const confirmed = (o?: Row["order"]) => !!o && (o.paymentStatus === "success" || String(o.paymentMethod).toLowerCase() === "cod");
const STATUS: Record<string, [string, string]> = {
  pending: ["Paid on delivery", "bg-amber-100 text-amber-800"],
  held: ["Held for your review", "bg-orange-100 text-orange-800"],
  rejected: ["Refused — no reward", "bg-muted text-muted-foreground"],
  rewarded: ["Reward paid", "bg-green-100 text-green-800"],
  cancelled: ["Cancelled — no reward", "bg-muted text-muted-foreground"],
  no_account: ["Referrer has no account", "bg-red-100 text-red-800"],
};

export default function AdminReferralsPage() {
  const [form, setForm] = useState<Settings | null>(null);
  const [saved, setSaved] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [reviewing, setReviewing] = useState("");

  useEffect(() => onSnapshot(doc(db, "settings", "referral"), (s) => {
    const v = { ...BLANK, ...(s.data() as Partial<Settings> | undefined) };
    setSaved(v);
    setForm((f) => f ?? v);
  }), []);

  // Every referral, with its order — only confirmed orders count; an unpaid checkout is not a referral yet.
  useEffect(() => onSnapshot(collection(db, "orderReferrals"), (snap) => {
    void Promise.all(snap.docs.map(async (d) => {
      const o = await getDoc(doc(db, "orders", d.id)).catch(() => null);
      return { _id: d.id, ...(d.data() as any), order: o?.data() } as Row;
    })).then((list) => setRows(list.filter((r) => confirmed(r.order)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))));
  }, (e) => { toast.error(e.message); setRows([]); }), []);

  const review = async (orderId: string, approve: boolean) => {
    setReviewing(orderId);
    try {
      const res: any = (await httpsCallable(functions, "reviewReferral")({ orderId, approve })).data;
      toast.success(res.status === "rewarded" ? "Approved and paid" : approve ? "Approved — paid on delivery" : "Refused");
    } catch (e: any) {
      toast.error(e?.message || "Could not update");
    } finally {
      setReviewing("");
    }
  };

  const dirty = !!form && !!saved && JSON.stringify(form) !== JSON.stringify(saved);
  const save = async () => {
    if (!form) return;
    if (form.enabled && !(form.referrerReward > 0) && !(form.friendValue > 0)) {
      toast.error("Set what the friend gets or what the referrer earns before switching it on");
      return;
    }
    setBusy(true);
    try {
      await httpsCallable(functions, "saveReferralSettings")(form);
      toast.success(form.enabled ? "Saved — referrals are on" : "Saved");
    } catch (e: any) {
      toast.error(e?.message || "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const totals = useMemo(() => {
    const list = rows || [];
    const sum = (f: (r: Row) => boolean) => list.filter(f).reduce((t, r) => t + (Number(r.reward) || 0), 0);
    return {
      orders: list.length,
      discounts: list.reduce((t, r) => t + (Number(r.friendDiscount) || 0), 0),
      paid: sum((r) => r.status === "rewarded"),
      owed: sum((r) => r.status === "pending"),
      held: list.filter((r) => r.status === "held").length,
    };
  }, [rows]);

  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => f && { ...f, [k]: Math.max(0, Number(e.target.value) || 0) });

  // Both offers in words, as customers will read them.
  const earns = form && form.referrerReward > 0
    ? (form.referrerType === "percent"
      ? `${form.referrerReward}% of their order${form.referrerMaxReward > 0 ? ` (up to ₹${form.referrerMaxReward})` : ""}`
      : `₹${form.referrerReward}`)
    : "nothing";
  // The friend's offer in words, as customers will read it.
  const offer = form && form.friendValue > 0
    ? `${form.friendType === "percent" ? `${form.friendValue}% off${form.friendMaxDiscount > 0 ? ` (up to ₹${form.friendMaxDiscount})` : ""}` : `₹${form.friendValue} off`} their first order${form.friendMinOrder > 0 ? ` over ₹${form.friendMinOrder}` : ""}`
    : "nothing";

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Referrals</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Customers share a link from their account. A friend who follows it gets a discount on their first order; the
            customer gets wallet credit once that order is delivered. A cancelled or returned order pays nothing, and the
            friend's discount doesn't combine with a coupon. Refused automatically: the customer's own email, phone or
            browser, and any email, phone or address that has ordered before. Held for your review: a friend delivering to
            a pincode the customer has ordered to, and customers past the 30-day limit.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">The offer</CardTitle>
            {form && (
              <label className="flex items-center gap-2 text-sm font-medium">
                <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
                {form.enabled ? "On" : "Off"}
              </label>
            )}
          </CardHeader>
          <CardContent>
            {!form ? <p className="text-sm text-muted-foreground">Loading…</p> : (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <fieldset className="space-y-3 rounded-lg border p-4">
                    <legend className="px-1 text-sm font-semibold">The friend gets</legend>
                    <div className="flex gap-2">
                      <Select value={form.friendType} onValueChange={(v) => setForm({ ...form, friendType: v as Settings["friendType"] })}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flat">₹ off</SelectItem>
                          <SelectItem value="percent">% off</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="number" min={0} value={form.friendValue || ""} onChange={num("friendValue")} placeholder={form.friendType === "percent" ? "10" : "50"} className="w-28" aria-label="Friend's discount" />
                    </div>
                    {form.friendType === "percent" && (
                      <div className="space-y-1">
                        <Label htmlFor="ref-max">Most it can take off (₹, 0 = no cap)</Label>
                        <Input id="ref-max" type="number" min={0} value={form.friendMaxDiscount || ""} onChange={num("friendMaxDiscount")} className="w-32" />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label htmlFor="ref-min">Smallest cart it applies to (₹)</Label>
                      <Input id="ref-min" type="number" min={0} value={form.friendMinOrder || ""} onChange={num("friendMinOrder")} placeholder="0" className="w-32" />
                    </div>
                  </fieldset>
                  <fieldset className="space-y-3 rounded-lg border p-4">
                    <legend className="px-1 text-sm font-semibold">The customer who shared earns</legend>
                    <div className="flex gap-2">
                      <Select value={form.referrerType} onValueChange={(v) => setForm({ ...form, referrerType: v as Settings["referrerType"] })}>
                        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flat">₹ per friend</SelectItem>
                          <SelectItem value="percent">% of friend's order</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="number" min={0} value={form.referrerReward || ""} onChange={num("referrerReward")} placeholder={form.referrerType === "percent" ? "10" : "100"} className="w-28" aria-label="Referrer's reward" />
                    </div>
                    {form.referrerType === "percent" && (
                      <div className="space-y-1">
                        <Label htmlFor="ref-max-reward">Most one friend can earn them (₹, 0 = no cap)</Label>
                        <Input id="ref-max-reward" type="number" min={0} value={form.referrerMaxReward || ""} onChange={num("referrerMaxReward")} className="w-32" />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {form.referrerType === "percent"
                        ? "A share of what the friend spends on items, after discounts and without shipping — a bigger cart earns more. "
                        : ""}
                      Paid into their GoSkinly wallet when the friend's order is delivered, to spend on their next order.
                    </p>
                  </fieldset>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ref-cap">Rewards one customer can earn in 30 days before the rest wait for your review (0 = no limit)</Label>
                  <Input id="ref-cap" type="number" min={0} value={form.monthlyCap} onChange={num("monthlyCap")} className="w-32" />
                </div>
                <p className="rounded-md bg-muted px-3 py-2 text-sm">
                  Customers will read: <b>your friend gets {offer}, you get {earns} in your wallet</b>.
                  {form.referrerType === "percent" && form.referrerReward > 0 && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      e.g. a friend's ₹1,000 cart earns ₹{Math.min(Math.floor(1000 * form.referrerReward / 100), form.referrerMaxReward || Infinity)}, a ₹3,000 cart ₹{Math.min(Math.floor(3000 * form.referrerReward / 100), form.referrerMaxReward || Infinity)}.
                    </span>
                  )}
                </p>
                <div className="flex gap-2">
                  <Button onClick={save} disabled={busy || !dirty}>{busy ? "Saving…" : "Save"}</Button>
                  {dirty && <Button variant="ghost" onClick={() => setForm(saved)}>Discard changes</Button>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["Referred orders", totals.orders],
            ["Discount given", `₹${totals.discounts}`],
            ["Rewards paid", `₹${totals.paid}`],
            ["Owed on delivery", `₹${totals.owed}${totals.held ? ` · ${totals.held} held` : ""}`],
          ].map(([l, v]) => (
            <Card key={String(l)}><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{l}</p><p className="text-2xl font-bold">{v}</p></CardContent></Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Referred orders</CardTitle></CardHeader>
          <CardContent>
            {!rows ? <p className="text-sm text-muted-foreground">Loading…</p> : !rows.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No referred orders yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Friend</TableHead>
                    <TableHead>Referred by</TableHead>
                    <TableHead className="text-right">Friend's discount</TableHead>
                    <TableHead className="text-right">Reward</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const [label, cls] = STATUS[r.status] || [r.status, ""];
                    return (
                      <TableRow key={r._id}>
                        <TableCell>
                          <Link to={`/backend-skinly/orders/${r._id}`} className="font-medium hover:underline">{r.order?.orderNumber || r.order?.checkoutRef}</Link>
                          <div className="text-xs text-muted-foreground">{r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN") : ""} · {r.order?.status}</div>
                        </TableCell>
                        <TableCell className="text-sm">{r.friendName}</TableCell>
                        <TableCell className="text-sm">
                          {r.referrerName || r.referrerEmail || "—"}
                          <div className="font-mono text-xs text-muted-foreground">{r.code}</div>
                        </TableCell>
                        <TableCell className="text-right text-sm">₹{Number(r.friendDiscount) || 0}</TableCell>
                        <TableCell className="text-right text-sm">₹{Number(r.reward) || 0}</TableCell>
                        <TableCell>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
                          {r.status === "held" && (
                            <div className="mt-1.5 space-y-1">
                              <p className="text-xs text-muted-foreground">{r.holdReason}</p>
                              <div className="flex gap-1">
                                <Button size="sm" className="h-7" disabled={reviewing === r._id} onClick={() => void review(r._id, true)}>Approve</Button>
                                <Button size="sm" variant="outline" className="h-7" disabled={reviewing === r._id} onClick={() => void review(r._id, false)}>Refuse</Button>
                              </div>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
