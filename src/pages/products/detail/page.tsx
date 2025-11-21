import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeftIcon, PackageIcon, ShoppingCartIcon, CheckIcon, RefreshCwIcon } from "lucide-react";
import { CartButton } from "@/components/cart.tsx";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth.ts";
import { useGuestCart } from "@/hooks/use-guest-cart.ts";
import { ConvexError } from "convex/values";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";

// Phone models data
const phoneModels: Record<string, string[]> = {
  "Apple": [
    "iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone 17 Air", "iPhone 17",
    "iPhone 16E", "iPhone 16 Pro Max", "iPhone 16 pro max", "iPhone 16 pro",
    "iPhone 16 Plus", "iPhone 16", "iPhone 15 Pro Max", "iPhone 15 Pro",
    "iPhone 15 Plus", "iPhone 15", "iPhone 14 Pro Max", "iPhone 14 Pro",
    "iPhone 14 Plus", "iPhone 14", "iPhone 13 Pro Max", "iPhone 13 Pro",
    "iPhone 13 Mini", "iPhone 13", "iPhone 12 Pro Max", "iPhone 12 Pro",
    "iPhone 12 Mini", "iPhone 12", "iPhone 11 Pro Max", "iPhone 11 Pro",
    "iPhone 11", "iPhone XS Max", "iPhone XS", "iPhone XR", "iPhone X",
    "iPhone 8 Plus", "iPhone 8", "iPhone 7 Plus", "iPhone 7",
    "iPhone 6S Plus", "iPhone 6S", "iPhone 6 Plus", "iPhone 6",
    "iPhone SE", "iPhone 5E", "iPhone 5S", "iPhone 5"
  ],
  "Samsung": [
    "Samsung Galaxy S25 Edge", "Samsung Galaxy S25 Plus", "Samsung Galaxy S25 Ultra (5G)",
    "Samsung Galaxy S25 (5G)", "Samsung Galaxy S24 Ultra (5G)", "Samsung Galaxy S24 Plus",
    "Samsung Galaxy S24 (5G)", "Samsung Galaxy S24 FE (5G)", "Samsung Galaxy S23 FE (5G)",
    "Samsung Galaxy S23 (5G)", "Samsung Galaxy S22 Ultra", "Samsung Galaxy S22 Plus",
    "Samsung Galaxy S22", "Samsung Galaxy S21 Ultra 5G", "Samsung Galaxy S21 Plus 5G",
    "Samsung Galaxy S21 FE 5G", "Samsung Galaxy S21 5G", "Samsung Galaxy Z Fold 5",
    "Samsung Galaxy Z Fold 4", "Samsung Galaxy Z Flip 5", "Samsung Galaxy Z Flip 4"
  ],
  "OnePlus": [
    "OnePlus 13 Pro", "OnePlus 13", "OnePlus 12", "OnePlus 11 5G", "OnePlus 10 Pro 5G",
    "OnePlus 9 Pro", "OnePlus 9", "OnePlus 8T", "OnePlus 8 Pro", "OnePlus Nord 4",
    "OnePlus Nord 3", "OnePlus Nord CE 4", "OnePlus Nord CE 3"
  ],
  "Nothing": [
    "Nothing Phone 3A Pro", "Nothing Phone 3A", "Nothing Phone 2A",
    "Nothing Phone 2", "Nothing Phone 1 5G"
  ],
  "Oppo": [
    "Oppo Find 8X Pro (5G)", "Oppo Find 8X (5G)", "Oppo Reno 14 Pro 5G",
    "Oppo Reno 14 5G", "Oppo Reno 13 Pro (5G)", "Oppo Reno 12 Pro (5G)",
    "Oppo F31 Pro Plus 5G", "Oppo F29 Pro (5G)", "Oppo F27 Pro Plus (5G)"
  ],
  "Realme": [
    "Realme GT 7T 5G", "Realme GT7 Pro 5G", "Realme P4 Pro 5G", "Realme P4 5G",
    "Realme 15 Pro 5G", "Realme 14 Pro Plus (5G)", "Realme 13 Pro Plus 5G",
    "Realme 12 Pro Plus (5G)", "Realme 11 Pro Plus"
  ],
  "Vivo": [
    "Vivo X200 Pro (5G)", "Vivo X200 (5G)", "Vivo X100 Pro", "Vivo V60 5G",
    "Vivo V50 5G", "Vivo V40 5G", "Vivo V30 Pro (5G)", "Vivo V29 Pro (5G)"
  ],
  "Xiaomi": [
    "Xiaomi 15 Ultra", "Xiaomi 15 Pro", "Xiaomi 15", "Xiaomi 14 Ultra",
    "Xiaomi 14 Pro", "Xiaomi 14", "Xiaomi 13 Pro", "Redmi Note 14 Pro Plus 5G",
    "Redmi Note 13 Pro Plus", "Poco X7 Pro", "Poco F6"
  ],
  "CMF": ["CMF Phone 2 Pro", "CMF Phone 1"],
  "Motorola": [
    "Motorola Edge 60 Ultra", "Motorola Edge 50 Pro", "Motorola Edge 40",
    "Moto G85", "Moto G75", "Moto G64"
  ],
  "Google": ["Google Pixel 9 Pro XL", "Google Pixel 9 Pro", "Google Pixel 8 Pro"]
};

