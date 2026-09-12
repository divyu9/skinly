import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  PackageIcon,
  ShoppingCartIcon,
  ZapIcon,
  AlertTriangleIcon,
  StarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronRightIcon,
  TruckIcon,
  ShieldCheckIcon,
  LockIcon,
  InfoIcon,
  MessageCircleIcon,
  ScissorsIcon,
  SmartphoneIcon,
} from "lucide-react";

// Layout Components
import { MobileHeader } from "@/components/mobile-header.tsx";
import { MobileNav } from "@/components/mobile-nav.tsx";
import { AnnouncementBar } from "@/components/announcement-bar.tsx";

// Product Components
import {
  ProductImages,
  ModelSelectorDialog,
  RequestModelDialog,
  ReviewSection,
  ReviewDialog,
  DeliveryInfo,
  OffersSection,
  DeviceSelectorCard,
  CoverageSelector,
  VariantSelector,
  ProductUSPs,
  ProductSEOHead,
} from "@/components/product";

// Existing Components
import { ProductShareButton } from "./_components/product-share.tsx";
import { ProductUgcFloat } from "./_components/product-ugc-float.tsx";
import { CashbackLine, cashbackAmount } from "./_components/cashback-line.tsx";
import { useHeaderOffset } from "@/hooks/use-header-offset.ts";
import { StickyBottomBar } from "./_components/sticky-bottom-bar.tsx";
import { FormattedDescription } from "./_components/formatted-description.tsx";
import { StockNotification } from "./_components/stock-notification.tsx";

// Product Page Sections
import {
  ProductLandingSections,
  SuggestedProductsSection,
  TrendingProductsSection,
} from "@/components/products/sections";

// Hooks
import { useProductDetail } from "@/hooks/useProductDetail";
import { useCartActions } from "@/hooks/useCartActions";
import { useModelSelector } from "@/hooks/useModelSelector";
import { useProductReviews } from "@/hooks/useProductReviews";
import { useProductRules } from "@/hooks/useProductRules";

// Constants
const WHATSAPP_NUMBER = "919761011121";
const WHATSAPP_MESSAGE = "Hey Skinly Team , I have a query regarding my purchase";

