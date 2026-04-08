import { useState, useMemo } from "react";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Link, useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { 
  SearchIcon, 
  ChevronDownIcon, 
  ChevronRightIcon,
  HelpCircleIcon,
  ZapIcon,
  Loader2Icon
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce.ts";

interface HeaderSearchProps {
  onRequestModelClick: () => void;
}

export function HeaderSearch({ onRequestModelClick }: HeaderSearchProps) {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [debouncedQuery] = useDebounce(searchQuery, 300);
  
  // Skip search on homepage since it has its own search
  const isHomepage = location.pathname === "/";

  // Server-side device search
  const deviceSearchResults = useQuery(
    api.supportedModels.searchModels,
    !isHomepage && debouncedQuery.trim().length >= 2 
      ? { query: debouncedQuery, limit: 15 }
      : "skip"
  );

  // Server-side product search
  const productSearchResults = useQuery(
    api.products.searchProducts,
    !isHomepage && debouncedQuery.trim().length >= 2 
      ? { query: debouncedQuery, limit: 15 }
      : "skip"
  );

  // Helper to normalize text for search
  const normalizeForSearch = (text: string): string => {
    return text.toLowerCase().replace(/[\s\-_]/g, '');
  };

  // Process search results
  const searchResults = useMemo(() => {
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
      if (product.variants) {
        product.variants.forEach((variant: any) => {
          if (variant.sku && normalizeForSearch(variant.sku).includes(normalizeForSearch(query))) {
            skuMatches.push({ product: product as typeof designMatches[0], variant });
          }
        });
      }
    });

    return {
      devices: deviceMatches,
      designs: designMatches,
      skus: skuMatches.slice(0, 10)
    };
  }, [searchQuery, deviceSearchResults, productSearchResults]);

  const hasResults = searchResults.devices.length > 0 || 
                     searchResults.designs.length > 0 || 
                     searchResults.skus.length > 0;

  // Auto-expand categories with results
  const categoriesInResults = useMemo(() => {
    const categories = new Set<string>();
    searchResults.devices.forEach(device => categories.add(device.category));
    return categories;
  }, [searchResults.devices]);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };
  
  // Return null on homepage (after all hooks have been called)
  if (isHomepage) return null;

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search devices, skins, magneto x, cases..."
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
          onBlur={() => {
            // Delay to allow clicks on results
            setTimeout(() => setShowResults(false), 200);
          }}
          className="pl-9 h-10 text-sm"
        />
      </div>

      {/* Search Results Dropdown */}
      {showResults && searchQuery.trim().length > 0 && (
        <Card className="absolute top-full mt-2 w-full max-w-2xl left-0 md:left-auto md:right-0 max-h-[70vh] overflow-y-auto border-2 shadow-xl z-50">
          <CardContent className="p-4">
            {debouncedQuery.trim().length >= 2 && (deviceSearchResults === undefined || productSearchResults === undefined) ? (
              // Loading state
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2Icon className="size-6 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Searching...</p>
              </div>
            ) : !hasResults ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-2">No results found</p>
                <p className="text-sm text-muted-foreground/70">Try different search terms</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Device Models Section */}
                {searchResults.devices.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground mb-2">DEVICES</h3>
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
                                className="w-full flex items-center justify-between p-2 hover:bg-muted rounded-md text-left"
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
                                      to={device.category === "Phones" 
                                        ? `/products?brand=${encodeURIComponent(device.brand)}&model=${encodeURIComponent(device.model)}&fromGadgetSelector=true`
                                        : `/products?brand=${encodeURIComponent(device.brand)}&model=${encodeURIComponent(device.model)}&fromGadgetSelector=true`
                                      }
                                      className="block p-2 hover:bg-muted rounded-md text-sm"
                                      onClick={() => setShowResults(false)}
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
                    <h3 className="text-xs font-semibold text-muted-foreground mb-2">DESIGNS</h3>
                    <div className="space-y-1">
                      {searchResults.designs.map(product => (
                        <Link
                          key={product._id}
                          to={`/products/${product.slug}`}
                          className="flex items-center gap-3 p-2 hover:bg-muted rounded-md"
                          onClick={() => setShowResults(false)}
                        >
                          {product.images && product.images[0] && (
                            <img 
                              src={product.images[0].url} 
                              alt={product.title}
                              width="48"
                              height="48"
                              className="size-12 object-cover rounded-lg flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{product.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {product.variants?.length || 0} variant{product.variants?.length !== 1 ? 's' : ''}
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
                    <h3 className="text-xs font-semibold text-muted-foreground mb-2">SKUs</h3>
                    <div className="space-y-1">
                      {searchResults.skus.map(({ product, variant }) => (
                        <Link
                          key={variant._id}
                          to={`/products/${product.slug}`}
                          className="flex items-center gap-3 p-2 hover:bg-muted rounded-md"
                          onClick={() => setShowResults(false)}
                        >
                          {product.images && product.images[0] && (
                            <img 
                              src={product.images[0].url} 
                              alt={product.title}
                              width="48"
                              height="48"
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
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <HelpCircleIcon className="size-3" />
                  <span>Can't Find Your Device?</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    onRequestModelClick();
                    setShowResults(false);
                  }}
                  className="bg-primary/5 hover:bg-primary/10 text-primary border-2 border-primary/40 hover:border-primary/60"
                >
                  <ZapIcon className="size-3 mr-2" />
                  Request Your Model
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
