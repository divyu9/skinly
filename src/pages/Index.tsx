import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { 
  ShieldCheckIcon, 
  SparklesIcon, 
  PackageIcon, 
  TruckIcon,
  SearchIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  LaptopIcon,
  SmartphoneIcon,
  PlaneIcon,
  CameraIcon,
  CircleDotIcon,
  BatteryChargingIcon,
  TabletSmartphoneIcon,
  GamepadIcon
} from "lucide-react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState, useMemo, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Input } from "@/components/ui/input.tsx";
import { CartButton } from "@/components/cart.tsx";
import { Link } from "react-router-dom";
import { phoneModels } from "@/lib/phone-models.ts";
import {
  macMiniModels,
  lensModels,
  cameraModels,
  tabletModels,
  consoleModels,
  chargerModels,
  droneModels
} from "@/lib/device-models.ts";
import { DeviceSelectorDialog } from "./_components/device-selector-dialog.tsx";

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
    inventoryQuantity: number;
    sku?: string;
  }>;
}

type DeviceType = "phone" | "camera" | "lens" | "tablet" | "macmini" | "console" | "drone" | "charger";

export default function Index() {
  // Query products from Convex database - use pagination for better performance
  const { results: paginatedProducts } = usePaginatedQuery(
    api.products.getAllProductsPaginated,
    { status: "active" },
    { initialNumItems: 100 }
  );
  const products = paginatedProducts || [];
  const isLoadingProducts = !paginatedProducts;
  
  // Fetch latest supported models for marquee
  const latestModels = useQuery(api.supportedModels.getLatest, { count: 20 });
  
  // Fetch ALL supported models for search
  const allSupportedModels = useQuery(api.supportedModels.listAll, { isActive: true });
  
  const [homeSearchQuery, setHomeSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDeviceType, setDialogDeviceType] = useState<DeviceType | undefined>(undefined);
  
  // Ref for scrolling to device selector
  const deviceSelectorRef = useRef<HTMLElement>(null);
  
  // Function to scroll to device selector
  const scrollToDeviceSelector = () => {
    deviceSelectorRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });
  };

  // Product category filters - reduced to 3 per category for horizontal layout
  const matteProducts = useMemo(() => 
    products.filter(p => p.title.toLowerCase().includes('matte')).slice(0, 3),
    [products]
  );
  const embossedProducts = useMemo(() =>
    products.filter(p => 
      p.title.toLowerCase().includes('3d textured') || 
      p.title.toLowerCase().includes('3d embossed')
    ).slice(0, 3),
    [products]
  );
  const transparentProducts = useMemo(() =>
    products.filter(p => p.title.toLowerCase().includes('tranzy')).slice(0, 3),
    [products]
  );

  // Featured products - search by specific keywords
  const featuredProducts = useMemo(() => {
    const magneto = products.find(p => p.title.toLowerCase().includes('magneto x'));
    const autoapply = products.find(p => p.title.toLowerCase().includes('autoapply guard'));
    const magsafe = products.find(p => p.title.toLowerCase().includes('magsafe'));
    
    return [magneto, autoapply, magsafe].filter(Boolean) as ConvexProduct[];
  }, [products]);

  // Function to open dialog with specific device type
  const openDialogForDevice = (deviceType: DeviceType) => {
    setDialogDeviceType(deviceType);
    setDialogOpen(true);
  };

  // Enhanced search results - searches devices, products, and SKUs
  const searchResults = useMemo(() => {
    const query = homeSearchQuery.toLowerCase().trim();
    if (!query) return { devices: [], designs: [], skus: [] };

    const searchTerms = query.split(/\s+/).filter(term => term.length > 0);
    
    // 1. Search Device Models
    const allDeviceCategories = [
      { name: "Phones", icon: "📱", models: phoneModels },
      { name: "Cameras", icon: "📷", models: cameraModels },
      { name: "Lenses", icon: "🔍", models: lensModels },
      { name: "Tablets", icon: "📱", models: tabletModels },
      { name: "Mac Mini", icon: "💻", models: macMiniModels },
      { name: "Gaming Consoles", icon: "🎮", models: consoleModels },
      { name: "Drones", icon: "🚁", models: droneModels },
      { name: "Chargers", icon: "🔌", models: chargerModels },
    ];

    const deviceMatches: Array<{ category: string; brand: string; model: string; icon: string }> = [];
    
    allDeviceCategories.forEach(category => {
      Object.entries(category.models).forEach(([brand, models]) => {
        models.forEach(model => {
          const modelLower = model.toLowerCase();
          const brandLower = brand.toLowerCase();
          const matchesAll = searchTerms.every(term => 
            modelLower.includes(term) || brandLower.includes(term)
          );
          if (matchesAll) {
            deviceMatches.push({
              category: category.name,
              brand,
              model,
              icon: category.icon
            });
          }
        });
      });
    });

    // Also search database models
    const dbModels = allSupportedModels || [];
    dbModels.forEach(dbModel => {
      const modelLower = dbModel.modelName.toLowerCase();
      const brandLower = dbModel.brandName.toLowerCase();
      const matchesAll = searchTerms.every(term => 
        modelLower.includes(term) || brandLower.includes(term)
      );
      if (matchesAll) {
        const categoryName = 
          dbModel.category === "phone" ? "Phones" :
          dbModel.category === "camera" ? "Cameras" :
          dbModel.category === "lens" ? "Lenses" :
          dbModel.category === "tablet" ? "Tablets" :
          dbModel.category === "mac-mini" ? "Mac Mini" :
          dbModel.category === "console" ? "Gaming Consoles" :
          dbModel.category === "drone" ? "Drones" :
          dbModel.category === "charger" ? "Chargers" : "Other";
        
        // Avoid duplicates
        const exists = deviceMatches.some(d => 
          d.brand === dbModel.brandName && d.model === dbModel.modelName
        );
        if (!exists) {
          deviceMatches.push({
            category: categoryName,
            brand: dbModel.brandName,
            model: dbModel.modelName,
            icon: "📱"
          });
        }
      }
    });

    // 2. Search Product Designs (titles)
    const designMatches = products.filter(product => {
      const titleLower = product.title.toLowerCase();
      return searchTerms.some(term => titleLower.includes(term));
    }).slice(0, 10);

    // 3. Search SKUs
    const skuMatches: Array<{ product: ConvexProduct; variant: ConvexProduct['variants'][0] }> = [];
    products.forEach(product => {
      product.variants.forEach(variant => {
        if (variant.sku) {
          const skuLower = variant.sku.toLowerCase();
          if (searchTerms.some(term => skuLower.includes(term))) {
            skuMatches.push({ product, variant });
          }
        }
      });
    });

    return {
      devices: deviceMatches.slice(0, 15),
      designs: designMatches,
      skus: skuMatches.slice(0, 10)
    };
  }, [homeSearchQuery, products, allSupportedModels]);

  const hasSearchResults = searchResults.devices.length > 0 || 
                          searchResults.designs.length > 0 || 
                          searchResults.skus.length > 0;

  const features = [
    {
      icon: ShieldCheckIcon,
      title: "Tough as Nails",
      description: "Your phone's new BFF. We protect against drops, bumps, and life's little accidents"
    },
    {
      icon: SparklesIcon,
      title: "Weirdly Wonderful",
      description: "From cosmic cats to dancing tacos, our designs are as unique as your personality"
    },
    {
      icon: PackageIcon,
      title: "Fits Like a Glove",
      description: "Snug fit for every button, port, and camera. No awkward gaps here"
    },
    {
      icon: TruckIcon,
      title: "Lightning Fast",
      description: "Free shipping, always. Your new phone vibe arrives in 2-3 days"
    }
  ];

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
              src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" 
              alt="Skinly" 
              className="h-16"
            />
          </div>
          <div className="flex items-center gap-6">
            <a href="#products" className="text-sm font-medium hover:text-primary transition-colors">
              Categories
            </a>
            <a href="/products" className="text-sm font-medium hover:text-primary transition-colors">
              All Products
            </a>
            <Link to="/devices" className="text-sm font-medium hover:text-primary transition-colors">
              Devices
            </Link>
            <Link to="/orders" className="text-sm font-medium hover:text-primary transition-colors">
              My Orders
            </Link>
            <CartButton />
          </div>
        </div>
      </nav>

      {/* Latest Models Marquee */}
      {latestModels && latestModels.length > 0 && (
        <div className="w-full bg-primary/5 border-y border-primary/10 py-3 mt-24 overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-bold px-4 py-1.5 flex-shrink-0 bg-primary text-primary-foreground rounded-r-full">
              <span>✨</span>
              <span className="whitespace-nowrap">Now supporting:</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="animate-marquee flex gap-3 whitespace-nowrap">
                {(() => {
                  const emojis = ['🔥', '🚀', '✨', '⭐', '💫', '🌟', '⚡', '🎯'];
                  return [...latestModels.slice(0, 20), ...latestModels.slice(0, 20), ...latestModels.slice(0, 20)].map((model, idx) => {
                    const emoji = emojis[idx % emojis.length];
                    return (
                      <span key={idx} className="text-sm text-foreground/80 font-medium">
                        {emoji} {model.brandName} {model.modelName} <span className="text-primary/40 mx-2">•</span>
                      </span>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto">
          {/* Universal Search Bar */}
          <div className="max-w-3xl mx-auto mb-16">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Find Your Device or Design</h2>
              <p className="text-muted-foreground">Search across devices, designs, and SKUs</p>
            </div>
            <div className="relative">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-6 text-muted-foreground" />
              <Input
                type="text"
                placeholder="iPhone 15 Pro, matte black, SKU-12345..."
                value={homeSearchQuery}
                onChange={(e) => {
                  const query = e.target.value;
                  setHomeSearchQuery(query);
                  setShowSearchResults(query.trim().length > 0);
                }}
                onFocus={() => {
                  if (homeSearchQuery.trim().length > 0) {
                    setShowSearchResults(true);
                  }
                }}
                className="pl-14 h-16 text-lg border-2 focus:border-primary"
              />
            </div>
            
            {/* Search Results Dropdown */}
            {showSearchResults && homeSearchQuery.trim().length > 0 && (
              <Card className="mt-2 max-h-[500px] overflow-y-auto border-2">
                <CardContent className="p-4">
                  {!hasSearchResults ? (
                    <p className="text-muted-foreground text-center py-4">No results found</p>
                  ) : (
                    <div className="space-y-6">
                      {/* Device Models Section */}
                      {searchResults.devices.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-muted-foreground mb-3">DEVICES</h3>
                          <div className="space-y-1">
                            {(() => {
                              const groupedByCategory: Record<string, typeof searchResults.devices> = {};
                              searchResults.devices.forEach(device => {
                                if (!groupedByCategory[device.category]) {
                                  groupedByCategory[device.category] = [];
                                }
                                groupedByCategory[device.category].push(device);
                              });

                              return Object.entries(groupedByCategory).map(([category, devices]) => (
                                <div key={category}>
                                  <button
                                    onClick={() => toggleCategory(category)}
                                    className="w-full flex items-center justify-between p-2 hover:bg-muted rounded-md text-left"
                                  >
                                    <span className="font-medium flex items-center gap-2">
                                      <span>{devices[0].icon}</span>
                                      <span>{category}</span>
                                      <span className="text-xs text-muted-foreground">({devices.length})</span>
                                    </span>
                                    {expandedCategories.has(category) ? (
                                      <ChevronDownIcon className="size-4" />
                                    ) : (
                                      <ChevronRightIcon className="size-4" />
                                    )}
                                  </button>
                                  {expandedCategories.has(category) && (
                                    <div className="ml-8 space-y-1 mt-1">
                                      {devices.map((device, idx) => (
                                        <Link
                                          key={idx}
                                          to={`/products?model=${encodeURIComponent(device.model)}`}
                                          className="block p-2 hover:bg-muted rounded-md text-sm"
                                          onClick={() => setShowSearchResults(false)}
                                        >
                                          {device.brand} {device.model}
                                        </Link>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Product Designs Section */}
                      {searchResults.designs.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-muted-foreground mb-3">DESIGNS</h3>
                          <div className="space-y-1">
                            {searchResults.designs.map(product => (
                              <Link
                                key={product._id}
                                to={`/products/${product.slug}`}
                                className="flex items-center gap-3 p-2 hover:bg-muted rounded-md"
                                onClick={() => setShowSearchResults(false)}
                              >
                                {product.images[0] && (
                                  <img 
                                    src={product.images[0].url} 
                                    alt={product.title}
                                    className="size-12 object-cover rounded"
                                  />
                                )}
                                <div className="flex-1">
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
                          <h3 className="text-sm font-semibold text-muted-foreground mb-3">SKUs</h3>
                          <div className="space-y-1">
                            {searchResults.skus.map(({ product, variant }) => (
                              <Link
                                key={variant._id}
                                to={`/products/${product.slug}`}
                                className="flex items-center gap-3 p-2 hover:bg-muted rounded-md"
                                onClick={() => setShowSearchResults(false)}
                              >
                                {product.images[0] && (
                                  <img 
                                    src={product.images[0].url} 
                                    alt={product.title}
                                    className="size-12 object-cover rounded"
                                  />
                                )}
                                <div className="flex-1">
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
                </CardContent>
              </Card>
            )}
          </div>

          {/* Hero Content */}
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight text-balance">
              Your Phone. <br />
              <span className="text-primary">Your Vibe.</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 text-balance">
              Custom skins that actually slap. Premium protection with designs that don't suck.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="text-lg px-8 py-6"
                onClick={scrollToDeviceSelector}
              >
                Find Your Device
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 py-6"
                asChild
              >
                <Link to="/products">Browse All Designs</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Device Selector - What Needs a Makeover */}
      <section ref={deviceSelectorRef} className="py-16 px-4 bg-muted/20">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black mb-4">What Needs a Makeover?</h2>
            <p className="text-xl text-muted-foreground">We've got skins for all your tech</p>
          </div>

          {/* Gadget Type Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 max-w-5xl mx-auto">
            <button
              onClick={() => openDialogForDevice("phone")}
              className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all flex flex-col items-center gap-3"
            >
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
                <SmartphoneIcon className="size-8 text-primary" />
              </div>
              <span className="font-semibold">Phones</span>
            </button>

            <button
              onClick={() => openDialogForDevice("tablet")}
              className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all flex flex-col items-center gap-3"
            >
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
                <TabletSmartphoneIcon className="size-8 text-primary" />
              </div>
              <span className="font-semibold">iPad/Tablet</span>
            </button>

            <button
              onClick={() => openDialogForDevice("macmini")}
              className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all flex flex-col items-center gap-3"
            >
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
                <LaptopIcon className="size-8 text-primary" />
              </div>
              <span className="font-semibold">Mac Mini</span>
            </button>

            <button
              onClick={() => openDialogForDevice("drone")}
              className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all flex flex-col items-center gap-3"
            >
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
                <PlaneIcon className="size-8 text-primary" />
              </div>
              <span className="font-semibold">Drones</span>
            </button>

            <button
              onClick={() => openDialogForDevice("camera")}
              className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all flex flex-col items-center gap-3"
            >
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CameraIcon className="size-8 text-primary" />
              </div>
              <span className="font-semibold">Camera</span>
            </button>

            <button
              onClick={() => openDialogForDevice("lens")}
              className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all flex flex-col items-center gap-3"
            >
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CircleDotIcon className="size-8 text-primary" />
              </div>
              <span className="font-semibold">Lenses</span>
            </button>

            <button
              onClick={() => openDialogForDevice("charger")}
              className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all flex flex-col items-center gap-3"
            >
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
                <BatteryChargingIcon className="size-8 text-primary" />
              </div>
              <span className="font-semibold">Chargers</span>
            </button>

            <button
              onClick={() => openDialogForDevice("console")}
              className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all flex flex-col items-center gap-3"
            >
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
                <GamepadIcon className="size-8 text-primary" />
              </div>
              <span className="font-semibold">Gaming Console</span>
            </button>
          </div>
        </div>
      </section>
      
      {/* Device Selector Dialog */}
      <DeviceSelectorDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen}
        initialDeviceType={dialogDeviceType}
      />

      {/* Product Categories - Horizontal Layout */}
      <section id="products" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black mb-4">Browse by Style</h2>
            <p className="text-xl text-muted-foreground">Find the perfect finish for your device</p>
          </div>

          {isLoadingProducts ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-96 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Matte Category */}
              <Card className="border-2">
                <CardContent className="p-6">
                  <div className="mb-4">
                    <h3 className="text-2xl font-bold mb-2">Matte Skins</h3>
                    <p className="text-muted-foreground text-sm mb-4">Smooth, premium, fingerprint-proof</p>
                  </div>
                  <div className="space-y-3 mb-4">
                    {matteProducts.map(product => (
                      <Link key={product._id} to={`/products/${product.slug}`}>
                        <div className="flex gap-3 p-2 hover:bg-muted rounded-lg transition-colors">
                          {product.images[0] && (
                            <img 
                              src={product.images[0].url} 
                              alt={product.title}
                              className="size-20 object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm mb-1 line-clamp-2">{product.title}</h4>
                            <p className="text-xs text-muted-foreground">
                              From ₹{Math.min(...product.variants.map(v => v.price))}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/products?filter=matte">View All Matte</Link>
                  </Button>
                </CardContent>
              </Card>

              {/* 3D Embossed Category */}
              <Card className="border-2">
                <CardContent className="p-6">
                  <div className="mb-4">
                    <h3 className="text-2xl font-bold mb-2">3D Embossed</h3>
                    <p className="text-muted-foreground text-sm mb-4">Textured designs you can feel</p>
                  </div>
                  <div className="space-y-3 mb-4">
                    {embossedProducts.map(product => (
                      <Link key={product._id} to={`/products/${product.slug}`}>
                        <div className="flex gap-3 p-2 hover:bg-muted rounded-lg transition-colors">
                          {product.images[0] && (
                            <img 
                              src={product.images[0].url} 
                              alt={product.title}
                              className="size-20 object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm mb-1 line-clamp-2">{product.title}</h4>
                            <p className="text-xs text-muted-foreground">
                              From ₹{Math.min(...product.variants.map(v => v.price))}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/products?filter=embossed">View All Embossed</Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Transparent Category */}
              <Card className="border-2">
                <CardContent className="p-6">
                  <div className="mb-4">
                    <h3 className="text-2xl font-bold mb-2">Transparent (Tranzy)</h3>
                    <p className="text-muted-foreground text-sm mb-4">Show off your phone's original color</p>
                  </div>
                  <div className="space-y-3 mb-4">
                    {transparentProducts.map(product => (
                      <Link key={product._id} to={`/products/${product.slug}`}>
                        <div className="flex gap-3 p-2 hover:bg-muted rounded-lg transition-colors">
                          {product.images[0] && (
                            <img 
                              src={product.images[0].url} 
                              alt={product.title}
                              className="size-20 object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm mb-1 line-clamp-2">{product.title}</h4>
                            <p className="text-xs text-muted-foreground">
                              From ₹{Math.min(...product.variants.map(v => v.price))}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/products?filter=transparent">View All Transparent</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </section>

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="py-20 px-4 bg-muted/30">
          <div className="container mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black mb-4">Featured Products</h2>
              <p className="text-xl text-muted-foreground">Our hero products you can't miss</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredProducts.map(product => (
                <Link key={product._id} to={`/products/${product.slug}`}>
                  <Card className="overflow-hidden hover:shadow-xl transition-shadow border-2 h-full">
                    {product.images[0] && (
                      <img 
                        src={product.images[0].url} 
                        alt={product.title}
                        className="w-full h-72 object-cover"
                      />
                    )}
                    <CardContent className="p-6">
                      <h3 className="text-2xl font-bold mb-3">{product.title}</h3>
                      <p className="text-muted-foreground mb-4 line-clamp-3">{product.description}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-semibold">
                          From ₹{Math.min(...product.variants.map(v => v.price))}
                        </p>
                        <Button size="sm">Shop Now</Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features Grid */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-2">
                <CardContent className="pt-6">
                  <feature.icon className="size-12 text-primary mb-4" />
                  <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl font-black mb-4">Ready to Transform Your Device?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of happy customers rocking unique designs
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            className="text-lg px-8 py-6"
            asChild
          >
            <Link to="/products">Shop Now</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-muted/30 border-t">
        <div className="container mx-auto text-center">
          <img 
            src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" 
            alt="Skinly" 
            className="h-12 mx-auto mb-4"
          />
          <p className="text-muted-foreground mb-4">
            Premium device skins with personality
          </p>
          <div className="flex justify-center gap-6 mb-4">
            <Link to="/devices" className="text-sm hover:text-primary transition-colors">
              Supported Devices
            </Link>
            <Link to="/orders" className="text-sm hover:text-primary transition-colors">
              Track Order
            </Link>
            <a 
              href="https://wa.me/917505273504" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm hover:text-primary transition-colors"
            >
              Contact Us
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Skinly. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
