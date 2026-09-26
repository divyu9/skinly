import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc, writeBatch } from "firebase/firestore";
import { LinkIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { httpsCallable } from "firebase/functions";
import { db, auth, functions } from "@/lib/firebase";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";

/**
 * Admin › Variant Presets: how much sheet each kind of variant uses.
 *
 * A preset is a named multiplier for one gadget ("Top + Keyboard Area" = 2×
 * for laptops). A variant linked to one takes its multiplier, and the stock
 * maths reads that: the sheet left ÷ the multiplier is how many can be sold
 * (functions/src/materials.ts). So editing a preset's multiplier now updates
 * every variant linked to it — before, the number changed on this page and
 * nowhere else.
 *
 * It also absorbs Auto-Assign Presets, which was a stub that always answered
 * zero: variants whose title is a preset's name, for the same gadget and at
 * the same multiplier, are linked here in one click.
 */

type Preset = { _id: string; gadgetTypeId: string; name: string; multiplier: number; description?: string; isActive?: boolean };
type Gadget = { _id: string; name: string; displayName?: string };
type Variant = { _id: string; productId: string; title?: string; rNumber?: string; materialMultiplier?: number; consumptionPresetId?: string; customMultiplier?: number };
type Product = { _id: string; status?: string; gadgetTypeId?: string };
type Form = { presetId?: string; gadgetTypeId: string; name: string; multiplier: string; description: string };

const RANK: Record<string, number> = {
  phone: 1, laptop: 2, "mac-mini": 3, camera: 4, tablet: 5, console: 6, lens: 7,
  drone: 8, controller: 9, charger: 10, gimbals: 11, 'action-camera': 4.5, accessory: 12,
};
const norm = (s?: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const mult = (v: Variant) => Number(v.materialMultiplier) || 1;
const fmtX = (n: number) => `${Number(n.toFixed(2))}×`;

function useCollection<T>(name: string) {
  const [rows, setRows] = useState<T[] | null>(null);
  useEffect(() => onSnapshot(collection(db, name),
    (s) => setRows(s.docs.map((d) => ({ _id: d.id, ...d.data() } as T))),
    (e) => { toast.error(e.message); setRows([]); }), [name]);
  return rows;
}

async function patchVariants(ids: string[], patch: Record<string, any>) {
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    ids.slice(i, i + 400).forEach((id) => batch.update(doc(db, "variants", id), patch));
    await batch.commit();
  }
}

export default function VariantPresetsManagementPage() {
  const presets = useCollection<Preset>("variantConsumptionPresets");
  const gadgetRows = useCollection<Gadget>("gadgetTypes");
  const variants = useCollection<Variant>("variants");
  const products = useCollection<Product>("products");
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [addFor, setAddFor] = useState("");

  const gadgets = useMemo(() => [...(gadgetRows || [])].sort((a, b) => (RANK[a.name] ?? 99) - (RANK[b.name] ?? 99)), [gadgetRows]);
  const gadgetLabel = (id: string) => { const g = gadgets.find((x) => x._id === id); return g?.displayName || g?.name || "?"; };

  // Every live variant with the gadget its product is for.
  const live = useMemo(() => {
    const prod = new Map((products || []).map((p) => [p._id, p]));
    return (variants || []).flatMap((v) => {
      const p = prod.get(v.productId);
      return p && p.status === "active" && p.gadgetTypeId ? [{ v, gadgetTypeId: p.gadgetTypeId }] : [];
    });
  }, [variants, products]);

  const usage = useMemo(() => {
    const m = new Map<string, Variant[]>();
    for (const v of variants || []) if (v.consumptionPresetId) m.set(v.consumptionPresetId, [...(m.get(v.consumptionPresetId) || []), v]);
    return m;
  }, [variants]);

  /*
   * Unlinked live variants named exactly as a preset of their gadget. Linked
   * only when the multiplier already agrees; a disagreement is shown, since
   * either the preset or the variant is wrong and only a person knows which.
   */
  const matches = useMemo(() => {
    const safe: { v: Variant; p: Preset }[] = [];
    const differ: { v: Variant; p: Preset }[] = [];
    for (const { v, gadgetTypeId } of live) {
      if (v.consumptionPresetId) continue;
      const p = (presets || []).find((x) => x.gadgetTypeId === gadgetTypeId && norm(x.name) === norm(v.title));
      if (!p) continue;
      (Math.abs(mult(v) - Number(p.multiplier)) < 1e-9 ? safe : differ).push({ v, p });
    }
    return { safe, differ };
  }, [live, presets]);

  /** Common unlinked titles per gadget: candidates for a preset of their own. */
  const orphans = useMemo(() => {
    const m = new Map<string, Map<string, Variant[]>>();
    for (const { v, gadgetTypeId } of live) {
      if (v.consumptionPresetId || !v.title || /^default( title)?$/i.test(v.title.trim())) continue;
      if ((presets || []).some((x) => x.gadgetTypeId === gadgetTypeId && norm(x.name) === norm(v.title))) continue;
      const byTitle = m.get(gadgetTypeId) || new Map<string, Variant[]>();
      byTitle.set(v.title.trim(), [...(byTitle.get(v.title.trim()) || []), v]);
      m.set(gadgetTypeId, byTitle);
    }
    return m;
  }, [live, presets]);

  const linkSafe = async () => {
    setBusy(true);
    try {
      const byPreset = new Map<string, string[]>();
      for (const { v, p } of matches.safe) byPreset.set(p._id, [...(byPreset.get(p._id) || []), v._id]);
      for (const [presetId, ids] of byPreset) await patchVariants(ids, { consumptionPresetId: presetId });
      toast.success(`Linked ${matches.safe.length} variants to their presets`);
    } catch (e: any) {
      toast.error(e?.message || "Could not link");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!form) return;
    const multiplier = parseFloat(form.multiplier);
    if (!(multiplier > 0)) { toast.error("The multiplier must be more than 0"); return; }
    const name = form.name.trim();
    if (!name) { toast.error("A name is needed"); return; }
    setBusy(true);
    try {
      if (form.presetId) {
        const before = presets?.find((p) => p._id === form.presetId);
        await updateDoc(doc(db, "variantConsumptionPresets", form.presetId), {
          name, multiplier, description: form.description.trim(), updatedAt: Date.now(),
        });
        // The variants follow, except those given a figure of their own.
        const linked = (usage.get(form.presetId) || []).filter((v) => !(Number(v.customMultiplier) > 0) && mult(v) !== multiplier);
        if (before && Number(before.multiplier) !== multiplier && linked.length) {
          await patchVariants(linked.map((v) => v._id), { materialMultiplier: multiplier });
          // Stock is counted per design and only recounted when asked: ask now.
          const codes = [...new Set(linked.map((v) => String(v.rNumber || "").trim()).filter(Boolean))];
          if (codes.length) {
            await httpsCallable(functions, "recalcMaterialStock", { timeout: 300_000 })({ codes })
              .catch(() => toast.warning("Saved, but the stock recount failed — it will catch up on the next order"));
          }
        }
        toast.success(linked.length ? `Saved — ${linked.length} variants now use ${fmtX(multiplier)}` : "Saved");
      } else {
        if ((presets || []).some((p) => p.gadgetTypeId === form.gadgetTypeId && norm(p.name) === norm(name))) {
          throw new Error(`${gadgetLabel(form.gadgetTypeId)} already has "${name}"`);
        }
        const ref = await addDoc(collection(db, "variantConsumptionPresets"), {
          gadgetTypeId: form.gadgetTypeId, name, multiplier, description: form.description.trim(),
          isActive: true, createdAt: Date.now(), _creationTime: Date.now(), createdBy: auth.currentUser?.uid || null,
        });
        // Variants already carrying this title and multiplier join it straight away.
        const join = [...(orphans.get(form.gadgetTypeId)?.entries() || [])]
          .filter(([t]) => norm(t) === norm(name)).flatMap(([, vs]) => vs).filter((v) => mult(v) === multiplier);
        if (join.length) await patchVariants(join.map((v) => v._id), { consumptionPresetId: ref.id });
        toast.success(join.length ? `Preset added and ${join.length} variants linked` : "Preset added");
      }
      setForm(null);
    } catch (e: any) {
      toast.error(e?.message || "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: Preset) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try { await deleteDoc(doc(db, "variantConsumptionPresets", p._id)); toast.success("Deleted"); }
    catch (e: any) { toast.error(e?.message || "Could not delete"); }
  };

  const toggle = async (p: Preset, on: boolean) => {
    try { await updateDoc(doc(db, "variantConsumptionPresets", p._id), { isActive: on }); }
    catch (e: any) { toast.error(e?.message || "Could not update"); }
  };

  const loading = !presets || !gadgetRows || !variants || !products;
  const shownGadgets = gadgets.filter((g) => (presets || []).some((p) => p.gadgetTypeId === g._id) || orphans.has(g._id));
  const otherGadgets = gadgets.filter((g) => !shownGadgets.includes(g));
  const editing = form?.presetId ? presets?.find((p) => p._id === form.presetId) : undefined;
  const editingLinked = form?.presetId ? (usage.get(form.presetId) || []).filter((v) => !(Number(v.customMultiplier) > 0)).length : 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Variant Presets</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            How much sheet each kind of variant uses. "Top + Keyboard Area" at 2× uses twice the sheet of "Only Top", so
            from the same roll you can sell half as many. The stock shown in the shop is worked out from these.
          </p>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {(matches.safe.length > 0 || matches.differ.length > 0) && (
              <Card className="border-amber-400">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Variants not linked to their preset</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {matches.safe.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3">
                      <p>
                        <b>{matches.safe.length}</b> live variants are named after a preset, at the same multiplier, but aren't
                        linked — so a change to the preset wouldn't reach them.
                      </p>
                      <Button size="sm" disabled={busy} onClick={linkSafe}><LinkIcon className="mr-1 size-4" /> Link {matches.safe.length}</Button>
                    </div>
                  )}
                  {matches.differ.length > 0 && (
                    <div>
                      <p className="mb-1"><b>{matches.differ.length}</b> are named after a preset but use a different multiplier — check which is right:</p>
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {[...new Set(matches.differ.map(({ v, p }) => `${gadgetLabel(p.gadgetTypeId)} · "${p.name}": preset ${fmtX(Number(p.multiplier))}, variant ${fmtX(mult(v))}`))].slice(0, 8).map((s) => <li key={s}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {shownGadgets.map((g) => {
              const list = (presets || []).filter((p) => p.gadgetTypeId === g._id)
                .sort((a, b) => Number(a.multiplier) - Number(b.multiplier) || a.name.localeCompare(b.name));
              const loose = [...(orphans.get(g._id)?.entries() || [])].filter(([, vs]) => vs.length >= 3).sort((a, b) => b[1].length - a[1].length);
              return (
                <Card key={g._id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg">{g.displayName || g.name}</CardTitle>
                    <Button size="sm" variant="outline" onClick={() => setForm({ gadgetTypeId: g._id, name: "", multiplier: "1", description: "" })}>
                      <PlusIcon className="mr-1 size-4" /> Add preset
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {list.length > 0 && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Preset</TableHead>
                            <TableHead className="w-28">Sheet use</TableHead>
                            <TableHead className="w-32">Variants linked</TableHead>
                            <TableHead className="w-28">In dropdown</TableHead>
                            <TableHead className="w-24 text-right" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {list.map((p) => {
                            const used = usage.get(p._id)?.length || 0;
                            return (
                              <TableRow key={p._id}>
                                <TableCell>
                                  <div className="font-medium">{p.name}</div>
                                  {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                                </TableCell>
                                <TableCell><Badge variant="secondary">{fmtX(Number(p.multiplier))}</Badge></TableCell>
                                <TableCell className="text-sm">{used || <span className="text-muted-foreground">none</span>}</TableCell>
                                <TableCell>
                                  <Switch checked={p.isActive !== false} onCheckedChange={(v) => toggle(p, v)} aria-label={`Offer ${p.name} in the product form`} />
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button size="icon" variant="ghost" className="size-8" aria-label={`Edit ${p.name}`}
                                      onClick={() => setForm({ presetId: p._id, gadgetTypeId: p.gadgetTypeId, name: p.name, multiplier: String(p.multiplier), description: p.description || "" })}>
                                      <PencilIcon className="size-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="size-8" disabled={used > 0} onClick={() => remove(p)}
                                      aria-label={`Delete ${p.name}`} title={used ? "Linked to variants — switch it off instead" : "Delete"}>
                                      <Trash2Icon className="size-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                    {loose.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs text-muted-foreground">
                          Variant names with no preset{list.length ? "" : " yet"} — make one to manage their sheet use here:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {loose.slice(0, 12).map(([title, vs]) => {
                            const ms = [...new Set(vs.map(mult))];
                            return (
                              <button key={title}
                                className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
                                title={`${vs.length} live variants${ms.length > 1 ? `, at ${ms.map(fmtX).join(" / ")}` : ""}`}
                                onClick={() => setForm({ gadgetTypeId: g._id, name: title, multiplier: String(ms.length === 1 ? ms[0] : 1), description: "" })}>
                                + {title} <span className="text-muted-foreground">· {vs.length} · {ms.map(fmtX).join("/")}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {otherGadgets.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                No presets yet for {otherGadgets.map((g) => g.displayName || g.name).join(", ")}.
                <Select value={addFor} onValueChange={(v) => { setAddFor(""); setForm({ gadgetTypeId: v, name: "", multiplier: "1", description: "" }); }}>
                  <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Add one for…" /></SelectTrigger>
                  <SelectContent>{otherGadgets.map((g) => <SelectItem key={g._id} value={g._id}>{g.displayName || g.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.presetId ? `Edit ${editing?.name || "preset"}` : `New ${form ? gadgetLabel(form.gadgetTypeId) : ""} preset`}</DialogTitle>
            <DialogDescription>
              Name it as the variant is named on the product, so products pick it up by name.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="preset-name">Name</Label>
                <Input id="preset-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Top + Keyboard Area" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preset-mult">Sheet use (×)</Label>
                <Input id="preset-mult" type="number" step="0.1" min="0.1" value={form.multiplier} onChange={(e) => setForm({ ...form, multiplier: e.target.value })} className="w-32" />
                <p className="text-xs text-muted-foreground">1 = the usual amount for this gadget, 2 = twice as much, 0.5 = half.</p>
                {form.presetId && editing && parseFloat(form.multiplier) > 0 && parseFloat(form.multiplier) !== Number(editing.multiplier) && editingLinked > 0 && (
                  <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    {editingLinked} linked variant{editingLinked === 1 ? "" : "s"} will change from {fmtX(Number(editing.multiplier))} to {fmtX(parseFloat(form.multiplier))}, and their stock with them.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preset-desc">Note (optional)</Label>
                <Input id="preset-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Lid and palm rest" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)} disabled={busy}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
