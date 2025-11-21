import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useEffect, useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { AlertCircleIcon, PackageIcon, SearchIcon, InfoIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Input } from "@/components/ui/input.tsx";

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  description: string;
  vendor: string;
  product_type: string;
  tags: string;
  status: string;
  images: Array<{ id: number; src: string; alt: string | null }>;
  variants: Array<{
    id: number;
    title: string;
    price: string;
    sku: string;
    inventory_quantity: number;
    available: boolean;
  }>;
}

export default function ProductsPage() {
  const getAllProducts = useAction(api.shopify.getAllProducts);
  const verifyConnection = useAction(api.shopify.verifyConnection);
  const [allProducts, setAllProducts] = useState<ShopifyProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ShopifyProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const deviceFilter = urlParams.get('device');
  const finishFilter = urlParams.get('finish');
  const brandFilter = urlParams.get('brand');
  const modelFilter = urlParams.get('model');
  const showFinish = urlParams.get('showFinish') === 'true';

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

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    async function fetchProducts() {
      try {
        setIsLoading(true);
        setError(null);
        
        // Set a timeout to show error if it takes too long
        timeoutId = setTimeout(() => {
          setError("Request is taking longer than expected. Please check your Shopify credentials in the Secrets tab.");
          setIsLoading(false);
        }, 15000); // 15 second timeout
        
        const data = await getAllProducts({});
        clearTimeout(timeoutId);
        
        if (!data || data.length === 0) {
          toast.info("No products found in your Shopify store");
        }
        
        setAllProducts(data);
        applyFilters(data, deviceFilter, finishFilter, brandFilter, searchQuery);
      } catch (err) {
        clearTimeout(timeoutId);
        const errorMsg = err instanceof Error ? err.message : "Failed to load products";
        setError(errorMsg);
        toast.error(`Error: ${errorMsg}`);
      } finally {
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    }
    fetchProducts();
    
    return () => clearTimeout(timeoutId);
  }, [getAllProducts, deviceFilter, finishFilter, brandFilter, searchQuery]);

  // Apply filters when products or filters change
  useEffect(() => {
    if (allProducts.length > 0) {
      applyFilters(allProducts, deviceFilter, finishFilter, brandFilter, searchQuery);
    }
  }, [allProducts, deviceFilter, finishFilter, brandFilter, searchQuery]);

  const applyFilters = (products: ShopifyProduct[], device: string | null, finish: string | null, brand: string | null, search: string) => {
    let filtered = [...products];
    
    // Filter by device
    if (device) {
      filtered = filtered.filter(p => {
        const title = p.title.toLowerCase();
        if (device === 'phone') return title.includes('phone') || title.includes('iphone') || title.includes('samsung') || title.includes('oneplus');
        if (device === 'laptop') return title.includes('laptop') || title.includes('macbook');
        if (device === 'mac mini') return title.includes('mac mini');
        if (device === 'drone') return title.includes('drone');
        if (device === 'camera') return title.includes('camera');
        if (device === 'lens') return title.includes('lens');
        if (device === 'charger') return title.includes('charger');
        if (device === 'ipad') return title.includes('ipad') || title.includes('tablet');
        if (device === 'console') return title.includes('console') || title.includes('playstation') || title.includes('xbox') || title.includes('nintendo');
        return false;
      });
    }
    
    // Filter by finish (brand selection doesn't filter products, just guides user to finish selection)
    if (finish) {
      filtered = filtered.filter(p => {
        const title = p.title.toLowerCase();
        if (finish === 'matte') return title.includes('matte');
        if (finish === 'embossed') return title.includes('3d textured') || title.includes('3d embossed');
        if (finish === 'transparent') return title.includes('tranzy');
        return false;
      });
    }
    
    // Filter by search query
    if (search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(searchLower) || 
        p.description?.toLowerCase().includes(searchLower) ||
        p.tags?.toLowerCase().includes(searchLower)
      );
    }
    
    setFilteredProducts(filtered);
  };

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

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="size-8 bg-gradient-to-br from-primary via-secondary to-accent rounded-lg" />
              <span className="text-xl font-bold">SkinStudio</span>
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

  if (error) {
    return (
      <div className="min-h-screen">
        <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="size-8 bg-gradient-to-br from-primary via-secondary to-accent rounded-lg" />
              <span className="text-xl font-bold">SkinStudio</span>
            </Link>
          </div>
        </nav>

        <div className="pt-24 pb-20 px-4">
          <div className="container mx-auto max-w-2xl">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AlertCircleIcon />
                </EmptyMedia>
                <EmptyTitle>Connection Error</EmptyTitle>
                <EmptyDescription>
                  {error}
                  <br />
                  <br />
                  Make sure you've added your Shopify credentials in the Secrets tab.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <div className="flex gap-2">
                  <Button onClick={() => window.location.reload()}>Try Again</Button>
                  <Button variant="outline" onClick={testConnection}>Test Connection</Button>
                </div>
              </EmptyContent>
            </Empty>
          </div>
        </div>
      </div>
    );
  }

  if (filteredProducts.length === 0 && !isLoading && !error) {
    return (
      <div className="min-h-screen">
        <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="size-8 bg-gradient-to-br from-primary via-secondary to-accent rounded-lg" />
              <span className="text-xl font-bold">SkinStudio</span>
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
                  {deviceFilter || finishFilter
                    ? `No products match your filters. Try browsing all products.`
                    : `Your Shopify store doesn't have any products yet.`}
                </EmptyDescription>
              </EmptyHeader>
              {(deviceFilter || finishFilter) && (
                <EmptyContent>
                  <Button onClick={() => window.location.href = '/products'}>View All Products</Button>
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
            <Button size="sm">Cart</Button>
          </div>
        </div>
      </nav>

      {/* Products Section */}
      <section className="pt-24 pb-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12 space-y-4">
            <h1 className="text-4xl lg:text-5xl font-bold text-balance">
              {deviceFilter ? `${deviceFilter.charAt(0).toUpperCase() + deviceFilter.slice(1)} Skins` : 
               finishFilter ? `${finishFilter.charAt(0).toUpperCase() + finishFilter.slice(1)} Finish` : 
               'All Products'}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
              {filteredProducts.length} quirky {filteredProducts.length === 1 ? "skin" : "skins"} ready to make your tech pop
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
            
            {(deviceFilter || finishFilter) && (
              <Button variant="outline" onClick={() => window.location.href = '/products'}>
                Clear Filters
              </Button>
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
            {filteredProducts.map((product) => {
              const mainImage = product.images[0];
              const minPrice = Math.min(...product.variants.map(v => parseFloat(v.price)));
              const maxPrice = Math.max(...product.variants.map(v => parseFloat(v.price)));
              
              const priceDisplay = minPrice === maxPrice 
                ? `₹${minPrice.toFixed(0)}`
                : `₹${minPrice.toFixed(0)} - ₹${maxPrice.toFixed(0)}`;

              return (
                <Card key={product.id} className="group overflow-hidden border-2 hover:border-primary transition-all hover:shadow-xl">
                  <div className="aspect-square overflow-hidden bg-muted">
                    {mainImage ? (
                      <img
                        src={mainImage.src}
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
                    {product.vendor && (
                      <p className="text-sm text-muted-foreground">{product.vendor}</p>
                    )}
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
                      <Link to={`/products/detail?id=${product.id}`}>
                        Select My Phone Model
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
