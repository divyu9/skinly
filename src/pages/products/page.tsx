import { usePaginatedQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { AlertCircleIcon, PackageIcon, SearchIcon, InfoIcon, ArrowUpDown, Loader2Icon } from "lucide-react";
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
  
  const [searchQuery, setSearchQuery] = useState(urlSearchQuery);
  const [sortBy, setSortBy] = useState<string>("default");
  const [stockFilter, setStockFilter] = useState<string>("all");

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
  }, [productsData]);

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
    
    return result;
  }, [filteredProducts, sortBy, stockFilter, allProducts]);

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

  const isInitialLoading = status === "LoadingFirstPage";
  
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

        <div className="pt-24 pb-20 px-4">
          <div className="container mx-auto">
            <div className="mb-12">
              <Skeleton className="h-12 w-64 mx-auto mb-4" />
              <Skeleton className="h-6 w-96 mx-auto" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i}>
                  <Skeleton className="aspect-square w-full rounded-t-xl" />
                  <CardContent className="pt-4 space-y-2">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-4 w-24" />
                  </CardContent>
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

        <div className="pt-24 pb-20 px-4">
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
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img 
              src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" 
              alt="Skinly" 
              className="h-10"
            />
          </Link>
          <div className="flex items-center gap-6">
            <a href="/#products" className="text-sm font-medium hover:text-primary transition-colors">
              Shop
            </a>
            <Link to="/products" className="text-sm font-medium text-primary">
              All Products
            </Link>
            <Link to="/orders" className="text-sm font-medium hover:text-primary transition-colors">
              My Orders
            </Link>
            <CartButton />
          </div>
        </div>
      </nav>

      {/* Products Section */}
      <section className="pt-24 pb-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12 space-y-4">
            <h1 className="text-4xl lg:text-5xl font-bold text-balance">
              {searchQuery ? `Search Results` :
               deviceFilter ? `${deviceFilter.charAt(0).toUpperCase() + deviceFilter.slice(1)} Skins` : 
               finishFilter ? `${finishFilter.charAt(0).toUpperCase() + finishFilter.slice(1)} Finish` : 
               'All Products'}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
              {searchQuery 
                ? `${sortedAndFilteredProducts.length} ${sortedAndFilteredProducts.length === 1 ? "result" : "results"} for "${searchQuery}"`
                : `${sortedAndFilteredProducts.length} quirky ${sortedAndFilteredProducts.length === 1 ? "skin" : "skins"} ready to make your tech pop`
              }
            </p>
            
            {/* Search Bar */}
            <div className="max-w-md mx-auto pt-4">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search patterns & designs (not phone models)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 text-base"
                />
              </div>
            </div>
            
            {/* Sorting and Filtering */}
            <div className="max-w-4xl mx-auto pt-6 flex flex-wrap gap-3 justify-center items-center">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="size-4 text-muted-foreground" />
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="price-low-high">Price: Low to High</SelectItem>
                    <SelectItem value="price-high-low">Price: High to Low</SelectItem>
                    <SelectItem value="latest">Latest Addition</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <PackageIcon className="size-4 text-muted-foreground" />
                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Stock Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    <SelectItem value="in-stock">In Stock</SelectItem>
                    <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {(deviceFilter || finishFilter || searchQuery || sortBy !== "default" || stockFilter !== "all") && (
              <div className="pt-4">
                <Button variant="outline" onClick={() => {
                  setSortBy("default");
                  setStockFilter("all");
                  window.location.href = '/products';
                }}>
                  Clear All Filters
                </Button>
              </div>
            )}
          </div>

          {/* Important Notice for Finish Pages */}
          {finishFilter && (
            <Card className="mb-8 border-2 border-primary bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  {/* Left side - Icons */}
                  <div className="flex gap-3 shrink-0">
                    <div className="size-16 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center text-3xl shadow-lg">
                      📱
                    </div>
                    <div className="size-16 bg-gradient-to-br from-secondary to-accent rounded-2xl flex items-center justify-center text-3xl shadow-lg">
                      ✨
                    </div>
                    <div className="size-16 bg-gradient-to-br from-accent to-primary rounded-2xl flex items-center justify-center text-3xl shadow-lg">
                      ✓
                    </div>
                  </div>
                  
                  {/* Right side - Text */}
                  <div className="flex-1 text-center md:text-left space-y-2">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                      <InfoIcon className="size-5 text-primary" />
                      <h3 className="text-2xl font-bold text-primary">Good News!</h3>
                    </div>
                    <p className="text-base leading-relaxed">
                      <strong className="font-semibold">All designs are available for your device!</strong> The images you see are for reference to show how the design and colors actually look on any phone. When you select a design, you'll be asked to choose your specific phone model.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {sortedAndFilteredProducts.map((product) => {
              const mainImage = product.images[0];
              const minPrice = Math.min(...product.variants.map(v => v.price));
              const maxPrice = Math.max(...product.variants.map(v => v.price));
              
              const priceDisplay = minPrice === maxPrice 
                ? `₹${minPrice.toFixed(0)}`
                : `₹${minPrice.toFixed(0)} - ₹${maxPrice.toFixed(0)}`;

              return (
                <Card key={product._id} className="group overflow-hidden border-2 hover:border-primary transition-all hover:shadow-xl">
                  <div className="aspect-square overflow-hidden bg-muted">
                    {mainImage ? (
                      <img
                        src={mainImage.url}
                        alt={mainImage.alt || product.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <PackageIcon className="size-16 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CardContent className="pt-4 space-y-2">
                    <h3 className="font-bold text-lg line-clamp-2">{product.title}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-primary">{priceDisplay}</span>
                      {product.variants.length > 1 && (
                        <span className="text-xs text-muted-foreground">
                          {product.variants.length} options
                        </span>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full" asChild>
                      <Link to={`/products/detail?slug=${product.slug}${modelFilter ? `&model=${encodeURIComponent(modelFilter)}` : ''}${brandFilter ? `&brand=${brandFilter}` : ''}`}>
                        Select My Phone Model
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
          
          {/* Infinite scroll trigger */}
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
        </div>
      </section>
    </div>
  );
}
