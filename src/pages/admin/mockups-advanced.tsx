import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, limit, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  AlertCircleIcon, CheckCircle2Icon, CopyIcon, ImageIcon, Maximize2Icon, Minimize2Icon, RefreshCwIcon,
  Link2Icon, ListTodoIcon, SearchIcon, Trash2Icon, UploadIcon, XCircleIcon, XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase-db";
import { functions } from "@/lib/firebase";
import { useAction } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { convertImageToWebP, blobToBase64 } from "@/lib/image-processing";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";

/**
 * Admin › Advanced Mockups: each phone model's picture of each design.
 *
 * A mockup is one design (R-44) on one phone model, made in the desktop
 * software and uploaded here a model at a time; the shop shows it when a
 * customer has picked that phone. "Needed" means the designs live as phone
 * skins right now, read from the catalogue — not a fixed count, which had
 * stood at 359 while the real number moved.
 *
 * Coverage comes from mockupCoverage (functions/src/mockupCoverage.ts), one
 * small document per model, rather than downloading all 106k mockups on
 * every visit as this page used to.
 */

type Model = { _id: string; brandName: string; modelName: string; category?: string; isActive?: boolean; mergedInto?: string };
type Coverage = { _id: string; skus?: string[]; aliasOf?: string; aliasOfModel?: string };
type TodoRow = { modelId: string; brand: string; model: string; score: number; orders365: number; orders90: number; requests: number; newDays: number | null; have: number; reasons: string[] };
type Todo = { rows: TodoRow[]; need: number; coveredAt: number; candidates: number; computedAt: number; search?: { ok: boolean; pages?: number; error?: string } };
type Mockup = { _id: string; sku: string; cloudinaryUrl?: string; r2Url?: string };
type Design = { code: string; inStock: boolean; listings: number };
type Row = Model & { have: number; missing: Design[]; extra: number; aliasOf?: string; aliasOfModel?: string };

type UploadTask = {
  id: string; modelId: string; brandName: string; modelName: string; files: File[];
  status: "uploading" | "completed" | "cancelled";
  progress: { total: number; completed: number; failed: number; skipped: number; current: string };
  controller: AbortController; lastError?: string;
};

const PAGE = 50;
/** Design code of a listing SKU: R-44-IPH is filed under R-44. */
const designCode = (sku: string) => String(sku || "").trim().toUpperCase().replace(/^([A-Z]+-\d+)-[A-Z0-9]+$/, "$1");

/**
 * The design code in a mockup's filename: the last code in it, without
 * anything after (the -5G, -PRO of a model name used to be glued on, giving
 * codes like S-15-5G that no design has). Part suffixes _B/_B1 are dropped.
 */
function parseSKUFromFilename(filename: string): string | null {
  const clean = filename.replace(/\.[a-z0-9]+$/i, "").replace(/_B\d*(?=_|$| )/gi, "_");
  const all = [...clean.matchAll(/(?:^|[^A-Za-z0-9])([LMSBFART]-\d+)(?!\d)/gi)];
  return all.length ? all[all.length - 1][1].toUpperCase() : null;
}

function useLive<T>(q: any, key: string) {
  const [rows, setRows] = useState<T[] | null>(null);
  useEffect(() => onSnapshot(q, (s: any) => setRows(s.docs.map((d: any) => ({ _id: d.id, ...d.data() }))),
    (e: any) => { toast.error(e.message); setRows([]); }), [key]);
  return rows;
}

