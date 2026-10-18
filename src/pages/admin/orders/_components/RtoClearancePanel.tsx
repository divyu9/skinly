import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TagIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";

async function call(name: string, data: unknown) {
  const [{ functions }, { httpsCallable }] = await Promise.all([import("@/lib/firebase"), import("firebase/functions")]);
  return (await httpsCallable(functions, name)(data)).data as any;
}

/**
 * An RTO order's pieces onto the clearance page (functions: clearance.ts).
 * A returned skin is already cut for one device, so it is not put back in
 * stock: once the parcel is back, the admin ticks the pieces, sets a
 * clearance price, and each becomes a buy-now card on /clearance for that
 * device only.
 */
export function RtoClearancePanel({ order }: { order: any }) {
  const status = String(order?.status || "");
  const items: any[] = Array.isArray(order?.items) ? order.items : [];
  const done: number[] = Array.isArray(order?.clearanceLines) ? order.clearanceLines : [];
  const [pick, setPick] = useState<Record<number, boolean>>({});
  const [price, setPrice] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [pieces, setPieces] = useState<any[] | null>(null);

  const loadPieces = async () => {
    try {
      const r = await call("listClearance", { admin: true });
      setPieces((r?.items || []).filter((p: any) => p.sourceOrderId === String(order._id)));
    } catch { setPieces([]); }
  };
  useEffect(() => { if (done.length) void loadPieces(); }, [done.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!["rto", "undelivered", "cancelled"].includes(status) || !items.length) return null;

  const open = items.map((it, i) => ({ it, i })).filter(({ i }) => !done.includes(i));
  const defaultPrice = (it: any) => String(Math.max(49, Math.round(((Number(it?.price) || 0) * 0.5) / 10) * 10 - 1));

  const submit = async () => {
    const lines = open.filter(({ i }) => pick[i]).map(({ it, i }) => ({ index: i, price: Number(price[i] ?? defaultPrice(it)) }));
    if (!lines.length) { toast.error("Tick the pieces that came back"); return; }
    setBusy(true);
    try {
      const r = await call("addRtoToClearance", { orderId: String(order._id), lines });
      toast.success(`${r?.created || lines.length} piece${(r?.created || lines.length) === 1 ? "" : "s"} on the clearance page`);
      setPick({});
      void loadPieces();
    } catch (e: any) {
      toast.error(e?.message || "Could not add to clearance");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try { await call("removeClearanceItem", { id }); toast.success("Taken off clearance"); void loadPieces(); }
    catch (e: any) { toast.error(e?.message || "Could not remove"); }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><TagIcon className="size-4" /> Returned pieces → Clearance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          RTO skins are already cut for one device, so they do not go back into rolls or precut stock. Once the parcel is back with you, put the pieces on the clearance page — each sells only for its device.
        </p>
        {open.length > 0 ? (
          <>
            {open.map(({ it, i }) => (
              <label key={i} className="flex items-start gap-2 rounded-lg border p-2">
                <input type="checkbox" className="mt-1" checked={!!pick[i]} onChange={(e) => setPick({ ...pick, [i]: e.target.checked })} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{it.productTitle}{Number(it.quantity) > 1 ? ` × ${it.quantity}` : ""}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[it.variant && !/^default/i.test(it.variant) ? it.variant : "", [it.phoneBrand, it.phoneModel].filter(Boolean).join(" "), it.lensModel ? `lens ${it.lensModel}` : ""].filter(Boolean).join(" · ")} · paid ₹{it.price}
                  </span>
                </span>
                <span className="w-24 shrink-0">
                  <span className="block text-[11px] text-muted-foreground">Clearance ₹</span>
                  <Input inputMode="numeric" value={price[i] ?? defaultPrice(it)} onChange={(e) => setPrice({ ...price, [i]: e.target.value.replace(/\D/g, "") })} className="h-8" />
                </span>
              </label>
            ))}
            <Button type="button" onClick={submit} disabled={busy} className="w-full">{busy ? "Adding…" : "Parcel is back — add ticked pieces to clearance"}</Button>
          </>
        ) : (
          <p className="text-xs font-semibold text-green-700">Every line of this order is on clearance.</p>
        )}
        {pieces && pieces.length > 0 && (
          <div className="space-y-1 border-t pt-2">
            <p className="text-xs font-semibold">On the clearance page</p>
            {pieces.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">{p.productTitle} · {p.phoneModel} · ₹{p.price} · <b>{p.status}</b></span>
                {p.status === "available" && <button type="button" className="text-red-600 underline" onClick={() => remove(p.id)}>Remove</button>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
