import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeftIcon, PackageIcon, ShoppingCartIcon, CheckIcon, RefreshCwIcon } from "lucide-react";
import { CartButton } from "@/components/cart.tsx";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth.ts";
import { useGuestCart } from "@/hooks/use-guest-cart.ts";
import { ConvexError } from "convex/values";

export default function ProductDetailPage() {
  const [searchParams] = useSearchParams();
  const productSlug = searchParams.get('slug');
  const phoneModel = searchParams.get('model');
  const phoneBrand = searchParams.get('brand');
  
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
                          <Button size="sm" variant="outline" asChild>
                            <Link to="/">
                              <RefreshCwIcon className="size-3 mr-1.5" />
                              Change
                            </Link>
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
                            <Button size="sm" variant="outline" asChild className="w-full">
                              <Link to="/">Select Phone Model</Link>
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
    </div>
  );
}
