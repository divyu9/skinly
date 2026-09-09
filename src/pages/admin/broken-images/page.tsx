import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useQuery, useMutation, useAction } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import {
  ImageOffIcon,
  UploadIcon,
  ExternalLinkIcon,
  EditIcon,
  SearchIcon,
  CheckCircle2Icon,
  RefreshCwIcon,
  ImagesIcon,
} from "lucide-react";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/firebase-hooks";
import { SignInButton } from "@/components/ui/signin.tsx";
import { MediaPickerDialog } from "../products/_components/media-picker-dialog.tsx";
import { isDeadImageUrl } from "@/lib/image-fallback.ts";

const PAGE_SIZE = 40;

/**
 * Every product whose photos 404, with the details needed to replace them.
 *
 * The old Cloudinary account was deleted and took 2,531 image URLs with it, so
 * roughly two thirds of the catalogue renders a placeholder on the storefront.
 * Finding those products meant opening them one at a time; this lists them,
 * carries the SKU and category so the right photo can be matched, and uploads
 * the replacement straight onto the product.
 */
export default function AdminBrokenImagesPage() {
  return (
    <AdminLayout>
      <AuthLoading>
        <div className="space-y-4">
          <Skeleton className="h-9 w-64" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="space-y-4 text-center">
            <h2 className="text-xl font-semibold">Sign in required</h2>
            <p className="text-muted-foreground">Please sign in to manage product images.</p>
            <SignInButton />
          </div>
        </div>
      </Unauthenticated>
      <Authenticated>
        <BrokenImagesContent />
      </Authenticated>
    </AdminLayout>
  );
}

