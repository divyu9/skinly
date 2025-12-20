import { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import {
  SearchIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SmartphoneIcon,
  TabletIcon,
  LaptopIcon,
  GamepadIcon,
  BatteryChargingIcon,
  PlaneIcon,
  CameraIcon,
  PackageIcon,
  ZapIcon,
  HelpCircleIcon,
  AlertCircleIcon,
} from "lucide-react";
import { CartButton } from "@/components/cart.tsx";
import { MobileNav } from "@/components/mobile-nav.tsx";
import { AnnouncementBar } from "@/components/announcement-bar.tsx";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { toast } from "sonner";

const CATEGORY_CONFIG = {
  phone: { label: "Phones", icon: SmartphoneIcon, emoji: "📱" },
  tablet: { label: "Tablets", icon: TabletIcon, emoji: "📱" },
  laptop: { label: "Laptops", icon: LaptopIcon, emoji: "💻" },
  console: { label: "Gaming Consoles", icon: GamepadIcon, emoji: "🎮" },
  charger: { label: "Chargers", icon: BatteryChargingIcon, emoji: "🔌" },
  drone: { label: "Drones", icon: PlaneIcon, emoji: "🚁" },
  camera: { label: "Cameras", icon: CameraIcon, emoji: "📷" },
  lens: { label: "Camera Lenses", icon: CameraIcon, emoji: "🔍" },
  "mac-mini": { label: "Mac Mini", icon: PackageIcon, emoji: "💻" },
} as const;

// Hardcoded brand list as fallback (matches database brands)
const ALL_BRANDS = [
  "Acer", "Apple", "Asus", "CMF", "Canon", "DJI", "Dell", "Google",
  "HMD", "HP", "Honor", "Infinix", "Lava", "Lenovo", "Motorola",
  "Nikon", "Nothing", "One Plus", "Oppo", "PlayStation", "Poco",
  "Realme", "Samsung", "Sony", "Tecno", "Vivo", "Xbox", "Xiaomi", "iQOO"
];

export default function DevicesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
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
  
  // Fetch metadata from cache (super fast!)
  const metadata = useQuery(api.supportedModels.getMetadata);
  
  // Fetch all models in background (lazy load after cache shows)
  const allModels = useQuery(api.supportedModels.listAll, { isActive: true });
  
  // Get all brands from cache
  const allBrands = metadata?.brands || ALL_BRANDS;
  
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

  // Group models by brand (use cache for instant display, then real data when loaded)
  const brandedModels = useMemo(() => {
    // If metadata exists, create brand structure from cache
    if (metadata && !allModels) {
      // Show brands from cache while models are loading
      return allBrands.map(brand => {
        // Calculate total count and categories from metadata
        let totalCount = 0;
        const categories: string[] = [];
        
        Object.entries(metadata.byCategory).forEach(([categoryKey, categoryData]) => {
          if (categoryData.brands.includes(brand)) {
            categories.push(categoryKey);
          }
        });
        
        return {
          brand,
          models: [], // Empty initially
          categories,
          matchCount: totalCount,
          isLoading: true, // Mark as loading
        };
      }).sort((a, b) => a.brand.localeCompare(b.brand));
    }
    
    // When models are loaded, use actual data
    if (!allModels) return [];
    
    const grouped = new Map<string, { models: typeof allModels; categories: Set<string> }>();
    
    allModels.forEach((model) => {
      if (!grouped.has(model.brandName)) {
        grouped.set(model.brandName, { models: [], categories: new Set() });
      }
      const brand = grouped.get(model.brandName)!;
      brand.models.push(model);
      brand.categories.add(model.category);
    });
    
    return Array.from(grouped.entries()).map(([brand, data]) => ({
      brand,
      models: data.models,
      categories: Array.from(data.categories),
      matchCount: data.models.length,
      isLoading: false,
    })).sort((a, b) => a.brand.localeCompare(b.brand));
  }, [allModels, metadata, allBrands]);

  // Calculate total models (from cache or real data)
  const totalModels = allModels?.length || metadata?.totalModels || 0;

  // Filter and search logic
  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) {
      return brandedModels;
    }

    const searchLower = searchQuery.toLowerCase();
    return brandedModels
      .map((item) => {
        const matchingModels = item.models.filter(
          (model) =>
            model.modelName.toLowerCase().includes(searchLower) ||
            model.brandName.toLowerCase().includes(searchLower) ||
            CATEGORY_CONFIG[model.category as keyof typeof CATEGORY_CONFIG]?.label
              .toLowerCase()
              .includes(searchLower)
        );
        return {
          ...item,
          models: matchingModels,
          matchCount: matchingModels.length,
        };
      })
      .filter((item) => item.matchCount > 0 || item.brand.toLowerCase().includes(searchLower));
  }, [searchQuery, brandedModels]);

  // Flattened search results for dropdown (limit to 15)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !allModels) return [];
    
    const searchLower = searchQuery.toLowerCase();
    const results = allModels
      .filter((model) =>
        model.modelName.toLowerCase().includes(searchLower) ||
        model.brandName.toLowerCase().includes(searchLower) ||
        CATEGORY_CONFIG[model.category as keyof typeof CATEGORY_CONFIG]?.label
          .toLowerCase()
          .includes(searchLower)
      )
      .slice(0, 15);
    
    return results;
  }, [searchQuery, allModels]);

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

  // Handle clicking a model from dropdown
  const handleModelClick = (brandName: string, modelId: string) => {
    // Close dropdown
    setDropdownOpen(false);
    setSearchQuery("");
    
    // Expand the brand if not already expanded
    setExpandedBrands((prev) => new Set([...prev, brandName]));
    
    // Scroll to brand after a brief delay to allow expansion
    setTimeout(() => {
      const brandElement = document.getElementById(`brand-${brandName}`);
      if (brandElement) {
        const offset = 100; // Account for fixed header
        const elementPosition = brandElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });
        
        // Highlight the specific model after scrolling to brand
        setTimeout(() => {
          const modelElement = document.getElementById(`model-${modelId}`);
          if (modelElement) {
            modelElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
            
            // Add temporary highlight
            modelElement.classList.add("ring-2", "ring-primary", "ring-offset-2");
            setTimeout(() => {
              modelElement.classList.remove("ring-2", "ring-primary", "ring-offset-2");
            }, 2000);
          }
        }, 300);
      }
    }, 100);
  };

  // Open dropdown when search query changes
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      setDropdownOpen(true);
      setSelectedIndex(-1);
    } else {
      setDropdownOpen(false);
    }
  }, [searchQuery]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen || searchResults.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
          const model = searchResults[selectedIndex];
          handleModelClick(model.brandName, model._id);
        }
        break;
      case "Escape":
        e.preventDefault();
        setDropdownOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle model request submission
  const handleSubmitRequest = async () => {
    // Validation
    if (!requestBrand && !requestNewBrand) {
      toast.error("Please select or enter a brand name");
      return;
    }
    if (!requestModel.trim()) {
      toast.error("Please enter a model name");
      return;
    }
    if (!requestCategory) {
      toast.error("Please select a device category");
      return;
    }
    if (!requestWhatsApp.trim()) {
      toast.error("Please enter your WhatsApp number");
      return;
    }
    
    // Validate WhatsApp number format (10 digits)
    const cleanedPhone = requestWhatsApp.replace(/\D/g, "");
    if (cleanedPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    
    // If similar models exist and user hasn't confirmed, show warning
    if (similarModels && similarModels.length > 0 && !confirmedNotMatch) {
      toast.error("Please confirm that your model doesn't match any of the similar models listed");
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const finalBrand = isNewBrand ? requestNewBrand : requestBrand;
      await createModelRequest({
        brandName: finalBrand,
        modelName: requestModel.trim(),
        category: requestCategory as "phone" | "tablet" | "laptop" | "console" | "charger" | "drone" | "camera" | "lens" | "mac-mini",
        whatsappPhone: "+91" + cleanedPhone,
      });
      
      toast.success("Request submitted! We'll notify you on WhatsApp when it's added.");
      
      // Reset form
      setRequestDialogOpen(false);
      setRequestBrand("");
      setRequestNewBrand("");
      setIsNewBrand(false);
      setRequestModel("");
      setRequestCategory("");
      setRequestWhatsApp("");
      setConfirmedNotMatch(false);
    } catch (error) {
      toast.error("Failed to submit request. Please try again.");
      console.error(error);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Announcement Bar */}
      <AnnouncementBar />
      
      {/* Navigation */}
      <nav className="fixed top-[28px] w-full bg-background/80 backdrop-blur-lg border-b border-border z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv"
              alt="Skinly"
              className="h-12 md:h-16"
            />
          </Link>
          <MobileNav />
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
              Premium skins and protection for {totalModels}+ devices including phones, tablets, cameras, drones, and more. Find your device and explore our quirky designs.
            </p>
          </div>

          {/* Search Bar with Dropdown */}
          <div className="max-w-2xl mx-auto">
            <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <PopoverTrigger asChild>
                <div className="relative">
                  <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search by brand or model (e.g., iPhone 15 Pro, Galaxy S24...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-12 h-14 text-base border-2 focus:border-primary"
                    onFocus={() => searchQuery.trim() && setDropdownOpen(true)}
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0 max-h-[400px] overflow-y-auto"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                {searchResults.length > 0 ? (
                  <div className="py-2">
                    {searchResults.map((model, index) => {
                      const categoryConfig = CATEGORY_CONFIG[model.category as keyof typeof CATEGORY_CONFIG];
                      const Icon = categoryConfig?.icon || PackageIcon;
                      
                      return (
                        <button
                          key={model._id}
                          onClick={() => handleModelClick(model.brandName, model._id)}
                          className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors ${
                            selectedIndex === index ? "bg-muted" : ""
                          }`}
                        >
                          <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Icon className="size-4 text-primary" />
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <div className="font-medium truncate">{model.modelName}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>{model.brandName}</span>
                              <Badge variant="secondary" className="text-xs">
                                {categoryConfig?.label}
                              </Badge>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {allModels && filteredBrands.reduce((acc, item) => acc + item.matchCount, 0) > 15 && (
                      <div className="px-4 py-2 text-xs text-muted-foreground text-center border-t">
                        Showing top 15 results. Scroll down to see all {filteredBrands.reduce((acc, item) => acc + item.matchCount, 0)} matches.
                      </div>
                    )}
                  </div>
                ) : searchQuery.trim() && allModels ? (
                  <div className="p-8 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">
                      No models found matching "{searchQuery}"
                    </p>
                    <p className="text-xs text-muted-foreground">Can't find your model?</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRequestDialogOpen(true)}
                    >
                      Request Your Model →
                    </Button>
                  </div>
                ) : searchQuery.trim() ? (
                  <div className="p-8 flex flex-col items-center gap-2">
                    <div className="size-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Searching...</p>
                  </div>
                ) : null}
              </PopoverContent>
            </Popover>
            {searchQuery && (
              <div className="mt-3 text-sm text-muted-foreground text-center">
                Found {filteredBrands.length} brand(s) with{" "}
                {filteredBrands.reduce((acc, item) => acc + item.matchCount, 0)} matching model(s)
              </div>
            )}
            
            {/* Request Model Button */}
            <div className="mt-4 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <HelpCircleIcon className="size-4" />
                <span>Can't Find Your Device?</span>
              </div>
              <Button
                onClick={() => setRequestDialogOpen(true)}
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
        </div>
      </section>

      {/* Devices List */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          {/* Controls */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <PackageIcon className="size-5 text-primary" />
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

          {/* Loading State - only show if no metadata yet */}
          {!metadata && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          )}

          {/* Brands List - show immediately when metadata loads */}
          {metadata && (
            <div className="space-y-3">
              {filteredBrands.map(({ brand, models, categories, matchCount, isLoading }) => {
                const isExpanded = expandedBrands.has(brand);
                const primaryCategory = categories[0] as keyof typeof CATEGORY_CONFIG;
                const categoryConfig = CATEGORY_CONFIG[primaryCategory];

                return (
                  <Card key={brand} id={`brand-${brand}`} className="overflow-hidden border-2 hover:border-primary/50 transition-colors scroll-mt-24">
                    <button
                      onClick={() => toggleBrand(brand)}
                      className="w-full p-6 flex items-center justify-between hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                          {categoryConfig?.emoji || "📦"}
                        </div>
                        <div className="text-left">
                          <h3 className="text-xl font-bold">{brand}</h3>
                          <p className="text-sm text-muted-foreground">
                            {matchCount} supported model{matchCount !== 1 ? "s" : ""}{" "}
                            {categories.length > 1 && `across ${categories.length} categories`}
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
                        {isLoading ? (
                          // Loading state while models are being fetched
                          <div className="border-t pt-4 flex flex-col items-center justify-center py-8 gap-3">
                            <div className="size-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                            <p className="text-sm text-muted-foreground">Loading models...</p>
                          </div>
                        ) : (
                          <div className="border-t pt-4 space-y-4">
                            {/* Group by category */}
                            {categories.map((category) => {
                              const categoryModels = models.filter((m) => m.category === category);
                              const catConfig = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG];
                              
                              return (
                                <div key={category} className="space-y-2">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-sm font-semibold text-primary">
                                      {catConfig?.emoji} {catConfig?.label}
                                    </span>
                                    <Badge variant="secondary" className="text-xs">
                                      {categoryModels.length}
                                    </Badge>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {categoryModels.map((model) => (
                                      <Link
                                        key={model._id}
                                        id={`model-${model._id}`}
                                        to={`/products?brand=${brand.toLowerCase()}&model=${encodeURIComponent(model.modelName)}&showFinish=true`}
                                        className="p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-all group scroll-mt-24"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm font-medium group-hover:text-primary transition-colors">
                                            {model.modelName}
                                          </span>
                                          <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                                            →
                                          </span>
                                        </div>
                                      </Link>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

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
          <h2>Premium Device Skins & Protection</h2>
          <p>
            Skinly offers high-quality skins and protection for over {totalModels} devices across multiple categories. From smartphones and tablets to cameras, drones, gaming consoles, and more – we've got you covered. Our precision-cut skins are designed to fit your device perfectly while adding personality and protection.
          </p>
          <h3>Device Categories We Support</h3>
          <ul>
            <li><strong>Smartphones:</strong> iPhone, Samsung Galaxy, OnePlus, Google Pixel, and more</li>
            <li><strong>Tablets:</strong> iPad, Samsung Galaxy Tab, and other popular tablets</li>
            <li><strong>Cameras & Lenses:</strong> Canon, Nikon, Sony, and professional camera equipment</li>
            <li><strong>Drones:</strong> DJI and other drone models</li>
            <li><strong>Gaming Consoles:</strong> PlayStation, Xbox, and controllers</li>
            <li><strong>Chargers:</strong> Apple, OnePlus, Samsung fast chargers</li>
            <li><strong>Mac Mini:</strong> All generations of Apple Mac Mini</li>
          </ul>
          <h3>Why Choose Skinly?</h3>
          <ul>
            <li><strong>Universal Compatibility:</strong> Support for {totalModels}+ devices across all major brands</li>
            <li><strong>Premium Materials:</strong> High-quality vinyl with bubble-free application</li>
            <li><strong>Unique Designs:</strong> Quirky, artistic patterns you won't find anywhere else</li>
            <li><strong>Perfect Fit:</strong> Laser-cut precision for all buttons, ports, and cameras</li>
            <li><strong>Easy Application:</strong> Bubble-free installation with our application kit</li>
          </ul>
          <h3>Supported Brands</h3>
          <p>
            We support devices from {filteredBrands.length} major brands including {filteredBrands.slice(0, 10).map(b => b.brand).join(", ")}{filteredBrands.length > 10 ? ", and more" : ""}.
          </p>
        </div>
      </section>

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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Request a Device Model</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Brand Selection */}
            <div className="space-y-2">
              <Label>Brand *</Label>
              <Select 
                value={isNewBrand ? "other_new_brand" : requestBrand} 
                onValueChange={(value) => {
                  if (value === "other_new_brand") {
                    setIsNewBrand(true);
                    setRequestBrand("");
                  } else {
                    setIsNewBrand(false);
                    setRequestBrand(value);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a brand" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {allBrands.map((brand) => (
                    <SelectItem key={brand} value={brand}>
                      {brand}
                    </SelectItem>
                  ))}
                  <SelectItem value="other_new_brand">Other (New Brand)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Brand Input */}
            {isNewBrand && (
              <div className="space-y-2">
                <Label>Enter New Brand Name *</Label>
                <Input
                  type="text"
                  placeholder="Enter brand name"
                  value={requestNewBrand}
                  onChange={(e) => setRequestNewBrand(e.target.value)}
                />
              </div>
            )}

            {/* Model Name */}
            <div className="space-y-2">
              <Label>Model Name *</Label>
              <Input
                type="text"
                placeholder="e.g., iPhone 15 Pro Max"
                value={requestModel}
                onChange={(e) => setRequestModel(e.target.value)}
              />
            </div>

            {/* Similar Models Warning */}
            {similarModels && similarModels.length > 0 && (
              <div className="p-4 border-2 border-yellow-500/50 bg-yellow-500/5 rounded-lg space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircleIcon className="size-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                      Similar models found in our database:
                    </p>
                    <ul className="space-y-1 mb-3">
                      {similarModels.slice(0, 5).map((model, idx) => (
                        <li key={idx} className="text-sm text-yellow-800 dark:text-yellow-200">
                          • {model.brandName} {model.modelName}
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-start gap-2 mt-3 p-3 bg-yellow-500/10 rounded">
                      <Checkbox
                        id="confirm-not-match"
                        checked={confirmedNotMatch}
                        onCheckedChange={(checked) => setConfirmedNotMatch(checked === true)}
                      />
                      <label
                        htmlFor="confirm-not-match"
                        className="text-sm font-medium leading-tight cursor-pointer"
                      >
                        I confirm my device model is different from the models listed above
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Category Selection */}
            <div className="space-y-2">
              <Label>Device Category *</Label>
              <Select value={requestCategory} onValueChange={setRequestCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="tablet">Tablet</SelectItem>
                  <SelectItem value="laptop">Laptop</SelectItem>
                  <SelectItem value="console">Gaming Console</SelectItem>
                  <SelectItem value="charger">Charger</SelectItem>
                  <SelectItem value="drone">Drone</SelectItem>
                  <SelectItem value="camera">Camera</SelectItem>
                  <SelectItem value="lens">Camera Lens</SelectItem>
                  <SelectItem value="mac-mini">Mac Mini</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* WhatsApp Number */}
            <div className="space-y-2">
              <Label>WhatsApp Number *</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground px-3 py-2 bg-muted rounded-md">
                  +91
                </span>
                <Input
                  type="tel"
                  placeholder="9876543210"
                  value={requestWhatsApp}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setRequestWhatsApp(value);
                  }}
                  className="flex-1"
                  maxLength={10}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                We'll notify you on WhatsApp when your device is added
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSubmitRequest}
                disabled={isSubmittingRequest}
                className="flex-1"
              >
                {isSubmittingRequest ? "Submitting..." : "Submit Request"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setRequestDialogOpen(false)}
                disabled={isSubmittingRequest}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
