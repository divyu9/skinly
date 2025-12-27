import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { SearchIcon, ZapIcon, ChevronRightIcon } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { Link } from "react-router-dom";

interface ExploreModelsProps {
  onRequestModelClick: () => void;
}

export function ExploreModels({ onRequestModelClick }: ExploreModelsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebounce(searchQuery, 300);
  const [showResults, setShowResults] = useState(false);

  // Server-side device search
  const deviceSearchResults = useQuery(
    api.supportedModels.searchModels,
    debouncedQuery.trim().length >= 2 
      ? { query: debouncedQuery, limit: 20 }
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

  // Group device results by category
  const groupedResults = (() => {
    if (!deviceSearchResults) return {};
    
    const grouped: Record<string, typeof deviceSearchResults> = {};
    deviceSearchResults.forEach(model => {
      const category = model.category;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(model);
    });
    
    return grouped;
  })();

  // Process product search results
  const searchResults = (() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return { designs: [], skus: [] };
    
    const productsFromSearch = productSearchResults || [];
    const designMatches = productsFromSearch.map(product => ({
      _id: product._id,
      title: product.title,
      slug: product.slug,
      images: product.images,
      variants: product.variants,
    }));

    // SKU matches
    const skuMatches: Array<{ product: typeof designMatches[0]; variant: typeof designMatches[0]['variants'][0] }> = [];
    productsFromSearch.forEach(product => {
      product.variants.forEach(variant => {
        if (variant.sku && normalizeForSearch(variant.sku).includes(normalizeForSearch(query))) {
          skuMatches.push({ product: product as typeof designMatches[0], variant });
        }
      });
    });

    return {
      designs: designMatches,
      skus: skuMatches.slice(0, 10)
    };
  })();

  const hasResults = Object.keys(groupedResults).length > 0 || 
                     searchResults.designs.length > 0 || 
                     searchResults.skus.length > 0;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "phone": return "📱";
      case "camera": return "📷";
      case "lens": return "🔍";
      case "tablet": return "📱";
      case "mac-mini": return "💻";
      case "console": return "🎮";
      case "drone": return "🚁";
      case "charger": return "🔌";
      default: return "📱";
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case "phone": return "Phones";
      case "camera": return "Cameras";
      case "lens": return "Lenses";
      case "tablet": return "Tablets";
      case "mac-mini": return "Mac Mini";
      case "console": return "Gaming Consoles";
      case "drone": return "Drones";
      case "charger": return "Chargers";
      default: return "Other";
    }
  };

  return (
    <section className="bg-muted/30 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto space-y-6">
        {/* Title */}
        <div className="text-center space-y-2">
          <h2 className="text-3xl md:text-4xl font-bold">
            Find Your Device
          </h2>
          <p className="text-muted-foreground">
            Search for your device model to see available products
          </p>
        </div>

        {/* Search Input */}
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-primary" />
          <Input
            type="text"
            placeholder="Search devices, skins, cases, products..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowResults(e.target.value.trim().length > 0);
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
            className="h-14 pl-12 pr-32 text-base rounded-full border-[3px] border-primary/60 bg-background focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:border-primary shadow-lg"
          />
          <Button
            size="lg"
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full h-12 px-6 shadow-md"
            onClick={() => {
              if (searchQuery.trim().length > 0) {
                setShowResults(true);
              }
            }}
          >
            <SearchIcon className="size-4 mr-2" />
            Search
          </Button>
        </div>

        {/* Search Results */}
        {showResults && searchQuery.trim().length > 0 && (
          <Card className="border-2 shadow-xl max-h-[60vh] overflow-y-auto">
            <CardContent className="p-4">
              {debouncedQuery.trim().length >= 2 && (deviceSearchResults === undefined || productSearchResults === undefined) ? (
                // Loading
                <div className="space-y-6">
                  <div className="text-center py-8">
                    <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Searching...</p>
                  </div>
                  
                  {/* Request Model Button */}
                  <div className="flex flex-col items-center gap-3 pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Can't find your device?
                    </p>
                    <Button
                      size="lg"
                      onClick={() => {
                        onRequestModelClick();
                        setShowResults(false);
                        setSearchQuery("");
                      }}
                      className="rounded-full px-8 shadow-lg hover:shadow-xl transition-all hover:scale-105"
                    >
                      <ZapIcon className="size-4 mr-2" />
                      Request Your Model
                    </Button>
                  </div>
                </div>
              ) : !hasResults ? (
                // No results
                <div className="space-y-6">
                  <div className="text-center py-8">
                    <p className="text-foreground mb-2">No results found</p>
                    <p className="text-sm text-muted-foreground">
                      Try different search terms
                    </p>
                  </div>
                  
                  {/* Request Model Button */}
                  <div className="flex flex-col items-center gap-3 pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Can't find your device?
                    </p>
                    <Button
                      size="lg"
                      onClick={() => {
                        onRequestModelClick();
                        setShowResults(false);
                        setSearchQuery("");
                      }}
                      className="rounded-full px-8 shadow-lg hover:shadow-xl transition-all hover:scale-105"
                    >
                      <ZapIcon className="size-4 mr-2" />
                      Request Your Model
                    </Button>
                  </div>
                </div>
              ) : (
                // Results
                <div className="space-y-6">
                  {/* Device Models Section */}
                  {Object.keys(groupedResults).length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-semibold text-muted-foreground px-2">DEVICES</h3>
                      {Object.entries(groupedResults).map(([category, models]) => (
                        <div key={category}>
                          <h4 className="text-xs font-medium text-muted-foreground mb-2 px-2">
                            {getCategoryIcon(category)} {getCategoryName(category)} ({models.length})
                          </h4>
                          <div className="space-y-1">
                            {models.map((model, idx) => (
                              <Link
                                key={idx}
                                to={`/products?brand=${encodeURIComponent(model.brandName)}&model=${encodeURIComponent(model.modelName)}&fromGadgetSelector=true`}
                                className="flex items-center justify-between p-3 hover:bg-muted rounded-lg transition-colors group"
                                onClick={() => {
                                  setShowResults(false);
                                  setSearchQuery("");
                                }}
                              >
                                <span className="font-medium">
                                  {model.brandName} {model.modelName}
                                </span>
                                <ChevronRightIcon className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Product Designs Section */}
                  {searchResults.designs.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-2">DESIGNS</h3>
                      <div className="space-y-2">
                        {searchResults.designs.map(product => (
                          <Link
                            key={product._id}
                            to={`/products/${product.slug}`}
                            className="flex items-center gap-3 p-3 hover:bg-muted rounded-lg transition-colors"
                            onClick={() => {
                              setShowResults(false);
                              setSearchQuery("");
                            }}
                          >
                            {product.images[0] && (
                              <img 
                                src={product.images[0].url} 
                                alt={product.title}
                                width="56"
                                height="56"
                                className="size-14 object-cover rounded-lg flex-shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-base">{product.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {product.variants.length} variant{product.variants.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <ChevronRightIcon className="size-5 text-muted-foreground flex-shrink-0" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SKUs Section */}
                  {searchResults.skus.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-2">SKUs</h3>
                      <div className="space-y-2">
                        {searchResults.skus.map(({ product, variant }) => (
                          <Link
                            key={variant._id}
                            to={`/products/${product.slug}`}
                            className="flex items-center gap-3 p-3 hover:bg-muted rounded-lg transition-colors"
                            onClick={() => {
                              setShowResults(false);
                              setSearchQuery("");
                            }}
                          >
                            {product.images[0] && (
                              <img 
                                src={product.images[0].url} 
                                alt={product.title}
                                width="56"
                                height="56"
                                className="size-14 object-cover rounded-lg flex-shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-base">{product.title}</p>
                              <p className="text-sm text-muted-foreground">
                                SKU: {variant.sku} • {variant.title}
                              </p>
                            </div>
                            <ChevronRightIcon className="size-5 text-muted-foreground flex-shrink-0" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Request Model Button - always shown at bottom of search results */}
                  <div className="flex flex-col items-center gap-3 pt-4 mt-6 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Can't find your device?
                    </p>
                    <Button
                      size="lg"
                      onClick={() => {
                        onRequestModelClick();
                        setShowResults(false);
                        setSearchQuery("");
                      }}
                      className="rounded-full px-8 shadow-lg hover:shadow-xl transition-all hover:scale-105"
                    >
                      <ZapIcon className="size-4 mr-2" />
                      Request Your Model
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </section>
  );
}
