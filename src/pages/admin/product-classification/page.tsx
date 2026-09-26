import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc, writeBatch } from "firebase/firestore";
import { AlertTriangleIcon, CheckCircle2Icon, ExternalLinkIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon, WandSparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { issuesOf, type Issue, type Product, type TypeRow } from "@/lib/classification";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";

/**
 * Admin › Classification: every product's gadget and finish.
 *
 * These two fields drive the storefront: the gadget filter reads
 * gadgetTypeId, while "fits your device", the breadcrumb and the SEO pages
 * read gadgetCategory — the same gadget by name. When the two disagree or one
 * is blank a skin quietly drops out of "fits your device", so the page leads
 * with what needs attention and writes both fields together, always.
 *
 * What it replaced: Seed buttons for types that were all present, an
 * auto-classify card and two tabs wired to stubs that always answered empty,
 * a category migration every product had long had, and product counts stored
 * on the types that no longer matched the catalogue. Product categories
 * themselves are managed on Admin › Categories.
 */

type CategoryRow = { _id: string; name?: string; slug?: string };

const PAGE = 100;
const RANK: Record<string, number> = {
  phone: 1, laptop: 2, "mac-mini": 3, camera: 4, tablet: 5, console: 6, lens: 7,
  drone: 8, controller: 9, charger: 10, gimbals: 11, 'action-camera': 4.5, accessory: 12,
};
const label = (t?: TypeRow) => t?.displayName || t?.name || "";

/** A live collection; `null` name waits (nothing is read until it is needed). */
function useCollection<T>(name: string | null) {
  const [rows, setRows] = useState<T[] | null>(null);
  useEffect(() => name ? onSnapshot(collection(db, name),
    (s) => setRows(s.docs.map((d) => ({ _id: d.id, ...d.data() } as T))),
    (e) => { toast.error(e.message); setRows([]); }) : undefined, [name]);
  return rows;
}

async function patchProducts(ids: string[], patch: (id: string) => Record<string, any>) {
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    ids.slice(i, i + 400).forEach((id) => batch.update(doc(db, "products", id), { ...patch(id), updatedAt: Date.now() }));
    await batch.commit();
  }
}