function BrokenImagesContent() {
  const products = useQuery(api.products.getAllProductsBasic, { sortBy: "title_asc" });
  const gadgetTypes = useQuery(api.gadgetTypes.list, {});
  const updateProduct = useMutation(api.products.updateProduct);
  const uploadToR2 = useAction(api.r2.uploadToR2);

  const [search, setSearch] = useState("");
  const [gadgetFilter, setGadgetFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [fixed, setFixed] = useState<Set<string>>(new Set());
  const [pickerFor, setPickerFor] = useState<any | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const gadgetNameById = useMemo(
    () => new Map<string, string>((gadgetTypes || []).map((g: any) => [g._id, g.displayName || g.name])),
    [gadgetTypes]
  );

  const broken = useMemo(() => {
    if (!products) return [];
    return products
      .map((p: any) => {
        const images = Array.isArray(p.images) ? p.images : [];
        const dead = images.filter((i: any) => isDeadImageUrl(i?.url));
        return { ...p, images, dead, allDead: images.length > 0 && dead.length === images.length };
      })
      .filter((p: any) => p.dead.length > 0 && !fixed.has(p._id));
  }, [products, fixed]);

  const filtered = useMemo(() => {
    let rows = broken;
    if (gadgetFilter !== "all") {
      rows = rows.filter((p: any) => gadgetNameById.get(p.gadgetTypeId) === gadgetFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (p: any) =>
          p.title?.toLowerCase().includes(q) ||
          p.slug?.toLowerCase().includes(q) ||
          (p.variantSkus || []).some((s: string) => s?.toLowerCase().includes(q))
      );
    }
    return rows;
  }, [broken, gadgetFilter, search, gadgetNameById]);

  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const gadgetOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of broken) {
      const n = gadgetNameById.get((p as any).gadgetTypeId);
      if (n) counts.set(n, (counts.get(n) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [broken, gadgetNameById]);

  /** Replaces every dead URL on the product, keeping any live ones. */
  const applyImages = async (product: any, newImages: { url: string; alt?: string }[]) => {
    const kept = product.images.filter((i: any) => !isDeadImageUrl(i?.url));
    await updateProduct({ productId: product._id, images: [...newImages, ...kept] });
    setFixed((prev) => new Set(prev).add(product._id));
    toast.success(`Updated ${product.title}`);
  };

  const handleUpload = async (product: any, files: FileList | null) => {
    if (!files?.length) return;
    setBusyId(product._id);
    try {
      const uploaded: { url: string; alt?: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image`);
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is over 10MB`);
          continue;
        }
        const base64: string = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result).split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        const slug = String(product.slug || product._id).toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 40);
        const ext = file.name.split(".").pop()?.toLowerCase() || "webp";
        const result = await uploadToR2({
          fileBase64: base64,
          key: `products/${slug}/img_${i}_${Date.now()}.${ext}`,
          contentType: file.type || "image/webp",
        });
        if (!result?.success) throw new Error(result?.error || "Upload failed");
        uploaded.push({ url: result.url || result.publicUrl, alt: product.title });
      }
      if (uploaded.length) await applyImages(product, uploaded);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusyId(null);
    }
  };

  if (products === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const totalDeadUrls = broken.reduce((n: number, p: any) => n + p.dead.length, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Broken images</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Products whose photos no longer load. Upload a replacement and it goes live immediately.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Stat label="Products" value={broken.length} tone="rose" />
          <Stat label="Dead URLs" value={totalDeadUrls} tone="amber" />
          <Stat label="Fixed today" value={fixed.size} tone="emerald" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search title, slug or SKU"
            className="h-9 pl-9"
          />
        </div>
        <Select
          value={gadgetFilter}
          onValueChange={(v) => {
            setGadgetFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="h-9 w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories ({broken.length})</SelectItem>
            {gadgetOptions.map(([name, n]) => (
              <SelectItem key={name} value={name}>
                {name} ({n})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {filtered.length.toLocaleString()} shown
        </p>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <CheckCircle2Icon className="size-10 text-emerald-500" />
            <p className="font-medium">Nothing broken here</p>
            <p className="text-sm text-muted-foreground">
              {broken.length === 0 ? "Every product image loads." : "No products match this filter."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {pageRows.map((p: any) => {
            const sku = (p.variantSkus || [])[0];
            const gadget = gadgetNameById.get(p.gadgetTypeId);
            const busy = busyId === p._id;
            return (
              <Card key={p._id} className="overflow-hidden">
                <CardContent className="flex flex-wrap items-center gap-4 p-3">
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-muted to-muted/40 ring-1 ring-border">
                    <ImageOffIcon className="size-6 text-muted-foreground/50" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/backend-skinly/products/${p._id}`}
                      className="block truncate font-medium hover:text-primary hover:underline"
                    >
                      {p.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {sku && <Badge variant="outline" className="font-mono text-[11px]">{sku}</Badge>}
                      {gadget && <Badge variant="secondary" className="text-[11px]">{gadget}</Badge>}
                      {p.finishType && <Badge variant="outline" className="text-[11px]">{p.finishType}</Badge>}
                      <span>
                        {p.dead.length} of {p.images.length} image{p.images.length === 1 ? "" : "s"} dead
                      </span>
                      {!p.allDead && (
                        <Badge className="bg-amber-500/15 text-[11px] text-amber-700 dark:text-amber-300">
                          partial
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <input
                      ref={(el) => { fileInputs.current[p._id] = el; }}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        handleUpload(p, e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <Button size="sm" disabled={busy} onClick={() => fileInputs.current[p._id]?.click()}>
                      {busy ? (
                        <RefreshCwIcon className="mr-1.5 size-3.5 animate-spin" />
                      ) : (
                        <UploadIcon className="mr-1.5 size-3.5" />
                      )}
                      {busy ? "Uploading" : "Upload"}
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => setPickerFor(p)}>
                      <ImagesIcon className="mr-1.5 size-3.5" />
                      Library
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/backend-skinly/products/${p._id}`} title="Edit product">
                        <EditIcon className="size-3.5" />
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`https://goskinly.com/${p.slug}`, "_blank")}
                      title="View on the live site"
                    >
                      <ExternalLinkIcon className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {pickerFor && (
        <MediaPickerDialog
          open={!!pickerFor}
          onOpenChange={(o: boolean) => !o && setPickerFor(null)}
          onSelect={async (images: { url: string; alt?: string }[]) => {
            const target = pickerFor;
            setPickerFor(null);
            if (target && images?.length) {
              setBusyId(target._id);
              try {
                await applyImages(target, images);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not update the product");
              } finally {
                setBusyId(null);
              }
            }
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "rose" | "amber" | "emerald" }) {
  const tones = {
    rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
  } as const;
  return (
    <div className={`rounded-xl border px-3 py-2 text-center ${tones[tone]}`}>
      <div className="text-base font-semibold tabular-nums">{value.toLocaleString()}</div>
      <div className="text-[11px] uppercase tracking-wide opacity-70">{label}</div>
    </div>
  );
}
