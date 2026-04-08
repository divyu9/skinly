import { useState, useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Types
export type ProductCategory = "skin" | "case-cover" | "camera-ring" | "magneto-x" | "glass" | "accessory" | null;
export type SortOption = "default" | "price-low-high" | "price-high-low" | "latest";
export type StockFilter = "all" | "in-stock" | "out-of-stock";

export interface FilterState {
  productCategory: ProductCategory;
  gadgetFilter: string | null;
  finishFilter: string | null;
  sortBy: SortOption;
  stockFilter: StockFilter;
  searchQuery: string;
  collectionParam: string;
}

export interface URLParams {
  device: string | null;
  brand: string | null;
  model: string | null;
  search: string;
  collection: string;
  productType: ProductCategory;
  gadget: string | null;
  finish: string | null;
  fromGadgetSelector: boolean;
}

export function useProductFilters() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Parse URL params once
  const urlParams = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      device: params.get('device'),
      brand: params.get('brand'),
      model: params.get('model'),
      search: params.get('search') || '',
      collection: params.get('collection') || '',
      productType: params.get('productType') as ProductCategory,
      gadget: params.get('gadget'),
      finish: params.get('finish'),
      fromGadgetSelector: params.get('fromGadgetSelector') === 'true',
    };
  }, [location.search]);
  
  // Consolidated filter state
  const [filters, setFilters] = useState<FilterState>({
    productCategory: urlParams.productType,
    gadgetFilter: urlParams.gadget,
    finishFilter: urlParams.finish,
    sortBy: "default",
    stockFilter: "all",
    searchQuery: urlParams.search,
    collectionParam: urlParams.collection,
  });
  
  // Track if smart filters have been applied
  const [smartFiltersApplied, setSmartFiltersApplied] = useState(false);
  const [prevBrandModel, setPrevBrandModel] = useState("");
  
  // Sync URL params to state when location changes
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setFilters(prev => ({
      ...prev,
      productCategory: params.get('productType') as ProductCategory,
      gadgetFilter: params.get('gadget'),
      finishFilter: params.get('finish'),
      collectionParam: params.get('collection') || '',
      searchQuery: params.get('search') || '',
    }));
  }, [location.search]);
  
  // Reset smart filters when brand/model changes
  useEffect(() => {
    const currentBrandModel = `${urlParams.brand}-${urlParams.model}`;
    if (currentBrandModel !== prevBrandModel) {
      setPrevBrandModel(currentBrandModel);
      setSmartFiltersApplied(false);
    }
  }, [urlParams.brand, urlParams.model, prevBrandModel]);
  
  // Update URL using React Router
  const updateURL = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(window.location.search);
    
    let hasChanges = false;
    Object.entries(updates).forEach(([key, value]) => {
      const current = params.get(key);
      if (value === null || value === '') {
        if (params.has(key)) {
          params.delete(key);
          hasChanges = true;
        }
      } else {
        if (current !== value) {
          params.set(key, value);
          hasChanges = true;
        }
      }
    });
    
    if (hasChanges) {
      navigate(`?${params.toString()}`, { replace: true });
    }
  }, [navigate]);
  
  // Update filters with URL sync
  const updateFilters = useCallback((updates: Partial<FilterState>) => {
    setFilters(prev => {
      const newState = { ...prev, ...updates };
      
      // Clear dependent filters when category changes
      if (updates.productCategory !== undefined && updates.productCategory !== prev.productCategory) {
        if (updates.gadgetFilter === undefined) newState.gadgetFilter = null;
        if (updates.finishFilter === undefined) newState.finishFilter = null;
      }
      
      // Clear finish when gadget changes
      if (updates.gadgetFilter !== undefined && updates.gadgetFilter !== prev.gadgetFilter) {
        if (updates.finishFilter === undefined) newState.finishFilter = null;
      }
      
      return newState;
    });
    
    // Build URL updates
    const urlUpdates: Record<string, string | null> = {};
    
    if (updates.productCategory !== undefined) {
      urlUpdates.productType = updates.productCategory;
      if (updates.gadgetFilter === undefined) urlUpdates.gadget = null;
      if (updates.finishFilter === undefined) urlUpdates.finish = null;
      if (updates.productCategory !== 'skin') {
        urlUpdates.collection = null;
        urlUpdates.fromGadgetSelector = null;
      }
    }
    
    if (updates.gadgetFilter !== undefined) {
      urlUpdates.gadget = updates.gadgetFilter;
      if (updates.finishFilter === undefined) urlUpdates.finish = null;
      if (updates.gadgetFilter !== 'phone') urlUpdates.collection = null;
    }
    
    if (updates.finishFilter !== undefined) {
      urlUpdates.finish = updates.finishFilter;
    }
    
    if (updates.collectionParam !== undefined) {
      urlUpdates.collection = updates.collectionParam || null;
    }
    
    updateURL(urlUpdates);
  }, [updateURL]);
  
  // Apply smart filters based on model info
  const applySmartFilters = useCallback((gadgetTypeName: string) => {
    if (!smartFiltersApplied && urlParams.brand && urlParams.model) {
      setFilters(prev => ({
        ...prev,
        productCategory: "skin",
        gadgetFilter: gadgetTypeName,
      }));
      
      updateURL({
        productType: 'skin',
        gadget: gadgetTypeName,
      });
      
      setSmartFiltersApplied(true);
    }
  }, [smartFiltersApplied, urlParams.brand, urlParams.model, updateURL]);
  
  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFilters({
      productCategory: null,
      gadgetFilter: null,
      finishFilter: null,
      sortBy: "default",
      stockFilter: "all",
      searchQuery: "",
      collectionParam: "",
    });
    navigate('/products');
  }, [navigate]);
  
  // Update sort and stock filter (doesn't affect URL)
  const updateSortAndStock = useCallback((sortBy: SortOption, stockFilter: StockFilter) => {
    setFilters(prev => ({ ...prev, sortBy, stockFilter }));
  }, []);
  
  // Update search query
  const updateSearchQuery = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, searchQuery: query }));
  }, []);
  
  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setFilters(prev => ({
        ...prev,
        productCategory: params.get('productType') as ProductCategory,
        gadgetFilter: params.get('gadget'),
        finishFilter: params.get('finish'),
        collectionParam: params.get('collection') || '',
      }));
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  
  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.gadgetFilter ||
      filters.finishFilter ||
      filters.collectionParam ||
      filters.sortBy !== "default" ||
      filters.stockFilter !== "all"
    );
  }, [filters]);
  
  return {
    filters,
    urlParams,
    updateFilters,
    updateSortAndStock,
    updateSearchQuery,
    updateURL,
    clearAllFilters,
    applySmartFilters,
    hasActiveFilters,
  };
}
