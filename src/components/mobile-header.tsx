import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { 
  MenuIcon, 
  SearchIcon, 
  UserIcon, 
  ShoppingCartIcon,
  XIcon,
  Loader2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  HelpCircleIcon,
  ZapIcon
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { cn } from "@/lib/utils.ts";

interface MobileHeaderProps {
  onMenuClick?: () => void;
  onRequestModelClick?: () => void;
}

export function MobileHeader({ onMenuClick, onRequestModelClick }: MobileHeaderProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [debouncedQuery] = useDebounce(searchQuery, 300);

  // Fetch homepage settings
  const homepageSettings = useQuery(api.homepage.getHomepageSettings);
  
  // Fetch cart count
  const cartItems = useQuery(api.cart.getCart);
  const cartCount = cartItems?.reduce((acc, item) => acc + item.quantity, 0) || 0;

  // Server-side device search
  const deviceSearchResults = useQuery(
    api.supportedModels.searchModels,
    debouncedQuery.trim().length >= 2 
      ? { query: debouncedQuery, limit: 15 }
      : "skip"
  );

  // Server-side product search
  const productSearchResults = useQuery(
    api.products.searchProducts,
    debouncedQuery.trim().length >= 2 
      ? { query: debouncedQuery, limit: 15 }
      : "skip"
  );

  // Helper to normalize text for search
  const normalizeForSearch = (text: string): string => {
    return text.toLowerCase().replace(/[\s\-_]/g, '');
  };

  // Process search results
  const searchResults = (() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return { devices: [], designs: [], skus: [] };
    
    // 1. Device Models
    const deviceMatches = (deviceSearchResults || []).map(model => {
      const categoryName = 
        model.category === "phone" ? "Phones" :
        model.category === "camera" ? "Cameras" :
        model.category === "lens" ? "Lenses" :
        model.category === "tablet" ? "Tablets" :
        model.category === "mac-mini" ? "Mac Mini" :
        model.category === "console" ? "Gaming Consoles" :
        model.category === "drone" ? "Drones" :
        model.category === "charger" ? "Chargers" : "Other";
      
      const icon = 
        model.category === "phone" ? "📱" :
        model.category === "camera" ? "📷" :
        model.category === "lens" ? "🔍" :
        model.category === "tablet" ? "📱" :
        model.category === "mac-mini" ? "💻" :
        model.category === "console" ? "🎮" :
        model.category === "drone" ? "🚁" :
        model.category === "charger" ? "🔌" : "📱";

      return {
        category: categoryName,
        brand: model.brandName,
        model: model.modelName,
        icon
      };
    });

    // 2. Products
    const productsFromSearch = productSearchResults || [];
    const designMatches = productsFromSearch.map(product => ({
      _id: product._id,
      title: product.title,
      slug: product.slug,
      images: product.images,
      variants: product.variants,
    }));

    // 3. SKU matches
    const skuMatches: Array<{ product: typeof designMatches[0]; variant: typeof designMatches[0]['variants'][0] }> = [];
    productsFromSearch.forEach(product => {
      product.variants.forEach(variant => {
        if (variant.sku && normalizeForSearch(variant.sku).includes(normalizeForSearch(query))) {
          skuMatches.push({ product: product as typeof designMatches[0], variant });
        }
      });
    });

    return {
      devices: deviceMatches,
      designs: designMatches,
      skus: skuMatches.slice(0, 10)
    };
  })();

  const hasResults = searchResults.devices.length > 0 || 
                     searchResults.designs.length > 0 || 
                     searchResults.skus.length > 0;

  const categoriesInResults = (() => {
    const categories = new Set<string>();
    searchResults.devices.forEach(device => categories.add(device.category));
    return categories;
  })();

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handleSearchToggle = () => {
    setIsSearchExpanded(!isSearchExpanded);
    if (isSearchExpanded) {
      // Closing search
      setSearchQuery("");
      setShowResults(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle search submit if needed
  };

  const logoUrl = homepageSettings?.logoImageUrl || "https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv";
  const logoLink = homepageSettings?.logoRedirectLink || "/";
  const showSearch = homepageSettings?.showSearchIcon ?? true;

  return (
    <>
      {/* Main Header */}
      <header 
        className={cn(
          "fixed top-[28px] left-0 right-0 z-40 bg-background border-b border-border transition-all duration-300",
          isSearchExpanded ? "h-16" : "h-16"
        )}
      >
        <div className="h-full px-4 flex items-center justify-between gap-3">
          {isSearchExpanded ? (
            // Expanded Search Header
            <>
              <button
                onClick={handleSearchToggle}
                className="flex-shrink-0 p-2 -ml-2 hover:bg-muted rounded-full transition-colors"
                aria-label="Close search"
              >
                <XIcon className="size-5 text-foreground" />
              </button>
              
              <form onSubmit={handleSearchSubmit} className="flex-1">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search your device or model"
                    value={searchQuery}
                    onChange={(e) => {
                      const query = e.target.value;
                      setSearchQuery(query);
                      setShowResults(query.trim().length > 0);
                    }}
                    onFocus={() => {
                      if (searchQuery.trim().length > 0) {
                        setShowResults(true);
                      }
                    }}
                    className="pl-9 pr-4 h-10 text-sm rounded-full bg-muted border-none focus-visible:ring-2 focus-visible:ring-primary"
                    autoFocus
                  />
                </div>
              </form>
            </>
          ) : (
            // Normal Header
            <>
              {/* Left: Menu Icon */}
              <button
                onClick={onMenuClick}
                className="flex-shrink-0 p-2 -ml-2 hover:bg-muted rounded-full transition-colors"
                aria-label="Open menu"
              >
                <MenuIcon className="size-6 text-foreground" />
              </button>

              {/* Left: Search Icon (conditional) */}
              {showSearch && (
                <button
                  onClick={handleSearchToggle}
                  className="flex-shrink-0 p-2 hover:bg-muted rounded-full transition-colors"
                  aria-label="Search"
                >
                  <SearchIcon className="size-5 text-foreground" />
                </button>
              )}

              {/* Center: Logo */}
              <Link 
                to={logoLink} 
                className="flex-1 flex items-center justify-center"
              >
                <img 
                  src={logoUrl}
                  alt="Skinly" 
                  className="h-10 w-auto object-contain"
                />
              </Link>

              {/* Right: Profile Icon */}
              <button
                onClick={() => navigate(user ? "/account" : "/auth/callback")}
                className="flex-shrink-0 p-2 hover:bg-muted rounded-full transition-colors"
                aria-label="Account"
              >
                <UserIcon className="size-5 text-foreground" />
              </button>

              {/* Right: Cart Icon with Badge */}
              <button
                onClick={() => navigate("/cart")}
                className="flex-shrink-0 p-2 -mr-2 hover:bg-muted rounded-full transition-colors relative"
                aria-label="Cart"
              >
                <ShoppingCartIcon className="size-5 text-foreground" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 size-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Search Results Overlay */}
      {isSearchExpanded && showResults && searchQuery.trim().length > 0 && (
        <div className="fixed inset-x-0 top-[92px] bottom-0 z-40 bg-background overflow-y-auto">
          <div className="container mx-auto px-4 py-4">
            {debouncedQuery.trim().length >= 2 && (deviceSearchResults === undefined || productSearchResults === undefined) ? (
              // Loading state
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2Icon className="size-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Searching...</p>
              </div>
            ) : !hasResults ? (
              <div className="text-center py-12">
                <p className="text-base text-foreground mb-2">No results found</p>
                <p className="text-sm text-muted-foreground">Try different search terms</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Device Models Section */}
                {searchResults.devices.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground mb-3">DEVICES</h3>
                    <div className="space-y-1">
                      {(() => {
                        const groupedByCategory: Record<string, typeof searchResults.devices> = {};
                        searchResults.devices.forEach(device => {
                          if (!groupedByCategory[device.category]) {
                            groupedByCategory[device.category] = [];
                          }
                          groupedByCategory[device.category].push(device);
                        });

                        return Object.entries(groupedByCategory).map(([category, devices]) => {
                          const isExpanded = expandedCategories.has(category) || categoriesInResults.has(category);
                          
                          return (
                            <div key={category}>
                              <button
                                onClick={() => toggleCategory(category)}
                                className="w-full flex items-center justify-between p-3 hover:bg-muted rounded-lg text-left"
                              >
                                <span className="text-sm font-medium flex items-center gap-2">
                                  <span>{devices[0].icon}</span>
                                  <span>{category}</span>
                                  <span className="text-xs text-muted-foreground">({devices.length})</span>
                                </span>
                                {isExpanded ? (
                                  <ChevronDownIcon className="size-4" />
                                ) : (
                                  <ChevronRightIcon className="size-4" />
                                )}
                              </button>
                              {isExpanded && (
                                <div className="ml-8 space-y-1 mt-1">
                                  {devices.map((device, idx) => (
                                    <Link
                                      key={idx}
                                      to={`/products?brand=${encodeURIComponent(device.brand)}&model=${encodeURIComponent(device.model)}&fromGadgetSelector=true`}
                                      className="block p-3 hover:bg-muted rounded-lg text-sm"
                                      onClick={() => {
                                        setShowResults(false);
                                        setIsSearchExpanded(false);
                                        setSearchQuery("");
                                      }}
                                    >
                                      {device.brand} {device.model}
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

                {/* Product Designs Section */}
                {searchResults.designs.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground mb-3">DESIGNS</h3>
                    <div className="space-y-2">
                      {searchResults.designs.map(product => (
                        <Link
                          key={product._id}
                          to={`/products/${product.slug}`}
                          className="flex items-center gap-3 p-3 hover:bg-muted rounded-lg"
                          onClick={() => {
                            setShowResults(false);
                            setIsSearchExpanded(false);
                            setSearchQuery("");
                          }}
                        >
                          {product.images[0] && (
                            <img 
                              src={product.images[0].url} 
                              alt={product.title}
                              className="size-12 object-cover rounded-lg flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{product.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {product.variants.length} variant{product.variants.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* SKUs Section */}
                {searchResults.skus.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground mb-3">SKUs</h3>
                    <div className="space-y-2">
                      {searchResults.skus.map(({ product, variant }) => (
                        <Link
                          key={variant._id}
                          to={`/products/${product.slug}`}
                          className="flex items-center gap-3 p-3 hover:bg-muted rounded-lg"
                          onClick={() => {
                            setShowResults(false);
                            setIsSearchExpanded(false);
                            setSearchQuery("");
                          }}
                        >
                          {product.images[0] && (
                            <img 
                              src={product.images[0].url} 
                              alt={product.title}
                              className="size-12 object-cover rounded-lg flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{product.title}</p>
                            <p className="text-xs text-muted-foreground">
                              SKU: {variant.sku} • {variant.title}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Request Model Button */}
            {onRequestModelClick && (
              <div className="mt-6 pt-6 border-t border-border">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <HelpCircleIcon className="size-4" />
                    <span>Can't Find Your Device?</span>
                  </div>
                  <Button
                    size="lg"
                    onClick={() => {
                      onRequestModelClick();
                      setShowResults(false);
                      setIsSearchExpanded(false);
                      setSearchQuery("");
                    }}
                    className="w-full max-w-xs bg-primary hover:bg-primary/90"
                  >
                    <ZapIcon className="size-4 mr-2" />
                    Request Your Model
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
