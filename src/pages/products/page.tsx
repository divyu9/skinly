import { usePaginatedQuery, useAction, useQuery, useQueries, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { AlertCircleIcon, PackageIcon, SearchIcon, InfoIcon, ArrowUpDown, Loader2Icon, BellIcon, Smartphone, Laptop, Tablet, Camera, Zap, Gamepad2, Package2, Shield, Glasses, ShoppingBag, Video, Box } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Input } from "@/components/ui/input.tsx";
import { CartButton } from "@/components/cart.tsx";
import { GadgetSelectorBanner } from "@/components/gadget-selector-banner.tsx";
import { HeaderSearch } from "@/components/header-search.tsx";
import { DeviceSelectorDialog } from "@/pages/_components/device-selector-dialog.tsx";
import { Helmet } from "react-helmet-async";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { trackSearch, trackCollectionView } from "@/lib/analytics.ts";

import type { Id } from "@/convex/_generated/dataModel.d.ts";

// Component to show mockup or fallback to original image
function ProductImage({ 
  product, 
  brandFilter, 
  modelFilter 
}: { 
  product: { 
    images: Array<{ url: string; alt?: string }>; 
    title: string;
    variants: Array<{ sku: string }>;
  }; 
  brandFilter: string | null; 
  modelFilter: string | null;
}) {
  // Try to get mockup if brand and model are selected
  const firstSku = product.variants[0]?.sku;
  const mockupUrl = useQuery(
    api.mockups.getMockupFileId,
    brandFilter && modelFilter && firstSku
      ? { brand: brandFilter, model: modelFilter, sku: firstSku }
      : "skip"
  );
  
  const mainImage = product.images[0];
  
  // Show loading spinner while mockup is being fetched
  if (brandFilter && modelFilter && mockupUrl === undefined) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <Loader2Icon className="size-8 sm:size-12 text-muted-foreground animate-spin" />
      </div>
    );
  }
  
  const imageUrl = mockupUrl || mainImage?.url;
  const imageAlt = mainImage?.alt || product.title;
  
  if (!imageUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <PackageIcon className="size-8 sm:size-16 text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="relative w-full h-full">
      <img
        src={imageUrl}
        alt={imageAlt}
        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
      />
      {/* Show "Generic Image" badge when no mockup exists but device is selected */}
      {brandFilter && modelFilter && mockupUrl === null && (
        <div className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-black/80 text-white rounded px-2 py-1 text-[8px] md:text-[10px] leading-tight text-center">
          Generic Image<br />Exact Design Available
        </div>
      )}
    </div>
  );
}

interface ConvexProduct {
  _id: Id<"products">;
  title: string;
  slug: string;
  description: string;
  status: "active" | "draft" | "archived";
  images: Array<{ url: string; alt?: string }>;
  tags: string[];
  productCategory?: "skin" | "case-cover" | "camera-ring" | "magneto-x" | "glass" | "accessory";
  gadgetCategory?: string;
  finishType?: "matte" | "embossed" | "transparent";
  variants: Array<{
    _id: Id<"variants">;
    title: string;
    price: number;
    compareAtPrice?: number;
    inventoryQuantity: number;
    sku: string;
  }>;
}

