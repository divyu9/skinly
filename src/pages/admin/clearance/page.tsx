import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ExternalLinkIcon, MinusIcon, PlusIcon, TagIcon, TrashIcon, VideoIcon } from "lucide-react";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/firebase-hooks";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { SearchPicker } from "../orders/_components/SearchPicker.tsx";
import { ProductImageUploader } from "../products/_components/product-image-uploader.tsx";
import { LensSelector, isWithLensVariant } from "@/components/product/LensSelector.tsx";
import { searchRows } from "@/lib/search-match";
import { cn } from "@/lib/utils.ts";

async function call(name: string, data: unknown) {
  const [{ functions }, { httpsCallable }] = await Promise.all([import("@/lib/firebase"), import("firebase/functions")]);
  return (await httpsCallable(functions, name)(data)).data as any;
}

type Piece = {
  id: string; productId: string; productTitle: string; productImage?: string; variant: string; sku?: string;
  phoneBrand: string; phoneModel: string; coverage?: string | null; lensModel?: string | null;
  price: number; originalPrice: number; createdAt: number; videoUrl?: string;
  status: string; buyable: boolean; source: string; note?: string;
  sourceOrderId?: string | null; sourceOrderNumber?: string; reservedOrderId?: string | null; soldOrderId?: string | null; soldAt?: number | null;
};

const device = (p: { phoneBrand?: string; phoneModel?: string }) => {
  const b = (p.phoneBrand || "").trim(), m = (p.phoneModel || "").trim();
  return b && m.toLowerCase().startsWith(b.toLowerCase()) ? m : [b, m].filter(Boolean).join(" ");
};
// Not by price: a kind repriced after one sold split into a "Sold out" row and a second row.
const groupKey = (p: Piece) => [p.productId, p.variant, p.phoneBrand, p.phoneModel, p.coverage || "", p.lensModel || ""].join("|");

/** One device-model picker for the add form, models of the chosen gadget kind. */
function ModelSearch({ gadget, value, onPick }: { gadget: string; value: string; onPick: (b: string, m: string) => void }) {
  const models = useQuery(api.supportedModels.listAll, { category: gadget, isActive: true });
  return (
    <SearchPicker<any>
      rows={models}
      value={value}
      onPick={(m) => onPick(String(m.brandName || ""), String(m.modelName || ""))}
      label={(m) => `${m.brandName} ${m.modelName}`}
      placeholder={`Search ${gadget} model`}
      searchPlaceholder="e.g. iphone 15 pro, s24fe, a7iii"
      emptyText="Not listed — type brand and model below."
    />
  );
}

const GADGETS = ["phone", "laptop", "tablet", "camera", "lens", "console", "controller", "drone", "action-camera", "gimbals", "charger", "mac-mini"];

/**
 * Add pieces to the clearance page: an existing listing (draft or unlisted
 * too) or a piece described from scratch, the device it is cut for, a
 * price and how many (functions: addClearanceStock).
 */
