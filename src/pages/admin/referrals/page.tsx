import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from "firebase/firestore";
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
 * the browser.
 */

type Settings = {
  enabled: boolean; friendType: "flat" | "percent"; friendValue: number;
  friendMaxDiscount: number; friendMinOrder: number;
  referrerType: "flat" | "percent"; referrerReward: number; referrerMaxReward: number;
};
type Order = {
  _id: string; orderNumber?: string; checkoutRef?: string; customerName?: string; createdAt?: number; status?: string;
  paymentStatus?: string; paymentMethod?: string; total?: number; referralDiscount?: number;
  referral?: { code: string; referrerUserDocId: string; reward: number; status: string };
};

const BLANK: Settings = {
  enabled: false, friendType: "flat", friendValue: 0, friendMaxDiscount: 0, friendMinOrder: 0,
  referrerType: "flat", referrerReward: 0, referrerMaxReward: 0,
};
const confirmed = (o: Order) => o.paymentStatus === "success" || String(o.paymentMethod).toLowerCase() === "cod";
const STATUS: Record<string, [string, string]> = {
  pending: ["Waiting for delivery", "bg-amber-100 text-amber-800"],
  rewarded: ["Reward paid", "bg-green-100 text-green-800"],
  cancelled: ["Cancelled — no reward", "bg-muted text-muted-foreground"],
  no_account: ["Referrer has no account", "bg-red-100 text-red-800"],
};

export default function AdminReferralsPage() {
  const [form, setForm] = useState<Settings | null>(null);
  const [saved, setSaved] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => onSnapshot(doc(db, "settings", "referral"), (s) => {
    const v = { ...BLANK, ...(s.data() as Partial<Settings> | undefined) };
    setSaved(v);
    setForm((f) => f ?? v);
  }), []);

  useEffect(() => onSnapshot(
    query(collection(db, "orders"), where("referralCode", ">", ""), orderBy("referralCode")),
    (s) => setOrders(s.docs.map((d) => ({ _id: d.id, ...d.data() } as Order)).filter(confirmed)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))),
    (e) => { toast.error(e.message); setOrders([]); },
  ), []);

  // Who each referrer is, for the list.
  useEffect(() => {
    const ids = [...new Set((orders || []).map((o) => o.referral?.referrerUserDocId).filter(Boolean))] as string[];
    const missing = ids.filter((id) => !(id in names));
    if (!missing.length) return;
    void Promise.all(missing.map(async (id) => {
      const u = await getDoc(doc(db, "users", id)).catch(() => null);
      const d: any = u?.data() || {};
      return [id, d.name || d.email || id.slice(0, 8)] as const;
    })).then((pairs) => setNames((n) => ({ ...n, ...Object.fromEntries(pairs) })));
  }, [orders, names]);

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
    const list = orders || [];
    return {
      orders: list.length,
      discounts: list.reduce((t, o) => t + (Number(o.referralDiscount) || 0), 0),
      paid: list.filter((o) => o.referral?.status === "rewarded").reduce((t, o) => t + (Number(o.referral?.reward) || 0), 0),
      owed: list.filter((o) => o.referral?.status === "pending").reduce((t, o) => t + (Number(o.referral?.reward) || 0), 0),
    };
  }, [orders]);

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
            friend's discount doesn't combine with a coupon.
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
            ["Rewards owed on delivery", `₹${totals.owed}`],
          ].map(([l, v]) => (
            <Card key={String(l)}><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{l}</p><p className="text-2xl font-bold">{v}</p></CardContent></Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Referred orders</CardTitle></CardHeader>
          <CardContent>
            {!orders ? <p className="text-sm text-muted-foreground">Loading…</p> : !orders.length ? (
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
                  {orders.map((o) => {
                    const [label, cls] = STATUS[o.referral?.status || "pending"] || [o.referral?.status || "", ""];
                    return (
                      <TableRow key={o._id}>
                        <TableCell>
                          <Link to={`/backend-skinly/orders/${o._id}`} className="font-medium hover:underline">{o.orderNumber || o.checkoutRef}</Link>
                          <div className="text-xs text-muted-foreground">{o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-IN") : ""} · {o.status}</div>
                        </TableCell>
                        <TableCell className="text-sm">{o.customerName}</TableCell>
                        <TableCell className="text-sm">
                          {names[o.referral?.referrerUserDocId || ""] || "…"}
                          <div className="font-mono text-xs text-muted-foreground">{o.referral?.code}</div>
                        </TableCell>
                        <TableCell className="text-right text-sm">₹{Number(o.referralDiscount) || 0}</TableCell>
                        <TableCell className="text-right text-sm">₹{Number(o.referral?.reward) || 0}</TableCell>
                        <TableCell><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span></TableCell>
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
