import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { CheckIcon, XIcon, Undo2Icon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { db, functions } from "@/lib/firebase";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";

/**
 * Admin › Models › From plotter.
 *
 * Models the cutting software (Mobicare) can cut that the website does not
 * list, named as the software names them with the part suffixes (-A, -B, -B1,
 * Sides, (Top)…) taken off. Brand, name and category can be corrected in the
 * row before approving; approving adds the model to the picker straight away
 * (functions/src/plotterModels.ts).
 */

type Row = {
  _id: string;
  brand: string;
  model: string;
  category: string;
  parts?: string[];
  folders?: string[];
  newestFileAt?: number;
  firstFileAt?: number;
  /** Which cutting software has it, the name it uses there, and when that vendor added it. */
  vendors?: Partial<Record<"mobicare" | "tia", { name: string; firstFileAt?: number | null }>>;
  status: "pending" | "approved" | "rejected";
  approvedAs?: { brandName: string; modelName: string; category: string };
};

/** Used until the site's own gadget types have loaded. */
const FALLBACK_GADGETS = ["phone", "tablet", "laptop", "camera", "lens", "console", "drone", "gimbals", "controller", "charger", "mac-mini", "accessory"];

/*
 * The gadget choices are the site's gadget types, read live — a hard-coded
 * list here had left out console, charger, mac-mini and accessory, so a row
 * that belonged to one of them could only be approved under the wrong one.
 */
function useGadgetTypes() {
  const [names, setNames] = useState<string[]>(FALLBACK_GADGETS);
  useEffect(() => onSnapshot(collection(db, "gadgetTypes"), (snap) => {
    const live = snap.docs.map((d) => d.data() as any).filter((g) => g.isActive !== false && g.name).map((g) => String(g.name));
    if (live.length) setNames([...new Set(live)].sort());
  }, () => { /* keep the fallback */ }), []);
  return names;
}
const VENDOR_LABEL = { mobicare: "Mobicare", tia: "TIA" } as const;
type Vendor = keyof typeof VENDOR_LABEL;
const vendorsOf = (r: Row): Vendor[] => (Object.keys(r.vendors || {}) as Vendor[]).filter((v) => v in VENDOR_LABEL);
/** The earliest date any vendor had this model. */
const since = (r: Row) => {
  const ds = vendorsOf(r).map((v) => r.vendors?.[v]?.firstFileAt || 0).filter(Boolean) as number[];
  return ds.length ? Math.min(...ds) : (r.firstFileAt || r.newestFileAt || 0);
};
const fmt = (t?: number | null) => t ? new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export function usePlotterPendingCount() {
  const [n, setN] = useState(0);
  useEffect(() => onSnapshot(collection(db, "plotterModels"),
    (s) => setN(s.docs.filter((d) => d.data().status === "pending").length),
    () => setN(0)), []);
  return n;
}

export function PlotterModels() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<Row>>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Row["status"]>("pending");
  const [category, setCategory] = useState("all");
  const [vendor, setVendor] = useState<"all" | Vendor | "both">("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const CATEGORIES = useGadgetTypes();

  useEffect(() => onSnapshot(collection(db, "plotterModels"), (snap) => {
    setRows(snap.docs.map((d) => ({ _id: d.id, ...(d.data() as any) })));
  }, (e) => { toast.error(e.message); setRows([]); }), []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows || [])
      .filter((r) => r.status === status)
      .filter((r) => category === "all" || r.category === category)
      .filter((r) => vendor === "all" || (vendor === "both" ? vendorsOf(r).length > 1 : vendorsOf(r).includes(vendor)))
      .filter((r) => !q || `${r.brand} ${r.model}`.toLowerCase().includes(q))
      .sort((a, b) => since(b) - since(a) || a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
  }, [rows, status, category, vendor, search]);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 } as Record<string, number>;
    (rows || []).forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [rows]);

  const val = (r: Row, k: "brand" | "model" | "category") => (edits[r._id]?.[k] as string) ?? r[k];
  const edit = (id: string, patch: Partial<Row>) => setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOn = visible.length > 0 && visible.every((r) => selected.has(r._id));

  const approve = async (ids: string[]) => {
    if (!ids.length) return;
    setBusy(true);
    try {
      const byId = new Map((rows || []).map((r) => [r._id, r]));
      const items = ids.map((id) => {
        const r = byId.get(id)!;
        return { id, brandName: val(r, "brand"), modelName: val(r, "model"), category: val(r, "category") };
      });
      const res: any = (await httpsCallable(functions, "approvePlotterModels")({ items })).data;
      toast.success(`${res.added} added to the website${res.alreadyListed ? `, ${res.alreadyListed} were already listed` : ""}`);
      if (res.errors?.length) toast.error(res.errors.slice(0, 3).join("\n"));
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e?.message || "Could not approve");
    } finally {
      setBusy(false);
    }
  };

  const reject = async (ids: string[], undo = false) => {
    if (!ids.length) return;
    setBusy(true);
    try {
      await httpsCallable(functions, "rejectPlotterModels")({ ids, undo });
      toast.success(undo ? "Moved back to pending" : `${ids.length} rejected`);
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e?.message || "Could not update");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>New models from the plotter software</CardTitle>
        <p className="text-sm text-muted-foreground">
          Models the cutting software (Mobicare, TIA) has and the website doesn't. Names are as the software writes them, with the
          part files (-A, -B, -B1, Sides, Top…) folded into one. Fix the brand, name or category in the row if needed,
          then approve — it appears in the model picker straight away.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={(v) => { setStatus(v as Row["status"]); setSelected(new Set()); }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending ({counts.pending || 0})</SelectItem>
              <SelectItem value="approved">Approved ({counts.approved || 0})</SelectItem>
              <SelectItem value="rejected">Rejected ({counts.rejected || 0})</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All gadgets</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={vendor} onValueChange={(v) => setVendor(v as typeof vendor)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Both vendors</SelectItem>
              <SelectItem value="mobicare">Mobicare has it</SelectItem>
              <SelectItem value="tia">TIA has it</SelectItem>
              <SelectItem value="both">Both have it</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search brand or model" className="w-56 pl-8" />
          </div>
          {status === "pending" && (
            <div className="ml-auto flex gap-2">
              <Button size="sm" disabled={busy || !selected.size} onClick={() => approve([...selected])}>
                <CheckIcon className="mr-1 size-4" /> Approve {selected.size || ""}
              </Button>
              <Button size="sm" variant="outline" disabled={busy || !selected.size} onClick={() => reject([...selected])}>
                <XIcon className="mr-1 size-4" /> Reject {selected.size || ""}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {rows === null ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : !visible.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {status === "pending" && (
                  <TableHead className="w-8">
                    <Checkbox checked={allOn} onCheckedChange={() => setSelected(allOn ? new Set() : new Set(visible.map((r) => r._id)))} />
                  </TableHead>
                )}
                <TableHead className="w-40">Brand</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="w-36">Gadget</TableHead>
                <TableHead className="w-40">Vendor</TableHead>
                <TableHead className="w-24">Part files</TableHead>
                <TableHead className="w-28">First seen</TableHead>
                <TableHead className="w-44 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r._id}>
                  {status === "pending" && (
                    <TableCell><Checkbox checked={selected.has(r._id)} onCheckedChange={() => toggle(r._id)} /></TableCell>
                  )}
                  <TableCell>
                    {status === "pending"
                      ? <Input value={val(r, "brand")} onChange={(e) => edit(r._id, { brand: e.target.value })} className="h-8" />
                      : (r.approvedAs?.brandName || r.brand)}
                  </TableCell>
                  <TableCell>
                    {status === "pending"
                      ? <Input value={val(r, "model")} onChange={(e) => edit(r._id, { model: e.target.value })} className="h-8" />
                      : (r.approvedAs?.modelName || r.model)}
                  </TableCell>
                  <TableCell>
                    {status === "pending" ? (
                      <Select value={val(r, "category")} onValueChange={(v) => edit(r._id, { category: v })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (r.approvedAs?.category || r.category)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {vendorsOf(r).map((v) => {
                        const d = r.vendors?.[v]?.firstFileAt;
                        const first = vendorsOf(r).length > 1 && d && d === since(r);
                        return (
                          <Tooltip key={v}>
                            <TooltipTrigger asChild>
                              <Badge variant={first ? "default" : "outline"} className="cursor-default">
                                {VENDOR_LABEL[v]}{first ? " · first" : ""}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{r.vendors?.[v]?.name}</p>
                              <p className="opacity-80">Added {fmt(d)}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary" className="cursor-default">{r.parts?.length || 0}</Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p className="mb-1 font-semibold">{(r.folders || []).join(", ")}</p>
                        {(r.parts || []).map((p) => <p key={p}>{p}</p>)}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmt(since(r))}</TableCell>
                  <TableCell className="text-right">
                    {status === "pending" ? (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" disabled={busy} onClick={() => approve([r._id])}><CheckIcon className="size-4" /></Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => reject([r._id])}><XIcon className="size-4" /></Button>
                      </div>
                    ) : status === "rejected" ? (
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => reject([r._id], true)}>
                        <Undo2Icon className="mr-1 size-4" /> Back to pending
                      </Button>
                    ) : (
                      <Badge>On website</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
