import { usePaginatedQuery, useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { AlertCircleIcon, PackageIcon, SearchIcon, InfoIcon, ArrowUpDown, Loader2Icon, BellIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Input } from "@/components/ui/input.tsx";
import { CartButton } from "@/components/cart.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { trackSearch, trackCollectionView } from "@/lib/analytics.ts";

import type { Id } from "@/convex/_generated/dataModel.d.ts";

interface ConvexProduct {
  _id: Id<"products">;
  title: string;
  slug: string;
  description: string;
  status: "active" | "draft" | "archived";
  images: Array<{ url: string; alt?: string }>;
  tags: string[];
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
  
  // Use paginated query - load 30 products at a time
  const { results: productsData, status, loadMore } = usePaginatedQuery(
    api.products.getAllProductsPaginated,
    { status: "active" },
    { initialNumItems: 30 }
  );
  
  // Intersection observer for infinite scroll
  const observerTarget = useRef<HTMLDivElement>(null);
  
  const handleLoadMore = useCallback(() => {
    if (status === "CanLoadMore") {
      loadMore(30);
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
  
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const deviceFilter = urlParams.get('device');
  const finishFilter = urlParams.get('finish');
  const brandFilter = urlParams.get('brand');
  const modelFilter = urlParams.get('model');
  const showFinish = urlParams.get('showFinish') === 'true';
  const urlSearchQuery = urlParams.get('search') || '';
  const collectionParam = urlParams.get('collection') || '';
  
  const [searchQuery, setSearchQuery] = useState(urlSearchQuery);
  const [sortBy, setSortBy] = useState<string>("default");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [lastTrackedSearch, setLastTrackedSearch] = useState<string>("");
  
  // Get collection if collection parameter is present
  const collection = useQuery(
    api.collections.getCollectionByName,
    collectionParam ? { name: collectionParam } : "skip"
  );
  
  // Get collection products if we have a collection
  const collectionProducts = useQuery(
    api.collections.getCollectionProducts,
    collection?._id ? { collectionId: collection._id } : "skip"
  );
  
  // Get all collections for the dropdown
  const allCollections = useQuery(api.collections.getAllCollections, {});

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

  // Convert Convex products to the format needed
  const allProducts = useMemo(() => {
    // If we have a collection, use collection products instead
    if (collectionParam && collectionProducts) {
      return collectionProducts.map((product) => ({
        _id: product._id,
        slug: product.slug,
        title: product.title,
        description: product.description,
        status: product.status,
        tags: product.tags.join(", "),
        images: product.images,
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
  }, [productsData, collectionProducts, collectionParam]);

  // Apply filters
  const filteredProducts = useMemo(() => {
    let filtered = [...allProducts];
    
    // Filter by device
    if (deviceFilter) {
      filtered = filtered.filter(p => {
        const title = p.title.toLowerCase();
        if (deviceFilter === 'phone') return title.includes('phone') || title.includes('iphone') || title.includes('samsung') || title.includes('oneplus');
        if (deviceFilter === 'laptop') return title.includes('laptop') || title.includes('macbook');
        if (deviceFilter === 'mac mini') return title.includes('mac mini');
        if (deviceFilter === 'drone') return title.includes('drone');
        if (deviceFilter === 'camera') return title.includes('camera');
        if (deviceFilter === 'lens') return title.includes('lens');
        if (deviceFilter === 'charger') return title.includes('charger');
        if (deviceFilter === 'ipad') return title.includes('ipad') || title.includes('tablet');
        if (deviceFilter === 'console') return title.includes('console') || title.includes('playstation') || title.includes('xbox') || title.includes('nintendo');
        return false;
      });
    }
    
    // Filter by finish
    if (finishFilter) {
      filtered = filtered.filter(p => {
        const title = p.title.toLowerCase();
        if (finishFilter === 'matte') return title.includes('matte');
        if (finishFilter === 'embossed') return title.includes('3d textured') || title.includes('3d embossed');
        if (finishFilter === 'transparent') return title.includes('tranzy');
        return false;
      });
    }
    
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
  }, [allProducts, deviceFilter, finishFilter, searchQuery]);
  
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
    if (autoSortOOS === true) {
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
                className="h-10"
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
            <div className="grid md:grid-cols-3 gap-6">
              <Card 
                className="group cursor-pointer relative overflow-hidden border-2 hover:border-primary transition-all hover:shadow-xl"
                onClick={() => window.location.href = `/products?brand=${brandFilter}${modelFilter ? `&model=${encodeURIComponent(modelFilter)}` : ''}&finish=matte`}
              >
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold rounded-bl-lg">
                  CLASSIC
                </div>
                <CardContent className="pt-8 space-y-6 text-center">
                  <div className="text-6xl mb-4">🎨</div>
                  <h3 className="text-2xl font-bold">Matte Finish</h3>
                  <p className="text-muted-foreground">
                    Smooth, velvety texture with zero glare. Perfect for grip and that premium feel.
                  </p>
                  <Button className="w-full" variant="outline">
                    Choose Matte
                  </Button>
                </CardContent>
              </Card>

              <Card 
                className="group cursor-pointer relative overflow-hidden border-2 hover:border-secondary transition-all hover:shadow-xl"
                onClick={() => window.location.href = `/products?brand=${brandFilter}${modelFilter ? `&model=${encodeURIComponent(modelFilter)}` : ''}&finish=embossed`}
              >
                <div className="absolute top-0 right-0 bg-secondary text-secondary-foreground px-3 py-1 text-xs font-semibold rounded-bl-lg">
                  PREMIUM
                </div>
                <CardContent className="pt-8 space-y-6 text-center">
                  <div className="text-6xl mb-4">✨</div>
                  <h3 className="text-2xl font-bold">3D Embossed Finish</h3>
                  <p className="text-muted-foreground">
                    Raised textures you can feel. Touch meets art in the most satisfying way.
                  </p>
                  <Button className="w-full" variant="outline">
                    Choose 3D Embossed
                  </Button>
                </CardContent>
              </Card>

              <Card 
                className="group cursor-pointer relative overflow-hidden border-2 hover:border-accent transition-all hover:shadow-xl"
                onClick={() => window.location.href = `/products?brand=${brandFilter}${modelFilter ? `&model=${encodeURIComponent(modelFilter)}` : ''}&finish=transparent`}
              >
                <div className="absolute top-0 right-0 bg-accent text-accent-foreground px-3 py-1 text-xs font-semibold rounded-bl-lg">
                  SLEEK
                </div>
                <CardContent className="pt-8 space-y-6 text-center">
                  <div className="text-6xl mb-4">💎</div>
                  <h3 className="text-2xl font-bold">Transparent Finish</h3>
                  <p className="text-muted-foreground">
                    Show off your phone's original color with our crystal-clear protective layer.
                  </p>
                  <Button className="w-full" variant="outline">
                    Choose Transparent
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
  
  if (isInitialLoading) {
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
          <div className="container mx-auto">
            <div className="mb-3 sm:mb-12">
              <Skeleton className="h-6 sm:h-12 w-32 sm:w-64 mx-auto mb-2 sm:mb-4" />
              <Skeleton className="h-4 sm:h-6 w-48 sm:w-96 mx-auto hidden sm:block" />
            </div>
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
          </div>
        </div>
      </div>
    );
  }

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
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img 
              src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" 
              alt="Skinly" 
              className="h-8 sm:h-10"
            />
          </Link>
          <div className="flex items-center gap-2 sm:gap-6">
            <a href="/#products" className="text-[10px] sm:text-sm font-medium hover:text-primary transition-colors hidden sm:inline">
              Shop
            </a>
            <Link to="/products" className="text-[10px] sm:text-sm font-medium text-primary hidden sm:inline">
              All Products
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
               'All Products'}
            </h1>
            <p className="text-xs sm:text-xl text-muted-foreground max-w-2xl mx-auto text-balance hidden sm:block">
              {searchQuery 
                ? `${sortedAndFilteredProducts.length} ${sortedAndFilteredProducts.length === 1 ? "result" : "results"} for "${searchQuery}"`
                : `${sortedAndFilteredProducts.length} quirky ${sortedAndFilteredProducts.length === 1 ? "skin" : "skins"} ready to make your tech pop`
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
            
            {/* Sorting and Filtering - Compact on mobile */}
            <div className="max-w-4xl mx-auto pt-1 sm:pt-6 flex flex-wrap gap-1.5 sm:gap-3 justify-center items-center">
              {/* Collections Filter */}
              <Select 
                value={collectionParam || "all"} 
                onValueChange={(value) => {
                  if (value === "all") {
                    window.location.href = '/products';
                  } else {
                    window.location.href = `/products?collection=${encodeURIComponent(value)}`;
                  }
                }}
              >
                <SelectTrigger className="w-[110px] sm:w-[180px] h-7 sm:h-10 text-[10px] sm:text-sm">
                  <SelectValue placeholder="Collection" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Collections</SelectItem>
                  {allCollections?.map((col) => (
                    <SelectItem key={col._id} value={col.name}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[110px] sm:w-[200px] h-7 sm:h-10 text-[10px] sm:text-sm">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="price-low-high">Price: Low to High</SelectItem>
                  <SelectItem value="price-high-low">Price: High to Low</SelectItem>
                  <SelectItem value="latest">Latest</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-[100px] sm:w-[180px] h-7 sm:h-10 text-[10px] sm:text-sm">
                  <SelectValue placeholder="Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="in-stock">In Stock</SelectItem>
                  <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {(deviceFilter || finishFilter || searchQuery || collectionParam || sortBy !== "default" || stockFilter !== "all") && (
              <div className="pt-1 sm:pt-4">
                <Button variant="outline" size="sm" onClick={() => {
                  setSortBy("default");
                  setStockFilter("all");
                  window.location.href = '/products';
                }} className="h-6 sm:h-10 text-[10px] sm:text-sm px-2 sm:px-4">
                  Clear Filters
                </Button>
              </div>
            )}
          </div>

          {/* Important Notice for Finish Pages */}
          {finishFilter && (
            <Card className="mb-2 sm:mb-8 border border-primary bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10 overflow-hidden">
              <CardContent className="p-2 sm:p-6">
                <div className="flex items-center gap-2 sm:gap-6">
                  {/* Left side - Icons - Hidden on mobile */}
                  <div className="hidden sm:flex gap-2 sm:gap-3 shrink-0">
                    <div className="size-12 sm:size-16 bg-gradient-to-br from-primary to-secondary rounded-xl sm:rounded-2xl flex items-center justify-center text-2xl sm:text-3xl shadow-lg">
                      📱
                    </div>
                    <div className="size-12 sm:size-16 bg-gradient-to-br from-secondary to-accent rounded-xl sm:rounded-2xl flex items-center justify-center text-2xl sm:text-3xl shadow-lg">
                      ✨
                    </div>
                    <div className="size-12 sm:size-16 bg-gradient-to-br from-accent to-primary rounded-xl sm:rounded-2xl flex items-center justify-center text-2xl sm:text-3xl shadow-lg">
                      ✓
                    </div>
                  </div>
                  
                  {/* Right side - Text */}
                  <div className="flex-1 text-left space-y-0 sm:space-y-2">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <InfoIcon className="size-3 sm:size-5 text-primary shrink-0" />
                      <h3 className="text-xs sm:text-2xl font-bold text-primary">All designs available for your device!</h3>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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

              return (
                <Card key={product._id} className="group overflow-hidden border hover:border-primary transition-all hover:shadow-xl p-0">
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    {mainImage ? (
                      <img
                        src={mainImage.url}
                        alt={mainImage.alt || product.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <PackageIcon className="size-8 sm:size-16 text-muted-foreground" />
                      </div>
                    )}
                    {isOutOfStock && autoSortOOS && (
                      <div className="absolute top-2 left-2 right-2">
                        <Badge className="w-full justify-center bg-orange-500/90 hover:bg-orange-500 text-white text-[8px] sm:text-xs font-semibold py-0.5 sm:py-1">
                          OUT OF STOCK - REQUEST RESTOCK
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div className="px-1 pt-0.5 pb-1 sm:p-4 space-y-0.5 sm:space-y-2">
                    <h3 className="font-semibold text-[10px] leading-[1.2] sm:text-lg sm:leading-normal line-clamp-2">{product.title}</h3>
                    <span className="text-[11px] sm:text-lg font-bold text-primary block">{priceDisplay}</span>
                    {isOutOfStock && autoSortOOS ? (
                      <Button 
                        className="w-full text-[10px] sm:text-sm h-5 sm:h-10 px-0.5 sm:px-4" 
                        variant="outline"
                        asChild
                      >
                        <Link to={`/products/detail?slug=${product.slug}${modelFilter ? `&model=${encodeURIComponent(modelFilter)}` : ''}${brandFilter ? `&brand=${brandFilter}` : ''}`}>
                          <BellIcon className="size-3 sm:size-4 mr-1" />
                          <span className="hidden sm:inline">Request Restock</span>
                          <span className="sm:hidden">Restock</span>
                        </Link>
                      </Button>
                    ) : (
                      <Button className="w-full text-[10px] sm:text-sm h-5 sm:h-10 px-0.5 sm:px-4" asChild>
                        <Link to={`/products/detail?slug=${product.slug}${modelFilter ? `&model=${encodeURIComponent(modelFilter)}` : ''}${brandFilter ? `&brand=${brandFilter}` : ''}`}>
                          <span className="hidden sm:inline">Select My Phone Model</span>
                          <span className="sm:hidden">Select</span>
                        </Link>
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
          
          {/* Infinite scroll trigger - only show if not using collection filtering */}
          {!collectionParam && (
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
        </div>
      </section>
    </div>
  );
}
