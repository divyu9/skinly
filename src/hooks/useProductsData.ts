import { usePaginatedQuery, useQuery } from "@/lib/firebase-hooks";
import { brandInScope, productFitsDevice } from "@/lib/device-fit";
import { loadCatalogue } from "@/lib/catalogue";
import { hasUsableImage } from "@/lib/image-fallback";
import { api } from "@/lib/firebase-api";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { FilterState, URLParams } from "./useProductFilters";
import type { Id } from "@/lib/firebase-api";
import { extractSKU } from "@/lib/mockups"; // Import extractSKU helper

export interface ProductVariant {
  _id: Id<"variants">;
  title: string;
  price: number;
  compareAtPrice?: number;
  sku: string;
  inventory_quantity: number;
  available: boolean;
}

export interface Product {
  _id: Id<"products">;
  slug: string;
  title: string;
  description: string;
  status: string;
  tags: string;
  images: Array<{ url: string; alt?: string }>;
  gadgetCategory?: string;
  modelBrands?: string[];
  modelBrandsExclude?: string[];
  productCategory?: string;
  finishType?: string;
  variants: ProductVariant[];
  mockupUrl?: string; // Added for batch mockup support
}

interface UseProductsDataParams {
  filters: FilterState;
  urlParams: URLParams;
  gadgetTypeId?: Id<"gadgetTypes">;
  finishTypeId?: Id<"finishTypes">;
  modelCategory?: string;
  /** The shopper's device, from the URL or remembered — used to rank what fits first. */
  device?: { brand: string; model: string } | null;
}

// Viewport batch size - how many mockups to fetch at once
const MOCKUP_BATCH_SIZE = 24;