export default function ProductsPage() {
  const verifyConnection = useAction(api.shopify.verifyConnection);
  
  // Get OOS sorting setting
  const autoSortOOS = useQuery(api.settings.getSetting, { key: "autoSortOutOfStock" });
  
  // Model request dialog state
  const [isModelRequestOpen, setIsModelRequestOpen] = useState(false);
  const [modelRequestBrand, setModelRequestBrand] = useState("");
  const [modelRequestModel, setModelRequestModel] = useState("");
  const [modelRequestCategory, setModelRequestCategory] = useState("");
  const [modelRequestPhone, setModelRequestPhone] = useState("");
  const createModelRequest = useMutation(api.modelRequests.createModelRequest);
  
  // Device selector dialog state
  const [isDeviceSelectorOpen, setIsDeviceSelectorOpen] = useState(false);
  
  // Get URL parameters (must be before queries that depend on them)
  const urlParams = new URLSearchParams(window.location.search);
  const deviceFilter = urlParams.get('device');
  const brandFilter = urlParams.get('brand');
  const modelFilter = urlParams.get('model');
  const showFinish = urlParams.get('showFinish') === 'true';
  const urlSearchQuery = urlParams.get('search') || '';
  const collectionParam = urlParams.get('collection') || '';
  const fromGadgetSelector = urlParams.get('fromGadgetSelector') === 'true';
  
  // Get model info if brand and model are present
  const modelInfo = useQuery(
    api.supportedModels.getModelInfo,
    brandFilter && modelFilter
      ? { brand: brandFilter, model: modelFilter }
      : "skip"
  );
  
  // Get gadget type from model category
  const modelGadgetType = useQuery(
    api.gadgetTypes.getByCategory,
    modelInfo?.category ? { category: modelInfo.category } : "skip"
  );
  
  // State declarations for filters (initialized from URL or smart defaults)
  const [searchQuery, setSearchQuery] = useState(urlSearchQuery);
  const [sortBy, setSortBy] = useState<string>("default");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [lastTrackedSearch, setLastTrackedSearch] = useState<string>("");
  const [prevBrandModel, setPrevBrandModel] = useState<string>("");
  const [smartFiltersApplied, setSmartFiltersApplied] = useState(false);
  const [productCategory, setProductCategory] = useState<"skin" | "case-cover" | "camera-ring" | "magneto-x" | "glass" | "accessory" | null>(
    urlParams.get('productType') as "skin" | "case-cover" | "camera-ring" | "magneto-x" | "glass" | "accessory" | null
  );
  const [gadgetFilter, setGadgetFilter] = useState<string | null>(urlParams.get('gadget'));
  const [finishFilter, setFinishFilter] = useState<string | null>(urlParams.get('finish'));
  const [isFilterTransitioning, setIsFilterTransitioning] = useState(false);
  
  // Reset smart filters when brand/model changes
  useEffect(() => {
    const currentBrandModel = `${brandFilter}-${modelFilter}`;
    if (currentBrandModel !== prevBrandModel) {
      setPrevBrandModel(currentBrandModel);
      setSmartFiltersApplied(false);
    }
  }, [brandFilter, modelFilter, prevBrandModel]);
  
  // Apply smart filters when model info is available
  useEffect(() => {
    if (brandFilter && modelFilter && modelGadgetType && !smartFiltersApplied) {
      // Set product category to "skin"
      setProductCategory("skin");
      // Set gadget filter to the model's gadget type name (lowercase, e.g., "laptop")
      setGadgetFilter(modelGadgetType.name);
      setSmartFiltersApplied(true);
    }
  }, [brandFilter, modelFilter, modelGadgetType, smartFiltersApplied]);
  
  // Get finish types, gadget types, and product categories for filtering
  const finishTypes = useQuery(api.finishTypes.listAllActive, {});
  const gadgetTypes = useQuery(api.gadgetTypes.listAllActive, {});
  const productCategories = useQuery(api.productCategories.listAllWithCounts, {});
  
  // Find gadgetTypeId from gadgetFilter
  const selectedGadgetType = gadgetTypes?.find(gt => gt.name === gadgetFilter);
  const gadgetTypeId = selectedGadgetType?._id;
  
  // Find finishTypeId from finishFilter
  const selectedFinishType = finishTypes?.find(ft => ft.name === finishFilter);
  const finishTypeId = selectedFinishType?._id;
  
  // Function to update filters without reload
  const updateFilters = useCallback((updates: {
    productType?: string | null;
    gadget?: string | null;
    finish?: string | null;
  }) => {
    setIsFilterTransitioning(true);
    
    // Update state
    if (updates.productType !== undefined) {
      setProductCategory(updates.productType as typeof productCategory);
      // Clear dependent filters when category changes
      if (updates.gadget === undefined) {
        setGadgetFilter(null);
      }
      if (updates.finish === undefined) {
        setFinishFilter(null);
      }
    }
    if (updates.gadget !== undefined) {
      setGadgetFilter(updates.gadget);
      // Clear finish when gadget changes
      if (updates.finish === undefined) {
        setFinishFilter(null);
      }
    }
    if (updates.finish !== undefined) {
      setFinishFilter(updates.finish);
    }
    
    // Update URL without reload
    const params = new URLSearchParams(window.location.search);
    if (updates.productType !== undefined) {
      if (updates.productType) {
        params.set('productType', updates.productType);
      } else {
        params.delete('productType');
      }
      // Clear dependent params
      if (updates.gadget === undefined) {
        params.delete('gadget');
      }
      if (updates.finish === undefined) {
        params.delete('finish');
      }
    }
    if (updates.gadget !== undefined) {
      if (updates.gadget) {
        params.set('gadget', updates.gadget);
      } else {
        params.delete('gadget');
      }
      // Clear finish param
      if (updates.finish === undefined) {
        params.delete('finish');
      }
    }
    if (updates.finish !== undefined) {
      if (updates.finish) {
        params.set('finish', updates.finish);
      } else {
        params.delete('finish');
      }
    }
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);
    
    // Reset transitioning state after brief delay
    setTimeout(() => setIsFilterTransitioning(false), 300);
  }, []);
  
  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setProductCategory(params.get('productType') as typeof productCategory);
      setGadgetFilter(params.get('gadget'));
      setFinishFilter(params.get('finish'));
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  
  // Use paginated query - load 100 products at a time
  const { results: productsData, status, loadMore } = usePaginatedQuery(
    api.products.getAllProductsPaginated,
    { 
      status: "active",
      productCategory: productCategory || undefined,
      gadgetTypeId: gadgetTypeId || undefined,
      finishTypeId: finishTypeId || undefined,
      ...(brandFilter && modelFilter ? { gadgetCategory: "phone" } : {})
    },
    { initialNumItems: 100 }
  );
  
  // Intersection observer for infinite scroll
  const observerTarget = useRef<HTMLDivElement>(null);
  
  const handleLoadMore = useCallback(() => {
    if (status === "CanLoadMore") {
      loadMore(100);
    }
  }, [status, loadMore]);
  
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
  
  // Get collection if collection parameter is present
  const collection = useQuery(
    api.collections.getCollectionByName,
    collectionParam ? { name: collectionParam } : "skip"
  );
  
  // State for collection pagination
  const [collectionOffset, setCollectionOffset] = useState(0);
  const collectionPageSize = 30;
  
  // Reset collection offset and accumulated products when collection changes
  useEffect(() => {
    setCollectionOffset(0);
    setAccumulatedCollectionProducts([]);
  }, [collectionParam]);
  
  // Get collection products if we have a collection (paginated)
  const collectionProductsData = useQuery(
    api.collections.getCollectionProductsPaginated,
    collection?._id ? { 
      collectionId: collection._id,
      limit: collectionPageSize,
      offset: collectionOffset 
    } : "skip"
  );
  
  // Extract products and metadata
  const collectionProducts = collectionProductsData?.products;
  const hasMoreCollectionProducts = collectionProductsData?.hasMore || false;
  
  // Get all collections - filter by phone category if brand/model selected
  const phoneCollections = useQuery(
    api.collections.getCollectionsByCategory,
    brandFilter && modelFilter ? { category: "phone" } : "skip"
  );
  const allCollectionsGeneral = useQuery(
    api.collections.getAllCollections,
    !brandFilter || !modelFilter ? {} : "skip"
  );
  const allCollections = brandFilter && modelFilter ? phoneCollections : allCollectionsGeneral;

  const testConnection = async () => {
    try {
      const result = await verifyConnection({});
      toast.success(`Connected to: ${result.shop} (${result.domain})`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Connection failed";
      toast.error(`Connection Error: ${errorMsg}`);
      console.error("Shopify connection error:", err);
    }
  };
  
  // Handle model request submission
  const handleModelRequestSubmit = async () => {
    if (!modelRequestBrand.trim() || !modelRequestModel.trim() || !modelRequestCategory || !modelRequestPhone.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    
    try {
      await createModelRequest({
        brandName: modelRequestBrand.trim(),
        modelName: modelRequestModel.trim(),
        category: modelRequestCategory,
        whatsappPhone: modelRequestPhone.trim(),
      });
      toast.success("Model request submitted! We'll notify you when it's added.");
      setIsModelRequestOpen(false);
      setModelRequestBrand("");
      setModelRequestModel("");
      setModelRequestCategory("");
      setModelRequestPhone("");
    } catch (error) {
      toast.error("Failed to submit request. Please try again.");
      console.error("Model request error:", error);
    }
  };

  // State to accumulate collection products across pagination
  const [accumulatedCollectionProducts, setAccumulatedCollectionProducts] = useState<ConvexProduct[]>([]);
  
  // Accumulate collection products as we paginate
  useEffect(() => {
    if (collectionProducts && Array.isArray(collectionProducts)) {
      if (collectionOffset === 0) {
        // First page - replace
        setAccumulatedCollectionProducts(collectionProducts);
      } else {
        // Subsequent pages - append
        setAccumulatedCollectionProducts(prev => [...prev, ...collectionProducts]);
      }
    }
  }, [collectionProducts, collectionOffset]);
  
  // Convert Convex products to the format needed
  const allProducts = useMemo(() => {
    // If we have a collection, use accumulated collection products
    if (collectionParam && accumulatedCollectionProducts.length > 0) {
      return accumulatedCollectionProducts.map((product) => ({
        _id: product._id,
        slug: product.slug,
        title: product.title,
        description: product.description,
        status: product.status,
        tags: product.tags.join(", "),
        images: product.images,
        gadgetCategory: product.gadgetCategory,
        finishType: product.finishType,
        variants: product.variants.map((v) => ({
          _id: v._id,
          title: v.title,
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          sku: v.sku,
          inventory_quantity: v.inventoryQuantity,
          available: v.inventoryQuantity > 0,
        })),
      }));
    }
    
    // Otherwise use regular paginated products
    if (!productsData || productsData.length === 0) return [];
    
    return productsData.map((product) => ({
      _id: product._id,
      slug: product.slug,
      title: product.title,
      description: product.description,
      status: product.status,
      tags: product.tags.join(", "),
      images: product.images,
      gadgetCategory: product.gadgetCategory,
      finishType: product.finishType,
      variants: product.variants.map((v) => ({
        _id: v._id,
        title: v.title,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        sku: v.sku,
        inventory_quantity: v.inventoryQuantity,
        available: v.inventoryQuantity > 0,
      })),
    }));
  }, [productsData, accumulatedCollectionProducts, collectionParam]);

  // Apply search filter (backend handles productCategory, gadgetTypeId, finishTypeId filtering)
  const filteredProducts = useMemo(() => {
    let filtered = [...allProducts];
    
    // Filter by search query
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(searchLower) || 
        p.description?.toLowerCase().includes(searchLower) ||
        p.tags?.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  }, [allProducts, searchQuery]);
  
  // Apply sorting and stock filtering
  const sortedAndFilteredProducts = useMemo(() => {
    let result = [...filteredProducts];
    
    // Apply stock filter
    if (stockFilter === "in-stock") {
      result = result.filter(p => p.variants.some(v => v.available && v.inventory_quantity > 0));
    } else if (stockFilter === "out-of-stock") {
      result = result.filter(p => p.variants.every(v => !v.available || v.inventory_quantity === 0));
    }
    
    // Apply sorting
    if (sortBy === "price-low-high") {
      result.sort((a, b) => {
        const minPriceA = Math.min(...a.variants.map(v => v.price));
        const minPriceB = Math.min(...b.variants.map(v => v.price));
        return minPriceA - minPriceB;
      });
    } else if (sortBy === "price-high-low") {
      result.sort((a, b) => {
        const maxPriceA = Math.max(...a.variants.map(v => v.price));
        const maxPriceB = Math.max(...b.variants.map(v => v.price));
        return maxPriceB - maxPriceA;
      });
    } else if (sortBy === "latest") {
      // Sort by _creationTime instead
      result.sort((a, b) => {
        // Since we don't have _creationTime in our mapped data, reverse order by index
        const indexA = allProducts.findIndex(p => p._id === a._id);
        const indexB = allProducts.findIndex(p => p._id === b._id);
        return indexB - indexA;
      });
    }
    
    // Auto-sort by stock status if enabled (in-stock first, OOS last)
    if (autoSortOOS?.value === true) {
      result.sort((a, b) => {
        const aInStock = a.variants.some(v => v.available && v.inventory_quantity > 0);
        const bInStock = b.variants.some(v => v.available && v.inventory_quantity > 0);
        
        // In-stock products come first
        if (aInStock && !bInStock) return -1;
        if (!aInStock && bInStock) return 1;
        return 0;
      });
    }
    
    return result;
  }, [filteredProducts, sortBy, stockFilter, allProducts, autoSortOOS]);
  
  // Track search events
  useEffect(() => {
    if (searchQuery.trim() && searchQuery !== lastTrackedSearch) {
      trackSearch(searchQuery, sortedAndFilteredProducts.length);
      setLastTrackedSearch(searchQuery);
    }
  }, [searchQuery, sortedAndFilteredProducts.length, lastTrackedSearch]);
  
  // Track collection views
  useEffect(() => {
    if (collectionParam && collection) {
      trackCollectionView(collection.name, collectionProducts?.length);
    }
  }, [collectionParam, collection, collectionProducts]);

  // Show finish selector when brand is selected and showFinish is true
  if (showFinish && brandFilter) {
    return (
      <div className="min-h-screen">
        <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img 
                src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" 
                alt="Skinly" 
                className="h-16"
              />
            </Link>
            <Button size="sm" asChild>
              <Link to="/">Back to Home</Link>
            </Button>
          </div>
        </nav>

        <section className="pt-32 pb-20 px-4">
          <div className="container mx-auto max-w-4xl">
            {/* Confirmation Message */}
            <div className="text-center mb-16 space-y-6">
              <div className="inline-block animate-bounce">
                <div className="size-20 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center text-4xl">
                  ✓
                </div>
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold text-balance">
                We Got You Covered!
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
                Perfect! Now pick the finish type for your {modelFilter || `${brandFilter.charAt(0).toUpperCase() + brandFilter.slice(1)} device`}
              </p>
            </div>

            {/* Finish Selection */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-6">
              <Card 
                className="group cursor-pointer relative overflow-hidden border-2 hover:border-primary transition-all hover:shadow-xl"
                onClick={() => window.location.href = `/products?brand=${brandFilter}${modelFilter ? `&model=${encodeURIComponent(modelFilter)}` : ''}&finish=matte${collectionParam ? `&collection=${encodeURIComponent(collectionParam)}` : ''}`}
              >
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-1.5 py-0.5 sm:px-3 sm:py-1 text-[8px] sm:text-xs font-semibold rounded-bl-lg">
                  CLASSIC
                </div>
                <CardContent className="pt-4 sm:pt-6 md:pt-8 space-y-2 sm:space-y-4 md:space-y-6 text-center px-2 sm:px-4 md:px-6">
                  <div className="text-3xl sm:text-5xl md:text-6xl mb-1 sm:mb-2 md:mb-4">🎨</div>
                  <h3 className="text-xs sm:text-lg md:text-2xl font-bold leading-tight">Matte Finish</h3>
                  <p className="text-muted-foreground text-[9px] sm:text-sm md:text-base leading-tight hidden sm:block">
                    Smooth, velvety texture with zero glare. Perfect for grip and that premium feel.
                  </p>
                  <Button className="w-full text-[9px] sm:text-sm h-6 sm:h-9 md:h-10" variant="outline">
                    <span className="hidden sm:inline">Choose Matte</span>
                    <span className="sm:hidden">Matte</span>
                  </Button>
                </CardContent>
              </Card>

              <Card 
                className="group cursor-pointer relative overflow-hidden border-2 hover:border-secondary transition-all hover:shadow-xl"
                onClick={() => window.location.href = `/products?brand=${brandFilter}${modelFilter ? `&model=${encodeURIComponent(modelFilter)}` : ''}&finish=embossed${collectionParam ? `&collection=${encodeURIComponent(collectionParam)}` : ''}`}
              >
                <div className="absolute top-0 right-0 bg-secondary text-secondary-foreground px-1.5 py-0.5 sm:px-3 sm:py-1 text-[8px] sm:text-xs font-semibold rounded-bl-lg">
                  PREMIUM
                </div>
                <CardContent className="pt-4 sm:pt-6 md:pt-8 space-y-2 sm:space-y-4 md:space-y-6 text-center px-2 sm:px-4 md:px-6">
                  <div className="text-3xl sm:text-5xl md:text-6xl mb-1 sm:mb-2 md:mb-4">✨</div>
                  <h3 className="text-xs sm:text-lg md:text-2xl font-bold leading-tight">3D Embossed</h3>
                  <p className="text-muted-foreground text-[9px] sm:text-sm md:text-base leading-tight hidden sm:block">
                    Raised textures you can feel. Touch meets art in the most satisfying way.
                  </p>
                  <Button className="w-full text-[9px] sm:text-sm h-6 sm:h-9 md:h-10" variant="outline">
                    <span className="hidden sm:inline">Choose 3D Embossed</span>
                    <span className="sm:hidden">3D</span>
                  </Button>
                </CardContent>
              </Card>

              <Card 
                className="group cursor-pointer relative overflow-hidden border-2 hover:border-accent transition-all hover:shadow-xl"
                onClick={() => window.location.href = `/products?brand=${brandFilter}${modelFilter ? `&model=${encodeURIComponent(modelFilter)}` : ''}&finish=transparent${collectionParam ? `&collection=${encodeURIComponent(collectionParam)}` : ''}`}
              >
                <div className="absolute top-0 right-0 bg-accent text-accent-foreground px-1.5 py-0.5 sm:px-3 sm:py-1 text-[8px] sm:text-xs font-semibold rounded-bl-lg">
                  SLEEK
                </div>
                <CardContent className="pt-4 sm:pt-6 md:pt-8 space-y-2 sm:space-y-4 md:space-y-6 text-center px-2 sm:px-4 md:px-6">
                  <div className="text-3xl sm:text-5xl md:text-6xl mb-1 sm:mb-2 md:mb-4">💎</div>
                  <h3 className="text-xs sm:text-lg md:text-2xl font-bold leading-tight">Transparent</h3>
                  <p className="text-muted-foreground text-[9px] sm:text-sm md:text-base leading-tight hidden sm:block">
                    Show off your phone's original color with our crystal-clear protective layer.
                  </p>
                  <Button className="w-full text-[9px] sm:text-sm h-6 sm:h-9 md:h-10" variant="outline">
                    <span className="hidden sm:inline">Choose Transparent</span>
                    <span className="sm:hidden">Clear</span>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const isInitialLoading = status === "LoadingFirstPage" || (collectionParam && collection === undefined);
  const isProductsLoading = isInitialLoading || isFilterTransitioning;

  if (filteredProducts.length === 0 && status === "Exhausted") {
    return (
      <div className="min-h-screen">
        <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img 
                src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" 
                alt="Skinly" 
                className="h-10"
              />
            </Link>
          </div>
        </nav>

        <div className="pt-16 sm:pt-24 pb-6 sm:pb-20 px-2 sm:px-4">
          <div className="container mx-auto max-w-2xl">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <PackageIcon />
                </EmptyMedia>
                <EmptyTitle>No Products Found</EmptyTitle>
                <EmptyDescription>
                  {deviceFilter || finishFilter || sortBy !== "default" || stockFilter !== "all"
                    ? `No products match your filters. Try adjusting your filters.`
                    : `Your Shopify store doesn't have any products yet.`}
                </EmptyDescription>
              </EmptyHeader>
              {(deviceFilter || finishFilter || sortBy !== "default" || stockFilter !== "all") && (
                <EmptyContent>
                  <Button onClick={() => {
                    setSortBy("default");
                    setStockFilter("all");
                    window.location.href = '/products';
                  }}>Clear All Filters</Button>
                </EmptyContent>
              )}
            </Empty>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* SEO Meta Tags */}
      <Helmet>
        <title>Shop Premium Phone Skins & Gadget Accessories | Skinly</title>
        <meta name="description" content="Browse 500+ unique phone skins and gadget accessories. Premium quality, perfect fit, bubble-free application." />
        
        {/* Open Graph Tags */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Shop Premium Phone Skins & Gadget Accessories | Skinly" />
        <meta property="og:description" content="Browse 500+ unique phone skins and gadget accessories. Premium quality, perfect fit, bubble-free application." />
        <meta property="og:url" content="https://goskinly.com/products" />
        <meta property="og:image" content="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Skinly" />
        
        {/* Twitter Card Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Shop Premium Phone Skins & Gadget Accessories | Skinly" />
        <meta name="twitter:description" content="Browse 500+ unique phone skins and gadget accessories. Premium quality, perfect fit, bubble-free application." />
        <meta name="twitter:image" content="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" />
        <meta name="twitter:site" content="@goskinly" />
      </Helmet>

      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <img 
              src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" 
              alt="Skinly" 
              className="h-8 sm:h-10"
            />
          </Link>
          
          {/* Header Search - Hidden on mobile, shown on tablet+ */}
          <div className="hidden md:flex flex-1 max-w-lg">
            <HeaderSearch onRequestModelClick={() => setIsModelRequestOpen(true)} />
          </div>
          
          <div className="flex items-center gap-2 sm:gap-6">
            <a href="/#products" className="text-[10px] sm:text-sm font-medium hover:text-primary transition-colors hidden sm:inline">
              Shop
            </a>
            <Link to="/products" className="text-[10px] sm:text-sm font-medium text-primary hidden sm:inline">
              All Products
            </Link>
            <Link to="/devices" className="text-[10px] sm:text-sm font-medium hover:text-primary transition-colors hidden sm:inline">
              Devices
            </Link>
            <Link to="/orders" className="text-[10px] sm:text-sm font-medium hover:text-primary transition-colors">
              Orders
            </Link>
            <CartButton />
          </div>
        </div>
      </nav>

      {/* Products Section */}
      <section className="pt-16 sm:pt-24 pb-6 sm:pb-20 px-2 sm:px-4">
        <div className="container mx-auto">
          <div className="text-center mb-3 sm:mb-12 space-y-1 sm:space-y-4">
            <h1 className="text-xl sm:text-4xl lg:text-5xl font-bold text-balance">
              {searchQuery ? `Search Results` :
               collectionParam && collection ? collection.name :
               deviceFilter ? `${deviceFilter.charAt(0).toUpperCase() + deviceFilter.slice(1)} Skins` : 
               finishFilter ? `${finishFilter.charAt(0).toUpperCase() + finishFilter.slice(1)} Finish` : 
               'Shop'}
            </h1>
            <p className="text-xs sm:text-xl text-muted-foreground max-w-2xl mx-auto text-balance hidden sm:block">
              {searchQuery 
                ? `${sortedAndFilteredProducts.length} ${sortedAndFilteredProducts.length === 1 ? "result" : "results"} for "${searchQuery}"`
                : `More than 500 Designs To Choose From Across Gadgets`
              }
            </p>
            
            {/* Search Bar - Hidden on mobile to save space */}
            <div className="max-w-md mx-auto pt-1 sm:pt-4 hidden sm:block">
              <div className="relative">
                <SearchIcon className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 size-4 sm:size-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search patterns & designs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 sm:pl-10 h-9 sm:h-12 text-sm sm:text-base"
                />
              </div>
            </div>
          </div>

          {/* Gadget Selector Welcome Banner - Show when brand and model are selected */}
          {brandFilter && modelFilter && modelInfo && (
            <div className="mb-6 max-w-4xl mx-auto">
              <GadgetSelectorBanner 
                brandName={brandFilter} 
                modelName={modelFilter}
                onChangeDevice={() => setIsDeviceSelectorOpen(true)}
              />
            </div>
          )}

          {/* Product Type Tabs - First level navigation */}
          {productCategories && (
            <div className="mb-4">
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                {productCategories.map((category) => {
                  // Map category IDs to icons and gradient colors
                  const categoryConfig = {
                    'skin': { icon: Package2, gradient: 'from-blue-500 to-purple-500' },
                    'case-cover': { icon: Shield, gradient: 'from-teal-500 to-cyan-500' },
                    'camera-ring': { icon: Video, gradient: 'from-violet-500 to-purple-500' },
                    'magneto-x': { icon: Zap, gradient: 'from-red-500 to-pink-500' },
                    'glass': { icon: Glasses, gradient: 'from-sky-500 to-blue-500' },
                    'accessory': { icon: ShoppingBag, gradient: 'from-orange-500 to-amber-500' },
                  };
                  
                  const config = categoryConfig[category.id as keyof typeof categoryConfig] || { icon: Box, gradient: 'from-gray-500 to-slate-500' };
                  const IconComponent = config.icon;
                  
                  return (
                    <button
                      key={category.id}
                      onClick={() => updateFilters({ productType: category.id })}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                        productCategory === category.id
                          ? `bg-gradient-to-r ${config.gradient} text-white shadow-lg scale-105`
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      <IconComponent className="size-4" />
                      {category.displayName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Gadget Category Tabs - Only show when Skins product type is selected */}
          {productCategory === 'skin' && gadgetTypes && (
            <div className="mb-4">
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                <button
                  onClick={() => updateFilters({ productType: 'skin', gadget: null })}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                    !gadgetFilter
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg scale-105'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  <Package2 className="size-4" />
                  All Gadgets
                </button>
                {gadgetTypes
                  .filter((gadgetType) => gadgetType.name !== 'accessory' && gadgetType.name !== 'cover')
                  .map((gadgetType) => {
                  // Map gadget type names to icons
                  const gadgetIconMap: Record<string, typeof Package2> = {
                    'phone': Smartphone,
                    'laptop': Laptop,
                    'tablet': Tablet,
                    'camera': Camera,
                    'lens': Camera,
                    'drone': Video,
                    'charger': Zap,
                    'console': Gamepad2,
                    'mac-mini': Box,
                  };
                  const IconComponent = gadgetIconMap[gadgetType.name] || Package2;
                  
                  return (
                    <button
                      key={gadgetType._id}
                      onClick={() => updateFilters({ productType: 'skin', gadget: gadgetType.name })}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                        gadgetFilter === gadgetType.name
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg scale-105'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      <IconComponent className="size-4" />
                      {gadgetType.displayName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}



          {/* Finish Tabs - Only show when Skins product type is selected AND gadget is selected */}
          {productCategory === 'skin' && gadgetFilter && finishTypes && (
            <div className="mb-4 sm:mb-6">
              <div className="border-b">
                <div className="flex gap-1 overflow-x-auto no-scrollbar">
                  {finishTypes.map((finishType) => (
                    <button
                      key={finishType._id}
                      onClick={() => updateFilters({ finish: finishType.name })}
                      className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold whitespace-nowrap transition-colors border-b-2 ${
                        finishFilter === finishType.name
                          ? 'border-primary text-primary' 
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {finishType.displayName}
                    </button>
                  ))}
                  <button
                    onClick={() => updateFilters({ finish: null })}
                    className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold whitespace-nowrap transition-colors border-b-2 ${
                      !finishFilter 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    All Finishes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Collection Tabs - Show only phone collections when brand/model selected */}
          {allCollections && allCollections.length > 0 && brandFilter && modelFilter && (
            <div className="mb-4 sm:mb-6">
              {/* Mobile: 2 rows max with horizontal scroll */}
              <div className="sm:hidden overflow-x-auto no-scrollbar">
                <div className="grid grid-flow-col auto-cols-max grid-rows-2 gap-2">
                  <button
                    onClick={() => window.location.href = `/products?brand=${encodeURIComponent(brandFilter)}&model=${encodeURIComponent(modelFilter)}${finishFilter ? `&finish=${finishFilter}` : ''}`}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                      !collectionParam 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    All Categories
                  </button>
                  {allCollections.map((col) => (
                    <button
                      key={col._id}
                      onClick={() => window.location.href = `/products?brand=${encodeURIComponent(brandFilter)}&model=${encodeURIComponent(modelFilter)}&collection=${encodeURIComponent(col.name)}${finishFilter ? `&finish=${finishFilter}` : ''}`}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                        collectionParam === col.name 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {col.name}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Desktop: Normal flex wrap */}
              <div className="hidden sm:flex flex-wrap gap-2">
                <button
                  onClick={() => window.location.href = `/products?brand=${encodeURIComponent(brandFilter)}&model=${encodeURIComponent(modelFilter)}${finishFilter ? `&finish=${finishFilter}` : ''}`}
                  className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                    !collectionParam 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  All Categories
                </button>
                {allCollections.map((col) => (
                  <button
                    key={col._id}
                    onClick={() => window.location.href = `/products?brand=${encodeURIComponent(brandFilter)}&model=${encodeURIComponent(modelFilter)}&collection=${encodeURIComponent(col.name)}${finishFilter ? `&finish=${finishFilter}` : ''}`}
                    className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                      collectionParam === col.name 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {col.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filters Section */}
          <div className="mb-4 sm:mb-8">
            {/* Combined Sort & Stock Filter (left aligned) */}
            <div className="flex items-center gap-3">
              <Select 
                value={`${sortBy}|${stockFilter}`}
                onValueChange={(value) => {
                  const [sort, stock] = value.split('|');
                  setSortBy(sort);
                  setStockFilter(stock);
                }}
              >
                <SelectTrigger className="w-[120px] sm:w-[140px] h-8 sm:h-10 text-xs sm:text-sm">
                  <SelectValue placeholder="Filters" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">SORT BY</p>
                    <SelectItem value="default|all">Default</SelectItem>
                    <SelectItem value="price-low-high|all">Price: Low to High</SelectItem>
                    <SelectItem value="price-high-low|all">Price: High to Low</SelectItem>
                    <SelectItem value="latest|all">Latest</SelectItem>
                    <div className="border-t my-2"></div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">STOCK</p>
                    <SelectItem value="default|in-stock">In Stock Only</SelectItem>
                    <SelectItem value="default|out-of-stock">Out of Stock Only</SelectItem>
                  </div>
                </SelectContent>
              </Select>

              {(deviceFilter || finishFilter || searchQuery || collectionParam || sortBy !== "default" || stockFilter !== "all" || gadgetFilter || productCategory) && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setSortBy("default");
                  setStockFilter("all");
                  updateFilters({ productType: null, gadget: null, finish: null });
                }} className="h-8 sm:h-10 text-xs sm:text-sm">
                  Clear All
                </Button>
              )}
            </div>
          </div>

          {/* Products Grid - Show loading state or actual products */}
          {isProductsLoading ? (
            <>
              {/* Loading indicator */}
              <div className="flex items-center justify-center gap-3 py-8 mb-4 bg-muted/30 rounded-lg">
                <Loader2Icon className="size-6 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">
                  {productCategory && gadgetFilter && finishFilter 
                    ? `Loading ${finishFilter} ${gadgetFilter} skins...`
                    : productCategory && gadgetFilter
                    ? `Loading ${gadgetFilter} products...`
                    : productCategory
                    ? `Loading ${productCategory} products...`
                    : "Loading products..."}
                </p>
              </div>
              
              {/* Skeleton cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Card key={i} className="p-0">
                    <Skeleton className="aspect-square w-full rounded-t-xl" />
                    <div className="px-1 pt-0.5 pb-1 sm:p-4 space-y-0.5">
                      <Skeleton className="h-3 sm:h-6 w-full" />
                      <Skeleton className="h-3 sm:h-4 w-12 sm:w-24" />
                      <Skeleton className="h-5 sm:h-10 w-full" />
                    </div>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-6">
                  {sortedAndFilteredProducts.map((product) => {
                  const mainImage = product.images[0];
                  const minPrice = Math.min(...product.variants.map(v => v.price));
                  const maxPrice = Math.max(...product.variants.map(v => v.price));
                  
                  const priceDisplay = minPrice === maxPrice 
                    ? `₹${minPrice.toFixed(0)}`
                    : `₹${minPrice.toFixed(0)} - ₹${maxPrice.toFixed(0)}`;
                  
                  // Check if all variants are out of stock
                  const isOutOfStock = product.variants.every(v => !v.available || v.inventory_quantity === 0);

                  const productUrl = `/products/detail?slug=${product.slug}${modelFilter ? `&model=${encodeURIComponent(modelFilter)}` : ''}${brandFilter ? `&brand=${brandFilter}` : ''}`;
                  
                  return (
                    <Link key={product._id} to={productUrl}>
                      <Card className="group overflow-hidden border hover:border-primary transition-all hover:shadow-xl p-0 cursor-pointer">
                        <div className="relative aspect-square overflow-hidden bg-muted">
                          <ProductImage 
                            product={product} 
                            brandFilter={brandFilter} 
                            modelFilter={modelFilter}
                          />
                          {isOutOfStock && autoSortOOS && (
                            <div className="absolute top-2 left-2 right-2">
                              <Badge className="w-full justify-center bg-orange-500/90 hover:bg-orange-500 text-white text-[8px] sm:text-xs font-semibold py-0.5 sm:py-1">
                                Sold Out
                              </Badge>
                            </div>
                          )}
                        </div>
                        <div className="px-1 pt-0.5 pb-1 sm:p-4 space-y-0.5 sm:space-y-2">
                          <h3 className="font-semibold text-[10px] leading-[1.2] sm:text-lg sm:leading-normal line-clamp-2">{product.title}</h3>
                          <span className="text-[11px] sm:text-lg font-bold text-primary block">{priceDisplay}</span>
                          {isOutOfStock && autoSortOOS ? (
                            <div className="w-full text-[10px] sm:text-sm h-5 sm:h-10 px-0.5 sm:px-4 inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground">
                              <BellIcon className="size-3 sm:size-4 mr-1" />
                              <span className="hidden sm:inline">Request Restock</span>
                              <span className="sm:hidden">Restock</span>
                            </div>
                          ) : (
                            <div className="w-full text-[10px] sm:text-sm h-5 sm:h-10 px-0.5 sm:px-4 inline-flex items-center justify-center whitespace-nowrap rounded-md text-primary-foreground font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary hover:bg-primary/90">
                              <span className="hidden sm:inline">Select Your Device</span>
                              <span className="sm:hidden">Select</span>
                            </div>
                          )}
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
              
              {/* Infinite scroll trigger */}
              {collectionParam ? (
                // Collection pagination
                <div className="py-8 flex justify-center">
                  {hasMoreCollectionProducts && (
                    <Button 
                      onClick={() => setCollectionOffset(prev => prev + collectionPageSize)} 
                      variant="outline" 
                      size="lg"
                      disabled={!collectionProducts}
                    >
                      {collectionProducts ? "Load More Products" : "Loading..."}
                    </Button>
                  )}
                  {!hasMoreCollectionProducts && allProducts.length > 30 && (
                    <p className="text-muted-foreground text-sm">
                      You've reached the end! 🎉
                    </p>
                  )}
                </div>
              ) : (
                // Regular product pagination
                <div ref={observerTarget} className="py-8 flex justify-center">
                  {status === "LoadingMore" && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2Icon className="size-5 animate-spin" />
                      <span>Loading more products...</span>
                    </div>
                  )}
                  {status === "CanLoadMore" && (
                    <Button 
                      onClick={handleLoadMore} 
                      variant="outline" 
                      size="lg"
                    >
                      Load More Products
                    </Button>
                  )}
                  {status === "Exhausted" && allProducts.length > 30 && (
                    <p className="text-muted-foreground text-sm">
                      You've reached the end! 🎉
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>
      
      {/* Model Request Dialog */}
      <Dialog open={isModelRequestOpen} onOpenChange={setIsModelRequestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Your Model</DialogTitle>
            <DialogDescription>
              Can't find your device? Let us know and we'll add it!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Brand *</Label>
              <Input
                id="brand"
                placeholder="e.g., Apple, Samsung, OnePlus"
                value={modelRequestBrand}
                onChange={(e) => setModelRequestBrand(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model Name *</Label>
              <Input
                id="model"
                placeholder="e.g., iPhone 15 Pro Max"
                value={modelRequestModel}
                onChange={(e) => setModelRequestModel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Device Type *</Label>
              <Select value={modelRequestCategory} onValueChange={setModelRequestCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select device type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="laptop">Laptop</SelectItem>
                  <SelectItem value="tablet">Tablet</SelectItem>
                  <SelectItem value="camera">Camera</SelectItem>
                  <SelectItem value="lens">Lens</SelectItem>
                  <SelectItem value="console">Gaming Console</SelectItem>
                  <SelectItem value="drone">Drone</SelectItem>
                  <SelectItem value="charger">Charger</SelectItem>
                  <SelectItem value="mac-mini">Mac Mini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">WhatsApp Number *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="e.g., +919876543210"
                value={modelRequestPhone}
                onChange={(e) => setModelRequestPhone(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsModelRequestOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleModelRequestSubmit}
                disabled={!modelRequestBrand.trim() || !modelRequestModel.trim() || !modelRequestCategory || !modelRequestPhone.trim()}
              >
                Submit Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Device Selector Dialog */}
      <DeviceSelectorDialog
        open={isDeviceSelectorOpen}
        onOpenChange={setIsDeviceSelectorOpen}
      />
    </div>
  );
}
