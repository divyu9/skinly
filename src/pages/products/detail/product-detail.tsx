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
  InfoIcon,
  MessageCircleIcon,
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
const WHATSAPP_NUMBER = "917505273504";
const WHATSAPP_MESSAGE = "Hey Skinly Team , I have a query regarding my purchase";

export default function ProductDetailPage() {
  // Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
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
      <div className="min-h-screen bg-background pb-20">
        <AnnouncementBar />
        <MobileHeader 
          onMenuClick={() => setIsMobileMenuOpen(true)}
          onRequestModelClick={openRequestForm}
        />
        <MobileNav open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen} />
        
        <div className="pt-28 px-4">
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
      <div className="min-h-screen bg-background pb-20">
        <AnnouncementBar />
        <MobileHeader 
          onMenuClick={() => setIsMobileMenuOpen(true)}
          onRequestModelClick={openRequestForm}
        />
        <MobileNav open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen} />
        
        <div className="pt-28 px-4">
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
  
  return (
    <div className="min-h-screen bg-background pb-20">
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
      <section className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Back Button */}
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link to="/products">
              <ArrowLeftIcon className="size-4 mr-2" />
              Back
            </Link>
          </Button>

          {/* Reference Message Banner */}
          {isSkinProduct && (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <div className="flex items-start gap-2 text-sm">
                <InfoIcon className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="text-foreground">
                  Model images are for reference only - You will receive the skin for your selected model
                </span>
              </div>
            </div>
          )}

          {/* Main Grid */}
          <div className="grid md:grid-cols-[45%_1fr] lg:grid-cols-[450px_1fr] gap-6 md:gap-8 mb-12">
            {/* Image Gallery */}
            <ProductImages
              images={displayImages}
              selectedImage={productState.selectedImage}
              onImageSelect={handleImageSelect}
              productTitle={productData.title}
              phoneModel={phoneModel}
              mockupUrl={mockupState.url}
            />

            {/* Product Info */}
            <div className="space-y-6">
              {/* Title and Share */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold flex-1">
                    {productData.title}
                  </h1>
                  <ProductShareButton
                    productTitle={productData.title}
                    productUrl={productUrl}
                  />
                </div>
                
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-2xl font-bold text-primary">{priceDisplay}</div>
                  {reviewStats && reviewStats.totalReviews > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <StarIcon
                            key={i}
                            className={`size-4 ${
                              i < Math.round(reviewStats.averageRating)
                                ? "fill-yellow-400 text-yellow-400"
                                : "fill-muted text-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {reviewStats.averageRating} ({reviewStats.totalReviews} reviews)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* USPs */}
              <ProductUSPs show={isSkinProduct} />

              {/* Description */}
              {productData.description && (
                <div className="border border-border rounded-lg p-4">
                  <button
                    onClick={() => updateProductState({ 
                      showFullDescription: !productState.showFullDescription 
                    })}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <h3 className="font-semibold text-sm">Product Description</h3>
                    {productState.showFullDescription ? (
                      <ChevronUpIcon className="size-4" />
                    ) : (
                      <ChevronDownIcon className="size-4" />
                    )}
                  </button>
                  {productState.showFullDescription && (
                    <div className="mt-3">
                      <FormattedDescription description={productData.description} />
                    </div>
                  )}
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
              
              {/* Add to Cart / Buy Now Buttons */}
              {isInStock ? (
                <div className="flex gap-3">
                  <Button
                    className="flex-1 !border-2 !border-foreground"
                    size="lg"
                    variant="outline"
                    onClick={handleAddToCartClick}
                    disabled={isAdding || isBuyingNow || isButtonDisabled}
                  >
                    <ShoppingCartIcon className="size-5 mr-2" />
                    {isAdding ? "Adding..." : "Add to Cart"}
                  </Button>
                  <Button
                    className="flex-1 animate-shake border-2 border-primary"
                    size="lg"
                    onClick={handleBuyNow}
                    disabled={isAdding || isBuyingNow || isButtonDisabled}
                  >
                    <ZapIcon className="size-5 mr-2" />
                    {isBuyingNow ? "Processing..." : "Buy Now"}
                  </Button>
                </div>
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
                cashbackInfo={cashbackInfo}
              />
              
              {/* WhatsApp Support Button */}
              <Button
                variant="outline"
                className="w-full !border-2 !border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10"
                size="lg"
                onClick={handleWhatsAppSupport}
              >
                <MessageCircleIcon className="size-5 mr-2" />
                WhatsApp Support
              </Button>
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
        disabled={isButtonDisabled}
        isLoading={isBuyingNow}
        show={productState.showStickyBar}
      />
    </div>
  );
}
