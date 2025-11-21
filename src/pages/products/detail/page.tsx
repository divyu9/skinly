import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeftIcon, PackageIcon, ShoppingCartIcon } from "lucide-react";

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  description: string;
  vendor: string;
  product_type: string;
  tags: string;
  status: string;
  images: Array<{ id: number; src: string; alt: string | null }>;
  variants: Array<{
    id: number;
    title: string;
    price: string;
    sku: string;
    inventory_quantity: number;
    available: boolean;
  }>;
}

export default function ProductDetailPage() {
  const [searchParams] = useSearchParams();
  const productId = searchParams.get('id');
  const getAllProducts = useAction(api.shopify.getAllProducts);
  const [product, setProduct] = useState<ShopifyProduct | null>(null);
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchProduct() {
      try {
        setIsLoading(true);
        const data = await getAllProducts({});
        const foundProduct = data.find((p: ShopifyProduct) => p.id.toString() === productId);
        if (foundProduct) {
          setProduct(foundProduct);
          setSelectedImage(foundProduct.images[0]?.src || "");
        }
      } catch (err) {
        console.error("Failed to load product:", err);
      } finally {
        setIsLoading(false);
      }
    }
    
    if (productId) {
      fetchProduct();
    }
  }, [getAllProducts, productId]);

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

  const minPrice = Math.min(...product.variants.map(v => parseFloat(v.price)));
  const maxPrice = Math.max(...product.variants.map(v => parseFloat(v.price)));
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
            <Button size="sm">Cart</Button>
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
                  {product.images.map((image) => (
                    <button
                      key={image.id}
                      onClick={() => setSelectedImage(image.src)}
                      className={`aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                        selectedImage === image.src
                          ? "border-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <img
                        src={image.src}
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
                {product.vendor && (
                  <p className="text-lg text-muted-foreground mb-4">by {product.vendor}</p>
                )}
                <div className="text-3xl font-bold text-primary mb-6">{priceDisplay}</div>
              </div>

              {product.description && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-2">Description</h3>
                    <p className="text-muted-foreground">{product.description}</p>
                  </CardContent>
                </Card>
              )}

              {/* Phone Model Selector Placeholder */}
              <Card className="border-2 border-primary bg-primary/5">
                <CardContent className="pt-6 space-y-4">
                  <h3 className="text-xl font-bold">Select Your Phone Model</h3>
                  <p className="text-sm text-muted-foreground">
                    This design is available for all phone models. Please select your device to proceed.
                  </p>
                  
                  {/* Placeholder for phone model selector - will be implemented */}
                  <div className="space-y-3">
                    <Button className="w-full" size="lg" disabled>
                      <ShoppingCartIcon className="size-5 mr-2" />
                      Phone Model Selector (Coming Soon)
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      Phone model selection will be available soon
                    </p>
                  </div>
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
                          key={variant.id}
                          className="flex justify-between items-center p-3 bg-muted rounded-lg"
                        >
                          <span className="text-sm">{variant.title}</span>
                          <span className="text-sm font-semibold">₹{parseFloat(variant.price).toFixed(0)}</span>
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