function AddStock({ onAdded }: { onAdded: () => void }) {
  const products = useQuery(api.products.getAllProducts);
  const [mode, setMode] = useState<"listing" | "custom">("listing");
  const [product, setProduct] = useState<any | null>(null);
  const [variant, setVariant] = useState("");
  const [title, setTitle] = useState("");
  const [images, setImages] = useState<any[]>([]);
  const [gadget, setGadget] = useState("phone");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [coverage, setCoverage] = useState("");
  const [lens, setLens] = useState("");
  const [price, setPrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const variants = ((product?.variants || []) as any[]).filter((v) => Number(v?.price) > 0);
  const pickProduct = (p: any) => {
    setProduct(p);
    const v = ((p.variants || []) as any[]).find((x) => Number(x?.price) > 0);
    setVariant(v?.title || "");
    setMrp(String(Math.round(Number(v?.compareAtPrice) || Number(v?.price) || 0) || ""));
    setGadget(String(p.gadgetCategory || "phone"));
    setLens("");
  };

  const reset = () => {
    setProduct(null); setVariant(""); setTitle(""); setImages([]); setBrand(""); setModel("");
    setCoverage(""); setLens(""); setPrice(""); setMrp(""); setQty("1"); setNote("");
  };

  const submit = async () => {
    if (mode === "listing" && !product) { toast.error("Pick the listing"); return; }
    if (mode === "custom" && !title.trim()) { toast.error("Give the piece a title"); return; }
    if (!(Number(price) > 0)) { toast.error("Set a clearance price"); return; }
    setBusy(true);
    try {
      const r = await call("addClearanceStock", {
        ...(mode === "listing" ? { productId: product._id, variant } : { productTitle: title.trim(), productImage: images[0]?.url || "", variant: "Default" }),
        phoneBrand: brand.trim(), phoneModel: model.trim(),
        coverage: coverage || undefined, lensModel: lens.trim() || undefined,
        price: Number(price), originalPrice: Number(mrp) || 0, quantity: Number(qty) || 1, note: note.trim() || undefined,
      });
      toast.success(`${r?.created || qty} piece${Number(r?.created || qty) === 1 ? "" : "s"} added to clearance`);
      reset();
      onAdded();
    } catch (e: any) {
      toast.error(e?.message || "Could not add");
    } finally {
      setBusy(false);
    }
  };

  const showCoverage = gadget === "phone";
  const showLens = gadget === "camera" && (mode === "custom" || isWithLensVariant(variant));

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><PlusIcon className="size-4" /> Add stock to clearance</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex gap-1 text-xs font-semibold">
          {(["listing", "custom"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={cn("rounded-md border px-3 py-1.5", mode === m ? "bg-foreground text-background" : "hover:bg-muted")}>
              {m === "listing" ? "From a listing (incl. unlisted)" : "New piece (not on the site)"}
            </button>
          ))}
        </div>

        {mode === "listing" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Listing</Label>
              <SearchPicker<any>
                rows={products as any[] | undefined}
                value={product?.title || ""}
                onPick={pickProduct}
                label={(p) => String(p.title || "")}
                sub={(p) => [p.status !== "active" ? p.status : "", (p.variantSkus || []).slice(0, 3).join(", ")].filter(Boolean).join(" · ")}
                full={(p) => `${p.title} ${(p.tags || []).join(" ")} ${(p.variantSkus || []).join(" ")}`}
                placeholder="Search a listing (name or SKU)"
                searchPlaceholder="e.g. L-124, midnight topography"
              />
            </div>
            {variants.length > 1 && (
              <div className="space-y-1.5">
                <Label>Variant</Label>
                <Select value={variant} onValueChange={(v) => { setVariant(v); setLens(""); const x = variants.find((y) => y.title === v); if (x) setMrp(String(Math.round(Number(x.compareAtPrice) || Number(x.price) || 0))); }}>
                  <SelectTrigger><SelectValue placeholder="Variant" /></SelectTrigger>
                  <SelectContent>{variants.map((v) => <SelectItem key={v._id || v.title} value={v.title}>{v.title} · ₹{v.price}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Carbon Fibre Black Matte Phone Skin" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Photo</Label>
              <ProductImageUploader images={images} onImagesChange={(imgs) => setImages(imgs.slice(0, 1))} productSlug="clearance" />
            </div>
            <div className="space-y-1.5">
              <Label>Device kind</Label>
              <Select value={gadget} onValueChange={(g) => { setGadget(g); setBrand(""); setModel(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{GADGETS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Cut for (device) — leave empty for a gadget or accessory</Label>
            <ModelSearch gadget={gadget} value={model ? device({ phoneBrand: brand, phoneModel: model }) : ""} onPick={(b, m) => { setBrand(b); setModel(m); setLens(""); }} />
          </div>
          <div className="space-y-1.5">
            <Label>Brand</Label>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Samsung" />
          </div>
          <div className="space-y-1.5">
            <Label>Model</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Galaxy S24 FE" />
          </div>
          {showCoverage && (
            <div className="space-y-1.5">
              <Label>Coverage</Label>
              <Select value={coverage || "none"} onValueChange={(v) => setCoverage(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not stated</SelectItem>
                  <SelectItem value="only_back">Back only</SelectItem>
                  <SelectItem value="full_body_wrap">Full body wrap</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {showLens && <LensSelector brand={brand} value={lens} onChange={setLens} />}

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5"><Label>Clearance price ₹</Label><Input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} /></div>
          <div className="space-y-1.5"><Label>Was (MRP) ₹</Label><Input inputMode="numeric" value={mrp} onChange={(e) => setMrp(e.target.value.replace(/\D/g, ""))} /></div>
          <div className="space-y-1.5"><Label>Pieces</Label><Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} /></div>
          <div className="space-y-1.5"><Label>Note (admin only)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. shelf B2" /></div>
        </div>
        <Button type="button" onClick={submit} disabled={busy} className="w-full">{busy ? "Adding…" : "Add to clearance"}</Button>
      </CardContent>
    </Card>
  );
}


/** Where clearance-only orders are paid: the owner's UPI (functions: saveClearanceUpi). */
function UpiSettings() {
  const [vpa, setVpa] = useState("");
  const [name, setName] = useState("");
  const [on, setOn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    call("getClearanceUpi", { admin: true }).then((r) => { setVpa(r?.vpa || ""); setName(r?.payeeName || ""); setOn(r?.enabled === true); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);
  const save = async () => {
    setBusy(true);
    try { await call("saveClearanceUpi", { vpa: vpa.trim(), payeeName: name.trim(), enabled: on }); toast.success(on ? "Direct UPI is on for clearance orders" : "Saved (direct UPI off)"); }
    catch (e: any) { toast.error(e?.message || "Could not save"); } finally { setBusy(false); }
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Payment for clearance orders (direct UPI)</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          When on, a cart of clearance items only is paid straight to this UPI ID (QR + app button on the order page). These are personal sales: numbered CL-1001 onwards, no GST invoice. You confirm each payment on the order page.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5"><Label>UPI ID</Label><Input value={vpa} onChange={(e) => setVpa(e.target.value)} placeholder="name@ybl" disabled={!loaded} /></div>
          <div className="space-y-1.5"><Label>Name shown to the customer</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="optional" disabled={!loaded} /></div>
          <label className="flex items-end gap-2 pb-2"><input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} disabled={!loaded} /> <span>Direct UPI on</span></label>
        </div>
        <Button type="button" onClick={save} disabled={busy || !loaded}>{busy ? "Saving…" : "Save"}</Button>
      </CardContent>
    </Card>
  );
}

function AdminClearanceInner() {
  const [pieces, setPieces] = useState<Piece[] | null>(null);
  const [view, setView] = useState<"live" | "sold">("live");
  const [q, setQ] = useState("");
  const [priceEdit, setPriceEdit] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await call("listClearance", { admin: true });
      setPieces(r?.items || []);
    } catch (e: any) {
      toast.error(e?.message || "Could not load clearance");
      setPieces([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Alike pieces together: one row per listing + variant + device + price.
  const groups = useMemo(() => {
    // Live keeps a kind whose pieces have all sold, as a "Sold out" row with
    // Restock: without it the only way to sell more was Add stock, which made
    // a second card (another listing id, no photos) next to the sold-out one.
    const list = (pieces || []).filter((p) => (view === "sold" ? p.status === "sold" : true));
    const m = new Map<string, Piece[]>();
    for (const p of list) m.set(groupKey(p), [...(m.get(groupKey(p)) || []), p]);
    let rows = [...m.values()].map((ps) => {
      if (view === "sold") return { key: groupKey(ps[0]), first: ps[0], pieces: ps, soldOut: false };
      const open = ps.filter((p) => p.status !== "sold");
      return { key: groupKey(ps[0]), first: open[0] || ps[0], pieces: open, soldOut: open.length === 0 };
    });
    if (q.trim()) rows = searchRows(rows, q, (r) => device(r.first), (r) => `${device(r.first)} ${r.first.productTitle} ${r.first.sku || ""} ${r.first.sourceOrderNumber || ""}`);
    const newest = (r: { first: Piece; pieces: Piece[] }) => Math.max(r.first.createdAt, ...r.pieces.map((p) => p.createdAt));
    return rows.sort((a, b) => Number(a.soldOut) - Number(b.soldOut) || newest(b) - newest(a));
  }, [pieces, view, q]);

  const live = (pieces || []).filter((p) => p.status !== "sold");
  const onSale = live.filter((p) => p.buyable).length;
  const held = live.filter((p) => p.status === "reserved" && !p.buyable).length;
  const drafts = live.filter((p) => p.status === "draft").length;
  const sold = (pieces || []).filter((p) => p.status === "sold");

  const setGroupPrice = async (g: { key: string; pieces: Piece[] }) => {
    const price = Number(priceEdit[g.key]);
    if (!(price > 0)) return;
    setBusy(g.key);
    try {
      for (const p of g.pieces.filter((x) => x.status !== "sold")) await call("updateClearanceItem", { id: p.id, price });
      toast.success(`Price set to ₹${price}`);
      setPriceEdit((e) => ({ ...e, [g.key]: "" }));
      await load();
    } catch (e: any) { toast.error(e?.message || "Could not change the price"); } finally { setBusy(""); }
  };

  const addMore = async (g: { key: string; first: Piece }, n: number) => {
    const f = g.first;
    setBusy(g.key);
    try {
      // A copy of this piece (photos, condition, description), so it joins the same card.
      await call("addClearanceStock", { sameAs: f.id, quantity: n });
      toast.success(`+${n} piece${n === 1 ? "" : "s"}`);
      await load();
    } catch (e: any) { toast.error(e?.message || "Could not add"); } finally { setBusy(""); }
  };

  // A UGC clip of the piece in use: the card plays it instead of the first photo.
  const setVideo = async (g: { key: string; first: Piece; pieces: Piece[] }) => {
    const url = window.prompt("Video link (.mp4 from Media Library). Leave empty to remove the video.", g.first.videoUrl || "");
    if (url === null) return;
    setBusy(g.key);
    try {
      await call("setClearanceVideo", { ids: g.pieces.filter((x) => x.status !== "sold").map((x) => x.id), videoUrl: url.trim() });
      toast.success(url.trim() ? "Video added" : "Video removed");
      await load();
    } catch (e: any) { toast.error(e?.message || "Could not set the video"); } finally { setBusy(""); }
  };

  const removeOne = async (g: { key: string; pieces: Piece[] }) => {
    const p = g.pieces.find((x) => x.status === "available" || x.status === "draft");
    if (!p) { toast.error("No free piece to remove (the rest are held by an order)"); return; }
    setBusy(g.key);
    try { await call("removeClearanceItem", { id: p.id }); toast.success("One piece removed"); await load(); }
    catch (e: any) { toast.error(e?.message || "Could not remove"); } finally { setBusy(""); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><TagIcon className="size-6" /> Clearance sale</h1>
          <p className="text-sm text-muted-foreground">Pieces already cut for one device — RTO returns and old stock. Each sells once, for its device.</p>
        </div>
        <a href="/clearance" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-semibold hover:bg-muted">
          View the clearance page <ExternalLinkIcon className="size-4" />
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">On sale</p><p className="text-2xl font-bold">{pieces ? onSale : "…"}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Held by an unpaid order · waiting for a price</p><p className="text-2xl font-bold">{pieces ? held : "…"} <span className="text-sm font-medium text-amber-700">· {pieces ? drafts : "…"} need a price</span></p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Sold</p><p className="text-2xl font-bold">{pieces ? sold.length : "…"} <span className="text-sm font-medium text-muted-foreground">· ₹{sold.reduce((s, p) => s + (Number(p.price) || 0), 0).toLocaleString("en-IN")}</span></p></div>
      </div>

      <UpiSettings />

      <AddStock onAdded={load} />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div className="flex gap-1 text-xs font-semibold">
            {(["live", "sold"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={cn("rounded-md border px-3 py-1.5", view === v ? "bg-foreground text-background" : "hover:bg-muted")}>
                {v === "live" ? `On the page (${live.length})` : `Sold (${sold.length})`}
              </button>
            ))}
          </div>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search device, design, SKU or order" className="max-w-xs" />
        </CardHeader>
        <CardContent>
          {!pieces ? <p className="text-sm text-muted-foreground">Loading…</p> : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">{view === "live" ? "Nothing on clearance yet — add stock above, or from an RTO order's page." : "Nothing sold yet."}</p>
          ) : (
            <ul className="divide-y">
              {groups.map((g) => {
                const f = g.first;
                const free = g.pieces.filter((p) => p.buyable).length;
                return (
                  <li key={g.key} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                    <div className="size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                      {f.productImage && <img src={f.productImage} alt="" className="size-full object-cover" loading="lazy" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{f.productTitle}{f.videoUrl && <span className="ml-1.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-800">▶ video</span>}</p>
                      <p className="text-xs text-muted-foreground">
                        {[device(f) ? `Cut for ${device(f)}` : "Gadget / accessory", f.variant && !/^default/i.test(f.variant) ? f.variant : "", f.coverage === "only_back" ? "Back only" : f.coverage === "full_body_wrap" ? "Full body" : "", f.lensModel ? `lens ${f.lensModel}` : "", f.sku || ""].filter(Boolean).join(" · ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {f.source === "manual" ? "Added by hand" : f.sourceOrderId ? <>From RTO <Link className="underline" to={`/backend-skinly/orders/${f.sourceOrderId}`}>{f.sourceOrderNumber || "order"}</Link></> : "From RTO"}
                        {f.note ? ` · ${f.note}` : ""}
                        {view === "sold" && g.pieces.map((p) => p.soldOrderId ? <span key={p.id}> · sold in <Link className="underline" to={`/backend-skinly/orders/${p.soldOrderId}`}>order</Link></span> : null)}
                      </p>
                    </div>
                    <div className="text-right">
                      {f.status === "draft" || !(f.price > 0) ? (
                        <p className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">Needs price — not live{f.originalPrice ? ` · MRP ₹${f.originalPrice}` : ""}</p>
                      ) : (
                        <p className="font-bold">₹{f.price}{f.originalPrice > f.price && <span className="ml-1 text-xs font-normal text-muted-foreground line-through">₹{f.originalPrice}</span>}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{view === "sold" ? `${g.pieces.length} sold` : `${free} on sale${g.pieces.length - free ? ` · ${g.pieces.length - free} held` : ""}`}</p>
                    </div>
                    {view === "live" && g.soldOut && (
                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">Sold out</span>
                        <Button type="button" size="sm" disabled={busy === g.key}
                          onClick={() => { const n = Number(window.prompt("How many pieces to put back on this card?", "1")); if (n > 0) void addMore(g, Math.min(200, Math.floor(n))); }}>
                          <PlusIcon className="mr-1 size-4" /> Restock
                        </Button>
                      </div>
                    )}
                    {view === "live" && !g.soldOut && (
                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                        <div className="flex items-center gap-1">
                          <Input inputMode="numeric" placeholder="New ₹" value={priceEdit[g.key] || ""} onChange={(e) => setPriceEdit({ ...priceEdit, [g.key]: e.target.value.replace(/\D/g, "") })} className="h-8 w-20" />
                          <Button type="button" size="sm" variant="outline" disabled={busy === g.key || !priceEdit[g.key]} onClick={() => setGroupPrice(g)}>Set price</Button>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button type="button" size="sm" variant="outline" disabled={busy === g.key} onClick={() => removeOne(g)} aria-label="Remove one piece"><MinusIcon className="size-4" /></Button>
                          <Button type="button" size="sm" variant="outline" disabled={busy === g.key} onClick={() => addMore(g, 1)} aria-label="Add one piece"><PlusIcon className="size-4" /></Button>
                        </div>
                        <Button type="button" size="sm" variant="outline" disabled={busy === g.key} onClick={() => setVideo(g)}>
                          <VideoIcon className="mr-1 size-4" /> {f.videoUrl ? "Video" : "Add video"}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="text-red-600" disabled={busy === g.key}
                          onClick={async () => { for (const p of g.pieces.filter((x) => x.status === "available" || x.status === "draft")) { await call("removeClearanceItem", { id: p.id }).catch(() => {}); } toast.success("Removed from clearance"); void load(); }}>
                          <TrashIcon className="size-4" />
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminClearancePage() {
  return (
    <AdminLayout>
      <Unauthenticated><div className="p-6"><SignInButton /></div></Unauthenticated>
      <AuthLoading><Skeleton className="h-64 w-full" /></AuthLoading>
      <Authenticated><AdminClearanceInner /></Authenticated>
    </AdminLayout>
  );
}
