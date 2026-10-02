import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import { RotateCcwIcon, LoaderIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";

const REASONS = ["Lost in transit", "Delivered damaged", "Wrong item delivered", "Other"];

/**
 * Reship a lost or damaged parcel: a replacement order (#4079-R1) with the
 * chosen lines, its material taken like any order, booked on RapidShyp
 * straight away (functions/src/orderItems.ts reshipOrder). On a replacement,
 * this shows which order it replaces instead.
 */
export function ReshipPanel({ order, orderId }: { order: any; orderId: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [why, setWhy] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const items: any[] = Array.isArray(order?.items) ? order.items : [];
  const reships: any[] = Array.isArray(order?.reships) ? order.reships : [];

  if (order?.isReplacement) {
    return (
      <Card className="border-2 border-amber-400">
        <CardContent className="py-3 text-sm">
          <b>Replacement parcel</b> for{" "}
          <Link to={`/backend-skinly/orders/${order.reshipOf}`} className="font-bold underline">{order.parentOrderNumber || "the original order"}</Link>
          {order.reshipReason ? ` — ${order.reshipReason}` : ""}. Not counted as a sale.
        </CardContent>
      </Card>
    );
  }
  const confirmed = order?.orderNumber && order?.status !== "pending_payment" && order?.paymentStatus !== "failed" && !order?.isDeleted;
  if (!confirmed || !items.length) return null;

  const start = () => { setPicked(new Set(items.map((_, i) => i))); setWhy(REASONS[0]); setNote(""); setOpen(true); };
  const go = async () => {
    const reason = [why, note.trim()].filter(Boolean).join(": ");
    setBusy(true);
    try {
      const fns = getFunctions();
      const r: any = (await httpsCallable(fns, "reshipOrder")({ orderId, reason, lineIndexes: [...picked] })).data;
      toast.success(`Replacement ${r.orderNumber} created — booking RapidShyp…`);
      try {
        await httpsCallable(fns, "createRapidshypOrder")({ orderId: r.orderId });
        toast.success(`${r.orderNumber} booked on RapidShyp`);
      } catch (e: any) {
        toast.error(`${r.orderNumber} created, but RapidShyp said: ${e?.message || "booking failed"} — book it from its page`);
      }
      setOpen(false);
      navigate(`/backend-skinly/orders/${r.orderId}`);
    } catch (e: any) {
      toast.error(e?.message || "Could not create the replacement");
    } finally { setBusy(false); }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><RotateCcwIcon className="size-4" /> Reship</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">Lost or arrived damaged? Send it again as a replacement order — stock is taken and RapidShyp is booked.</p>
          {reships.map((r) => (
            <p key={r.orderId} className="text-xs">
              <Link to={`/backend-skinly/orders/${r.orderId}`} className="font-bold underline">{r.orderNumber}</Link>
              {" · "}{new Date(r.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {r.reason}
            </p>
          ))}
          <Button variant="outline" size="sm" onClick={start}><RotateCcwIcon className="mr-1.5 size-4" />Reship this order</Button>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reship {order.orderNumber}</DialogTitle>
            <DialogDescription>Creates {order.orderNumber}-R{reships.length + 1} at ₹0 to the same address, takes the material, and books it on RapidShyp.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              {items.map((it, i) => (
                <label key={i} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={picked.has(i)} onChange={(e) => {
                    const n = new Set(picked); if (e.target.checked) n.add(i); else n.delete(i); setPicked(n);
                  }} />
                  <span>{it.productTitle} <span className="text-muted-foreground">· {it.variant}{it.phoneModel ? ` · ${it.phoneModel}` : ""} · ×{it.quantity || 1}</span></span>
                </label>
              ))}
            </div>
            <select value={why} onChange={(e) => setWhy(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
              {REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Details (courier ticket, photo received…)" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={go} disabled={busy || !picked.size || (why === "Other" && !note.trim())}>
              {busy && <LoaderIcon className="mr-1.5 size-4 animate-spin" />}Create replacement & book
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
