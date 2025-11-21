import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { 
  ShieldCheckIcon, 
  SparklesIcon, 
  PackageIcon, 
  TruckIcon,
  LaptopIcon,
  SmartphoneIcon,
  MonitorIcon,
  PlaneIcon,
  CameraIcon,
  CircleDotIcon,
  BatteryChargingIcon,
  TabletSmartphoneIcon,
  GamepadIcon,
  SearchIcon
} from "lucide-react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { CartButton } from "@/components/cart.tsx";
import { Authenticated } from "convex/react";
import { Link } from "react-router-dom";

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  images: Array<{ id: number; src: string; alt: string | null }>;
  variants: Array<{
    id: number;
    title: string;
    price: string;
  }>;
}

// Phone models data - extracted from Shopify variants
const phoneModels: Record<string, string[]> = {
  "Apple": [
    "iPhone 17 Pro Max",
    "iPhone 17 Pro",
    "iPhone 17 Air",
    "iPhone 17",
    "iPhone 16E",
    "iPhone 16 Pro Max",
    "iPhone 16 pro max",
    "iPhone 16 pro",
    "iPhone 16 Plus",
    "iPhone 16",
    "iPhone 15 Pro Max",
    "iPhone 15 Pro",
    "iPhone 15 Plus",
    "iPhone 15",
    "iPhone 14 Pro Max",
    "iPhone 14 Pro",
    "iPhone 14 Plus",
    "iPhone 14",
    "iPhone 13 Pro Max",
    "iPhone 13 Pro",
    "iPhone 13 Mini",
    "iPhone 13",
    "iPhone 12 Pro Max",
    "iPhone 12 Pro",
    "iPhone 12 Mini",
    "iPhone 12",
    "iPhone 11 Pro Max",
    "iPhone 11 Pro",
    "iPhone 11",
    "iPhone XS Max",
    "iPhone XS",
    "iPhone XR",
    "iPhone X",
    "iPhone 8 Plus",
    "iPhone 8",
    "iPhone 7 Plus",
    "iPhone 7",
    "iPhone 6S Plus",
    "iPhone 6S",
    "iPhone 6 Plus",
    "iPhone 6",
    "iPhone SE",
    "iPhone 5E",
    "iPhone 5S",
    "iPhone 5"
  ],
  "Samsung": ["Galaxy S24 Ultra", "Galaxy S24+", "Galaxy S24", "Galaxy S23 Ultra", "Galaxy S23+", "Galaxy S23", "Galaxy S22 Ultra", "Galaxy S22+", "Galaxy S22", "Galaxy Z Fold 5", "Galaxy Z Flip 5", "Galaxy A54", "Galaxy A34"],
  "Nothing": ["Nothing Phone 2", "Nothing Phone 2a", "Nothing Phone 1"],
  "Oppo": ["Reno 11 Pro", "Reno 11", "Reno 10 Pro+", "Reno 10 Pro", "Find N3", "Find X6 Pro"],
  "Realme": ["Realme 12 Pro+", "Realme 12 Pro", "Realme 11 Pro+", "Realme 11 Pro", "Realme GT 3"],
  "CMF": ["CMF Phone 1"],
  "Vivo": ["V30 Pro", "V30", "V29 Pro", "V29", "X100 Pro", "X100"],
  "iQOO": ["iQOO 12", "iQOO 11", "iQOO Neo 9 Pro", "iQOO Neo 9"],
  "Xiaomi": ["Xiaomi 14 Pro", "Xiaomi 14", "Xiaomi 13 Pro", "Xiaomi 13", "Redmi Note 13 Pro+", "Redmi Note 13 Pro"],
  "Lava": ["Lava Blaze 2", "Lava Agni 2"],
  "Infinix": ["Infinix Note 30 Pro", "Infinix Zero 30"],
  "Asus": ["ROG Phone 8 Pro", "ROG Phone 8", "Zenfone 11 Ultra"],
  "HMD": ["Nokia G60", "Nokia X30"]
};

