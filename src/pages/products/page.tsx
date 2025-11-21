import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useEffect, useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { AlertCircleIcon, PackageIcon } from "lucide-react";
import { Link } from "react-router-dom";

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

export default function ProductsPage() {
  const getAllProducts = useAction(api.shopify.getAllProducts);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getAllProducts({});
        setProducts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load products");
      } finally {
        setIsLoading(false);
      }
    }
    fetchProducts();
  }, [getAllProducts]);

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="size-8 bg-gradient-to-br from-primary via-secondary to-accent rounded-lg" />
              <span className="text-xl font-bold">SkinStudio</span>
            </Link>
          </div>
        </nav>

        <div className="pt-24 pb-20 px-4">
          <div className="container mx-auto">
            <div className="mb-12">
              <Skeleton className="h-12 w-64 mx-auto mb-4" />
              <Skeleton className="h-6 w-96 mx-auto" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i}>
                  <Skeleton className="aspect-square w-full rounded-t-xl" />
                  <CardContent className="pt-4 space-y-2">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-4 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="size-8 bg-gradient-to-br from-primary via-secondary to-accent rounded-lg" />
              <span className="text-xl font-bold">SkinStudio</span>
            </Link>
          </div>
        </nav>

        <div className="pt-24 pb-20 px-4">
          <div className="container mx-auto max-w-2xl">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AlertCircleIcon />
                </EmptyMedia>
                <EmptyTitle>Connection Error</EmptyTitle>
                <EmptyDescription>
                  {error}
                  <br />
                  <br />
                  Make sure you've added your Shopify credentials in the Secrets tab.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => window.location.reload()}>Try Again</Button>
              </EmptyContent>
            </Empty>
          </div>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="min-h-screen">
        <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="size-8 bg-gradient-to-br from-primary via-secondary to-accent rounded-lg" />
              <span className="text-xl font-bold">SkinStudio</span>
            </Link>
          </div>
        </nav>

        <div className="pt-24 pb-20 px-4">
          <div className="container mx-auto max-w-2xl">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <PackageIcon />
                </EmptyMedia>
                <EmptyTitle>No Products Found</EmptyTitle>
                <EmptyDescription>
                  Your Shopify store doesn't have any products yet.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-8 bg-gradient-to-br from-primary via-secondary to-accent rounded-lg" />
            <span className="text-xl font-bold">SkinStudio</span>
          </Link>
          <div className="flex items-center gap-6">
            <a href="/#products" className="text-sm font-medium hover:text-primary transition-colors">
              Shop
            </a>
            <Link to="/products" className="text-sm font-medium text-primary">
              All Products
            </Link>
            <Button size="sm">Cart</Button>
          </div>
        </div>
      </nav>

      {/* Products Section */}
      <section className="pt-24 pb-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12 space-y-4">
            <h1 className="text-4xl lg:text-5xl font-bold text-balance">
              All Products
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
              {products.length} quirky {products.length === 1 ? "skin" : "skins"} ready to make your tech pop
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => {
              const mainImage = product.images[0];
              const minPrice = Math.min(...product.variants.map(v => parseFloat(v.price)));
              const maxPrice = Math.max(...product.variants.map(v => parseFloat(v.price)));
              const priceDisplay = minPrice === maxPrice 
                ? `$${minPrice.toFixed(2)}`
                : `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;

              return (
                <Card key={product.id} className="group overflow-hidden border-2 hover:border-primary transition-all hover:shadow-xl">
                  <div className="aspect-square overflow-hidden bg-muted">
                    {mainImage ? (
                      <img
                        src={mainImage.src}
                        alt={mainImage.alt || product.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <PackageIcon className="size-16 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CardContent className="pt-4 space-y-2">
                    <h3 className="font-bold text-lg line-clamp-2">{product.title}</h3>
                    {product.vendor && (
                      <p className="text-sm text-muted-foreground">{product.vendor}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-primary">{priceDisplay}</span>
                      {product.variants.length > 1 && (
                        <span className="text-xs text-muted-foreground">
                          {product.variants.length} options
                        </span>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full">View Details</Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