export default function ProductDetailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const productSlug = searchParams.get('slug');
  const phoneModel = searchParams.get('model');
  const phoneBrand = searchParams.get('brand');
  
  // Model selector state
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [modelSearch, setModelSearch] = useState("");
  
  // Filter models based on search
  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) return phoneModels[selectedBrand] || [];
    
    const searchTerms = modelSearch
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 0);
    
    return (phoneModels[selectedBrand] || []).filter((model) => {
      const modelLower = model.toLowerCase();
      return searchTerms.every((term) => modelLower.includes(term));
    });
  }, [selectedBrand, modelSearch]);
  
  // Handle model selection
  const handleModelSelect = (model: string, brand: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('model', model);
    newSearchParams.set('brand', brand);
    navigate({
      pathname: '/products/detail',
      search: newSearchParams.toString(),
    });
    setModelDialogOpen(false);
    setSelectedBrand("");
    setModelSearch("");
  };
  
  // Query local database
  const productData = useQuery(
    api.products.getProductBySlug, 
    productSlug ? { slug: productSlug } : "skip"
  );
  
  const addToCart = useMutation(api.cart.addToCart);
  const { user } = useAuth();
  const { addToGuestCart } = useGuestCart();
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [selectedVariant, setSelectedVariant] = useState<number>(0);
  const [isAdding, setIsAdding] = useState(false);
  
  const isLoading = productData === undefined;
  const product = productData;
  
  // Set initial selected image when product loads
  if (product && !selectedImage && product.images[0]) {
    setSelectedImage(product.images[0].url);
  }

  if (isLoading) {
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
          <div className="container mx-auto max-w-6xl">
            <Skeleton className="h-8 w-32 mb-8" />
            <div className="grid lg:grid-cols-2 gap-12">
              <Skeleton className="aspect-square w-full rounded-2xl" />
              <div className="space-y-6">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    if (!isLoading) {
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
            <div className="container mx-auto max-w-2xl text-center">
              <PackageIcon className="size-16 text-muted-foreground mx-auto mb-4" />
              <h1 className="text-3xl font-bold mb-4">Product Not Found</h1>
              <Button asChild>
                <Link to="/products">Browse All Products</Link>
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  const minPrice = Math.min(...product.variants.map(v => v.price));
  const maxPrice = Math.max(...product.variants.map(v => v.price));
  const priceDisplay = minPrice === maxPrice 
    ? `₹${minPrice.toFixed(0)}`
    : `₹${minPrice.toFixed(0)} - ₹${maxPrice.toFixed(0)}`;

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
            <Link to="/products" className="text-sm font-medium hover:text-primary transition-colors">
              All Products
            </Link>
            <CartButton />
          </div>
        </div>
      </nav>

      {/* Product Detail Section */}
      <section className="pt-24 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <Button variant="ghost" asChild className="mb-8">
            <Link to="/products">
              <ArrowLeftIcon className="size-4 mr-2" />
              Back to Products
            </Link>
          </Button>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Image Gallery */}
            <div className="space-y-4">
              <div className="aspect-square overflow-hidden rounded-2xl bg-muted border-2 border-border">
                {selectedImage ? (
                  <img
                    src={selectedImage}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <PackageIcon className="size-16 text-muted-foreground" />
                  </div>
                )}
              </div>
              
              {/* Thumbnail Gallery */}
              {product.images.length > 1 && (
                <div className="grid grid-cols-4 gap-4">
                  {product.images.map((image, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImage(image.url)}
                      className={`aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                        selectedImage === image.url
                          ? "border-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <img
                        src={image.url}
                        alt={image.alt || product.title}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="space-y-6">
              <div>
                <h1 className="text-4xl font-bold mb-4">{product.title}</h1>
                <div className="text-3xl font-bold text-primary mb-6">{priceDisplay}</div>
              </div>

              {product.description && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-2">Description</h3>
                    <div 
                      className="text-muted-foreground prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: product.description }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Add to Cart Section */}
              <Card className="border-2 border-primary bg-primary/5">
                <CardContent className="pt-6 space-y-4">
                  <h3 className="text-xl font-bold">Add to Cart</h3>
                  
                  {/* Phone Model Display */}
                  {phoneModel ? (
                    <Card className="border border-primary/20 bg-primary/5">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <CheckIcon className="size-5 text-primary shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-1">Selected Phone Model</p>
                            <p className="font-bold text-base">{phoneModel}</p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setModelDialogOpen(true)}
                          >
                            <RefreshCwIcon className="size-3 mr-1.5" />
                            Change
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border border-yellow-500/50 bg-yellow-500/10">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl shrink-0">📱</div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold mb-1">Phone Model Required</p>
                            <p className="text-xs text-muted-foreground mb-3">
                              Select your phone model to ensure perfect fit
                            </p>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="w-full"
                              onClick={() => setModelDialogOpen(true)}
                            >
                              Select Phone Model
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  {product.variants.length > 1 && (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Select Variant</label>
                      <div className="space-y-2">
                        {product.variants.map((variant, idx) => (
                          <button
                            key={variant._id}
                            onClick={() => setSelectedVariant(idx)}
                            className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                              selectedVariant === idx
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium">{variant.title}</span>
                              <span className="font-bold text-primary">
                                ₹{variant.price.toFixed(0)}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={async () => {
                      if (!phoneModel) {
                        toast.error("Please select your phone model first");
                        return;
                      }
                      
                      setIsAdding(true);
                      
                      try {
                        const cartItem = {
                          productId: product._id,
                          productTitle: product.title,
                          productImage: product.images[0]?.url,
                          variant: product.variants[selectedVariant].title,
                          price: product.variants[selectedVariant].price,
                          quantity: 1,
                          phoneModel: phoneModel,
                          phoneBrand: phoneBrand || undefined,
                        };
                        
                        if (user) {
                          // Add to authenticated cart
                          await addToCart(cartItem);
                        } else {
                          // Add to guest cart
                          addToGuestCart(cartItem);
                        }
                        
                        toast.success("Added to cart!");
                      } catch (error) {
                        if (error instanceof ConvexError && error.data.code === "UNAUTHENTICATED") {
                          // Fallback to guest cart if auth fails
                          addToGuestCart({
                            productId: product._id,
                            productTitle: product.title,
                            productImage: product.images[0]?.url,
                            variant: product.variants[selectedVariant].title,
                            price: product.variants[selectedVariant].price,
                            quantity: 1,
                            phoneModel: phoneModel,
                            phoneBrand: phoneBrand || undefined,
                          });
                          toast.success("Added to cart!");
                        } else {
                          toast.error("Failed to add to cart");
                        }
                      } finally {
                        setIsAdding(false);
                      }
                    }}
                    disabled={isAdding || !phoneModel}
                  >
                    <ShoppingCartIcon className="size-5 mr-2" />
                    {isAdding ? "Adding..." : "Add to Cart"}
                  </Button>
                </CardContent>
              </Card>

              {/* Product Details */}
              {product.variants.length > 1 && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-3">Available Options</h3>
                    <div className="space-y-2">
                      {product.variants.map((variant) => (
                        <div
                          key={variant._id}
                          className="flex justify-between items-center p-3 bg-muted rounded-lg"
                        >
                          <span className="text-sm">{variant.title}</span>
                          <span className="text-sm font-semibold">₹{variant.price.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </section>
      
      {/* Model Selector Dialog */}
      <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          {!selectedBrand ? (
            <>
              <DialogHeader>
                <DialogTitle>Select Phone Brand</DialogTitle>
                <DialogDescription>Choose your phone brand to see available models</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto pr-2">
                {Object.keys(phoneModels).sort().map((brand) => (
                  <Button
                    key={brand}
                    variant="outline"
                    className="h-auto py-4"
                    onClick={() => setSelectedBrand(brand)}
                  >
                    {brand}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Select {selectedBrand} Model</DialogTitle>
                <DialogDescription>
                  {filteredModels.length} models available
                </DialogDescription>
              </DialogHeader>
              <Input
                placeholder={`Search ${selectedBrand} models...`}
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                className="mb-2"
              />
              <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                {filteredModels.length > 0 ? (
                  filteredModels.map((model) => (
                    <Button
                      key={model}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3"
                      onClick={() => handleModelSelect(model, selectedBrand)}
                    >
                      {model}
                    </Button>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                    <p className="text-muted-foreground">No models found matching "{modelSearch}"</p>
                    <a
                      href={`https://wa.me/919761011121?text=${encodeURIComponent("I Want to request a model on Skinly")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                    >
                      Request Your Model
                    </a>
                  </div>
                )}
              </div>
              <div className="pt-4 border-t">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelectedBrand("");
                    setModelSearch("");
                  }}
                  className="w-full"
                >
                  ← Back to Brands
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
