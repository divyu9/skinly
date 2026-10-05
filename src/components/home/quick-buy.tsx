import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingCartIcon, SmartphoneIcon, ZapIcon, ArrowRightIcon, PencilIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog.tsx";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { ModelSelectorDialog } from "@/components/product/ModelSelectorDialog";
import { RequestModelDialog } from "@/components/product/RequestModelDialog";
import { CoverageSelector } from "@/components/product/CoverageSelector";
import { VariantSelector } from "@/components/product/VariantSelector";
import { SmartSetup, type SetupCartItem } from "@/pages/products/detail/_components/smart-setup.tsx";
import { CashbackLine } from "@/pages/products/detail/_components/cashback-line.tsx";
import { useIsMobile } from "@/hooks/use-mobile.ts";
import { useCartActions } from "@/hooks/useCartActions";
import { useModelSelector } from "@/hooks/useModelSelector";
import { useProductRules } from "@/hooks/useProductRules";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { readActiveDevice, writeActiveDevice } from "@/lib/active-device";
import { brandInScope } from "@/lib/device-fit";
import { responsiveImg } from "@/lib/image-cdn";
import { trackProductView } from "@/lib/analytics.ts";

/**
 * Buy from a homepage card without opening the product page: pick the
 * device, coverage and finish, see the add-ons that fit it ("Complete your
 * setup", with the free gift) and the cashback, then Add to cart or Buy now.
 * A bottom sheet on phones, a dialog on wider screens. Same hooks as the
 * product page (useModelSelector, useCartActions, SmartSetup), so the cart
 * line and the upsell pricing are exactly what that page would add.
 */

const DEVICE_WORD = /\b(iphone|ipad|galaxy|samsung|pixel|oneplus|one plus|redmi|xiaomi|poco|vivo|oppo|realme|iqoo|motorola|moto|nothing|cmf)\b/i;
const stockOf = (v: any) => Number(v?.inventoryQuantity ?? v?.inventory_quantity ?? 0);