export default function ProductDetailPage() {
  // Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const headerOffset = useHeaderOffset();
  
  // Main product data hook
  const {
    phoneModel,
    phoneBrand,
    productData,
    isLoading,
    displayImages,
    applicableCoupons,
    cashbackInfo,
    seoMeta,
    priceDisplay,
    productState,
    updateProductState,
    mockupState,
  } = useProductDetail();
  
  // Product rules
  const { needsDeviceSelector, isSkinProduct, isPhoneSkin } = useProductRules(productData);
  
  // Device category for model selector
  const deviceCategory = productData?.gadgetCategory || "phone";
  
  // Model selector hook
  const {
    selectorState,
    openSelector,
    closeSelector,
    selectBrand,
    setSearchQuery,
    goBackToBrands,
    handleModelSelect,
    modelsByBrand,
    filteredModels,
    requestState,
    openRequestForm,
    resetRequestForm,
    updateRequestForm,
    handleSubmitRequest,
    similarModels,
    allBrands,
  } = useModelSelector(deviceCategory);
  
  // Cart actions hook
  const {
    isAdding,
    isBuyingNow,
    handleAddToCart,
    handleBuyNow,
  } = useCartActions({
    product: productData,
    selectedVariant: productState.selectedVariant,
    displayImage: displayImages[0]?.url || "",
    phoneModel,
    phoneBrand,
    coverage: isPhoneSkin ? productState.selectedCoverage : undefined,
    requiresDeviceSelection: isSkinProduct && needsDeviceSelector,
  });
  
  // Reviews hook
  const {
    reviews,
    reviewStats,
    formState: reviewFormState,
    openReviewDialog,
    closeReviewDialog,
    updateForm: updateReviewForm,
    addImages,
    removeImage,
    addVideos,
    removeVideo,
    handleSubmitReview,
  } = useProductReviews(productData?._id || null);
  
  // Handler for image selection
  const handleImageSelect = useCallback((url: string) => {
    updateProductState({ selectedImage: url });
  }, [updateProductState]);
  
  // Handler for variant selection
  const handleVariantChange = useCallback((index: number) => {
    updateProductState({ selectedVariant: index });
  }, [updateProductState]);
  
  // Handler for coverage selection
  const handleCoverageChange = useCallback((coverage: "only_back" | "full_body_wrap") => {
    updateProductState({ selectedCoverage: coverage });
  }, [updateProductState]);
  
  // Handler for WhatsApp support
  const handleWhatsAppSupport = useCallback(() => {
    const message = encodeURIComponent(WHATSAPP_MESSAGE);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, "_blank", "noopener,noreferrer");
  }, []);
  
  // Handler for add to cart with validation
  const handleAddToCartClick = useCallback(() => {
    if (isSkinProduct && needsDeviceSelector && !phoneModel) {
      toast.error("Please select your device model first");
      return;
    }
    handleAddToCart();
  }, [isSkinProduct, needsDeviceSelector, phoneModel, handleAddToCart]);
  
  // Loading state
  if (isLoading) {
    return (
      <div className="halftone min-h-screen pb-20">
        <AnnouncementBar />
        <MobileHeader 
          onMenuClick={() => setIsMobileMenuOpen(true)}
          onRequestModelClick={openRequestForm}
        />
        <MobileNav open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen} />
        
        <div className="px-4" style={{ paddingTop: headerOffset + 12 }}>
          <div className="container mx-auto max-w-6xl">
            <Skeleton className="h-8 w-32 mb-8" />
            <div className="grid lg:grid-cols-2 gap-8">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <div className="space-y-4">
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Product not found
  if (!productData) {
    return (
      <div className="halftone min-h-screen pb-20">
        <AnnouncementBar />
        <MobileHeader 
          onMenuClick={() => setIsMobileMenuOpen(true)}
          onRequestModelClick={openRequestForm}
        />
        <MobileNav open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen} />
        
        <div className="px-4" style={{ paddingTop: headerOffset + 12 }}>
          <div className="container mx-auto max-w-2xl text-center space-y-6">
            <div className="flex justify-center">
              <div className="size-20 rounded-full bg-muted flex items-center justify-center">
                <AlertTriangleIcon className="size-10 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">Product Not Found</h1>
              <p className="text-muted-foreground text-lg">
                Sorry, the product you're looking for doesn't exist or may have been removed.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button asChild size="lg">
                <Link to="/products">
                  <PackageIcon className="size-4 mr-2" />
                  Browse All Products
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/">
                  <ArrowLeftIcon className="size-4 mr-2" />
                  Back to Home
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Derived values
  const productUrl = `https://goskinly.com/products/${productData.slug || 'detail'}`;
  const productImage = displayImages[0]?.url || productData.images?.[0]?.url || '';
  const productPrice = productData.variants?.[productState.selectedVariant]?.price || 0;
  const isInStock = productData.variants?.[productState.selectedVariant]?.inventoryQuantity > 0;
  const isButtonDisabled = isSkinProduct && needsDeviceSelector && !phoneModel;

  // Shown only when the variant genuinely carries a higher compareAtPrice.
  // 286 of 1,839 variants do; the rest show the price alone rather than an
  // invented "MRP", which is the dark pattern the CCPA guidance is aimed at.
  const selectedVariantData = productData.variants?.[productState.selectedVariant];
  const mrp = Number(selectedVariantData?.compareAtPrice) || 0;
  const nowPrice = Number(selectedVariantData?.price) || 0;
  const hasRealDiscount = mrp > nowPrice && nowPrice > 0;
  const discountPercent = hasRealDiscount ? Math.round(((mrp - nowPrice) / mrp) * 100) : 0;
  
  return (
    <div className="halftone min-h-screen pb-20">
      {/* SEO Head */}
      <ProductSEOHead
        seoMeta={seoMeta}
        productData={productData}
        productImage={productImage}
        productUrl={productUrl}
        productPrice={productPrice}
        variants={productData?.variants}
        reviews={reviews}
      />
      
      {/* Layout */}
      <AnnouncementBar />
      <MobileHeader 
        onMenuClick={() => setIsMobileMenuOpen(true)}
        onRequestModelClick={openRequestForm}
      />
      <MobileNav open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen} />

      {/* Product Detail Section */}
      {/* Padding measured off the header rather than guessed: `pt-[72px]`
          left the breadcrumb 20px behind it, since the announcement bar sits
          above the header and pushes its bottom edge to 92. */}
      <section className="relative px-4 pb-12" style={{ paddingTop: headerOffset + 12 }}>
        {/* Wash behind the artwork, in the sleeve's own three colours —
            teal, pink, yellow. It used to be violet, fuchsia and sky, which
            appear nowhere on the product, the packaging or the logo. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[560px] overflow-hidden">
          <div className="absolute -left-24 top-8 size-[380px] rounded-full bg-brand/25 blur-[100px]" />
          <div className="absolute right-0 top-0 size-[340px] rounded-full bg-blush/40 blur-[100px]" />
          <div className="absolute left-1/3 top-40 size-[320px] rounded-full bg-sunny/25 blur-[110px]" />
        </div>

        <div className="relative z-10 container mx-auto max-w-6xl">
          {/* A full-height ghost button on its own line cost ~48px and told the
              visitor nothing. A breadcrumb is shorter, orients them, and gives
              the crawler a path. */}
          <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground">
            <Link to="/" className="transition-colors hover:text-foreground">Home</Link>
            <ChevronRightIcon className="size-3.5 opacity-50" />
            <Link to="/products" className="transition-colors hover:text-foreground">Shop</Link>
            <ChevronRightIcon className="size-3.5 opacity-50" />
            <span className="truncate font-medium text-foreground">{productData.title}</span>
          </nav>

          {/* This used to be an amber warning telling the buyer the photo is not
              what they get — the first sentence on the page. Same fact, told as
              the reason the product is worth buying. */}
          {isSkinProduct && (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border-2 border-ink/15 bg-blush/30 p-3.5">
              <span className="sticker-sm inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground">
                <ScissorsIcon className="size-[18px]" strokeWidth={2.2} />
              </span>
              <p className="text-[13px] leading-snug sm:text-sm">
                <span className="font-semibold text-foreground">Cut to fit your exact model.</span>{" "}
                <span className="text-muted-foreground">
                  Pick your device and we print and cut this design for it — the photo shows the design, not your model.
                </span>
              </p>
            </div>
          )}

          {/* Main Grid */}
          <div className="grid md:grid-cols-[45%_1fr] lg:grid-cols-[450px_1fr] gap-6 md:gap-8 mb-12">
            {/* A plain white card made the artwork look like a stock photo.
                A soft tinted stage gives it depth without competing. */}
            <div className="rounded-3xl border-2 border-ink/15 bg-card p-1.5 md:sticky md:top-24 md:self-start">
            <ProductImages
              images={displayImages}
              selectedImage={productState.selectedImage}
              onImageSelect={handleImageSelect}
              productTitle={productData.title}
              phoneModel={phoneModel}
              mockupUrl={mockupState.url}
            />

            {/* Trust strip — the row every marketplace puts under the gallery */}
            <div className="grid grid-cols-3 gap-1 px-2 py-3">
              {[
                { icon: TruckIcon,       label: "Pan-India\ndelivery" },
                { icon: ShieldCheckIcon, label: "Free reprint\nguarantee" },
                { icon: LockIcon,        label: "Secure\npayments" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-1.5 text-center">
                  <Icon className="size-[18px] text-brand" strokeWidth={2.2} />
                  <span className="whitespace-pre-line text-[10px] font-medium leading-tight text-muted-foreground">
                    {label}
                  </span>
                </div>
              ))}
            </div>
            </div>

            {/* Product Info */}
            <div className="space-y-6">
              {/* Title, price, proof */}
              <div>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h1 className="flex-1 text-[26px] font-bold leading-[1.15] tracking-tight md:text-4xl">
                    {productData.title}
                  </h1>
                  <ProductShareButton
                    productTitle={productData.title}
                    productUrl={productUrl}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="text-3xl font-extrabold tracking-tight text-brand">
                    {priceDisplay}
                  </div>
                  {hasRealDiscount && (
                    <>
                      <span className="text-lg text-muted-foreground line-through">₹{mrp.toFixed(0)}</span>
                      <span className="rounded-full border-2 border-ink bg-sunny px-2.5 py-1 text-[11px] font-bold text-ink">
                        {discountPercent}% OFF
                      </span>
                    </>
                  )}
                  <span className="rounded-full bg-brand/12 px-2.5 py-1 text-[11px] font-semibold text-brand ring-1 ring-brand/30">
                    Inclusive of all taxes
                  </span>

                  {/* Only shown when reviews actually exist — no placeholder stars. */}
                  {reviewStats && reviewStats.totalReviews > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <StarIcon
                            key={i}
                            className={`size-4 ${
                              i < Math.round(reviewStats.averageRating)
                                ? "fill-amber-400 text-amber-400"
                                : "fill-muted text-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {reviewStats.averageRating} ({reviewStats.totalReviews})
                      </span>
                    </div>
                  )}
                </div>

                {/* Beside the price, because that is where the money decision
                    happens. It used to sit in the offers block, 665px below
                    the Buy button. */}
                <CashbackLine info={cashbackInfo} price={nowPrice} />
              </div>

              {/* USPs */}
              <ProductUSPs show={isSkinProduct} />

              {/* Description — the first lines carry the "matte finish / 3M vinyl"
                  detail that justifies the price, so it starts open. */}
              {productData.description && (
                <div className="rounded-2xl border-2 border-ink/15 bg-card p-4">
                  <div
                    className={
                      productState.showFullDescription
                        ? ""
                        : "relative max-h-[4.5rem] overflow-hidden after:absolute after:inset-x-0 after:bottom-0 after:h-8 after:bg-gradient-to-t after:from-card after:to-transparent"
                    }
                  >
                    <FormattedDescription description={productData.description} />
                  </div>
                  <button
                    onClick={() =>
                      updateProductState({ showFullDescription: !productState.showFullDescription })
                    }
                    className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline"
                  >
                    {productState.showFullDescription ? "Show less" : "Read more"}
                    {productState.showFullDescription ? (
                      <ChevronUpIcon className="size-4" />
                    ) : (
                      <ChevronDownIcon className="size-4" />
                    )}
                  </button>
                </div>
              )}

              {/* Device Model Selection */}
              {isSkinProduct && needsDeviceSelector && (
                <div className="space-y-4">
                  <DeviceSelectorCard
                    deviceCategory={deviceCategory}
                    phoneModel={phoneModel}
                    onSelectClick={openSelector}
                  />
                  
                  {/* Coverage Selection */}
                  {phoneModel && isPhoneSkin && (
                    <CoverageSelector
                      selectedCoverage={productState.selectedCoverage}
                      onCoverageChange={handleCoverageChange}
                    />
                  )}
                </div>
              )}
              
              {/* Variant Selection */}
              {productData.variants && productData.variants.length > 0 && (
                <VariantSelector
                  variants={productData.variants}
                  selectedVariant={productState.selectedVariant}
                  onVariantChange={handleVariantChange}
                />
              )}
              
              {/* A dead grey primary button was the last thing a visitor saw
                  before leaving. When no model is picked the CTA is live and
                  says what to do; it only becomes Buy Now once we can sell. */}
              {isInStock ? (
                isButtonDisabled ? (
                  <div className="space-y-2">
                    <Button
                      size="lg"
                      onClick={openSelector}
                      className="h-14 w-full rounded-2xl sticker sticker-press bg-brand text-base font-bold text-brand-foreground hover:bg-brand/90"
                    >
                      <SmartphoneIcon className="mr-2 size-5" />
                      Select your device
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      953 models supported — we cut this design for yours
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={handleAddToCartClick}
                      disabled={isAdding || isBuyingNow}
                      className="sticker sticker-press h-14 flex-1 rounded-2xl border-ink text-base font-bold"
                    >
                      <ShoppingCartIcon className="mr-2 size-5" />
                      {isAdding ? "Adding..." : "Add to Cart"}
                    </Button>
                    <Button
                      size="lg"
                      onClick={handleBuyNow}
                      disabled={isAdding || isBuyingNow}
                      className="h-14 flex-[1.3] rounded-2xl sticker sticker-press bg-brand text-base font-bold text-brand-foreground hover:bg-brand/90"
                    >
                      <ZapIcon className="mr-2 size-5" />
                      {isBuyingNow ? "Processing..." : "Buy Now"}
                    </Button>
                  </div>
                )
              ) : productData.variants && productData.variants.length > 0 ? (
                <StockNotification
                  variantId={productData.variants[productState.selectedVariant]?._id}
                  variantTitle={productData.variants[productState.selectedVariant]?.title}
                />
              ) : null}

              {/* Delivery Info */}
              <DeliveryInfo isSkinProduct={isSkinProduct} />
              
              {/* Offers Section */}
              <OffersSection
                coupons={applicableCoupons}
              />
              
              {/* Support — deliberately quiet so it doesn't compete with Buy Now */}
              <button
                onClick={handleWhatsAppSupport}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-card py-3 text-[13px] font-medium text-muted-foreground ring-1 ring-border/70 transition-colors hover:text-foreground"
              >
                <MessageCircleIcon className="size-4 text-[#25D366]" />
                Questions? Chat with us on WhatsApp
              </button>
            </div>
          </div>

          {/* Apple-like Landing Sections */}
          <ProductLandingSections productId={productData._id} />

          {/* Suggested Products Section */}
          <SuggestedProductsSection productId={productData._id} />

          {/* Trending Products Section */}
          <TrendingProductsSection productId={productData._id} />

          {/* Reviews Section */}
          <ReviewSection
            reviews={reviews}
            reviewStats={reviewStats}
            onPostReview={openReviewDialog}
          />
        </div>
      </section>
      
      {/* Customer clips for this product, in the corner next to Buy Now. */}
      <ProductUgcFloat productId={productData._id} stickyBarVisible={productState.showStickyBar} />

      {/* Model Selector Dialog */}
      <ModelSelectorDialog
        open={selectorState.dialogOpen}
        onOpenChange={(open) => !open && closeSelector()}
        selectedBrand={selectorState.selectedBrand}
        searchQuery={selectorState.searchQuery}
        modelsByBrand={modelsByBrand}
        filteredModels={filteredModels}
        onBrandSelect={selectBrand}
        onSearchChange={setSearchQuery}
        onModelSelect={handleModelSelect}
        onBackToBrands={goBackToBrands}
        onRequestModel={() => {
          closeSelector();
          openRequestForm();
        }}
      />

      {/* Review Dialog */}
      <ReviewDialog
        open={reviewFormState.dialogOpen}
        onOpenChange={(open) => !open && closeReviewDialog()}
        formState={reviewFormState}
        onUpdateForm={updateReviewForm}
        onAddImages={addImages}
        onRemoveImage={removeImage}
        onAddVideos={addVideos}
        onRemoveVideo={removeVideo}
        onSubmit={handleSubmitReview}
        onClose={closeReviewDialog}
      />
      
      {/* Request Model Dialog */}
      <RequestModelDialog
        open={requestState.dialogOpen}
        onOpenChange={(open) => !open && resetRequestForm()}
        allBrands={allBrands}
        formState={requestState}
        similarModels={similarModels}
        onUpdateForm={updateRequestForm}
        onSubmit={handleSubmitRequest}
        onClose={resetRequestForm}
      />

      {/* Sticky Bottom Bar */}
      <StickyBottomBar
        price={priceDisplay}
        onBuyNow={handleBuyNow}
        onSelectDevice={openSelector}
        needsDevice={isButtonDisabled}
        isLoading={isBuyingNow}
        show={productState.showStickyBar}
        coinsBack={cashbackAmount(cashbackInfo, nowPrice)}
      />
    </div>
  );
}