/** Live phone-skin designs, with whether any of their phone listings is in stock. */
function useLiveDesigns() {
  const [designs, setDesigns] = useState<Map<string, Design> | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const gt = await getDocs(query(collection(db, "gadgetTypes"), where("name", "==", "phone"), limit(1)));
      const phoneId = gt.docs[0]?.id;
      const prods = await getDocs(query(collection(db, "products"), where("status", "==", "active")));
      const ids = prods.docs.filter((d) => d.data().productCategory === "skin" && d.data().gadgetTypeId === phoneId).map((d) => d.id);
      const variants: any[] = [];
      for (let i = 0; i < ids.length; i += 30) {
        const s = await getDocs(query(collection(db, "variants"), where("productId", "in", ids.slice(i, i + 30))));
        variants.push(...s.docs.map((d) => d.data()));
      }
      const byProduct = new Map<string, any[]>();
      for (const v of variants) byProduct.set(v.productId, [...(byProduct.get(v.productId) || []), v]);
      const out = new Map<string, Design>();
      for (const id of ids) {
        const vs = (byProduct.get(id) || []).sort((a, b) => (a._creationTime || 0) - (b._creationTime || 0));
        // The shop looks a listing's mockup up by its first variant's SKU.
        const c = vs[0]?.sku ? designCode(vs[0].sku) : "";
        if (!c) continue;
        const d = out.get(c) || { code: c, inStock: false, listings: 0 };
        d.listings++;
        d.inStock ||= vs.some((v) => Number(v.inventoryQuantity) > 0);
        out.set(c, d);
      }
      if (live) setDesigns(out);
    })().catch((e) => { toast.error(e.message); if (live) setDesigns(new Map()); });
    return () => { live = false; };
  }, []);
  return designs;
}

