import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
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
  GamepadIcon,
  MonitorIcon,
  MagnetIcon,
  ShieldIcon,
  StarIcon,
  PlusCircleIcon,
  ZapIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  HelpCircleIcon
} from "lucide-react";
import { usePaginatedQuery, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState, useMemo, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { Input } from "@/components/ui/input.tsx";
import { CartButton } from "@/components/cart.tsx";
import { MobileNav } from "@/components/mobile-nav.tsx";
import { Link, useNavigate } from "react-router-dom";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { toast } from "sonner";
import {
  laptopModels,
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

type DeviceType = "laptop" | "camera" | "lens" | "tablet" | "macmini" | "console" | "drone" | "charger";

// Brand logo mapping - matching the screenshots
const brandLogos: Record<string, string> = {
  "Apple": "https://cdn.hercules.app/file_54FjDV0bMGUJ9N5uWOHBlwYx",
  "Samsung": "https://cdn.hercules.app/file_8eVkxycD51p7VEELLLP3bxSy",
  "OnePlus": "https://cdn.hercules.app/file_FbXR6g2WQASC01Y3octztLhA",
  "Nothing": "https://cdn.hercules.app/file_fL533mZxpk2ay0q8AXPMvuRY",
  "CMF": "https://cdn.hercules.app/file_7h7knJlwFVqgbBOHAJjHTI0w",
  "Oppo": "https://cdn.hercules.app/file_MCp4r3Jyw8KP6WtCI1D2DuRD",
  "Realme": "https://cdn.hercules.app/file_JNqnBiKQWZzvQKqF4gd1mzRR",
  "Vivo": "https://cdn.hercules.app/file_hvtV8uEVRQisJNhlD61R9kdR",
  "iQOO": "https://cdn.hercules.app/file_xcVXF74gr4T2yPKx6ORu7NBz",
  "Xiaomi": "https://cdn.hercules.app/file_0lIeCdPQqf7QAo7N6nysd5X5",
  "Lava": "https://cdn.hercules.app/file_s9hzIBK6UB038BycBaNvFk6K",
  "Infinix": "https://cdn.hercules.app/file_Pjj5THd5TS0SHK2RAhDceiD4",
  "Asus": "https://cdn.hercules.app/file_3gojHhsqgDme3d6XcYPI927X",
  "HMD": "https://cdn.hercules.app/file_IoeAItMLvooxgFhpKthzUhZD",
};

// Hardcoded brand list as fallback (matches database brands)
const ALL_BRANDS = [
  "Acer", "Apple", "Asus", "CMF", "Canon", "DJI", "Dell", "Google",
  "HMD", "HP", "Honor", "Infinix", "Lava", "Lenovo", "Motorola",
  "Nikon", "Nothing", "One Plus", "Oppo", "PlayStation", "Poco",
  "Realme", "Samsung", "Sony", "Tecno", "Vivo", "Xbox", "Xiaomi", "iQOO"
];

export default function Index() {
  const navigate = useNavigate();
  
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
  
  // Fetch phone models from database for brand/model selector
  const phoneModelsFromDb = useQuery(api.supportedModels.listAll, { 
    category: "phone", 
    isActive: true 
  });
  
  // Fetch all brands for Request Model dropdown (with hardcoded fallback)
  const brandsFromDb = useQuery(api.supportedModels.getBrands);
  const allBrands = brandsFromDb && brandsFromDb.length > 0 ? brandsFromDb : ALL_BRANDS;
  
  const [homeSearchQuery, setHomeSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDeviceType, setDialogDeviceType] = useState<DeviceType | undefined>(undefined);
  const [selectedPhoneBrand, setSelectedPhoneBrand] = useState<string | null>(null);
  const [phoneModelSearch, setPhoneModelSearch] = useState("");
  
  // Model request dialog state
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestBrand, setRequestBrand] = useState("");
  const [requestNewBrand, setRequestNewBrand] = useState(""); // For custom brand entry
  const [isNewBrand, setIsNewBrand] = useState(false); // Track if "Other" is selected
  const [requestModel, setRequestModel] = useState("");
  const [requestCategory, setRequestCategory] = useState<string>("");
  const [requestWhatsApp, setRequestWhatsApp] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [confirmedNotMatch, setConfirmedNotMatch] = useState(false); // Confirmation checkbox
  
  // Refs for scrolling
  const phoneBrandSelectorRef = useRef<HTMLElement>(null);
  
  // Mutations
  const createModelRequest = useMutation(api.modelRequests.createModelRequest);
  
  // Debounce model search for fuzzy matching
  const [debouncedRequestModel] = useDebounce(requestModel, 500);
  
  // Find similar models query
  const similarModels = useQuery(
    api.modelRequests.findSimilarModels,
    debouncedRequestModel.trim().length >= 2
      ? {
          brandName: !isNewBrand && requestBrand ? requestBrand : undefined,
          modelName: debouncedRequestModel,
          category: requestCategory ? (requestCategory as "phone" | "tablet" | "laptop" | "console" | "charger" | "drone" | "camera" | "lens" | "mac-mini") : undefined,
        }
      : "skip"
  );
  
  // Function to scroll to phone brand selector
  const scrollToPhoneBrandSelector = () => {
    phoneBrandSelectorRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });
  };
  
  // Group phone models by brand from database
  const phoneModelsByBrand = useMemo(() => {
    if (!phoneModelsFromDb) return {};
    
    const grouped: Record<string, string[]> = {};
    phoneModelsFromDb.forEach(model => {
      if (!grouped[model.brandName]) {
        grouped[model.brandName] = [];
      }
      grouped[model.brandName].push(model.modelName);
    });
    
    // Sort models within each brand
    Object.keys(grouped).forEach(brand => {
      grouped[brand].sort();
    });
    
    return grouped;
  }, [phoneModelsFromDb]);
  
  // Get phone brands from database
  const phoneBrands = useMemo(() => {
    return Object.keys(phoneModelsByBrand).sort();
  }, [phoneModelsByBrand]);
  
  // Get filtered phone models for selected brand
  const filteredPhoneModels = useMemo(() => {
    if (!selectedPhoneBrand) return [];
    const models = phoneModelsByBrand[selectedPhoneBrand] || [];
    if (!phoneModelSearch) return models;
    const query = phoneModelSearch.toLowerCase();
    return models.filter(model => model.toLowerCase().includes(query));
  }, [selectedPhoneBrand, phoneModelSearch, phoneModelsByBrand]);
  
  // Handle phone brand selection
  const handlePhoneBrandSelect = (brand: string) => {
    setSelectedPhoneBrand(brand);
    setPhoneModelSearch("");
  };
  
  // Handle phone model selection
  const handlePhoneModelSelect = (model: string) => {
    if (!selectedPhoneBrand) return;
    navigate(`/products/confirm?brand=${encodeURIComponent(selectedPhoneBrand)}&model=${encodeURIComponent(model)}`);
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

  // Helper function to normalize text for search (removes spaces and special chars)
  const normalizeForSearch = (text: string): string => {
    return text.toLowerCase().replace(/[\s\-_]/g, '');
  };

  // Enhanced search results - searches devices, products, and SKUs
  const searchResults = useMemo(() => {
    const query = homeSearchQuery.toLowerCase().trim();
    if (!query) return { devices: [], designs: [], skus: [] };

    const searchTerms = query.split(/\s+/).filter(term => term.length > 0);
    const normalizedSearchTerms = searchTerms.map(normalizeForSearch);
    
    // 1. Search Device Models
    const allDeviceCategories = [
      { name: "Phones", icon: "📱", models: phoneModelsByBrand },
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
          const normalizedModel = normalizeForSearch(model);
          const normalizedBrand = normalizeForSearch(brand);
          const matchesAll = normalizedSearchTerms.every(term => 
            normalizedModel.includes(term) || normalizedBrand.includes(term)
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

    // Also search ALL database models (for any newly added categories not in static files)
    const dbModels = allSupportedModels || [];
    dbModels.forEach(dbModel => {
      const normalizedModel = normalizeForSearch(dbModel.modelName);
      const normalizedBrand = normalizeForSearch(dbModel.brandName);
      const matchesAll = normalizedSearchTerms.every(term => 
        normalizedModel.includes(term) || normalizedBrand.includes(term)
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

    // 2. Search Product Designs (titles) - ALL terms must match
    const designMatches = products.filter(product => {
      const normalizedTitle = normalizeForSearch(product.title);
      return normalizedSearchTerms.every(term => normalizedTitle.includes(term));
    }).slice(0, 10);

    // 3. Search SKUs - ALL terms must match
    const skuMatches: Array<{ product: ConvexProduct; variant: ConvexProduct['variants'][0] }> = [];
    products.forEach(product => {
      product.variants.forEach(variant => {
        if (variant.sku) {
          const normalizedSku = normalizeForSearch(variant.sku);
          if (normalizedSearchTerms.every(term => normalizedSku.includes(term))) {
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
  }, [homeSearchQuery, products, allSupportedModels, phoneModelsByBrand]);

  const hasSearchResults = searchResults.devices.length > 0 || 
                          searchResults.designs.length > 0 || 
                          searchResults.skus.length > 0;

  // Auto-expand all device categories when there are search results
  const categoriesInResults = useMemo(() => {
    const categories = new Set<string>();
    searchResults.devices.forEach(device => categories.add(device.category));
    return categories;
  }, [searchResults.devices]);

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
          <Link to="/" className="flex items-center gap-2">
            <img 
              src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" 
              alt="Skinly" 
              className="h-12 md:h-16"
            />
          </Link>
          <MobileNav 
            onGadgetSelectorClick={() => setDialogOpen(true)}
            onPhoneSelectorClick={() => phoneBrandSelectorRef.current?.scrollIntoView({ behavior: 'smooth' })}
          />
        </div>
      </nav>

      {/* Latest Models Marquee */}
      {latestModels && latestModels.length > 0 && (
        <div className="w-full bg-primary/5 border-y border-primary/10 mt-24 overflow-hidden">
          {/* Mobile: Stacked Horizontal Marquee */}
          <div className="md:hidden">
            <div className="text-center py-2 bg-primary text-primary-foreground text-xs font-bold">
              ✨ Now supporting:
            </div>
            <div className="py-3 overflow-hidden">
              <div className="animate-marquee-mobile flex gap-4 whitespace-nowrap">
                {(() => {
                  const emojis = ['🔥', '🚀', '✨', '⭐', '💫', '🌟', '⚡', '🎯'];
                  return [...latestModels.slice(0, 20), ...latestModels.slice(0, 20), ...latestModels.slice(0, 20)].map((model, idx) => {
                    const emoji = emojis[idx % emojis.length];
                    return (
                      <span key={idx} className="text-base text-foreground font-semibold">
                        {emoji} {model.brandName} {model.modelName} <span className="text-primary/40 mx-2">•</span>
                      </span>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* Desktop: Horizontal Marquee */}
          <div className="hidden md:flex items-center gap-4 py-3">
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
      <section className="pt-32 pb-20 px-4 bg-gradient-to-br from-cyan-50 via-purple-50 to-pink-50">
        <div className="container mx-auto">
          {/* Hero Content */}
          <div className="text-center max-w-4xl mx-auto mb-16">
            <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-12 shadow-xl border border-primary/20">
              <h1 className="text-5xl md:text-6xl font-black mb-6 leading-tight text-balance">
                Your Phone Called. It Wants Personality.
              </h1>
              <p className="text-xl text-muted-foreground mb-10 text-balance">
                Join 10,000+ happy humans who ditched boring for bold
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  className="text-lg px-8 py-6 bg-cyan-500 hover:bg-cyan-600"
                  asChild
                >
                  <Link to="/products">Shop Now</Link>
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="text-lg px-8 py-6"
                  asChild
                >
                  <Link to="/devices">Learn More</Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Universal Search Bar */}
          <div className="max-w-3xl mx-auto">
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
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-2">No results found</p>
                      <p className="text-sm text-muted-foreground/70">Try different search terms or request your device below</p>
                    </div>
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

                              return Object.entries(groupedByCategory).map(([category, devices]) => {
                                // Auto-expand categories that have search results
                                const isExpanded = expandedCategories.has(category) || categoriesInResults.has(category);
                                
                                return (
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
                                              ? `/products/confirm?brand=${encodeURIComponent(device.brand)}&model=${encodeURIComponent(device.model)}`
                                              : `/products?brand=${encodeURIComponent(device.brand)}&model=${encodeURIComponent(device.model)}&showFinish=true`
                                            }
                                            className="block p-2 hover:bg-muted rounded-md text-sm"
                                            onClick={() => setShowSearchResults(false)}
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
                  
                  {/* Request Model Button - Always visible */}
                  <div className="mt-6 pt-4 border-t border-border">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <HelpCircleIcon className="size-4" />
                        <span>Can't Find Your Device ?</span>
                      </div>
                      <Button
                        onClick={() => {
                          setRequestDialogOpen(true);
                          setShowSearchResults(false);
                        }}
                        className="bg-primary/5 hover:bg-primary/10 text-primary border-2 border-primary/40 hover:border-primary/60"
                      >
                        <ZapIcon className="size-4 mr-2" />
                        Request Your Model
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        we'll add it with high priority
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* Gadget Selector - What Needs a Makeover */}
      <section className="py-16 px-4 bg-muted/20">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black mb-4">What Needs a Makeover?</h2>
            <p className="text-xl text-muted-foreground">We've got skins for all your tech</p>
          </div>

          {/* Gadget Type Cards - 9 total */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
            <button
              onClick={() => openDialogForDevice("laptop")}
              className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all bg-white flex flex-col items-center gap-3"
            >
              <div className="size-16 rounded-full bg-cyan-50 flex items-center justify-center">
                <LaptopIcon className="size-8 text-cyan-500" />
              </div>
              <span className="font-semibold">Laptop</span>
            </button>

            <button
              onClick={scrollToPhoneBrandSelector}
              className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all bg-white flex flex-col items-center gap-3"
            >
              <div className="size-16 rounded-full bg-cyan-50 flex items-center justify-center">
                <SmartphoneIcon className="size-8 text-cyan-500" />
              </div>
              <span className="font-semibold">Phones</span>
            </button>

            <button
              onClick={() => openDialogForDevice("macmini")}
              className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all bg-white flex flex-col items-center gap-3"
            >
              <div className="size-16 rounded-full bg-cyan-50 flex items-center justify-center">
                <MonitorIcon className="size-8 text-cyan-500" />
              </div>
              <span className="font-semibold">Mac Mini</span>
            </button>

            <button
              onClick={() => openDialogForDevice("drone")}
              className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all bg-white flex flex-col items-center gap-3"
            >
              <div className="size-16 rounded-full bg-cyan-50 flex items-center justify-center">
                <PlaneIcon className="size-8 text-cyan-500" />
              </div>
              <span className="font-semibold">Drones</span>
            </button>

            <button
              onClick={() => openDialogForDevice("camera")}
              className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all bg-white flex flex-col items-center gap-3"
            >
              <div className="size-16 rounded-full bg-cyan-50 flex items-center justify-center">
                <CameraIcon className="size-8 text-cyan-500" />
              </div>
              <span className="font-semibold">Camera</span>
            </button>

            <button
              onClick={() => openDialogForDevice("lens")}
              className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all bg-white flex flex-col items-center gap-3"
            >
              <div className="size-16 rounded-full bg-cyan-50 flex items-center justify-center">
                <CircleDotIcon className="size-8 text-cyan-500" />
              </div>
              <span className="font-semibold">Lenses</span>
            </button>

            <button
              onClick={() => openDialogForDevice("charger")}
              className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all bg-white flex flex-col items-center gap-3"
            >
              <div className="size-16 rounded-full bg-cyan-50 flex items-center justify-center">
                <BatteryChargingIcon className="size-8 text-cyan-500" />
              </div>
              <span className="font-semibold">Chargers</span>
            </button>

            <button
              onClick={() => openDialogForDevice("tablet")}
              className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all bg-white flex flex-col items-center gap-3"
            >
              <div className="size-16 rounded-full bg-cyan-50 flex items-center justify-center">
                <TabletSmartphoneIcon className="size-8 text-cyan-500" />
              </div>
              <span className="font-semibold">iPad/Tablet</span>
            </button>

            <button
              onClick={() => openDialogForDevice("console")}
              className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all bg-white flex flex-col items-center gap-3"
            >
              <div className="size-16 rounded-full bg-cyan-50 flex items-center justify-center">
                <GamepadIcon className="size-8 text-cyan-500" />
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

      {/* Phone Brand Selector - On Page */}
      <section ref={phoneBrandSelectorRef} className="py-16 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black mb-4">Pick Your Device Brand</h2>
            <p className="text-xl text-muted-foreground">Select your brand and we'll show you the perfect skin</p>
          </div>

          {/* Brand Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 max-w-5xl mx-auto">
            {phoneBrands.map(brand => (
              <button
                key={brand}
                onClick={() => handlePhoneBrandSelect(brand)}
                className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all bg-white flex flex-col items-center gap-3"
              >
                {brandLogos[brand] ? (
                  <div className="size-16 rounded-full bg-muted flex items-center justify-center overflow-hidden p-2">
                    <img 
                      src={brandLogos[brand]} 
                      alt={brand}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold">
                    {brand[0]}
                  </div>
                )}
                <span className="font-semibold text-center">{brand}</span>
              </button>
            ))}
          </div>

          {/* Phone Model Selection Dialog */}
          {selectedPhoneBrand && (
            <Dialog open={!!selectedPhoneBrand} onOpenChange={(open) => !open && setSelectedPhoneBrand(null)}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-3xl">Select Your {selectedPhoneBrand} Model</DialogTitle>
                  <p className="text-muted-foreground">Choose your phone model to see compatible skins</p>
                </DialogHeader>

                {/* Search Input */}
                <div className="relative my-4">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search models..."
                    value={phoneModelSearch}
                    onChange={(e) => setPhoneModelSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Model List */}
                <div className="space-y-2">
                  {filteredPhoneModels.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No models found</p>
                  ) : (
                    filteredPhoneModels.map((model, idx) => (
                      <button
                        key={idx}
                        onClick={() => handlePhoneModelSelect(model)}
                        className="w-full flex items-center justify-between p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-muted/50 transition-all text-left"
                      >
                        <span className="font-medium">{model}</span>
                        <span className="text-primary">Select →</span>
                      </button>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </section>

      {/* Product Categories - Horizontal Layout */}
      <section className="py-20 px-4">
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
                    {matteProducts.slice(0, 3).map(product => (
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
                    {embossedProducts.slice(0, 3).map(product => (
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
                    {transparentProducts.slice(0, 3).map(product => (
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

      {/* Beyond Skins - Premium Collection */}
      <section className="py-20 px-4 bg-gradient-to-br from-cyan-50 via-purple-50 to-pink-50">
        <div className="container mx-auto">
          <div className="text-center mb-4">
            <p className="text-sm font-bold text-cyan-500 tracking-wider uppercase">Premium Collection</p>
          </div>
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black mb-4">Beyond Skins</h2>
            <p className="text-xl text-muted-foreground">Elevate your entire tech ecosystem with our signature accessories</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Magneto X */}
            <Card className="overflow-hidden hover:shadow-xl transition-all border-2 bg-gradient-to-br from-cyan-50 to-purple-100">
              <CardContent className="p-8 text-center">
                <div className="mb-6 flex justify-center">
                  <div className="size-32 bg-pink-200 rounded-full flex items-center justify-center">
                    <MagnetIcon className="size-16 text-pink-600" />
                  </div>
                </div>
                <div className="absolute top-4 right-4 bg-cyan-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  NEW
                </div>
                <h3 className="text-2xl font-bold mb-3">Magneto X</h3>
                <p className="text-muted-foreground mb-6">Revolutionary magnetic accessories and mounts for all your devices</p>
                <Button className="w-full" variant="outline" asChild>
                  <Link to="/products">Explore →</Link>
                </Button>
              </CardContent>
            </Card>

            {/* MagSafe Covers */}
            <Card className="overflow-hidden hover:shadow-xl transition-all border-2 bg-gradient-to-br from-purple-50 to-pink-100">
              <CardContent className="p-8 text-center">
                <div className="mb-6 flex justify-center">
                  <div className="size-32 bg-purple-300 rounded-full flex items-center justify-center">
                    <SmartphoneIcon className="size-16 text-purple-700" />
                  </div>
                </div>
                <div className="absolute top-4 right-4 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  POPULAR
                </div>
                <h3 className="text-2xl font-bold mb-3">MagSafe Covers</h3>
                <p className="text-muted-foreground mb-6">Premium black covers for iPhone & Samsung. Seamless magnetic experience</p>
                <Button className="w-full" variant="outline" asChild>
                  <Link to="/products">Explore →</Link>
                </Button>
              </CardContent>
            </Card>

            {/* AutoApply Guard */}
            <Card className="overflow-hidden hover:shadow-xl transition-all border-2 bg-gradient-to-br from-pink-50 to-orange-100">
              <CardContent className="p-8 text-center">
                <div className="mb-6 flex justify-center">
                  <div className="size-32 bg-orange-200 rounded-full flex items-center justify-center">
                    <StarIcon className="size-16 text-orange-600" />
                  </div>
                </div>
                <div className="absolute top-4 right-4 bg-pink-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  BEST VALUE
                </div>
                <h3 className="text-2xl font-bold mb-3">AutoApply Guard</h3>
                <p className="text-muted-foreground mb-6">Super HQ armoured tempered glass with auto-apply technology</p>
                <Button className="w-full" variant="outline" asChild>
                  <Link to="/products">Explore →</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Why We're Different */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black mb-4">Why We're Different</h2>
            <p className="text-xl text-muted-foreground">Because your phone deserves more than another boring case</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-2 bg-white">
                <CardContent className="pt-8 px-6 pb-6">
                  <div className="size-12 rounded-full bg-cyan-50 flex items-center justify-center mb-4">
                    <feature.icon className="size-6 text-cyan-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Fan Favorites */}
      <section className="py-20 px-4 bg-muted/20">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black mb-4">Fan Favorites</h2>
            <p className="text-xl text-muted-foreground">The designs everyone's obsessed with right now</p>
          </div>

          {isLoadingProducts ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {products.slice(0, 8).map(product => (
                <Link key={product._id} to={`/products/${product.slug}`}>
                  <Card className="overflow-hidden hover:shadow-xl transition-all border-2 h-full">
                    {product.images[0] && (
                      <img 
                        src={product.images[0].url} 
                        alt={product.title}
                        className="w-full h-64 object-cover"
                      />
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* WhatsApp Button - Full Width */}
      <section className="py-0">
        <a
          href="https://wa.me/917505273504"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white py-6 flex items-center justify-center gap-3 text-xl font-bold transition-colors"
        >
          <svg className="size-8" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Chat with us on WhatsApp
        </a>
      </section>

      {/* Footer */}
      <footer className="py-16 px-4 bg-white border-t">
        <div className="container mx-auto">
          <div className="flex flex-col items-center mb-8">
            <img 
              src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" 
              alt="Skinly" 
              className="h-16 mb-4"
            />
            <p className="text-muted-foreground text-center">
              Quirky wear for your gadgets
            </p>
          </div>

          {/* Desktop: 3 columns | Mobile: Shop & Support side-by-side, Company below */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12 max-w-4xl mx-auto mb-8">
            {/* Shop */}
            <div>
              <h3 className="font-bold text-lg mb-4">Shop</h3>
              <ul className="space-y-2">
                <li>
                  <Link to="/products" className="text-muted-foreground hover:text-primary transition-colors">
                    All Products
                  </Link>
                </li>
                <li>
                  <Link to="/products?filter=new" className="text-muted-foreground hover:text-primary transition-colors">
                    New Arrivals
                  </Link>
                </li>
                <li>
                  <Link to="/products?filter=best" className="text-muted-foreground hover:text-primary transition-colors">
                    Best Sellers
                  </Link>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h3 className="font-bold text-lg mb-4">Support</h3>
              <ul className="space-y-2">
                <li>
                  <a 
                    href="https://wa.me/917505273504" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    Contact Us
                  </a>
                </li>
                <li>
                  <Link to="/devices" className="text-muted-foreground hover:text-primary transition-colors">
                    Shipping Info
                  </Link>
                </li>
                <li>
                  <Link to="/orders" className="text-muted-foreground hover:text-primary transition-colors">
                    Returns & Refund Policy
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company - Spans full width on mobile */}
            <div className="col-span-2 md:col-span-1">
              <h3 className="font-bold text-lg mb-4">Company</h3>
              <ul className="space-y-2">
                <li>
                  <Link to="/devices" className="text-muted-foreground hover:text-primary transition-colors">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link to="/devices" className="text-muted-foreground hover:text-primary transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/devices" className="text-muted-foreground hover:text-primary transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground border-t pt-8">
            © {new Date().getFullYear()} Skinly. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Request Model Dialog */}
      <Dialog 
        open={requestDialogOpen} 
        onOpenChange={(open) => {
          setRequestDialogOpen(open);
          if (!open) {
            // Reset form when dialog closes
            setRequestBrand("");
            setRequestNewBrand("");
            setIsNewBrand(false);
            setRequestModel("");
            setRequestCategory("");
            setRequestWhatsApp("");
            setConfirmedNotMatch(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request a Device Model</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              
              // Determine final brand name (from dropdown or custom input)
              const finalBrandName = isNewBrand ? requestNewBrand.trim() : requestBrand;
              
              // Validate fields
              if (!finalBrandName || !requestModel.trim() || !requestCategory || !requestWhatsApp.trim()) {
                toast.error("Please fill in all fields");
                return;
              }
              
              // Check if similar models exist and user hasn't confirmed
              if (similarModels && similarModels.length > 0 && !confirmedNotMatch) {
                toast.error("Please confirm that none of the suggested models match your device");
                return;
              }
              
              // Validate WhatsApp number format (must be exactly 10 digits)
              if (requestWhatsApp.trim().length !== 10 || !/^\d{10}$/.test(requestWhatsApp.trim())) {
                toast.error("Please enter a valid 10-digit phone number");
                return;
              }
              
              setIsSubmittingRequest(true);
              
              try {
                await createModelRequest({
                  brandName: finalBrandName,
                  modelName: requestModel.trim(),
                  category: requestCategory as "phone" | "tablet" | "laptop" | "console" | "charger" | "drone" | "camera" | "lens" | "mac-mini",
                  whatsappPhone: `+91${requestWhatsApp.trim()}`,
                });
                
                toast.success("Request submitted! We'll notify you on WhatsApp when available.");
                
                // Reset form
                setRequestBrand("");
                setRequestNewBrand("");
                setIsNewBrand(false);
                setRequestModel("");
                setRequestCategory("");
                setRequestWhatsApp("");
                setConfirmedNotMatch(false);
                setRequestDialogOpen(false);
              } catch (error) {
                const err = error as { data?: { message?: string } };
                toast.error(err.data?.message || "Failed to submit request. Please try again.");
              } finally {
                setIsSubmittingRequest(false);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="request-brand">Brand Name *</Label>
              <Select 
                value={isNewBrand ? "other" : requestBrand} 
                onValueChange={(value) => {
                  if (value === "other") {
                    setIsNewBrand(true);
                    setRequestBrand("");
                  } else {
                    setIsNewBrand(false);
                    setRequestBrand(value);
                    setRequestNewBrand("");
                  }
                }}
                required
              >
                <SelectTrigger id="request-brand">
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {allBrands && allBrands.length > 0 ? (
                    <>
                      {allBrands.map((brand) => (
                        <SelectItem key={brand} value={brand}>
                          {brand}
                        </SelectItem>
                      ))}
                      <SelectItem value="other" className="font-semibold border-t mt-2 pt-2">
                        Other (New Brand)
                      </SelectItem>
                    </>
                  ) : (
                    <SelectItem value="other" className="font-semibold">
                      Other (New Brand)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            {/* Show custom brand input when "Other" is selected */}
            {isNewBrand && (
              <div className="space-y-2">
                <Label htmlFor="request-new-brand">Enter New Brand Name *</Label>
                <Input
                  id="request-new-brand"
                  placeholder="e.g., Lava, Infinix, Asus"
                  value={requestNewBrand}
                  onChange={(e) => setRequestNewBrand(e.target.value)}
                  required
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="request-model">Model Name *</Label>
              <Input
                id="request-model"
                placeholder="e.g., iPhone 16 Pro, Galaxy S24"
                value={requestModel}
                onChange={(e) => {
                  setRequestModel(e.target.value);
                  // Reset confirmation when model changes
                  setConfirmedNotMatch(false);
                }}
                required
              />
              
              {/* Show similar models if found */}
              {similarModels && similarModels.length > 0 && (
                <div className="mt-3 p-3 border-2 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 rounded-lg space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertCircleIcon className="size-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                        Similar models found! Please check if one of these matches your device:
                      </p>
                      <div className="space-y-2">
                        {similarModels.map((model) => (
                          <button
                            key={model._id}
                            type="button"
                            onClick={() => {
                              // Navigate to products page filtered by brand and model
                              navigate(`/products?brand=${encodeURIComponent(model.brandName)}&model=${encodeURIComponent(model.modelName)}`);
                              setRequestDialogOpen(false);
                            }}
                            className="w-full flex items-center justify-between p-2.5 bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded hover:border-amber-400 dark:hover:border-amber-600 transition-colors text-left group"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                {model.brandName} {model.modelName}
                              </div>
                              <div className="text-xs text-muted-foreground capitalize">
                                {model.category}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                                Already Available
                              </span>
                              <ChevronRightIcon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                          </button>
                        ))}
                      </div>
                      
                      {/* Confirmation checkbox */}
                      <div className="flex items-start gap-2.5 pt-2 border-t border-amber-200 dark:border-amber-800">
                        <Checkbox
                          id="confirm-not-match"
                          checked={confirmedNotMatch}
                          onCheckedChange={(checked) => setConfirmedNotMatch(checked as boolean)}
                          className="mt-0.5"
                        />
                        <label
                          htmlFor="confirm-not-match"
                          className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer leading-tight"
                        >
                          None of these match my device. I want to request a new model.
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="request-category">Device Category *</Label>
              <Select value={requestCategory} onValueChange={setRequestCategory} required>
                <SelectTrigger id="request-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="tablet">Tablet</SelectItem>
                  <SelectItem value="laptop">Laptop</SelectItem>
                  <SelectItem value="console">Console</SelectItem>
                  <SelectItem value="charger">Charger</SelectItem>
                  <SelectItem value="drone">Drone</SelectItem>
                  <SelectItem value="camera">Camera</SelectItem>
                  <SelectItem value="lens">Lens</SelectItem>
                  <SelectItem value="mac-mini">Mac Mini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="request-whatsapp">WhatsApp Number *</Label>
              <div className="flex items-center gap-2">
                <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 py-2 text-sm font-medium">
                  +91
                </div>
                <Input
                  id="request-whatsapp"
                  type="tel"
                  placeholder="9876543210"
                  value={requestWhatsApp}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    if (value.length <= 10) {
                      setRequestWhatsApp(value);
                    }
                  }}
                  maxLength={10}
                  className="flex-1"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                We'll notify you when this model is available
              </p>
            </div>
            
            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRequestDialogOpen(false)}
                disabled={isSubmittingRequest}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingRequest}>
                {isSubmittingRequest ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