export function useProductsData({
  filters,
  urlParams,
  gadgetTypeId,
  finishTypeId,
  modelCategory,
  device,
}: UseProductsDataParams) {
  // Get OOS sorting setting
  const autoSortOOS = useQuery(api.settings.getSetting, { key: "autoSortOutOfStock" });
  // And the same question for pictures: a card with nothing to show sells
  // nothing, so it can be sent to the end rather than take a top row.
  const autoSortNoImage = useQuery(api.settings.getSetting, { key: "autoSortNoImage" });
  
  // Track viewport for batch mockup loading
  const [viewportStart, setViewportStart] = useState(0);
  
  // Collection data
  const collection = useQuery(
    api.collections.getCollectionByName,
    filters.collectionParam ? { name: filters.collectionParam } : "skip"
  );
  
  // Collection pagination state
  const [collectionOffset, setCollectionOffset] = useState(0);
  const [accumulatedCollectionProducts, setAccumulatedCollectionProducts] = useState<any[]>([]);
  const collectionPageSize = 30;
  
  // Reset collection state when collection changes
  useEffect(() => {
    setCollectionOffset(0);
    setAccumulatedCollectionProducts([]);
  }, [filters.collectionParam]);
  
  // Collection products query
  const collectionProductsData = useQuery(
    api.collections.getCollectionProductsPaginated,
    collection?._id ? { 
      collectionId: collection._id,
      limit: collectionPageSize,
      offset: collectionOffset 
    } : "skip"
  );
  
  // Regular paginated products query
  const { results: productsData, status, loadMore } = usePaginatedQuery(
    api.products.getAllProductsPaginated,
    { 
      status: "active",
      productCategory: filters.productCategory || undefined,
      gadgetTypeId: gadgetTypeId || undefined,
      finishTypeId: finishTypeId || undefined,
      /*
       * Narrow to the device's gadget on skins only. Cases, camera rings,
       * screen guards and accessories carry `gadgetCategory: "accessory"` or
       * none at all, so with a phone in the URL every one of them was filtered
       * out and those categories read "No products found". Those are ranked by
       * fit further down instead.
       */
      ...(urlParams.brand && urlParams.model && modelCategory &&
          (!filters.productCategory || filters.productCategory === "skin") ? {
        gadgetCategory: modelCategory as any
      } : {})
    },
    { initialNumItems: 100 }
  );
  
  // Accumulate collection products across pagination
  useEffect(() => {
    if (collectionProductsData?.products && Array.isArray(collectionProductsData.products)) {
      if (collectionOffset === 0) {
        setAccumulatedCollectionProducts(collectionProductsData.products);
      } else {
        setAccumulatedCollectionProducts(prev => [...prev, ...collectionProductsData.products]);
      }
    }
  }, [collectionProductsData?.products, collectionOffset]);
  
  // Transform products to common format (without mockups first)
  const allProductsBase = useMemo((): Product[] => {
    // Once a collection resolves, its products are the grid. Keyed on the
    // accumulator being non-empty, a collection that was still loading — or
    // that genuinely holds nothing — silently rendered the whole catalogue
    // instead, which reads as "the filter did nothing".
    // Collection products arrive straight from the collection join, so unlike
    // the main query they are not narrowed by the gadget and finish the shopper
    // picked: on an iPhone 12, "Cars & Bikes" listed a laptop charger and a
    // drone skin. Drop anything that declares a different gadget or finish; a
    // product that declares neither cannot be ruled out, so it stays.
    const fitsChosenFilters = (p: any) => {
      if (filters.productCategory && p.productCategory && p.productCategory !== filters.productCategory) {
        return false;
      }
      if (filters.gadgetFilter && p.gadgetCategory && p.gadgetCategory !== filters.gadgetFilter) {
        return false;
      }
      if (filters.finishFilter && p.finishType && p.finishType !== filters.finishFilter) {
        return false;
      }
      return true;
    };

    const sourceProducts = filters.collectionParam && collection
      ? accumulatedCollectionProducts.filter(fitsChosenFilters)
      : productsData || [];
    
    if (!Array.isArray(sourceProducts)) return [];

    // A brand alone is enough to narrow the grid — it did nothing without a
    // model too, which is why every homepage brand card and every `?brand=`
    // link landed on the exact same unfiltered grid, Apple and Samsung and
    // Xbox all still there, and one design showed as five or six near-
    // identical cards with nothing separating them but the brand pill.
    const forBrand = urlParams.brand
      ? sourceProducts.filter((p: any) => p.productCategory !== "skin" || brandInScope(p, urlParams.brand))
      : sourceProducts;

    const withDesign = forBrand.map((product: any) => ({
      _id: product._id,
      slug: product.slug,
      title: product.title,
      description: product.description,
      status: product.status,
      tags: Array.isArray(product.tags) ? product.tags.join(", ") : product.tags || "",
      images: product.images,
      gadgetCategory: product.gadgetCategory,
      productCategory: product.productCategory,
      finishType: product.finishType,
      modelBrands: product.modelBrands,
      modelBrandsExclude: product.modelBrandsExclude,
      createdFromDesign: product.createdFromDesign || "",
      variants: product.variants?.map((v: any) => ({
        _id: v._id,
        title: v.title,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        sku: v.sku,
        inventory_quantity: v.inventoryQuantity ?? v.inventory_quantity ?? 0,
        available: (v.inventoryQuantity ?? v.inventory_quantity ?? 0) > 0,
      })) || [],
    }));

    // Without a brand chosen, one design's brand listings — Apple iPhone,
    // Samsung Galaxy, OnePlus, Android Phone, all the same artwork — showed
    // side by side as near-identical cards, brand pill the only difference.
    // Collapsed to one: the catch-all listing (no single named brand, so it
    // fits the widest audience) if the design has one, else the cheapest,
    // so a design reads as one card until a brand narrows it back down.
    if (urlParams.brand) return withDesign;
    const bySkinDesign = new Map<string, any[]>();
    const passthrough: any[] = [];
    for (const p of withDesign) {
      if (p.productCategory !== "skin" || !p.createdFromDesign) { passthrough.push(p); continue; }
      const group = bySkinDesign.get(p.createdFromDesign);
      if (group) group.push(p); else bySkinDesign.set(p.createdFromDesign, [p]);
    }
    if (!bySkinDesign.size) return withDesign;
    const startingPrice = (p: any) => p.variants.length ? Math.min(...p.variants.map((v: any) => v.price)) : Infinity;
    const representatives = [...bySkinDesign.values()].map((group) => {
      if (group.length === 1) return group[0];
      const catchAll = group.filter((p) => !p.modelBrands?.length);
      const pool = catchAll.length ? catchAll : group;
      return pool.reduce((best, p) => (startingPrice(p) < startingPrice(best) ? p : best));
    });
    return [...passthrough, ...representatives];
  }, [productsData, accumulatedCollectionProducts, filters.collectionParam, collection,
      filters.productCategory, filters.gadgetFilter, filters.finishFilter, urlParams.brand, urlParams.model]);

  /**
   * Every brand a shopper could be holding in this gadget, with how many
   * listings actually fit it.
   *
   * It used to be read off the listings alone — one chip per distinct
   * `modelBrands` set — so a brand only appeared once a listing had been cut
   * specifically for it. That left the row saying Skinly sells phone skins
   * for Apple, Samsung and three others, when the catch-all "Android Phone"
   * listings fit a Vivo, a Realme, an Infinix or a CMF just as well: 334 of
   * them each. Same for Lenovo and Asus laptops, Lenovo tablets, Nikon
   * lenses, Apple and iQOO chargers.
   *
   * So the brands come from the models we support for this gadget, and a
   * brand stays only if at least one listing here is in scope for it — the
   * chip can never lead to an empty grid.
   */
  const modelRows = useQuery(
    api.supportedModels.listAll,
    filters.productCategory === "skin"
      ? { isActive: true, ...(filters.gadgetFilter ? { category: filters.gadgetFilter } : {}) }
      : "skip"
  );

  /*
   * Which listings exist is asked of the whole catalogue, not of the grid's
   * own query: that one is paginated, so on the unfiltered skins view the
   * first hundred products decided the answer, and the row showed seven
   * brands where there are fifty.
   */
  const [catalogueProducts, setCatalogueProducts] = useState<any[] | null>(null);
  useEffect(() => {
    let live = true;
    void loadCatalogue().then((c) => { if (live && c) setCatalogueProducts(c.products); });
    return () => { live = false; };
  }, []);

  const availableBrands = useMemo(() => {
    const everything = catalogueProducts || (Array.isArray(productsData) ? productsData : []);
    const pool = everything.filter(
      (p: any) => p.productCategory === "skin" && (!filters.gadgetFilter || p.gadgetCategory === filters.gadgetFilter)
    );
    if (!pool.length) return [];

    // "One Plus" in the model list and "OnePlus" on a listing are one brand.
    const key = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    const candidates = new Map<string, { brand: string; models: number }>();
    const add = (name: unknown, models: number) => {
      const k = key(name);
      if (!k) return;
      const at = candidates.get(k);
      if (at) at.models += models;
      else candidates.set(k, { brand: String(name), models });
    };
    for (const m of (modelRows as any[]) || []) {
      if (filters.gadgetFilter && m.category !== filters.gadgetFilter) continue;
      add(m.brandName, 1);
    }
    /*
     * A listing's own brand list only fills in for a gadget we hold no models
     * of at all. Where we do hold them, they are the better answer: the
     * console listings name Microsoft beside Xbox and Sony beside PlayStation,
     * which read as two chips for one console, and the phone ones name Redmi,
     * whose handsets are filed under Xiaomi — so that chip led to a listing
     * whose model list had no Redmi in it.
     */
    const haveModels = candidates.size > 0;
    if (!haveModels) for (const p of pool) for (const b of (p.modelBrands || [])) add(b, 0);

    return [...candidates.values()]
      .map((c) => ({ ...c, listings: pool.filter((p: any) => brandInScope(p, c.brand)).length }))
      .filter((c) => c.listings > 0);
  }, [catalogueProducts, productsData, modelRows, filters.gadgetFilter]);
  
  // Apply search filter
  const filteredProducts = useMemo(() => {
    if (!filters.searchQuery.trim()) return allProductsBase;
    
    const searchLower = filters.searchQuery.toLowerCase().trim();
    return allProductsBase.filter(p => 
      p.title.toLowerCase().includes(searchLower) || 
      p.description?.toLowerCase().includes(searchLower) ||
      p.tags?.toLowerCase().includes(searchLower)
    );
  }, [allProductsBase, filters.searchQuery]);
  
  // Apply sorting and stock filtering
  const sortedProducts = useMemo(() => {
    let result = [...filteredProducts];
    
    // Apply stock filter
    if (filters.stockFilter === "in-stock") {
      result = result.filter(p => p.variants.some(v => v.available && v.inventory_quantity > 0));
    } else if (filters.stockFilter === "out-of-stock") {
      result = result.filter(p => p.variants.every(v => !v.available || v.inventory_quantity === 0));
    }
    
    // Apply sorting
    switch (filters.sortBy) {
      case "price-low-high":
        result.sort((a, b) => {
          const minA = Math.min(...a.variants.map(v => v.price));
          const minB = Math.min(...b.variants.map(v => v.price));
          return minA - minB;
        });
        break;
      case "price-high-low":
        result.sort((a, b) => {
          const maxA = Math.max(...a.variants.map(v => v.price));
          const maxB = Math.max(...b.variants.map(v => v.price));
          return maxB - maxA;
        });
        break;
      case "latest":
        result.reverse();
        break;
    }
    
    // Outside skins nothing is filtered to the device, so put what comes in a
    // version for it first. Only on the default order — an explicit price sort
    // means price. The sort is stable, so each group keeps its order.
    const rankByFit = !!device && filters.sortBy === "default" &&
      !!filters.productCategory && filters.productCategory !== "skin";
    if (rankByFit) {
      const fits = new Map(result.map((p) => [p._id, productFitsDevice(p, device!.brand, device!.model, null)]));
      result.sort((a, b) => Number(fits.get(b._id)) - Number(fits.get(a._id)));
    }

    // Auto-sort by stock status if enabled
    if (autoSortOOS?.value === true) {
      result.sort((a, b) => {
        const aInStock = a.variants.some(v => v.available && v.inventory_quantity > 0);
        const bInStock = b.variants.some(v => v.available && v.inventory_quantity > 0);
        if (aInStock && !bInStock) return -1;
        if (!aInStock && bInStock) return 1;
        return 0;
      });
    }

    /*
     * Pictureless products last, if the admin asked for it.
     *
     * Last of all the sorts, because it is the coarsest: whatever order the
     * rest of this settled on holds inside each group, and a product nobody
     * can see the design of goes below one they can. `hasUsableImage` is the
     * same function the admin's "No images" filter uses, so the listing there
     * and the order here can never disagree. Not a filter — the product is
     * still buyable, still findable by search, just not in the first row.
     */
    if (autoSortNoImage?.value === true) {
      result.sort((a, b) => Number(hasUsableImage(b.images)) - Number(hasUsableImage(a.images)));
    }

    return result;
  }, [filteredProducts, filters.sortBy, filters.stockFilter, filters.productCategory,
      device?.brand, device?.model, autoSortOOS?.value, autoSortNoImage?.value]);
  
  // ============================================
  // VIEWPORT-BASED BATCH MOCKUP LOADING
  // ============================================
  
  // Get SKUs for current viewport (with buffer for smooth scrolling)
  const viewportSkus = useMemo(() => {
    const endIndex = Math.min(viewportStart + MOCKUP_BATCH_SIZE + 8, sortedProducts.length);
    return sortedProducts
      .slice(0, endIndex) // Load from start to current viewport + buffer
      .map(p => {
        // Use extractSKU helper to get clean SKU from variant
        const rawSku = p.variants[0]?.sku;
        return extractSKU(p.title, rawSku);
      })
      .filter(Boolean) as string[];
  }, [sortedProducts, viewportStart]);
  
  // Batch fetch mockups for viewport products - SINGLE QUERY!
  const mockupResult = useQuery(
    api.mockups.getBatchMockups,
    urlParams.brand && urlParams.model && viewportSkus.length > 0
      ? {
          brand: urlParams.brand,
          model: urlParams.model,
          skus: viewportSkus
        }
      : "skip"
  );

  // Merge mockups into products
  const productsWithMockups = useMemo((): Product[] => {
    // Extract mockups map from new paginated return format
    const mockupMap = mockupResult?.mockups ?? {};

    if (!mockupResult || !urlParams.brand || !urlParams.model) {
      return sortedProducts;
    }

    return sortedProducts.map(product => {
      // Use extractSKU to get consistent SKU for matching
      const rawSku = product.variants[0]?.sku;
      const sku = extractSKU(product.title, rawSku);
      
      let mockupUrl = undefined;
      
      if (sku) {
        // Direct match
        if (mockupMap[sku]) {
          mockupUrl = mockupMap[sku];
        } 
        // Fallback: Check for case-insensitive match or prefix/suffix match in the map keys
        // The backend returns keys exactly as requested (from args.skus), 
        // BUT if there's a mismatch in how we generated args.skus vs how we check here, we might miss it.
        // Also, the backend result keys might be normalized? 
        // Let's check keys directly.
        else {
           const skuUpper = sku.toUpperCase();
           // Find any key in mockupMap that matches our SKU logic
           const matchingKey = Object.keys(mockupMap).find(key => {
             const keyUpper = key.toUpperCase();
             return keyUpper === skuUpper; 
           });
           if (matchingKey) {
             mockupUrl = mockupMap[matchingKey];
           }
        }
      }

      return {
        ...product,
        mockupUrl,
      };
    });
  }, [sortedProducts, mockupResult, urlParams.brand, urlParams.model]);
  
  // Update viewport when user scrolls (called by intersection observer)
  const updateViewport = useCallback((newStart: number) => {
    setViewportStart(prev => Math.max(prev, newStart));
  }, []);
  
  // ============================================
  // INFINITE SCROLL
  // ============================================
  
  // Infinite scroll observer
  const observerTarget = useRef<HTMLDivElement>(null);
  
  const handleLoadMore = useCallback(() => {
    if (status === "CanLoadMore") {
      loadMore(100);
    }
  }, [status, loadMore]);
  
  const handleLoadMoreCollection = useCallback(() => {
    if (collectionProductsData?.hasMore) {
      setCollectionOffset(prev => prev + collectionPageSize);
    }
  }, [collectionProductsData?.hasMore]);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );
    
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    
    return () => observer.disconnect();
  }, [handleLoadMore]);
  
  // Loading states
  const isInitialLoading = status === "LoadingFirstPage" ||
    !!(filters.collectionParam && collection === undefined) ||
    // The collection is known but its products have not arrived yet.
    !!(filters.collectionParam && collection && collectionProductsData === undefined);

  const isMockupsLoading = !!(urlParams.brand && urlParams.model && mockupResult === undefined);

  return {
    products: productsWithMockups,
    allProductsCount: allProductsBase.length,
    isInitialLoading,
    isLoadingMore: status === "LoadingMore",
    canLoadMore: status === "CanLoadMore",
    isExhausted: status === "Exhausted",
    handleLoadMore,
    handleLoadMoreCollection,
    hasMoreCollectionProducts: collectionProductsData?.hasMore || false,
    observerTarget,
    collection,
    autoSortOOS: autoSortOOS?.value === true,
    // New: Mockup specific
    isMockupsLoading,
    updateViewport,
    hasMockups: !!mockupResult?.mockups && Object.keys(mockupResult.mockups).length > 0,
    availableBrands,
  };
}