export default function ProductClassificationPage() {
  const products = useCollection<Product>("products");
  const gadgetRows = useCollection<TypeRow>("gadgetTypes");
  const finishRows = useCollection<TypeRow>("finishTypes");
  const categories = useCollection<CategoryRow>("productCategoriesConfig");

  const gadgets = useMemo(() => [...(gadgetRows || [])].sort((a, b) =>
    (RANK[a.name] ?? 99) - (RANK[b.name] ?? 99) || label(a).localeCompare(label(b))), [gadgetRows]);
  const finishes = useMemo(() => [...(finishRows || [])].sort((a, b) => label(a).localeCompare(label(b))), [finishRows]);

  const issues = useMemo(() => {
    const m = new Map<string, Issue[]>();
    if (!gadgetRows || !finishRows) return m;
    for (const p of products || []) {
      const list = issuesOf(p, gadgets, finishes);
      if (list.length) m.set(p._id, list);
    }
    return m;
  }, [products, gadgets, finishes, gadgetRows, finishRows]);

  const liveIssues = [...issues.entries()].filter(([id]) => products?.find((p) => p._id === id)?.status === "active");
  const fixable = [...issues.entries()].filter(([, list]) => list.some((i) => i.fix));
  const skins = (products || []).filter((p) => p.status === "active" && p.productCategory === "skin").length;

  const [fixOpen, setFixOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("products");
  const [onlyIssues, setOnlyIssues] = useState(false);

  const applyFixes = async () => {
    setBusy(true);
    try {
      const plan = new Map(fixable.map(([id, list]) => [id, Object.assign({}, ...list.filter((i) => i.fix).map((i) => i.fix))]));
      await patchProducts([...plan.keys()], (id) => plan.get(id)!);
      toast.success(`Fixed ${plan.size} product${plan.size === 1 ? "" : "s"}`);
      setFixOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Could not fix");
    } finally {
      setBusy(false);
    }
  };

  const loading = !products || !gadgetRows || !finishRows;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Classification</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Each product's gadget and finish. The shop's gadget filter, "fits your device" and breadcrumbs all read these,
            so a skin with a missing or mismatched gadget stops showing up for the customers it fits.
          </p>
        </div>

        {/* What needs doing, first */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">Live skins</p>
              <p className="text-2xl font-bold">{loading ? "…" : skins}</p>
              <p className="text-xs text-muted-foreground">{loading ? "" : `${(products || []).length} products in all`}</p>
            </CardContent>
          </Card>
          <Card className={liveIssues.length ? "border-amber-400" : ""}>
            <CardContent className="pt-5">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {liveIssues.length ? <AlertTriangleIcon className="size-4 text-amber-500" /> : <CheckCircle2Icon className="size-4 text-green-600" />}
                Live products needing attention
              </p>
              <p className="text-2xl font-bold">{loading ? "…" : liveIssues.length}</p>
              {!!issues.size && (
                <button className="text-xs text-primary hover:underline" onClick={() => { setTab("products"); setOnlyIssues(true); }}>
                  Show them{issues.size > liveIssues.length ? ` (+${issues.size - liveIssues.length} drafts/archived)` : ""}
                </button>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">Can be fixed automatically</p>
              <p className="text-2xl font-bold">{loading ? "…" : fixable.length}</p>
              <Button size="sm" className="mt-1" disabled={!fixable.length || busy} onClick={() => setFixOpen(true)}>
                <WandSparklesIcon className="mr-1 size-4" /> Review and fix
              </Button>
            </CardContent>
          </Card>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="gadgets">Gadget types ({gadgets.length})</TabsTrigger>
            <TabsTrigger value="finishes">Finish types ({finishes.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="products">
            <ProductsTab
              products={products} gadgets={gadgets} finishes={finishes} categories={categories || []}
              issues={issues} onlyIssues={onlyIssues} setOnlyIssues={setOnlyIssues}
            />
          </TabsContent>
          <TabsContent value="gadgets">
            <TypesTab kind="gadget" rows={gadgets} products={products || []} />
          </TabsContent>
          <TabsContent value="finishes">
            <TypesTab kind="finish" rows={finishes} products={products || []} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={fixOpen} onOpenChange={setFixOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Fix {fixable.length} product{fixable.length === 1 ? "" : "s"} automatically</DialogTitle>
            <DialogDescription>
              Only certain fixes: a gadget's missing half filled from the other half, and a skin's missing finish read
              from its title. Nothing already set is changed. The rest need a person — they stay in the list.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-1 overflow-y-auto text-sm">
            {fixable.map(([id, list]) => {
              const p = products?.find((x) => x._id === id);
              return (
                <div key={id} className="flex items-start justify-between gap-3 border-b py-1.5">
                  <span className="min-w-0 truncate">{p?.title || id}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {list.filter((i) => i.fix).map((i) => describeFix(i.fix!, gadgets, finishes)).join(", ")}
                  </span>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFixOpen(false)}>Cancel</Button>
            <Button disabled={busy} onClick={applyFixes}>{busy ? "Fixing…" : `Fix ${fixable.length}`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function describeFix(fix: Partial<Product>, gadgets: TypeRow[], finishes: TypeRow[]) {
  if (fix.gadgetCategory || fix.gadgetTypeId) {
    const g = gadgets.find((x) => x._id === fix.gadgetTypeId || x.name === fix.gadgetCategory);
    return `gadget → ${label(g)}`;
  }
  if (fix.finishTypeId) return `finish → ${label(finishes.find((f) => f._id === fix.finishTypeId))}`;
  return "";
}

function ProductsTab({ products, gadgets, finishes, categories, issues, onlyIssues, setOnlyIssues }: {
  products: Product[] | null; gadgets: TypeRow[]; finishes: TypeRow[]; categories: CategoryRow[];
  issues: Map<string, Issue[]>; onlyIssues: boolean; setOnlyIssues: (v: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [category, setCategory] = useState("all");
  const [gadget, setGadget] = useState("all");
  const [finish, setFinish] = useState("all");
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const gadgetOf = (p: Product) => gadgets.find((g) => g._id === p.gadgetTypeId) || gadgets.find((g) => g.name === p.gadgetCategory);
  const catName = (slug?: string) => categories.find((c) => c.slug === slug)?.name || slug || "—";

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products || []).filter((p) =>
      (status === "all" || p.status === status)
      && (category === "all" || (p.productCategory || "") === category)
      && (gadget === "all" || (gadget === "none" ? !gadgetOf(p) : gadgetOf(p)?._id === gadget))
      && (finish === "all" || (finish === "none" ? !p.finishTypeId : p.finishTypeId === finish))
      && (!onlyIssues || issues.has(p._id))
      && (!q || String(p.title || "").toLowerCase().includes(q)))
      .sort((a, b) => Number(issues.has(b._id)) - Number(issues.has(a._id)) || String(a.title).localeCompare(String(b.title)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, search, status, category, gadget, finish, onlyIssues, issues, gadgets]);

  useEffect(() => { setShown(PAGE); setSelected(new Set()); }, [search, status, category, gadget, finish, onlyIssues]);

  // The gadget is two fields that must name the same thing: always write both.
  const gadgetPatch = (id: string) => {
    const g = gadgets.find((x) => x._id === id);
    return g ? { gadgetTypeId: g._id, gadgetCategory: g.name } : null;
  };

  const save = async (ids: string[], patch: Record<string, any> | null, what: string) => {
    if (!ids.length || !patch) return;
    setBusy(true);
    try {
      await patchProducts(ids, () => patch);
      toast.success(ids.length === 1 ? `${what} saved` : `${what} set on ${ids.length} products`);
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e?.message || "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const page = visible.slice(0, shown);
  const allOn = page.length > 0 && page.every((p) => selected.has(p._id));
  const ids = [...selected];

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products" className="w-60 pl-8" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Live</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="all">Any status</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c._id} value={c.slug || c._id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={gadget} onValueChange={setGadget}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All gadgets</SelectItem>
              <SelectItem value="none">No gadget</SelectItem>
              {gadgets.map((g) => <SelectItem key={g._id} value={g._id}>{label(g)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={finish} onValueChange={setFinish}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All finishes</SelectItem>
              <SelectItem value="none">No finish</SelectItem>
              {finishes.map((f) => <SelectItem key={f._id} value={f._id}>{label(f)}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={onlyIssues} onCheckedChange={setOnlyIssues} /> Needs attention
          </label>
          <span className="ml-auto text-sm text-muted-foreground">{products ? `${visible.length} products` : ""}</span>
        </div>

        {!!selected.size && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
            <b>{selected.size} selected</b>
            <Select value="" onValueChange={(v) => save(ids, gadgetPatch(v), "Gadget")} disabled={busy}>
              <SelectTrigger className="h-8 w-36 bg-background"><SelectValue placeholder="Set gadget…" /></SelectTrigger>
              <SelectContent>{gadgets.map((g) => <SelectItem key={g._id} value={g._id}>{label(g)}</SelectItem>)}</SelectContent>
            </Select>
            <Select value="" onValueChange={(v) => save(ids, { finishTypeId: v }, "Finish")} disabled={busy}>
              <SelectTrigger className="h-8 w-36 bg-background"><SelectValue placeholder="Set finish…" /></SelectTrigger>
              <SelectContent>{finishes.map((f) => <SelectItem key={f._id} value={f._id}>{label(f)}</SelectItem>)}</SelectContent>
            </Select>
            <Select value="" onValueChange={(v) => save(ids, { productCategory: v }, "Category")} disabled={busy}>
              <SelectTrigger className="h-8 w-40 bg-background"><SelectValue placeholder="Set category…" /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c._id} value={c.slug || c._id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!products ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : !visible.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {onlyIssues ? "Nothing needs attention here." : "No products match."}
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox checked={allOn} onCheckedChange={() => setSelected(allOn ? new Set() : new Set(page.map((p) => p._id)))} />
                  </TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-32">Category</TableHead>
                  <TableHead className="w-40">Gadget</TableHead>
                  <TableHead className="w-44">Finish</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.map((p) => {
                  const g = gadgetOf(p);
                  const list = issues.get(p._id) || [];
                  return (
                    <TableRow key={p._id} className={list.length ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}>
                      <TableCell>
                        <Checkbox checked={selected.has(p._id)} onCheckedChange={() => setSelected((s) => {
                          const n = new Set(s); n.has(p._id) ? n.delete(p._id) : n.add(p._id); return n;
                        })} />
                      </TableCell>
                      <TableCell>
                        <Link to={`/backend-skinly/products/${p._id}`} className="group inline-flex items-start gap-1 font-medium hover:underline">
                          {p.title || p._id}
                          <ExternalLinkIcon className="mt-1 size-3 shrink-0 opacity-0 group-hover:opacity-60" />
                        </Link>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {p.status !== "active" && <Badge variant="outline" className="text-[10px]">{p.status}</Badge>}
                          {list.map((i) => (
                            <Badge key={i.label} variant="outline" className="border-amber-400 text-[10px] text-amber-700 dark:text-amber-400">
                              {i.label}{i.fix ? " · auto-fix" : ""}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{catName(p.productCategory)}</TableCell>
                      <TableCell>
                        {/* A gadget that disagrees with itself shows blank, so picking
                            the right one — even the one it seemed to be — saves. */}
                        <Select value={list.some((i) => i.label.startsWith("Gadget")) ? "" : g?._id || ""} onValueChange={(v) => save([p._id], gadgetPatch(v), "Gadget")} disabled={busy}>
                          <SelectTrigger className="h-8"><SelectValue placeholder={list.some((i) => i.label.startsWith("Gadget")) ? "Choose…" : "—"} /></SelectTrigger>
                          <SelectContent>{gadgets.map((x) => <SelectItem key={x._id} value={x._id}>{label(x)}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={finishes.some((f) => f._id === p.finishTypeId) ? p.finishTypeId : ""} onValueChange={(v) => save([p._id], { finishTypeId: v }, "Finish")} disabled={busy}>
                          <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>{finishes.map((f) => <SelectItem key={f._id} value={f._id}>{label(f)}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {visible.length > shown && (
              <div className="pt-4 text-center">
                <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>
                  Show more ({visible.length - shown} left)
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TypesTab({ kind, rows, products }: { kind: "gadget" | "finish"; rows: TypeRow[]; products: Product[] }) {
  const col = kind === "gadget" ? "gadgetTypes" : "finishTypes";
  const models = useCollection<{ _id: string; gadgetTypeId?: string; category?: string }>(kind === "gadget" ? "supportedModels" : null);
  const [editing, setEditing] = useState<TypeRow | "new" | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  // Counted from the catalogue as it is, not a stored number that goes stale.
  const productCount = (t: TypeRow) => products.filter((p) => kind === "gadget"
    ? p.gadgetTypeId === t._id || (!p.gadgetTypeId && p.gadgetCategory === t.name)
    : p.finishTypeId === t._id).length;
  const liveCount = (t: TypeRow) => products.filter((p) => p.status === "active" && (kind === "gadget"
    ? p.gadgetTypeId === t._id || (!p.gadgetTypeId && p.gadgetCategory === t.name)
    : p.finishTypeId === t._id)).length;
  const modelCount = (t: TypeRow) => kind === "gadget"
    ? (models || []).filter((m) => m.gadgetTypeId === t._id || (!m.gadgetTypeId && m.category === t.name)).length
    : 0;

  const open = (t: TypeRow | "new") => {
    setEditing(t);
    setDisplayName(t === "new" ? "" : label(t));
    setName(t === "new" ? "" : t.name);
  };

  const submit = async () => {
    const dn = displayName.trim();
    if (!dn) { toast.error("A name is needed"); return; }
    setBusy(true);
    try {
      if (editing === "new") {
        const key = (name.trim() || dn).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (rows.some((r) => r.name === key)) throw new Error(`"${key}" already exists`);
        await addDoc(collection(db, col), { name: key, displayName: dn, isActive: true, createdAt: Date.now(), _creationTime: Date.now() });
        toast.success(`${dn} added`);
      } else if (editing) {
        await updateDoc(doc(db, col, editing._id), { displayName: dn, updatedAt: Date.now() });
        toast.success("Saved");
      }
      setEditing(null);
    } catch (e: any) {
      toast.error(e?.message || "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (t: TypeRow, on: boolean) => {
    try { await updateDoc(doc(db, col, t._id), { isActive: on, updatedAt: Date.now() }); }
    catch (e: any) { toast.error(e?.message || "Could not update"); }
  };

  const remove = async (t: TypeRow) => {
    if (!confirm(`Delete ${label(t)}? This cannot be undone.`)) return;
    try { await deleteDoc(doc(db, col, t._id)); toast.success(`${label(t)} deleted`); }
    catch (e: any) { toast.error(e?.message || "Could not delete"); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">{kind === "gadget" ? "Gadget types" : "Finish types"}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {kind === "gadget"
              ? "Switched off, a gadget leaves the shop's pickers and filters. One in use by products or models can't be deleted."
              : "Switched off, a finish leaves the shop's filters. One in use by products can't be deleted."}
          </p>
        </div>
        <Button size="sm" onClick={() => open("new")}><PlusIcon className="mr-1 size-4" /> Add</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-32">Key</TableHead>
              <TableHead className="w-36">Products (live)</TableHead>
              {kind === "gadget" && <TableHead className="w-24">Models</TableHead>}
              <TableHead className="w-20">On</TableHead>
              <TableHead className="w-24 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => {
              const used = productCount(t) + modelCount(t);
              return (
                <TableRow key={t._id}>
                  <TableCell className="font-medium">{label(t)}</TableCell>
                  <TableCell><code className="text-xs text-muted-foreground">{t.name}</code></TableCell>
                  <TableCell className="text-sm">
                    {productCount(t)} <span className="text-muted-foreground">({liveCount(t)})</span>
                  </TableCell>
                  {kind === "gadget" && (
                    <TableCell className="text-sm">
                      {models ? modelCount(t) : "…"}
                    </TableCell>
                  )}
                  <TableCell><Switch checked={t.isActive !== false} onCheckedChange={(v) => toggle(t, v)} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => open(t)} aria-label={`Rename ${label(t)}`}>
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8" disabled={used > 0} onClick={() => remove(t)}
                        aria-label={`Delete ${label(t)}`} title={used ? "In use — switch it off instead" : "Delete"}>
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? `Add a ${kind} type` : `Rename ${editing ? label(editing) : ""}`}</DialogTitle>
            {editing !== "new" && (
              <DialogDescription>
                Only the name shown changes. The key stays, because products and models are filed under it.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="type-name">Name shown</Label>
              <Input id="type-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={kind === "gadget" ? "e.g. Smart Watch" : "e.g. Glossy"} />
            </div>
            {editing === "new" && (
              <div className="space-y-1.5">
                <Label htmlFor="type-key">Key (optional)</Label>
                <Input id="type-key" value={name} onChange={(e) => setName(e.target.value)} placeholder={displayName ? displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "made from the name"} />
                <p className="text-xs text-muted-foreground">Lower-case, used in links and filters. It can't be changed later.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={busy} onClick={submit}>{editing === "new" ? "Add" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