function QuickBuyBody({ slug, onDone }: { slug: string; onDone: () => void }) {
  const product = useQuery(api.products.getProductBySlug, { slug }) as any;
  const gadgetTypes = useQuery(api.gadgetTypes.list, {}) as Array<{ _id: string; name?: string }> | undefined;
  const cashbackInfo = useQuery(api.cashbackHelpers.getProductCashbackInfo, product?._id ? { productId: product._id } : "skip");

  // The same fallback as the product page: 160 older skins carry only gadgetTypeId.
  const deviceCategory = useMemo(() => {
    const own = String(product?.gadgetCategory || "").trim();
    if (own) return own;
    const id = String(product?.gadgetTypeId || "").trim();
    return String((id && (gadgetTypes || []).find((g) => g._id === id)?.name) || "").trim() || "phone";
  }, [product?.gadgetCategory, product?.gadgetTypeId, gadgetTypes]);
  const forRules = useMemo(() => (product ? { ...product, gadgetCategory: deviceCategory } : product), [product, deviceCategory]);
  const { needsDeviceSelector, isSkinProduct, isPhoneSkin } = useProductRules(forRules);

  // Start on the shopper's saved device when this skin fits it.
  const [device, setDevice] = useState<{ brand: string; model: string } | null>(null);
  useEffect(() => {
    if (!product || product.productCategory !== "skin") return;
    const d = readActiveDevice();
    if (d && d.isConfirmed !== false && (d.category || "phone") === deviceCategory && brandInScope(product, d.brand)) {
      setDevice((cur) => cur || { brand: d.brand, model: d.model });
    }
  }, [product?._id, deviceCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSelect = useCallback((model: string, brand: string) => {
    setDevice({ brand, model });
    writeActiveDevice(brand, model, deviceCategory);
  }, [deviceCategory]);

  const selector = useModelSelector(deviceCategory, {
    modelBrands: product?.modelBrands, modelBrandsExclude: product?.modelBrandsExclude,
  }, {
    slug: product?.slug, title: product?.title, listingKind: product?.listingKind,
    designImageUrl: product?.designImageUrl, gadgetCategory: product?.gadgetCategory,
  }, { onSelect });

  // Open on a variant that can be bought, as the product page does.
  const [variant, setVariant] = useState(0);
  const [coverage, setCoverage] = useState<"only_back" | "full_body_wrap">("full_body_wrap");
  useEffect(() => {
    const vs = product?.variants;
    if (!Array.isArray(vs) || !vs.length) return;
    let i = vs.findIndex((v: any) => Number(v.price) > 0 && stockOf(v) > 0);
    if (i === -1) i = vs.findIndex((v: any) => Number(v.price) > 0);
    setVariant(Math.max(0, i));
    trackProductView(product._id, product.title, Number(vs[Math.max(0, i)]?.price) || 0);
  }, [product?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isTranzy = /tranzy/i.test(String(product?.title || "")) || String(product?.finishType || "").toLowerCase() === "transparent";
  const [extras, setExtras] = useState<SetupCartItem[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const needsDevice = isSkinProduct && needsDeviceSelector;

  const { isAdding, isBuyingNow, handleAddToCart, handleBuyNow } = useCartActions({
    product,
    selectedVariant: variant,
    displayImage: product?.images?.[0]?.url || "",
    phoneModel: device?.model,
    phoneBrand: device?.brand,
    coverage: isPhoneSkin ? (isTranzy ? "only_back" : coverage) : undefined,
    requiresDeviceSelection: needsDevice,
    extras,
    onAdded: () => setResetKey((n) => n + 1),
  });

  if (product === undefined) {
    return (
      <div className="space-y-3 p-1">
        <div className="flex gap-3"><Skeleton className="size-20 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-6 w-20" /></div></div>
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
    );
  }
  if (!product) {
    return <p className="p-4 text-center text-sm text-muted-foreground">This product is no longer available.</p>;
  }

  const v = product.variants?.[variant];
  const price = Number(v?.price) || 0;
  const mrp = Number(v?.compareAtPrice) || 0;
  const off = mrp > price && price > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const inStock = stockOf(v) > 0;
  const variantLabel = isSkinProduct
    ? "Select Finish"
    : (product.variants ?? []).some((x: any) => DEVICE_WORD.test(String(x?.title ?? ""))) ? "Select Your Model" : "Select Option";
  const fullHref = device && isSkinProduct
    ? `/products/${product.slug}?${new URLSearchParams({ brand: device.brand, model: device.model })}`
    : `/products/${product.slug}`;
  const busy = isAdding || isBuyingNow;

  return (
    <div className="space-y-4">
      {/* What it is */}
      <div className="flex gap-3">
        {product.images?.[0]?.url && (
          <img {...responsiveImg(product.images[0].url, [160, 240], "96px")} alt={product.title} width={96} height={96}
            className="size-24 shrink-0 rounded-xl border-2 border-ink/15 object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-[15px] font-bold leading-snug">{product.title}</h2>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-xl font-extrabold text-brand">₹{price.toLocaleString("en-IN")}</span>
            {off > 0 && (
              <>
                <span className="text-sm text-muted-foreground line-through">₹{mrp.toLocaleString("en-IN")}</span>
                <span className="rounded-full border-2 border-ink bg-sunny px-1.5 py-0.5 text-[10px] font-extrabold text-ink">{off}% OFF</span>
              </>
            )}
          </div>
          <Link to={fullHref} onClick={onDone} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
            View full details <ArrowRightIcon className="size-3" />
          </Link>
        </div>
      </div>

      <CashbackLine info={cashbackInfo as any} price={price} />

      {/* Device */}
      {needsDevice && (
        device ? (
          <button type="button" onClick={selector.openSelector}
            className="flex w-full items-center gap-3 rounded-2xl border-2 border-ink/15 bg-card p-3 text-left hover:border-ink">
            <SmartphoneIcon className="size-5 shrink-0 text-brand" />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] text-muted-foreground">Cutting for</span>
              <span className="block truncate text-sm font-bold">{device.brand} {device.model}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand"><PencilIcon className="size-3" /> Change</span>
          </button>
        ) : (
          <Button size="lg" onClick={selector.openSelector}
            className="sticker sticker-press h-12 w-full rounded-2xl bg-brand text-base font-bold text-brand-foreground hover:bg-brand/90">
            <SmartphoneIcon className="mr-2 size-5" /> Select your device
          </Button>
        )
      )}

      {needsDevice && device && isPhoneSkin && (isTranzy ? (
        <p className="rounded-xl border-2 border-ink/10 bg-card px-3 py-2 text-xs text-muted-foreground">
          <b className="text-foreground">Coverage: Only Back.</b> Tranzy skins are clear, so they are cut for the back panel.
        </p>
      ) : (
        <CoverageSelector selectedCoverage={coverage} onCoverageChange={setCoverage} />
      ))}

      {product.variants?.length > 1 && (
        <VariantSelector variants={product.variants} selectedVariant={variant} onVariantChange={setVariant} label={variantLabel} />
      )}

      {/* Add-ons that fit the device, and the free gift — as on the product page. */}
      {inStock && isSkinProduct && device && (
        <SmartSetup
          productId={product._id}
          device={{ brand: device.brand, model: device.model, category: deviceCategory }}
          onChange={setExtras}
          resetKey={resetKey}
        />
      )}

      {!inStock ? (
        <Button asChild size="lg" variant="outline" className="h-12 w-full rounded-2xl border-ink font-bold">
          <Link to={fullHref} onClick={onDone}>Out of stock — get notified</Link>
        </Button>
      ) : needsDevice && !device ? null : (
        <div className="flex gap-2.5">
          <Button variant="outline" size="lg" disabled={busy}
            onClick={async () => { await handleAddToCart(); onDone(); }}
            className="sticker sticker-press h-12 flex-1 rounded-2xl border-ink text-[15px] font-bold">
            <ShoppingCartIcon className="mr-1.5 size-5" />
            {isAdding ? "Adding..." : extras.length ? `Add ${extras.length + 1}` : "Add to Cart"}
          </Button>
          <Button size="lg" disabled={busy} onClick={handleBuyNow}
            className="sticker sticker-press h-12 flex-[1.3] rounded-2xl bg-brand text-[15px] font-bold text-brand-foreground hover:bg-brand/90">
            <ZapIcon className="mr-1.5 size-5" />
            {isBuyingNow ? "Processing..." : "Buy Now"}
          </Button>
        </div>
      )}

      <ModelSelectorDialog
        open={selector.selectorState.dialogOpen}
        onOpenChange={(o: boolean) => !o && selector.closeSelector()}
        selectedBrand={selector.selectorState.selectedBrand}
        searchQuery={selector.selectorState.searchQuery}
        modelsByBrand={selector.modelsByBrand}
        filteredModels={selector.filteredModels}
        sameBodyModels={selector.sameBodyModels}
        deviceCategory={deviceCategory}
        onBrandSelect={selector.selectBrand}
        onSearchChange={selector.setSearchQuery}
        onModelSelect={selector.handleModelSelect}
        onBackToBrands={selector.goBackToBrands}
        onRequestModel={() => { selector.closeSelector(); selector.openRequestForm(); }}
      />
      <RequestModelDialog
        open={selector.requestState.dialogOpen}
        onOpenChange={(o: boolean) => !o && selector.resetRequestForm()}
        allBrands={selector.allBrands}
        formState={selector.requestState}
        similarModels={selector.similarModels}
        onUpdateForm={selector.updateRequestForm}
        onSubmit={selector.handleSubmitRequest}
        onClose={selector.resetRequestForm}
      />
    </div>
  );
}

export default function QuickBuy({ slug, title, open, onOpenChange }: { slug: string; title: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const mobile = useIsMobile();
  const done = () => onOpenChange(false);
  if (mobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t-2 border-ink px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-5">
          <SheetTitle className="sr-only">Buy {title}</SheetTitle>
          <SheetDescription className="sr-only">Choose your device and add to cart</SheetDescription>
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" aria-hidden />
          {open && <QuickBuyBody slug={slug} onDone={done} />}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-md overflow-y-auto rounded-3xl border-2 border-ink">
        <DialogTitle className="sr-only">Buy {title}</DialogTitle>
        <DialogDescription className="sr-only">Choose your device and add to cart</DialogDescription>
        {open && <QuickBuyBody slug={slug} onDone={done} />}
      </DialogContent>
    </Dialog>
  );
}