export default function MockupsAdvancedPage() {
  const models = useLive<Model>(query(collection(db, "supportedModels"), where("category", "==", "phone")), "phone-models");
  const coverage = useLive<Coverage>(collection(db, "mockupCoverage"), "coverage");
  // The ranked to-do list (functions/src/mockupTodo.ts), with rows dropped live as their coverage fills in.
  const [todo, setTodo] = useState<Todo | null>(null);
  const [todoShow, setTodoShow] = useState(10);
  const [todoBusy, setTodoBusy] = useState(false);
  useEffect(() => onSnapshot(doc(db, "mockupTodo", "latest"), (s) => setTodo(s.exists() ? (s.data() as Todo) : { rows: [], need: 0, coveredAt: 0, candidates: 0, computedAt: 0 }), () => setTodo(null)), []);
  const todoRows = useMemo(() => {
    if (!todo || !coverage) return [];
    const cov = new Map(coverage.map((c) => [c._id, (c.skus || []).length]));
    return todo.rows.filter((r) => (cov.get(r.modelId) || 0) < todo.coveredAt);
  }, [todo, coverage]);
  const refreshTodo = async () => {
    setTodoBusy(true);
    try { const r: any = (await httpsCallable(functions, "refreshMockupTodo", { timeout: 300_000 })({})).data; toast.success(`To-do list rebuilt: ${r.candidates} models need mockups`); }
    catch (e: any) { toast.error(e?.message || "Could not rebuild the list"); } finally { setTodoBusy(false); }
  };
  const designs = useLiveDesigns();

  const [tab, setTab] = useState<"some" | "none" | "done" | "all">("some");
  const [brand, setBrand] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"missing" | "az">("missing");
  const [shown, setShown] = useState(PAGE);
  const [dialog, setDialog] = useState<{ kind: "upload" | "missing" | "view" | "delete" | "alias"; row: Row } | null>(null);
  const [toolsOpen, setToolsOpen] = useState<"design" | null>(null);
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [busy, setBusy] = useState(false);
  const uploadToR2 = useAction(api.r2.uploadToR2);

  const rows = useMemo<Row[]>(() => {
    if (!models || !coverage || !designs) return [];
    const cov = new Map(coverage.map((c) => [c._id, c]));
    return models.filter((m) => m.isActive !== false && !m.mergedInto).map((m) => {
      const c = cov.get(m._id);
      const has = new Set(c?.skus || []);
      const missing = [...designs.values()].filter((d) => !has.has(d.code));
      return { ...m, have: designs.size - missing.length, missing, extra: [...has].filter((cd) => !designs.has(cd)).length, aliasOf: c?.aliasOf, aliasOfModel: c?.aliasOfModel };
    });
  }, [models, coverage, designs]);

  const brands = useMemo(() => [...new Set(rows.map((r) => r.brandName))].sort(), [rows]);
  const total = designs?.size || 0;
  const counts = {
    done: rows.filter((r) => total && !r.missing.length).length,
    some: rows.filter((r) => r.have > 0 && r.missing.length).length,
    none: rows.filter((r) => r.have === 0).length,
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      (tab === "all" || (tab === "done" ? !r.missing.length : tab === "none" ? r.have === 0 : r.have > 0 && r.missing.length > 0))
      && (brand === "all" || r.brandName === brand)
      && (!q || `${r.brandName} ${r.modelName}`.toLowerCase().includes(q)))
      .sort((a, b) => sort === "missing"
        ? b.missing.filter((d) => d.inStock).length - a.missing.filter((d) => d.inStock).length || a.modelName.localeCompare(b.modelName)
        : a.brandName.localeCompare(b.brandName) || a.modelName.localeCompare(b.modelName));
  }, [rows, tab, brand, search, sort]);

  useEffect(() => setShown(PAGE), [tab, brand, search, sort]);

  // ---- Upload manager: five files at a time, retried, each replacing that model's mockup of the design.
  const patchTask = (id: string, patch: Partial<Omit<UploadTask, "progress">> & { progress?: Partial<UploadTask["progress"]> }) =>
    setTasks((ts) => ts.map((t) => t.id !== id ? t : { ...t, ...patch, progress: { ...t.progress, ...(patch.progress || {}) } }));

  const startUpload = async (row: Row, files: File[], skipExisting: boolean) => {
    const have = new Set(coverage?.find((c) => c._id === row._id)?.skus || []);
    const task: UploadTask = {
      id: crypto.randomUUID(), modelId: row._id, brandName: row.brandName, modelName: row.modelName, files,
      status: "uploading", controller: new AbortController(),
      progress: { total: files.length, completed: 0, failed: 0, skipped: 0, current: "Starting…" },
    };
    setTasks((ts) => [...ts, task]);
    let completed = 0, failed = 0, skipped = 0;

    const one = async (file: File) => {
      if (task.controller.signal.aborted) return;
      const sku = parseSKUFromFilename(file.name);
      if (!sku) { failed++; patchTask(task.id, { progress: { failed }, lastError: `No design code in ${file.name}` }); return; }
      if (skipExisting && have.has(sku)) { skipped++; patchTask(task.id, { progress: { skipped } }); return; }
      for (let attempt = 1; attempt <= 3; attempt++) {
        if (task.controller.signal.aborted) return;
        try {
          patchTask(task.id, { progress: { current: `${file.name}${attempt > 1 ? ` (try ${attempt})` : ""}` } });
          const base64 = await blobToBase64(await convertImageToWebP(file));
          const r2: any = await uploadToR2({
            fileBase64: base64.includes(",") ? base64.split(",")[1] : base64,
            key: `mockups/${row.brandName}/${row.modelName}/${sku}.webp`,
            contentType: "image/webp",
          });
          if (!r2?.success) throw new Error(r2?.error || "Upload failed");
          const data = {
            brand: row.brandName, model: row.modelName, sku, supportedModelId: row._id,
            r2Key: r2.key, r2Bucket: r2.bucket, cloudinaryUrl: r2.url || r2.publicUrl, updatedAt: Date.now(),
          };
          // One mockup per model and design: a second upload replaces the first.
          const existing = await getDocs(query(collection(db, "mockups"),
            where("supportedModelId", "==", row._id), where("sku", "==", sku), limit(1)));
          if (existing.empty) await addDoc(collection(db, "mockups"), { ...data, createdAt: Date.now(), _creationTime: Date.now() });
          else await updateDoc(existing.docs[0].ref, data);
          completed++;
          patchTask(task.id, { progress: { completed } });
          return;
        } catch (e: any) {
          if (attempt === 3) { failed++; patchTask(task.id, { progress: { failed }, lastError: `${file.name}: ${e?.message || "failed"}` }); }
          else await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
        }
      }
    };

    for (let i = 0; i < files.length && !task.controller.signal.aborted; i += 5) {
      await Promise.all(files.slice(i, i + 5).map(one));
    }
    if (!task.controller.signal.aborted) {
      patchTask(task.id, { status: "completed", progress: { current: "Done" } });
      toast.success(`${row.brandName} ${row.modelName}: ${completed} uploaded${skipped ? `, ${skipped} skipped` : ""}${failed ? `, ${failed} failed` : ""}`);
    }
  };

  const recount = async () => {
    setBusy(true);
    try {
      const r: any = (await httpsCallable(functions, "rebuildMockupCoverage", { timeout: 300_000 })({})).data;
      toast.success(`Recounted ${r.mockups} mockups across ${r.models} models`);
    } catch (e: any) {
      toast.error(e?.message || "Could not recount");
    } finally {
      setBusy(false);
    }
  };

  const loading = !models || !coverage || !designs;
  const inStock = designs ? [...designs.values()].filter((d) => d.inStock).length : 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Phone Mockups</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Each phone model's picture of each design. When a customer picks their phone, the shop shows these; where one
            is missing they see a generic picture instead. Upload a model's folder from the mockup software — the design
            code (R-44, M-174…) is read from each file name.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["Live phone designs", loading ? "…" : total, loading ? "" : `${inStock} in stock`],
            ["Models with every design", loading ? "…" : counts.done, ""],
            ["Models missing some", loading ? "…" : counts.some, ""],
            ["Models with none", loading ? "…" : counts.none, `of ${rows.length || "…"} phone models`],
          ].map(([label, value, sub]) => (
            <Card key={String(label)}>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
                {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold"><ListTodoIcon className="size-5" /> Mockup to-do</h2>
                <p className="text-sm text-muted-foreground">
                  Models that most need mockups, ranked from orders (recent ones count double), customer model requests and how
                  new the phone is on the site. A model leaves the list the moment its uploads cover {todo?.coveredAt || "…"} of the {todo?.need || "…"} designs in stock.
                  {todo?.computedAt ? ` Ranked ${new Date(todo.computedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}; rebuilt nightly.` : ""}
                  {todo?.search && (todo.search.ok
                    ? <span className="text-emerald-700"> Google Search linked ({todo.search.pages} pages, 28 days).</span>
                    : <span className="text-amber-700"> Google Search not linked yet: add skinly-3003b@appspot.gserviceaccount.com as a user on the Search Console property, then rebuild.</span>)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={String(todoShow)} onValueChange={(v) => setTodoShow(Number(v))}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>{[10, 20, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>Top {n}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="outline" size="sm" disabled={todoBusy} onClick={refreshTodo}><RefreshCwIcon className={`mr-1 size-4 ${todoBusy ? "animate-spin" : ""}`} /> Rebuild now</Button>
              </div>
            </div>
            {!todo ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
            ) : !todoRows.length ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nothing waiting — every model with demand has its mockups.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Why</TableHead>
                    <TableHead className="w-20 text-right">Score</TableHead>
                    <TableHead className="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todoRows.slice(0, todoShow).map((t, i) => {
                    const r = rows.find((x) => x._id === t.modelId);
                    const have = coverage?.find((c) => c._id === t.modelId)?.skus?.length || 0;
                    return (
                      <TableRow key={t.modelId}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell><div className="font-medium">{t.model}</div><div className="text-xs text-muted-foreground">{t.brand}{have ? ` · ${have} designs done` : ""}</div></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.reasons.filter((x) => !/designs done/.test(x)).join(" · ")}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{t.score}</TableCell>
                        <TableCell className="text-right">
                          {r && <div className="flex justify-end gap-1">
                            <Button size="sm" onClick={() => setDialog({ kind: "upload", row: r })}><UploadIcon className="mr-1 size-4" /> Upload</Button>
                            <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "alias", row: r })}><Link2Icon className="mr-1 size-4" /> Same as…</Button>
                          </div>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {todo && todo.candidates > todoRows.length && <p className="text-xs text-muted-foreground">{todo.candidates} models have some demand in all; the list keeps the top 100.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
                <TabsList>
                  <TabsTrigger value="some">Missing some ({counts.some})</TabsTrigger>
                  <TabsTrigger value="none">None yet ({counts.none})</TabsTrigger>
                  <TabsTrigger value="done">Complete ({counts.done})</TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search models" className="w-52 pl-8" />
              </div>
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All brands</SelectItem>
                  {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="missing">Most in-stock missing</SelectItem>
                  <SelectItem value="az">Brand, A–Z</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : !visible.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No models here.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead className="w-56">Designs with a mockup</TableHead>
                      <TableHead className="w-44">Missing</TableHead>
                      <TableHead className="w-64 text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.slice(0, shown).map((r) => {
                      const missingIn = r.missing.filter((d) => d.inStock).length;
                      return (
                        <TableRow key={r._id}>
                          <TableCell>
                            <div className="font-medium">{r.modelName}</div>
                            <div className="text-xs text-muted-foreground">{r.brandName}{r.aliasOfModel ? <span className="ml-1 rounded bg-sunny/60 px-1 py-0.5 text-[10px] font-semibold text-ink"><Link2Icon className="mr-0.5 inline size-3" />same as {r.aliasOfModel}</span> : null}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={total ? (r.have / total) * 100 : 0} className="h-2 w-28" />
                              <span className="text-sm tabular-nums">{r.have}/{total}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {r.missing.length ? (
                              <button className="text-left text-sm hover:underline" onClick={() => setDialog({ kind: "missing", row: r })}>
                                <b>{missingIn}</b> in stock{r.missing.length > missingIn ? <span className="text-muted-foreground"> · {r.missing.length - missingIn} out</span> : null}
                              </button>
                            ) : <span className="flex items-center gap-1 text-sm text-green-700"><CheckCircle2Icon className="size-4" /> All</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" onClick={() => setDialog({ kind: "upload", row: r })}><UploadIcon className="mr-1 size-4" /> Upload</Button>
                              <Button size="sm" variant="outline" title="Show another model's mockups on this one (same back, different size)" onClick={() => setDialog({ kind: "alias", row: r })}>
                                <Link2Icon className="mr-1 size-4" /> {r.aliasOf ? "Linked" : "Same as…"}
                              </Button>
                              <Button size="sm" variant="outline" disabled={!r.have && !r.extra} onClick={() => setDialog({ kind: "view", row: r })}>
                                <ImageIcon className="mr-1 size-4" /> View
                              </Button>
                              <Button size="icon" variant="ghost" className="size-8" disabled={!r.have && !r.extra}
                                aria-label={`Delete ${r.modelName}'s mockups`} onClick={() => setDialog({ kind: "delete", row: r })}>
                                <Trash2Icon className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {visible.length > shown && (
                  <div className="text-center">
                    <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>Show more ({visible.length - shown} left)</Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={busy} onClick={recount}>
            <RefreshCwIcon className="mr-1 size-4" /> Recount from all mockups
          </Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => setToolsOpen("design")}>
            <Trash2Icon className="mr-1 size-4" /> Remove a design from every model
          </Button>
        </div>
      </div>

      {dialog?.kind === "upload" && (
        <UploadDialog row={dialog.row} have={new Set(coverage?.find((c) => c._id === dialog.row._id)?.skus || [])} designs={designs}
          onClose={() => setDialog(null)} onStart={(files, skip) => { void startUpload(dialog.row, files, skip); setDialog(null); }} />
      )}
      {dialog?.kind === "missing" && <MissingDialog row={dialog.row} onClose={() => setDialog(null)} />}
      {dialog?.kind === "view" && <ViewDialog row={dialog.row} designs={designs} onClose={() => setDialog(null)} />}
      {dialog?.kind === "delete" && <DeleteDialog row={dialog.row} onClose={() => setDialog(null)} />}
      {dialog?.kind === "alias" && <AliasDialog row={dialog.row} rows={rows} total={total} onClose={() => setDialog(null)} />}
      {toolsOpen === "design" && <DeleteDesignDialog onClose={() => setToolsOpen(null)} />}
      <UploadPanel tasks={tasks}
        onCancel={(id) => { tasks.find((t) => t.id === id)?.controller.abort(); patchTask(id, { status: "cancelled" }); }}
        onDismiss={(id) => setTasks((ts) => ts.filter((t) => t.id !== id))} />
    </AdminLayout>
  );
}

function UploadDialog({ row, have, designs, onClose, onStart }: {
  row: Row; have: Set<string>; designs: Map<string, Design> | null;
  onClose: () => void; onStart: (files: File[], skipExisting: boolean) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [skipExisting, setSkipExisting] = useState(true);
  const parsed = files.map((f) => ({ f, sku: parseSKUFromFilename(f.name) }));
  const noCode = parsed.filter((p) => !p.sku).length;
  const already = parsed.filter((p) => p.sku && have.has(p.sku)).length;
  const notLive = parsed.filter((p) => p.sku && designs && !designs.has(p.sku)).length;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload mockups · {row.brandName} {row.modelName}</DialogTitle>
          <DialogDescription>Choose the model's folder (or files). Each file name must contain its design code, e.g. iPhone 17 Pro_R-44.jpg.</DialogDescription>
        </DialogHeader>
        <label className="flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed hover:bg-muted/50">
          <UploadIcon className="mb-1 size-6 text-muted-foreground" />
          <span className="text-sm"><b>Choose a folder</b> — {row.have} of this model's designs are already up</span>
          <input type="file" accept="image/*" multiple className="hidden" {...({ webkitdirectory: "", directory: "" } as any)}
            onChange={(e) => e.target.files && setFiles([...e.target.files].filter((f) => f.type.startsWith("image/")))} />
        </label>
        {files.length > 0 && (
          <div className="space-y-2 text-sm">
            <p>
              <b>{files.length}</b> images · {files.length - noCode} with a design code
              {already > 0 && <> · {already} already uploaded</>}
              {notLive > 0 && <> · {notLive} for designs not live now</>}
            </p>
            {noCode > 0 && (
              <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                {noCode} file{noCode === 1 ? " has" : "s have"} no design code in the name and will be skipped: {parsed.filter((p) => !p.sku).slice(0, 3).map((p) => p.f.name).join(", ")}{noCode > 3 ? "…" : ""}
              </p>
            )}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} className="size-4" />
              Skip designs this model already has {skipExisting ? "" : "(they'll be replaced)"}
            </label>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!files.length || files.length === noCode} onClick={() => onStart(files, skipExisting)}>
            Upload {files.length - noCode - (skipExisting ? already : 0)} files
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MissingDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const inStock = row.missing.filter((d) => d.inStock).map((d) => d.code).sort(byCode);
  const out = row.missing.filter((d) => !d.inStock).map((d) => d.code).sort(byCode);
  const copy = (codes: string[]) => { void navigator.clipboard.writeText(codes.join("\n")); toast.success(`Copied ${codes.length} codes`); };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Missing for {row.brandName} {row.modelName}</DialogTitle>
          <DialogDescription>Live phone designs this model has no mockup of. Make the in-stock ones first — those are what customers can buy today.</DialogDescription>
        </DialogHeader>
        {[["In stock", inStock], ["Out of stock", out]].map(([label, codes]) => (codes as string[]).length > 0 && (
          <div key={label as string} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{label} ({(codes as string[]).length})</p>
              <Button size="sm" variant="ghost" onClick={() => copy(codes as string[])}><CopyIcon className="mr-1 size-4" /> Copy</Button>
            </div>
            <div className="flex max-h-48 flex-wrap gap-1 overflow-y-auto">
              {(codes as string[]).map((c) => <Badge key={c} variant="outline" className="font-mono">{c}</Badge>)}
            </div>
          </div>
        ))}
        <DialogFooter><Button onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewDialog({ row, designs, onClose }: { row: Row; designs: Map<string, Design> | null; onClose: () => void }) {
  const mockups = useLive<Mockup>(query(collection(db, "mockups"), where("supportedModelId", "==", row._id)), `view-${row._id}`);
  const remove = async (m: Mockup) => {
    if (!confirm(`Delete the ${m.sku} mockup for ${row.modelName}?`)) return;
    try { await deleteDoc(doc(db, "mockups", m._id)); toast.success("Deleted"); }
    catch (e: any) { toast.error(e?.message || "Could not delete"); }
  };
  const list = [...(mockups || [])].sort((a, b) => byCode(a.sku, b.sku));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>{row.brandName} {row.modelName}</DialogTitle>
          <DialogDescription>{mockups ? `${mockups.length} mockups` : "Loading…"} · faded ones are designs not live as phone skins now</DialogDescription>
        </DialogHeader>
        {/* auto-rows-max: with a fixed dialog height a CSS grid squashes auto rows of overflow-hidden cells to 0 (315 mockups became 2px lines) */}
        <div className="grid flex-1 auto-rows-max grid-cols-3 gap-3 overflow-y-auto p-1 sm:grid-cols-5">
          {list.map((m) => (
            <div key={m._id} className={`group relative overflow-hidden rounded-lg border ${designs && !designs.has(m.sku.toUpperCase()) ? "opacity-50" : ""}`}>
              <img src={m.r2Url || m.cloudinaryUrl} alt={m.sku} loading="lazy" className="aspect-[9/16] w-full bg-muted object-cover" />
              <div className="flex items-center justify-between border-t px-2 py-1">
                <span className="font-mono text-xs font-bold">{m.sku}</span>
                <button onClick={() => remove(m)} aria-label={`Delete ${m.sku}`} className="text-muted-foreground hover:text-destructive"><Trash2Icon className="size-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "Same as": pick the model whose mockups this one should show. Only models of
 * the same brand with (nearly) every design, and never one that is itself a
 * link. The function copies the docs (same files); unlink deletes only those.
 */
function AliasDialog({ row, rows, total, onClose }: { row: Row; rows: Row[]; total: number; onClose: () => void }) {
  const [source, setSource] = useState(row.aliasOf || "");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const options = useMemo(() => rows
    .filter((r) => r._id !== row._id && r.brandName === row.brandName && !r.aliasOf && total && r.have >= total * 0.9)
    .filter((r) => !q.trim() || r.modelName.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.modelName.localeCompare(b.modelName, undefined, { numeric: true })), [rows, row, total, q]);
  const call = async (data: Record<string, unknown>, done: (r: any) => string) => {
    setBusy(true);
    try { const r: any = (await httpsCallable(functions, "aliasMockups", { timeout: 300_000 })(data)).data; toast.success(done(r)); onClose(); }
    catch (e: any) { toast.error(e?.message || "Could not link"); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{row.brandName} {row.modelName}: same as…</DialogTitle>
          <DialogDescription>
            For a phone that looks the same from the back as another (only the size differs — S25 and S25 Plus, Edge 70 Fusion and
            Fusion+). This model will show the chosen model's mockups under its own name; nothing is copied on storage. Uploading
            its own mockups later replaces them.
            {row.aliasOfModel ? <> Currently linked to <b>{row.aliasOfModel}</b>.</> : null}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${row.brandName} models with mockups`} className="pl-8" />
          </div>
          <div className="max-h-72 overflow-y-auto rounded-md border">
            {options.length ? options.map((r) => (
              <label key={r._id} className={`flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/50 ${source === r._id ? "bg-muted" : ""}`}>
                <input type="radio" name="alias-source" checked={source === r._id} onChange={() => setSource(r._id)} />
                <span className="flex-1">{r.modelName}</span>
                <span className="text-xs text-muted-foreground">{r.have}/{total}</span>
              </label>
            )) : <p className="p-4 text-center text-sm text-muted-foreground">No {row.brandName} model with a full set of mockups{q ? " matches" : " yet"}.</p>}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {row.aliasOf && (
              <Button variant="outline" disabled={busy} onClick={() => call({ aliasId: row._id, remove: true }, (r) => `Unlinked: ${r.removed} mockups removed from ${row.modelName}`)}>
                <XIcon className="mr-1 size-4" /> Unlink
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={busy || !source || source === row.aliasOf} onClick={() => call({ aliasId: row._id, sourceId: source }, (r) => `${row.modelName} now shows ${rows.find((x) => x._id === source)?.modelName}'s mockups (${r.written} linked${r.kept ? `, ${r.kept} of its own kept` : ""})`)}>
              <Link2Icon className="mr-1 size-4" /> {busy ? "Linking…" : "Link"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const r: any = (await httpsCallable(functions, "deleteMockups", { timeout: 300_000 })({ modelId: row._id })).data;
      toast.success(`Deleted ${r.deleted} mockups for ${row.modelName}`);
      onClose();
    } catch (e: any) { toast.error(e?.message || "Could not delete"); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete every mockup of {row.brandName} {row.modelName}?</DialogTitle>
          <DialogDescription>Customers who pick this phone will see generic pictures until new ones are uploaded. Type the model name to confirm.</DialogDescription>
        </DialogHeader>
        <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={row.modelName} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={busy || typed.trim() !== row.modelName} onClick={go}>{busy ? "Deleting…" : "Delete"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDesignDialog({ onClose }: { onClose: () => void }) {
  const [sku, setSku] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const code = sku.trim().toUpperCase();
  useEffect(() => {
    setCount(null);
    if (!/^[A-Z]+-\d+$/.test(code)) return;
    const t = setTimeout(() => {
      getDocs(query(collection(db, "mockups"), where("sku", "==", code), limit(1000))).then((s) => setCount(s.size)).catch(() => setCount(null));
    }, 400);
    return () => clearTimeout(t);
  }, [code]);
  const go = async () => {
    if (!confirm(`Delete ${code} from all ${count} models? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const r: any = (await httpsCallable(functions, "deleteMockups", { timeout: 300_000 })({ sku: code })).data;
      toast.success(`Deleted ${r.deleted} mockups of ${code}`);
      onClose();
    } catch (e: any) { toast.error(e?.message || "Could not delete"); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove a design from every model</DialogTitle>
          <DialogDescription>For a design that is retired, or whose mockups were made wrong. Every phone model's mockup of it is deleted.</DialogDescription>
        </DialogHeader>
        <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Design code, e.g. R-44" />
        {count !== null && <p className="text-sm">{count ? <><b>{count}</b> mockups of {code} will be deleted.</> : `No mockups of ${code}.`}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={busy || !count} onClick={go}>{busy ? "Deleting…" : "Delete"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadPanel({ tasks, onCancel, onDismiss }: { tasks: UploadTask[]; onCancel: (id: string) => void; onDismiss: (id: string) => void }) {
  const [min, setMin] = useState(false);
  if (!tasks.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-lg border bg-background shadow-xl">
      <button className="flex w-full items-center justify-between bg-primary p-3 text-sm font-semibold text-primary-foreground" onClick={() => setMin(!min)}>
        <span className="flex items-center gap-2"><UploadIcon className="size-4" /> Uploads ({tasks.length})</span>
        {min ? <Maximize2Icon className="size-4" /> : <Minimize2Icon className="size-4" />}
      </button>
      {!min && (
        <div className="max-h-[50vh] space-y-3 overflow-y-auto p-3">
          {tasks.map((t) => {
            const done = t.progress.completed + t.progress.failed + t.progress.skipped;
            return (
              <div key={t.id} className="space-y-2 rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{t.brandName} {t.modelName}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {t.status === "completed" ? "Done" : t.status === "cancelled" ? "Cancelled" : t.progress.current}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="size-6" aria-label={t.status === "uploading" ? "Cancel" : "Dismiss"}
                    onClick={() => (t.status === "uploading" ? onCancel(t.id) : onDismiss(t.id))}>
                    <XIcon className="size-4" />
                  </Button>
                </div>
                <Progress value={t.progress.total ? (done / t.progress.total) * 100 : 0} className="h-2" />
                <div className="flex gap-3 text-xs">
                  <span className="flex items-center gap-1 text-green-600"><CheckCircle2Icon className="size-3" /> {t.progress.completed}</span>
                  <span className="flex items-center gap-1 text-muted-foreground">skipped {t.progress.skipped}</span>
                  <span className="flex items-center gap-1 text-red-600"><XCircleIcon className="size-3" /> {t.progress.failed}</span>
                  <span className="ml-auto text-muted-foreground">{done}/{t.progress.total}</span>
                </div>
                {t.lastError && (
                  <p className="flex items-center gap-1 truncate rounded bg-destructive/10 p-1 text-xs text-destructive" title={t.lastError}>
                    <AlertCircleIcon className="size-3 shrink-0" /> {t.lastError}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** R-2 before R-10: design codes by letter, then number. */
function byCode(a: string, b: string) {
  const [pa, na] = [a.replace(/-.*/, ""), parseInt(a.replace(/^[A-Z]+-/i, ""), 10) || 0];
  const [pb, nb] = [b.replace(/-.*/, ""), parseInt(b.replace(/^[A-Z]+-/i, ""), 10) || 0];
  return pa.localeCompare(pb) || na - nb;
}