export default function Index() {
  const getAllProducts = useAction(api.shopify.getAllProducts);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [homeSearchQuery, setHomeSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const data = await getAllProducts({});
        setProducts(data);
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        setIsLoadingProducts(false);
      }
    }
    fetchProducts();
  }, [getAllProducts]);

  const matteProducts = products.filter(p => p.title.toLowerCase().includes('matte')).slice(0, 4);
  const embossedProducts = products.filter(p => 
    p.title.toLowerCase().includes('3d textured') || 
    p.title.toLowerCase().includes('3d embossed')
  ).slice(0, 4);
  const transparentProducts = products.filter(p => p.title.toLowerCase().includes('tranzy')).slice(0, 4);

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

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
              src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" 
              alt="Skinly" 
              className="h-10"
            />
          </div>
          <div className="flex items-center gap-6">
            <a href="#products" className="text-sm font-medium hover:text-primary transition-colors">
              Categories
            </a>
            <a href="/products" className="text-sm font-medium hover:text-primary transition-colors">
              All Products
            </a>
            <Authenticated>
              <Link to="/orders" className="text-sm font-medium hover:text-primary transition-colors">
                My Orders
              </Link>
            </Authenticated>
            <CartButton />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto">
          {/* Model Search Bar */}
          <div className="max-w-3xl mx-auto mb-16">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Find Your Phone Model</h2>
              <p className="text-muted-foreground">Search across all brands to find your device</p>
            </div>
            <div className="relative">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-6 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search for your phone model (e.g., iPhone 16 Pro, Galaxy S24...)"
                value={homeSearchQuery}
                onChange={(e) => {
                  setHomeSearchQuery(e.target.value);
                  setShowSearchResults(e.target.value.trim().length > 0);
                }}
                className="pl-14 h-16 text-lg border-2 focus:border-primary"
              />
            </div>
            
            {/* Search Results Dropdown */}
            {showSearchResults && homeSearchQuery.trim().length > 0 && (
              <Card className="mt-2 max-h-96 overflow-y-auto border-2">
                <CardContent className="p-4">
                  {Object.entries(phoneModels).map(([brand, models]) => {
                    const filteredModels = models.filter(model =>
                      model.toLowerCase().includes(homeSearchQuery.toLowerCase())
                    );
                    
                    if (filteredModels.length === 0) return null;
                    
                    return (
                      <div key={brand} className="mb-4 last:mb-0">
                        <div className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                          <span>{brand}</span>
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                            {filteredModels.length}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {filteredModels.map((model, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setHomeSearchQuery("");
                                setShowSearchResults(false);
                                window.location.href = `/products?brand=${brand.toLowerCase()}&model=${encodeURIComponent(model)}&showFinish=true`;
                              }}
                              className="w-full text-left p-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-all group"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{model}</span>
                                <span className="text-xs text-muted-foreground group-hover:text-primary">
                                  Select →
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  
                  {Object.entries(phoneModels).every(([, models]) =>
                    models.filter(model =>
                      model.toLowerCase().includes(homeSearchQuery.toLowerCase())
                    ).length === 0
                  ) && (
                    <div className="text-center py-8 text-muted-foreground">
                      No models found matching &quot;{homeSearchQuery}&quot;
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-block">
                <div className="bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold">
                  ✨ New Quirky Drops
                </div>
              </div>
              <h1 className="text-5xl lg:text-7xl font-bold text-balance leading-tight">
                Boring Phones?
                <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                  {" "}Not On Our Watch!
                </span>
              </h1>
              <p className="text-xl text-muted-foreground text-balance max-w-xl">
                Wildly creative phone skins that'll make your friends jealous. 
                Why blend in when you were born to stand out?
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" className="text-base" asChild>
                  <a href="/products">Browse Collection</a>
                </Button>
                <Button size="lg" variant="secondary" className="text-base">
                  Custom Design
                </Button>
              </div>
              <div className="flex items-center gap-8 pt-4">
                <div>
                  <div className="text-3xl font-bold">10K+</div>
                  <div className="text-sm text-muted-foreground">Happy Customers</div>
                </div>
                <div className="h-12 w-px bg-border" />
                <div>
                  <div className="text-3xl font-bold">500+</div>
                  <div className="text-sm text-muted-foreground">Unique Designs</div>
                </div>
                <div className="h-12 w-px bg-border" />
                <div>
                  <div className="text-3xl font-bold">4.9★</div>
                  <div className="text-sm text-muted-foreground">Average Rating</div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 rounded-3xl blur-3xl" />
              <img 
                src="https://images.unsplash.com/photo-1576110771045-a7711d8aab8e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHw0fHxjb2xvcmZ1bCUyMHBob25lJTIwY2FzZXMlMjBza2lucyUyMG1vZGVybnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Colorful phone cases"
                className="relative rounded-3xl shadow-2xl w-full object-cover aspect-square"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Brand Selector Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl lg:text-5xl font-bold text-balance">
              Pick Your Device Brand
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
              Select your brand and we'll show you the perfect skin
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
            {[
              { name: "Apple", logo: "🍎" },
              { name: "Samsung", logo: "📱" },
              { name: "Nothing", logo: "⚫" },
              { name: "Oppo", logo: "🔷" },
              { name: "Realme", logo: "🟡" },
              { name: "CMF", logo: "🔸" },
              { name: "Vivo", logo: "🔵" },
              { name: "iQOO", logo: "⚡" },
              { name: "Xiaomi", logo: "🦊" },
              { name: "Lava", logo: "🌋" },
              { name: "Infinix", logo: "♾️" },
              { name: "Asus", logo: "🎮" },
              { name: "HMD", logo: "📞" }
            ].map((brand, index) => (
              <button
                key={index}
                onClick={() => {
                  setSelectedBrand(brand.name);
                  setSearchQuery("");
                  setIsDialogOpen(true);
                }}
                className="group flex flex-col items-center gap-4 p-6 bg-card rounded-2xl border-2 border-border hover:border-primary transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <div className="size-16 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform text-3xl">
                  {brand.logo}
                </div>
                <span className="text-sm font-semibold text-center">{brand.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Device Selector Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl lg:text-5xl font-bold text-balance">
              What Needs a Makeover?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
              We've got skins for all your tech
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-4">
            {[
              { icon: LaptopIcon, label: "Laptop", filter: "laptop" },
              { icon: SmartphoneIcon, label: "Phones", filter: "phone" },
              { icon: MonitorIcon, label: "Mac Mini", filter: "mac mini" },
              { icon: PlaneIcon, label: "Drones", filter: "drone" },
              { icon: CameraIcon, label: "Camera", filter: "camera" },
              { icon: CircleDotIcon, label: "Lenses", filter: "lens" },
              { icon: BatteryChargingIcon, label: "Chargers", filter: "charger" },
              { icon: TabletSmartphoneIcon, label: "iPad/Tablet", filter: "ipad" },
              { icon: GamepadIcon, label: "Gaming Console", filter: "console" }
            ].map((device, index) => (
              <a
                key={index}
                href={`/products?device=${device.filter}`}
                className="group flex flex-col items-center gap-4 p-6 bg-card rounded-2xl border-2 border-border hover:border-primary transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <div className="size-16 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <device.icon className="size-8 text-primary" />
                </div>
                <span className="text-sm font-semibold text-center">{device.label}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl lg:text-5xl font-bold text-balance">
              Pick Your Finish
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
              Three unique finishes, endless personality
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="group relative overflow-hidden border-2 hover:border-primary transition-all hover:shadow-xl">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold rounded-bl-lg">
                CLASSIC
              </div>
              <CardContent className="pt-8 space-y-6">
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold">Matte Finish</h3>
                  <p className="text-muted-foreground mb-4">
                    Smooth, velvety texture with zero glare. Perfect for grip and that premium feel.
                  </p>
                </div>
                {isLoadingProducts ? (
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="aspect-square w-full rounded-lg" />
                    ))}
                  </div>
                ) : matteProducts.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {matteProducts.map((product) => (
                      <div key={product.id} className="aspect-square overflow-hidden rounded-lg bg-muted">
                        {product.images[0] ? (
                          <img 
                            src={product.images[0].src} 
                            alt={product.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <PackageIcon className="size-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 rounded-2xl flex items-center justify-center">
                    <div className="text-6xl">🎨</div>
                  </div>
                )}
                <Button className="w-full" variant="outline" asChild>
                  <a href="/products?finish=matte">Shop Matte</a>
                </Button>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden border-2 hover:border-secondary transition-all hover:shadow-xl">
              <div className="absolute top-0 right-0 bg-secondary text-secondary-foreground px-3 py-1 text-xs font-semibold rounded-bl-lg">
                PREMIUM
              </div>
              <CardContent className="pt-8 space-y-6">
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold">3D Embossed Finish</h3>
                  <p className="text-muted-foreground mb-4">
                    Raised textures you can feel. Touch meets art in the most satisfying way.
                  </p>
                </div>
                {isLoadingProducts ? (
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="aspect-square w-full rounded-lg" />
                    ))}
                  </div>
                ) : embossedProducts.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {embossedProducts.map((product) => (
                      <div key={product.id} className="aspect-square overflow-hidden rounded-lg bg-muted">
                        {product.images[0] ? (
                          <img 
                            src={product.images[0].src} 
                            alt={product.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <PackageIcon className="size-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="aspect-square bg-gradient-to-br from-secondary/20 to-secondary/5 rounded-2xl flex items-center justify-center">
                    <div className="text-6xl">✨</div>
                  </div>
                )}
                <Button className="w-full" variant="outline" asChild>
                  <a href="/products?finish=embossed">Shop 3D Embossed</a>
                </Button>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden border-2 hover:border-accent transition-all hover:shadow-xl">
              <div className="absolute top-0 right-0 bg-accent text-accent-foreground px-3 py-1 text-xs font-semibold rounded-bl-lg">
                SLEEK
              </div>
              <CardContent className="pt-8 space-y-6">
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold">Transparent Finish</h3>
                  <p className="text-muted-foreground mb-4">
                    Show off your phone's original color with our crystal-clear protective layer.
                  </p>
                </div>
                {isLoadingProducts ? (
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="aspect-square w-full rounded-lg" />
                    ))}
                  </div>
                ) : transparentProducts.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {transparentProducts.map((product) => (
                      <div key={product.id} className="aspect-square overflow-hidden rounded-lg bg-muted">
                        {product.images[0] ? (
                          <img 
                            src={product.images[0].src} 
                            alt={product.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <PackageIcon className="size-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="aspect-square bg-gradient-to-br from-accent/20 to-accent/5 rounded-2xl flex items-center justify-center">
                    <div className="text-6xl">💎</div>
                  </div>
                )}
                <Button className="w-full" variant="outline" asChild>
                  <a href="/products?finish=transparent">Shop Transparent</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl lg:text-5xl font-bold text-balance">
              Why We're Different
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
              Because your phone deserves more than another boring case
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-2 hover:border-primary transition-all hover:shadow-lg">
                <CardContent className="pt-6 space-y-4">
                  <div className="size-12 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl flex items-center justify-center">
                    <feature.icon className="size-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl lg:text-5xl font-bold text-balance">
              Fan Favorites
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
              The designs everyone's obsessed with right now
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              "https://images.unsplash.com/photo-1582000129759-dc56c7b45cde?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHw5fHxjb2xvcmZ1bCUyMHBob25lJTIwY2FzZXMlMjBza2lucyUyMG1vZGVybnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
              "https://images.unsplash.com/photo-1636703781874-ffa0c5de09aa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHw3fHxjb2xvcmZ1bCUyMHBob25lJTIwY2FzZXMlMjBza2lucyUyMG1vZGVybnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
              "https://images.unsplash.com/photo-1636703782057-cdda1439bc2c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHwzfHxjb2xvcmZ1bCUyMHBob25lJTIwY2FzZXMlMjBza2lucyUyMG1vZGVybnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
              "https://images.unsplash.com/photo-1743670827800-61375c99e7a7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHw2fHxjb2xvcmZ1bCUyMHBob25lJTIwY2FzZXMlMjBza2lucyUyMG1vZGVybnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
              "https://images.unsplash.com/photo-1580013989584-8c3aa8b17263?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHwyfHxjb2xvcmZ1bCUyMHBob25lJTIwY2FzZXMlMjBza2lucyUyMG1vZGVybnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
              "https://images.unsplash.com/photo-1636267863852-a4897886ee2f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHwxMHx8Y29sb3JmdWwlMjBwaG9uZSUyMGNhc2VzJTIwc2tpbnMlMjBtb2Rlcm58ZW58MHx8fHwxNjYzNzIxMjUxfDA&ixlib=rb-4.1.0&q=80&w=1080",
              "https://images.unsplash.com/photo-1731039918160-a26b2b9ff126?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHw4fHxzbWFydHBob25lJTIwcHJvdGVjdGlvbiUyMHRyZW5keSUyMGRlc2lnbnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
              "https://images.unsplash.com/photo-1744646355003-2f61f09b9f18?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHw3fHxzbWFydHBob25lJTIwcHJvdGVjdGlvbiUyMHRyZW5keSUyMGRlc2lnbnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080"
            ].map((image, index) => (
              <div key={index} className="group relative aspect-square overflow-hidden rounded-xl">
                <img 
                  src={image} 
                  alt={`Phone skin design ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <Card className="relative overflow-hidden border-2">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10" />
            <CardContent className="relative py-16 text-center space-y-6">
              <h2 className="text-4xl lg:text-5xl font-bold text-balance">
                Your Phone Called. It Wants Personality.
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
                Join 10,000+ happy humans who ditched boring for bold
              </p>
              <div className="flex flex-wrap gap-4 justify-center pt-4">
                <Button size="lg" className="text-base">
                  Shop Now
                </Button>
                <Button size="lg" variant="outline" className="text-base">
                  Learn More
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <img 
                  src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" 
                  alt="Skinly" 
                  className="h-10"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Quirky wear for your gadgets
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Shop</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">All Products</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">New Arrivals</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Best Sellers</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Shipping Info</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Returns</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Skinly. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Model Selector Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">Select Your {selectedBrand} Model</DialogTitle>
            <DialogDescription>
              Choose your phone model to see compatible skins
            </DialogDescription>
          </DialogHeader>
          
          {/* Search Bar */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Model List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {selectedBrand && phoneModels[selectedBrand]
              ?.filter(model => 
                searchQuery.trim() === "" || 
                model.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((model, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setIsDialogOpen(false);
                    window.location.href = `/products?brand=${selectedBrand.toLowerCase()}&model=${encodeURIComponent(model)}&showFinish=true`;
                  }}
                  className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium group-hover:text-primary transition-colors">
                      {model}
                    </span>
                    <span className="text-sm text-muted-foreground group-hover:text-primary transition-colors">
                      Select →
                    </span>
                  </div>
                </button>
              ))}
            
            {selectedBrand && phoneModels[selectedBrand]
              ?.filter(model => 
                searchQuery.trim() === "" || 
                model.toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No models found matching &quot;{searchQuery}&quot;
                </div>
              )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
