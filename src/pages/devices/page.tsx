import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { SearchIcon, ChevronDownIcon, ChevronUpIcon, SmartphoneIcon } from "lucide-react";
import { CartButton } from "@/components/cart.tsx";

// Import phone models data
import { phoneModels } from "@/lib/phone-models.ts";

export default function DevicesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());

  // Calculate total models
  const totalModels = useMemo(() => {
    return Object.values(phoneModels).reduce((acc, models) => acc + models.length, 0);
  }, []);

  // Filter and search logic
  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) {
      return Object.entries(phoneModels).map(([brand, models]) => ({
        brand,
        models,
        matchCount: models.length,
      }));
    }

    const searchLower = searchQuery.toLowerCase();
    return Object.entries(phoneModels)
      .map(([brand, models]) => {
        const matchingModels = models.filter((model) =>
          model.toLowerCase().includes(searchLower)
        );
        return {
          brand,
          models: matchingModels,
          matchCount: matchingModels.length,
        };
      })
      .filter((item) => item.matchCount > 0 || item.brand.toLowerCase().includes(searchLower));
  }, [searchQuery]);

  const toggleBrand = (brand: string) => {
    const newExpanded = new Set(expandedBrands);
    if (newExpanded.has(brand)) {
      newExpanded.delete(brand);
    } else {
      newExpanded.add(brand);
    }
    setExpandedBrands(newExpanded);
  };

  const expandAll = () => {
    setExpandedBrands(new Set(filteredBrands.map((item) => item.brand)));
  };

  const collapseAll = () => {
    setExpandedBrands(new Set());
  };

  return (
    <div className="min-h-screen bg-background">
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
            <Link to="/#products" className="text-sm font-medium hover:text-primary transition-colors">
              Categories
            </Link>
            <Link to="/products" className="text-sm font-medium hover:text-primary transition-colors">
              All Products
            </Link>
            <Link to="/orders" className="text-sm font-medium hover:text-primary transition-colors">
              My Orders
            </Link>
            <CartButton />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-12 px-4 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center space-y-4 mb-8">
            <div className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-semibold mb-2">
              DEVICE COMPATIBILITY
            </div>
            <h1 className="text-4xl lg:text-6xl font-bold text-balance">
              Supported Devices
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto text-balance">
              Premium skins and protection for {totalModels}+ smartphone models. Find your device and explore our quirky designs.
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by brand or model (e.g., iPhone 15 Pro, Galaxy S24...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 text-base border-2 focus:border-primary"
              />
            </div>
            {searchQuery && (
              <div className="mt-3 text-sm text-muted-foreground text-center">
                Found {filteredBrands.length} brand(s) with{" "}
                {filteredBrands.reduce((acc, item) => acc + item.matchCount, 0)} matching model(s)
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Devices List */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          {/* Controls */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <SmartphoneIcon className="size-5 text-primary" />
              <h2 className="text-2xl font-bold">
                {filteredBrands.length} Brand{filteredBrands.length !== 1 ? "s" : ""}
              </h2>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandAll}>
                Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                Collapse All
              </Button>
            </div>
          </div>

          {/* Brands List */}
          <div className="space-y-3">
            {filteredBrands.map(({ brand, models, matchCount }) => {
              const isExpanded = expandedBrands.has(brand);

              return (
                <Card key={brand} className="overflow-hidden border-2 hover:border-primary/50 transition-colors">
                  <button
                    onClick={() => toggleBrand(brand)}
                    className="w-full p-6 flex items-center justify-between hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                        📱
                      </div>
                      <div className="text-left">
                        <h3 className="text-xl font-bold">{brand}</h3>
                        <p className="text-sm text-muted-foreground">
                          {matchCount} supported model{matchCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-semibold">
                        {matchCount}
                      </Badge>
                      {isExpanded ? (
                        <ChevronUpIcon className="size-5 text-muted-foreground" />
                      ) : (
                        <ChevronDownIcon className="size-5 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <CardContent className="pt-0 pb-6 px-6">
                      <div className="border-t pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {models.map((model, idx) => (
                            <Link
                              key={idx}
                              to={`/products?brand=${brand.toLowerCase()}&model=${encodeURIComponent(model)}&showFinish=true`}
                              className="p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-all group"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium group-hover:text-primary transition-colors">
                                  {model}
                                </span>
                                <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                                  →
                                </span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          {filteredBrands.length === 0 && (
            <Card className="p-12 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-2xl font-bold mb-2">No devices found</h3>
              <p className="text-muted-foreground mb-6">
                Try a different search term or browse all brands
              </p>
              <Button onClick={() => setSearchQuery("")}>Clear Search</Button>
            </Card>
          )}

          {/* CTA Section */}
          <Card className="mt-12 p-8 bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10 border-2">
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-bold">Don't see your device?</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                We're constantly adding support for new devices. Contact us if your model isn't listed yet.
              </p>
              <div className="flex gap-3 justify-center">
                <Button asChild>
                  <Link to="/products">Browse All Products</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/">Back to Home</Link>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* SEO Content */}
      <section className="py-12 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl prose prose-slate dark:prose-invert">
          <h2>Premium Phone Skins for Every Device</h2>
          <p>
            Skinly offers high-quality phone skins and protection for over {totalModels} smartphone models from leading brands including Apple, Samsung, OnePlus, Google Pixel, and more. Our precision-cut skins are designed to fit your device perfectly while adding personality and protection.
          </p>
          <h3>Why Choose Skinly?</h3>
          <ul>
            <li><strong>Universal Compatibility:</strong> Support for all major phone brands and models</li>
            <li><strong>Premium Materials:</strong> High-quality vinyl with bubble-free application</li>
            <li><strong>Unique Designs:</strong> Quirky, artistic patterns you won't find anywhere else</li>
            <li><strong>Perfect Fit:</strong> Laser-cut precision for all buttons, ports, and cameras</li>
            <li><strong>Easy Application:</strong> Bubble-free installation with our application kit</li>
          </ul>
          <h3>Supported Brands</h3>
          <p>
            We support devices from {Object.keys(phoneModels).length} major brands: {Object.keys(phoneModels).join(", ")}.
          </p>
        </div>
      </section>
    </div>
  );
}
