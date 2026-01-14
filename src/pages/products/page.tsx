import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { trackSearch, trackCollectionView } from "@/lib/analytics.ts";

// Layout Components
import { MobileHeader } from "@/components/mobile-header.tsx";
import { MobileNav } from "@/components/mobile-nav.tsx";
import { AnnouncementBar } from "@/components/announcement-bar.tsx";
import { ProductCategoryHeader } from "@/components/product-category-header.tsx";
import { GadgetSelectorBanner } from "@/components/gadget-selector-banner.tsx";
import { DeviceSelectorDialog } from "@/pages/_components/device-selector-dialog.tsx";

// Local Components
import {
  ProductGrid,
  PaginationControls,
  FilterBar,
  CollectionPills,
  DeviceSelectionCTA,
  PageHeader,
  EmptyState,
  ModelRequestDialog,
  ProductsSEOHead,
} from "@/components/products";

// Hooks
import { useProductFilters } from "@/hooks/useProductFilters";
import { useProductsData } from "@/hooks/useProductsData";

export default function ProductsPage() {
  // ============================================
  // STATE & DIALOGS
  // ============================================
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isModelRequestOpen, setIsModelRequestOpen] = useState(false);
  const [isDeviceSelectorOpen, setIsDeviceSelectorOpen] = useState(false);
  const [lastTrackedSearch, setLastTrackedSearch] = useState("");
  
  // ============================================
  // LAYOUT CALCULATIONS
  // ============================================
  const homepageSettings = useQuery(api.homepage.getHomepageSettings);
  const showAnnouncement = homepageSettings?.announcementEnabled ?? false;
  const announcementHeight = showAnnouncement ? 28 : 0;
  const headerHeight = 64;
  const categoryHeaderTop = announcementHeight + headerHeight;
  
  // ============================================
  // FILTER MANAGEMENT
  // ============================================
  const {
    filters,
    urlParams,
    updateFilters,
    updateSortAndStock,
    updateURL,
    clearAllFilters,
    applySmartFilters,
    hasActiveFilters,
  } = useProductFilters();
  
  // ============================================
  // DATA FETCHING SETUP
  // ============================================
  
  // Get filter reference data
  const finishTypes = useQuery(api.finishTypes.listAllActive, {});
  const gadgetTypes = useQuery(api.gadgetTypes.listAllActive, {});
  
  // Get model info for smart filtering
  const modelInfo = useQuery(
    api.supportedModels.getModelInfo,
    urlParams.brand && urlParams.model
      ? { brand: urlParams.brand, model: urlParams.model }
      : "skip"
  );
  
  // Get gadget type from model category
  const modelGadgetType = useQuery(
    api.gadgetTypes.getByCategory,
    modelInfo?.category ? { category: modelInfo.category } : "skip"
  );
  
  // Find filter IDs
  const gadgetTypeId = useMemo(() => {
    return gadgetTypes?.find(gt => gt.name === filters.gadgetFilter)?._id;
  }, [gadgetTypes, filters.gadgetFilter]);
  
  const finishTypeId = useMemo(() => {
    return finishTypes?.find(ft => ft.name === filters.finishFilter)?._id;
  }, [finishTypes, filters.finishFilter]);
  
  // Get collections
  const phoneCollections = useQuery(
    api.collections.getCollectionsByCategory,
    urlParams.brand && urlParams.model ? { category: "phone" } : "skip"
  );
  const allCollectionsGeneral = useQuery(
    api.collections.getAllCollections,
    !urlParams.brand || !urlParams.model ? {} : "skip"
  );
  const allCollections = urlParams.brand && urlParams.model 
    ? phoneCollections 
    : allCollectionsGeneral;
  
  // ============================================
  // PRODUCTS DATA
  // ============================================
  const {
    products,
    allProductsCount,
    isInitialLoading,
    isLoadingMore,
    canLoadMore,
    isExhausted,
    handleLoadMore,
    handleLoadMoreCollection,
    hasMoreCollectionProducts,
    observerTarget,
    collection,
    autoSortOOS,
    isMockupsLoading,
    updateViewport,
  } = useProductsData({
    filters,
    urlParams,
    gadgetTypeId,
    finishTypeId,
    modelCategory: modelInfo?.category,
  });
  
  // ============================================
  // SMART FILTERS
  // ============================================
  useEffect(() => {
    if (modelGadgetType?.name) {
      applySmartFilters(modelGadgetType.name);
    }
  }, [modelGadgetType?.name, applySmartFilters]);
  
  // ============================================
  // ANALYTICS
  // ============================================
  useEffect(() => {
    if (filters.searchQuery.trim() && filters.searchQuery !== lastTrackedSearch) {
      trackSearch(filters.searchQuery, products.length);
      setLastTrackedSearch(filters.searchQuery);
    }
  }, [filters.searchQuery, products.length, lastTrackedSearch]);
  
  useEffect(() => {
    if (filters.collectionParam && collection) {
      trackCollectionView(collection.name, products.length);
    }
  }, [filters.collectionParam, collection, products.length]);
  
  // ============================================
  // HANDLERS
  // ============================================
  const handleCollectionChange = useCallback((collectionName: string | null) => {
    updateFilters({ collectionParam: collectionName || "" });
  }, [updateFilters]);
  
  const handleFilterUpdate = useCallback((updates: {
    productType?: string | null;
    gadget?: string | null;
    finish?: string | null;
  }) => {
    updateFilters({
      productCategory: updates.productType as any,
      gadgetFilter: updates.gadget,
      finishFilter: updates.finish,
    });
  }, [updateFilters]);
  
  // ============================================
  // LOADING MESSAGE
  // ============================================
  const loadingMessage = useMemo(() => {
    if (filters.productCategory && filters.gadgetFilter && filters.finishFilter) {
      return `Loading ${filters.finishFilter} ${filters.gadgetFilter} skins...`;
    }
    if (filters.productCategory && filters.gadgetFilter) {
      return `Loading ${filters.gadgetFilter} products...`;
    }
    if (filters.productCategory) {
      return `Loading ${filters.productCategory} products...`;
    }
    return "Loading products...";
  }, [filters.productCategory, filters.gadgetFilter, filters.finishFilter]);
  
  // ============================================
  // RENDER CONDITIONS
  // ============================================
  const showDeviceCTA = filters.productCategory === 'skin' && 
    filters.gadgetFilter && 
    !urlParams.brand && 
    !urlParams.model;
  
  const showGadgetBanner = filters.productCategory === 'skin' && 
    urlParams.brand && 
    urlParams.model;
  
  const showCollectionPills = filters.productCategory === 'skin' && 
    filters.gadgetFilter === 'phone' && 
    allCollections && 
    allCollections.length > 0 && 
    urlParams.brand && 
    urlParams.model;
  
  // ============================================
  // EMPTY STATE
  // ============================================
  if (products.length === 0 && isExhausted) {
    return (
      <EmptyState
        hasFilters={hasActiveFilters}
        onClearFilters={clearAllFilters}
      />
    );
  }
  
  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <div className="min-h-screen">
      {/* SEO */}
      <ProductsSEOHead />
      
      {/* Announcement Bar */}
      <AnnouncementBar />
      
      {/* Mobile Header */}
      <MobileHeader 
        onMenuClick={() => setIsMobileNavOpen(true)}
        onRequestModelClick={() => setIsModelRequestOpen(true)} 
      />
      
      {/* Mobile Nav */}
      <MobileNav 
        open={isMobileNavOpen}
        onOpenChange={setIsMobileNavOpen}
        onGadgetSelectorClick={() => setIsDeviceSelectorOpen(true)}
        onPhoneSelectorClick={() => setIsDeviceSelectorOpen(true)}
      />

      {/* Product Category Header - Sticky */}
      <div 
        className="fixed left-0 right-0 z-30 bg-white dark:bg-gray-950"
        style={{ top: `${categoryHeaderTop}px` }}
      >
        <ProductCategoryHeader
          productCategory={filters.productCategory}
          gadgetFilter={filters.gadgetFilter}
          finishFilter={filters.finishFilter}
          onUpdateFilters={handleFilterUpdate}
          onDeviceSelectorClick={() => setIsDeviceSelectorOpen(true)}
        />
      </div>

      {/* Products Section */}
      <section 
        className="pb-6 sm:pb-20 px-2 sm:px-4 bg-white dark:bg-gray-950"
        style={{ paddingTop: `${categoryHeaderTop + 120}px` }}
      >
        <div className="container mx-auto max-w-7xl">
          {/* Page Header */}
          <PageHeader
            searchQuery={filters.searchQuery}
            collectionName={collection?.name}
            deviceFilter={urlParams.device}
            finishFilter={filters.finishFilter}
            resultsCount={products.length}
          />

          {/* Device Selection CTA */}
          {showDeviceCTA && (
            <DeviceSelectionCTA 
              onSelectDevice={() => setIsDeviceSelectorOpen(true)} 
            />
          )}

          {/* Gadget Selector Banner */}
          {showGadgetBanner && (
            <div className="mb-2 sm:mb-4">
              <GadgetSelectorBanner 
                brandName={urlParams.brand!} 
                modelName={urlParams.model!}
                onChangeDevice={() => setIsDeviceSelectorOpen(true)}
              />
            </div>
          )}

          {/* Collection Pills */}
          {showCollectionPills && (
            <CollectionPills
              collections={allCollections!}
              currentCollection={filters.collectionParam}
              onCollectionChange={handleCollectionChange}
            />
          )}

          {/* Sort and Filter Bar */}
          <FilterBar
            sortBy={filters.sortBy}
            stockFilter={filters.stockFilter}
            onSortChange={updateSortAndStock}
            onClearAll={clearAllFilters}
            hasActiveFilters={hasActiveFilters}
          />

          {/* Products Grid */}
          <ProductGrid
            products={products}
            brandFilter={urlParams.brand}
            modelFilter={urlParams.model}
            autoSortOOS={autoSortOOS}
            isLoading={!!isInitialLoading}
            loadingMessage={loadingMessage}
            isMockupsLoading={isMockupsLoading}
            updateViewport={updateViewport} // Pass viewport update function
          />
          
          {/* Pagination Controls */}
          {!isInitialLoading && (
            <PaginationControls
              isCollection={!!filters.collectionParam}
              hasMore={hasMoreCollectionProducts}
              isLoadingMore={isLoadingMore}
              canLoadMore={canLoadMore}
              isExhausted={isExhausted}
              totalProducts={allProductsCount}
              onLoadMore={filters.collectionParam ? handleLoadMoreCollection : handleLoadMore}
              observerRef={observerTarget}
            />
          )}
        </div>
      </section>
      
      {/* Model Request Dialog */}
      <ModelRequestDialog
        open={isModelRequestOpen}
        onOpenChange={setIsModelRequestOpen}
      />
      
      {/* Device Selector Dialog */}
      <DeviceSelectorDialog
        open={isDeviceSelectorOpen}
        onOpenChange={setIsDeviceSelectorOpen}
      />
    </div>
  );
}
