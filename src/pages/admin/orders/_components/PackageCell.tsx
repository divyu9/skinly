import { useState } from "react";
import { deleteField, doc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { PencilIcon } from "lucide-react";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";

/**
 * Orders list › Package: the parcel's weight on the row, and weight + size
 * editable together in place. Saved as the order's packageOverride — the
 * figures RapidShyp and Delhivery are sent (functions/src/rapidshyp.ts
 * packageOf); an empty box falls back to the items' figure.
 */
export type Dims = { weightGrams: number; lengthCm: number; breadthCm: number; heightCm: number };
export type PackageInfo = { computed: Dims; effective: Dims; overridden: boolean };
const FIELDS: Array<[keyof Dims, string]> = [["weightGrams", "Weight g"], ["lengthCm", "L cm"], ["breadthCm", "B cm"], ["heightCm", "H cm"]];

export function PackageCell({ orderId, info, override, locked, onSaved }: {
  orderId: string; info?: PackageInfo; override?: Partial<Dims> | null; locked: boolean;
  onSaved: (override: Partial<Dims> | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (!info) return <span className="text-xs text-muted-foreground">…</span>;
  const e = info.effective;

  const openEditor = (o: boolean) => {
    if (o) setForm(Object.fromEntries(FIELDS.map(([k]) => [k, override?.[k] ? String(override[k]) : ""])));
    setOpen(o);
  };

  const save = async (clear = false) => {
    const next: Partial<Dims> = {};
    if (!clear) for (const [k] of FIELDS) {
      const n = Number(form[k]);
      if (form[k] && !(n > 0)) { toast.error("Use positive numbers"); return; }
      if (n > 0) next[k] = Math.round(n * 10) / 10;
    }
    const has = Object.keys(next).length > 0;
    setSaving(true);
    try {
      await updateDoc(doc(db, "orders", orderId), has ? { packageOverride: next, updatedAt: Date.now() } : { packageOverride: deleteField(), updatedAt: Date.now() });
      onSaved(has ? next : null);
      setOpen(false);
      toast.success(has ? "Package saved" : "Back to the items' figures");
    } catch (err: any) { toast.error(err?.message || "Could not save"); }
    finally { setSaving(false); }
  };

  const label = (
    <span className="text-left">
      <span className={`block text-sm font-semibold tabular-nums ${info.overridden ? "text-brand-deep" : ""}`}>{e.weightGrams} g</span>
      <span className="block text-[11px] tabular-nums text-muted-foreground">{e.lengthCm}×{e.breadthCm}×{e.heightCm} cm{info.overridden ? " · set" : ""}</span>
    </span>
  );

  if (locked) return <div title="Shipment booked — the courier has these figures">{label}</div>;

  return (
    <Popover open={open} onOpenChange={openEditor}>
      <PopoverTrigger asChild>
        <button type="button" onClick={(ev) => ev.stopPropagation()}
          className="group flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-muted" title="Edit the package sent to the courier">
          {label}
          <PencilIcon className="size-3 text-muted-foreground opacity-50 group-hover:opacity-100" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" onClick={(ev) => ev.stopPropagation()}>
        <p className="mb-2 text-sm font-semibold">Package for the courier</p>
        <div className="grid grid-cols-4 gap-2">
          {FIELDS.map(([k, l]) => (
            <div key={k} className="space-y-1">
              <Label className="text-[11px]" htmlFor={`${orderId}-${k}`}>{l}</Label>
              <Input id={`${orderId}-${k}`} type="number" min={0} inputMode="decimal" className="h-8 px-2 text-sm"
                value={form[k] ?? ""} placeholder={String(info.computed[k])} disabled={saving}
                onChange={(ev) => setForm({ ...form, [k]: ev.target.value })}
                onKeyDown={(ev) => { if (ev.key === "Enter") void save(); }} />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Faded figures come from the items; leave a box empty to keep them.</p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          {info.overridden && <Button size="sm" variant="outline" onClick={() => void save(true)} disabled={saving}>Use items'</Button>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
