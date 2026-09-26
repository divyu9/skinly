import { useEffect, useState } from "react";
import { deleteField, doc, updateDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import { PackageIcon, RotateCcwIcon } from "lucide-react";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";

/**
 * The parcel's weight and size, as the couriers are told them.
 *
 * Worked out from the items (functions/src/rapidshyp.ts buildOrderPayload);
 * an order whose box is not what its items add up to can be given its own
 * measure here, saved on the order as packageOverride and sent to RapidShyp
 * and Delhivery alike — Delhivery's rate on this page follows it too.
 */
type Pkg = { weightGrams?: number; lengthCm?: number; breadthCm?: number; heightCm?: number };
const FIELDS: Array<[keyof Pkg, string]> = [["weightGrams", "Weight (g)"], ["lengthCm", "Length (cm)"], ["breadthCm", "Breadth (cm)"], ["heightCm", "Height (cm)"]];

export function PackageCard({ orderId, override, locked }: { orderId: string; override?: Pkg | null; locked: boolean }) {
  const [computed, setComputed] = useState<Pkg | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    httpsCallable(getFunctions(), "getOrderPackage")({ orderId })
      .then((r: any) => { if (live) setComputed(r.data?.computed || null); })
      .catch((e) => { if (live) setError(e?.message || "Could not work out the package"); });
    return () => { live = false; };
  }, [orderId]);

  useEffect(() => {
    setForm(Object.fromEntries(FIELDS.map(([k]) => [k, override?.[k] ? String(override[k]) : ""])));
  }, [JSON.stringify(override || {})]);

  const save = async () => {
    const next: Pkg = {};
    for (const [k] of FIELDS) {
      const n = Number(form[k]);
      if (form[k] && !(n > 0)) { toast.error("Use positive numbers"); return; }
      if (n > 0) next[k] = Math.round(n * 10) / 10;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "orders", orderId), Object.keys(next).length ? { packageOverride: next, updatedAt: Date.now() } : { packageOverride: deleteField(), updatedAt: Date.now() });
      toast.success(Object.keys(next).length ? "Package saved — RapidShyp and Delhivery get these" : "Back to the items' weight and size");
    } catch (e: any) { toast.error(e?.message || "Could not save"); }
    finally { setSaving(false); }
  };

  const reset = async () => {
    setSaving(true);
    try { await updateDoc(doc(db, "orders", orderId), { packageOverride: deleteField(), updatedAt: Date.now() }); toast.success("Back to the items' weight and size"); }
    catch (e: any) { toast.error(e?.message || "Could not reset"); }
    finally { setSaving(false); }
  };

  const hasOverride = !!override && FIELDS.some(([k]) => override?.[k]);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><PackageIcon className="size-4" /> Package</CardTitle>
        <CardDescription>
          {locked ? "The shipment is booked; the courier has these figures."
            : "What RapidShyp and Delhivery are told. Leave a box empty to use the figure from the items (shown faded)."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FIELDS.map(([k, label]) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={`pkg-${k}`}>{label}</Label>
              <Input id={`pkg-${k}`} type="number" min={0} inputMode="decimal" disabled={locked || saving}
                value={form[k] ?? ""} placeholder={computed?.[k] !== undefined ? String(computed[k]) : "…"}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        {!locked && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save package"}</Button>
            {hasOverride && (
              <Button size="sm" variant="outline" onClick={() => void reset()} disabled={saving}>
                <RotateCcwIcon className="mr-1.5 size-3.5" /> Use items' figures
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
