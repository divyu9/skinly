import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { LoaderIcon, SparklesIcon } from "lucide-react";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { offerPrice, SETUP_KINDS, withDefaults, type SetupKind, type SmartUpsellSettings } from "@/lib/smart-setup";

/**
 * Upsells › Smart setup: the offer on each kind of add-on in a skin page's
 * "Complete your setup". Saved to settings/smartUpsell, which the product
 * page reads and placeOrder charges by (functions/src/smartUpsell.ts).
 */

/** A typical price per kind, so the preview reads "₹119 → ₹79" rather than a bare number. */
const SAMPLE: Record<SetupKind, number> = { chargerSkin: 119, case: 229, glass: 299, cameraRing: 249, membrane: 249, magneto: 1999 };

export function SmartSetupSettings() {
  const [s, setS] = useState<SmartUpsellSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    getDoc(doc(db, "settings", "smartUpsell")).then((d) => setS(withDefaults(d.data()))).catch(() => setS(withDefaults(null)));
  }, []);

  if (!s) return <div className="mb-6 h-40 animate-pulse rounded-2xl bg-muted" />;

  const edit = (next: SmartUpsellSettings) => { setS(next); setDirty(true); };
  const setOffer = (k: SetupKind, patch: Partial<SmartUpsellSettings["offers"][SetupKind]>) =>
    edit({ ...s, offers: { ...s.offers, [k]: { ...s.offers[k], ...patch } } });

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "smartUpsell"), { ...s, updatedAt: Date.now() });
      setDirty(false);
      toast.success("Smart setup saved — live on product pages now");
    } catch (e: any) {
      toast.error(e?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border-2 border-ink shadow-[3px_3px_0_0_var(--ink)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink/10 bg-sunny/35 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold"><SparklesIcon className="size-5" /> Smart setup · product page</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Add-ons that fit the shopper's chosen device, shown above Add to Cart on every skin page. Set the offer on each.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <Switch checked={s.enabled} onCheckedChange={(v) => edit({ ...s, enabled: v })} /> {s.enabled ? "On" : "Off"}
          </label>
          <Button onClick={() => void save()} disabled={!dirty || saving} className="rounded-lg">
            {saving ? <LoaderIcon className="mr-2 size-4 animate-spin" /> : null}
            {dirty ? "Save" : "Saved"}
          </Button>
        </div>
      </header>

      <div className={s.enabled ? "" : "pointer-events-none opacity-50"}>
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-2">Add-on</th>
              <th className="px-3 py-2">Show</th>
              <th className="px-3 py-2">Discount</th>
              <th className="px-5 py-2 text-right">Example</th>
            </tr>
          </thead>
          <tbody>
            {SETUP_KINDS.map(({ kind, label, hint }) => {
              const o = s.offers[kind];
              const now = offerPrice(SAMPLE[kind], o);
              return (
                <tr key={kind} className="border-t">
                  <td className="px-5 py-3">
                    <p className="font-semibold">{label}</p>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                  </td>
                  <td className="px-3 py-3"><Switch checked={o.enabled} onCheckedChange={(v) => setOffer(kind, { enabled: v })} /></td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <select value={o.type} onChange={(e) => setOffer(kind, { type: e.target.value as "percent" | "flat" })}
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                        <option value="percent">% off</option>
                        <option value="flat">₹ off</option>
                      </select>
                      <input type="number" min={0} value={o.value} onChange={(e) => setOffer(kind, { value: Math.max(0, Number(e.target.value) || 0) })}
                        className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm tabular-nums" />
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {now < SAMPLE[kind] ? <><span className="text-muted-foreground line-through">₹{SAMPLE[kind]}</span> <b>₹{now}</b></> : <b>₹{SAMPLE[kind]}</b>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="border-t px-5 py-3 text-xs text-muted-foreground">
          The offer price applies only when the cart also has a skin; on its own an add-on is charged in full. A value of 0 shows it at full price.
        </p>
      </div>
    </section>
  );
}
