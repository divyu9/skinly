import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { FilterState, URLParams } from "./useProductFilters";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

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
}

// Viewport batch size - how many mockups to fetch at once
const MOCKUP_BATCH_SIZE = 24;

export function useProductsData({
  filters,
  urlParams,
  gadgetTypeId,
  finishTypeId,
  modelCategory,
}: UseProductsDataParams) {
  // Get OOS sorting setting
  const autoSortOOS = useQuery(api.settings.getSetting, { key: "autoSortOutOfStock" });
  
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
      ...(urlParams.brand && urlParams.model && modelCategory ? { 
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
    const sourceProducts = filters.collectionParam && accumulatedCollectionProducts.length > 0
      ? accumulatedCollectionProducts
      : productsData || [];
    
    return sourceProducts.map((product: any) => ({
      _id: product._id,
      slug: product.slug,
      title: product.title,
      description: product.description,
      status: product.status,
      tags: Array.isArray(product.tags) ? product.tags.join(", ") : product.tags || "",
      images: product.images,
      gadgetCategory: product.gadgetCategory,
      finishType: product.finishType,
      variants: product.variants.map((v: any) => ({
        _id: v._id,
        title: v.title,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        sku: v.sku,
        inventory_quantity: v.inventoryQuantity ?? v.inventory_quantity ?? 0,
        available: (v.inventoryQuantity ?? v.inventory_quantity ?? 0) > 0,
      })),
    }));
  }, [productsData, accumulatedCollectionProducts, filters.collectionParam]);
  
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
    
    return result;
  }, [filteredProducts, filters.sortBy, filters.stockFilter, autoSortOOS?.value]);
  
  // ============================================
  // VIEWPORT-BASED BATCH MOCKUP LOADING
  // ============================================
  
  // Get SKUs for current viewport (with buffer for smooth scrolling)
  const viewportSkus = useMemo(() => {
    const endIndex = Math.min(viewportStart + MOCKUP_BATCH_SIZE + 8, sortedProducts.length);
    return sortedProducts
      .slice(0, endIndex) // Load from start to current viewport + buffer
      .map(p => p.variants[0]?.sku)
      .filter(Boolean) as string[];
  }, [sortedProducts, viewportStart]);
  
  // Batch fetch mockups for viewport products - SINGLE QUERY!
  const mockupMap = useQuery(
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
    if (!mockupMap || !urlParams.brand || !urlParams.model) {
      return sortedProducts;
    }
    
    return sortedProducts.map(product => {
      const sku = product.variants[0]?.sku;
      const mockupUrl = sku ? mockupMap[sku] : undefined;
      
      return {
        ...product,
        mockupUrl,
      };
    });
  }, [sortedProducts, mockupMap, urlParams.brand, urlParams.model]);
  
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
    (filters.collectionParam && collection === undefined);
  
  const isMockupsLoading = !!(urlParams.brand && urlParams.model && mockupMap === undefined);
  
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
    hasMockups: !!mockupMap && Object.keys(mockupMap).length > 0,
  };
}
