import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
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
import { writeActiveDevice } from "@/lib/active-device";
import { CATEGORY_PAGES, canonicalListingPath } from "@/lib/category-paths.mjs";
import { ANNOUNCEMENT_DISMISSED_EVENT, isAnnouncementDismissed } from "@/lib/announcement-dismissed.ts";
import { BrandPicker } from "./_components/brand-picker.tsx";

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
  // Same as the header: the sticky category strip below it has to move when
  // the visitor closes the bar, not just when the setting is off.
  const [barDismissed, setBarDismissed] = useState(isAnnouncementDismissed);
  useEffect(() => {
    const sync = () => setBarDismissed(true);
    window.addEventListener(ANNOUNCEMENT_DISMISSED_EVENT, sync);
    return () => window.removeEventListener(ANNOUNCEMENT_DISMISSED_EVENT, sync);
  }, []);
  const showAnnouncement = (homepageSettings?.announcementEnabled ?? false) && !barDismissed;
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
    activeDevice,
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
    availableBrands,
  } = useProductsData({
    filters,
    urlParams,
    gadgetTypeId,
    finishTypeId,
    modelCategory: modelInfo?.category,
    device: activeDevice,
  });
  
  // ============================================
  // SMART FILTERS
  // ============================================
  useEffect(() => {
    if (modelGadgetType?.name) {
      applySmartFilters(modelGadgetType.name);
    }
  }, [modelGadgetType?.name, applySmartFilters]);

  // Remember what kind of gadget the device is, so the page can still tell
  // once the pair has left the URL.
  useEffect(() => {
    if (urlParams.brand && urlParams.model && modelInfo?.category) {
      writeActiveDevice(urlParams.brand, urlParams.model, modelInfo.category);
    }
  }, [urlParams.brand, urlParams.model, modelInfo?.category]);

  // Devices saved before the category was recorded have none; look it up once.
  const savedDeviceInfo = useQuery(
    api.supportedModels.getModelInfo,
    activeDevice && !activeDevice.category && !urlParams.brand
      ? { brand: activeDevice.brand, model: activeDevice.model }
      : "skip"
  );
  useEffect(() => {
    if (activeDevice && savedDeviceInfo?.category) {
      writeActiveDevice(activeDevice.brand, activeDevice.model, savedDeviceInfo.category);
    }
  }, [activeDevice, savedDeviceInfo?.category]);

  const deviceCategory = modelInfo?.category ?? activeDevice?.category ?? savedDeviceInfo?.category;
  
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
  
  // Only forward the keys the caller actually sent. Passing all three meant an
  // object like { productCategory: undefined, gadgetFilter: 'console',
  // finishFilter: undefined }, and `{ ...prev, ...updates }` overwrites a key
  // even when its value is undefined — so picking a gadget silently wiped the
  // product category, and picking a finish wiped the gadget. The URL kept every
  // param, the in-memory filters kept only the last click, and the grid showed
  // the wrong products: ?gadget=console&finish=transparent returned the 24
  // transparent phone and laptop skins.
  const handleFilterUpdate = useCallback((updates: {
    productType?: string | null;
    gadget?: string | null;
    finish?: string | null;
  }) => {
    const next: Record<string, unknown> = {};
    if ("productType" in updates) next.productCategory = updates.productType;
    if ("gadget" in updates) next.gadgetFilter = updates.gadget;
    if ("finish" in updates) next.finishFilter = updates.finish;

    /*
     * The device pair follows the gadget.
     *
     * With `brand=Apple&model=iPhone 12` still in the URL, picking Laptop asked
     * for laptop skins that also fit a phone — the query adds the model's
     * category — and the grid said "No products found". Picking another gadget
     * now drops the pair (the device stays remembered); coming back to the
     * device's own gadget puts it back, so its mockups and collections return.
     */
    let extraURL: Record<string, string | null> | undefined;
    const gadget = updates.gadget;
    if (gadget && deviceCategory && activeDevice) {
      if (gadget !== deviceCategory && urlParams.brand) {
        extraURL = { brand: null, model: null, fromGadgetSelector: null };
      } else if (gadget === deviceCategory && !urlParams.brand) {
        extraURL = { brand: activeDevice.brand, model: activeDevice.model };
      }
    }
    updateFilters(next as any, extraURL);
  }, [updateFilters, deviceCategory, activeDevice, urlParams.brand]);
  
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
  // ROOM FOR THE STICKY CATEGORY HEADER
  // ============================================
  /*
   * The page reserved a flat 120px under the fixed category strip. That strip
   * changes height — it grows a second row when the gadget selector opens, and
   * more again now the pills wrap instead of running off the edge — so the
   * guess was wrong more often than right, and "Shop" sat underneath it.
   *
   * Measured instead, and re-measured whenever it resizes, which covers the
   * selector opening, the filters changing and the window being resized.
   */
  const categoryHeaderRef = useRef<HTMLDivElement>(null);
  const [categoryHeaderHeight, setCategoryHeaderHeight] = useState(120);

  useEffect(() => {
    const el = categoryHeaderRef.current;
    if (!el) return;
    const measure = () => {
      const h = Math.round(el.getBoundingClientRect().height);
      if (h > 0) setCategoryHeaderHeight(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ============================================
  // HOW MANY CARDS ARE ACTUALLY IN THE DOM
  // ============================================
  /*
   * The listing built every loaded product at once: 100 cards, 14601px, about
   * eighteen screens. Nobody reaches card ninety, but every phone pays to lay
   * them out and hold them.
   *
   * So the grid renders a windowful and grows as you approach the end. This is
   * deliberately separate from the fetching the hook already does — that
   * decides how many products exist here, this decides how many are drawn.
   * The existing loader only appears once drawing has caught up with fetching,
   * so reaching the bottom asks the backend for more rather than firing the
   * moment the page is short.
   */
  const RENDER_PAGE = 24;
  const [visibleCount, setVisibleCount] = useState(RENDER_PAGE);
  const growRef = useRef<HTMLDivElement>(null);

  // A different result set starts from the top again.
  useEffect(() => {
    setVisibleCount(RENDER_PAGE);
  }, [
    filters.productCategory,
    filters.gadgetFilter,
    filters.finishFilter,
    filters.sortBy,
    filters.stockFilter,
    filters.searchQuery,
    filters.collectionParam,
    urlParams.brand,
    urlParams.model,
  ]);

  useEffect(() => {
    const el = growRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(c + RENDER_PAGE, products.length));
        }
      },
      // Grow before the sentinel is on screen, so the next rows are already
      // there by the time anyone scrolls to where they belong.
      { rootMargin: "800px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [products.length]);

  const visibleProducts = useMemo(
    () => products.slice(0, visibleCount),
    [products, visibleCount],
  );
  const moreToDraw = visibleCount < products.length;

  // ============================================
  // RENDER CONDITIONS
  // ============================================
  /*
   * The device chip is not a property of one route.
   *
   * Both of these used to read `urlParams.brand/model`, so the chip appeared
   * only while the query string happened to survive — and only under
   * `productCategory === 'skin'`, which dropped it the moment a shopper looked
   * at Cases, even though a case is cut for one model just as a skin is.
   * `activeDevice` remembers the pick, so the chip is constant across every
   * product route until the shopper changes it.
   */
  const showDeviceCTA = filters.productCategory === 'skin' &&
    filters.gadgetFilter &&
    !activeDevice;

  /*
   * Skins only.
   *
   * I widened this to every category a while back, reasoning that "a case is
   * cut for one model just as a skin is". That was wrong in practice. The
   * banner promises "all designs shown are reference, we'll send it for your
   * exact model", which is a statement about printing a skin to order — cases,
   * camera rings and screen protectors are stocked per model and each card
   * carries its own Select Your Device. So on those tabs the banner was not
   * merely redundant, it was claiming something untrue: a shopper with an
   * Alienware laptop saved was being told camera rings would come cut for it.
   *
   * The device itself is remembered either way, so it is waiting when they
   * come back to Skins.
   */
  // …and only while the gadget being browsed is the kind the device is: an
  // iPhone 12 banner has nothing to say on laptop skins.
  const showGadgetBanner = !!activeDevice && filters.productCategory === 'skin' &&
    (!filters.gadgetFilter || !deviceCategory || filters.gadgetFilter === deviceCategory);
  
  // On every skins view, not only the unfiltered one: a saved device writes
  // its own brand into the URL, so hiding the row once a brand was set meant
  // anyone with a phone remembered never saw it at all. The row marks the
  // active brand and tapping it again clears it.
  const showBrandPicker = filters.productCategory === 'skin';

  const showCollectionPills = filters.productCategory === 'skin' &&
    filters.gadgetFilter === 'phone' && 
    allCollections && 
    allCollections.length > 0 && 
    urlParams.brand && 
    urlParams.model;
  
  // The listing's canonical follows its category (and, for skins, gadget), so
  // /products?productType=case-cover declares /cases-covers.
  const listingCanonical = canonicalListingPath(filters.productCategory, filters.gadgetFilter);
  const categoryPage = filters.productCategory ? CATEGORY_PAGES[filters.productCategory] : undefined;
  const listingSeo = categoryPage && listingCanonical === categoryPage.path
    ? { title: categoryPage.title, description: categoryPage.description, canonicalPath: listingCanonical }
    : { canonicalPath: listingCanonical };

  // ============================================
  // EMPTY STATE
  // ============================================
  /*
   * Rendered in place of the grid, not as a page of its own. It used to
   * replace everything — header, category stories, bottom nav — with a bare
   * logo bar, so a shopper who landed on an empty category had no way to pick
   * another one short of the back button.
   */
  const isEmpty = products.length === 0 && isExhausted;
  
  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <div className="min-h-screen">
      {/* SEO */}
      <ProductsSEOHead {...listingSeo} />
      
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
        ref={categoryHeaderRef}
        className="fixed left-0 right-0 z-30 border-b-2 border-ink/10 bg-card"
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
        className="halftone px-2 pb-6 sm:px-4 sm:pb-20"
        style={{ paddingTop: `${categoryHeaderTop + categoryHeaderHeight + 16}px` }}
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

          {/* Shop by Brand — above the device box, because brand comes first
              in the sequence a shopper works through: brand, then model. */}
          {showBrandPicker && <BrandPicker brands={availableBrands} />}

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
                brandName={activeDevice!.brand}
                modelName={activeDevice!.model}
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

          {isEmpty ? (
            <EmptyState
              hasFilters={hasActiveFilters}
              onClearFilters={clearAllFilters}
            />
          ) : (
          <>
          {/* Products Grid */}
          <ProductGrid
            products={visibleProducts}
            /* The remembered device, not only one sitting in the URL — so a
               shopper who picked a model on the skins tab is not asked again
               on every case and camera-ring card. Each card checks the device
               against its own variants before using it. */
            brandFilter={activeDevice?.brand ?? urlParams.brand}
            modelFilter={activeDevice?.model ?? urlParams.model}
            deviceCategory={deviceCategory}
            autoSortOOS={autoSortOOS}
            isLoading={!!isInitialLoading}
            loadingMessage={loadingMessage}
            isMockupsLoading={isMockupsLoading}
            updateViewport={updateViewport} // Pass viewport update function
          />
          
          {/* Draw more of what is already here before asking for more. */}
          {moreToDraw && <div ref={growRef} aria-hidden="true" className="h-px w-full" />}

          {/* Pagination Controls */}
          {!isInitialLoading && !moreToDraw && (
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
          </>
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
