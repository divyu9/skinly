import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Link } from "react-router-dom";
import { PackageIcon, PlusIcon, EditIcon, TrashIcon } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

function AdminProductsPageInner() {
  const products = useQuery(api.products.getAllProducts, {});
  const deleteProduct = useMutation(api.products.deleteProduct);

  const handleDelete = async (productId: Id<"products">) => {
    if (!confirm("Are you sure you want to delete this product? This will also delete all variants.")) {
      return;
    }

    try {
      await deleteProduct({ productId });
      toast.success("Product deleted successfully");
    } catch (error) {
      toast.error("Failed to delete product");
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "draft":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "archived":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      default:
        return "";
    }
  };

  if (products === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        <Link to="/admin/products/new">
          <Button>
            <PlusIcon className="size-4 mr-2" />
            Add Product
          </Button>
        </Link>
      </div>

      {products.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageIcon />
            </EmptyMedia>
            <EmptyTitle>No products yet</EmptyTitle>
            <EmptyDescription>
              Create your first product to start selling
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link to="/admin/products/new">
              <Button>
                <PlusIcon className="size-4 mr-2" />
                Create Product
              </Button>
            </Link>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-4">
          {products.map((product) => (
            <Card key={product._id}>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  {/* Product Image */}
                  {product.images.length > 0 && (
                    <div className="size-24 bg-muted rounded-lg overflow-hidden shrink-0">
                      <img
                        src={product.images[0].url}
                        alt={product.images[0].alt || product.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-lg line-clamp-1">
                          {product.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {product.description}
                        </p>
                      </div>
                      <Badge className={getStatusBadgeColor(product.status)}>
                        {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      <span>{product.variants.length} variant(s)</span>
                      {product.collection && (
                        <span>Collection: {product.collection.name}</span>
                      )}
                      <span>
                        Total Stock:{" "}
                        {product.variants.reduce(
                          (sum, v) => sum + v.inventoryQuantity,
                          0
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link to={`/admin/products/${product._id}`}>
                        <Button size="sm" variant="outline">
                          <EditIcon className="size-4 mr-2" />
                          Edit
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(product._id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <TrashIcon className="size-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminProductsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img
                src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv"
                alt="Skinly"
                className="h-8"
              />
            </Link>
            <nav className="flex items-center gap-6">
              <Link to="/admin/products" className="text-sm font-medium text-primary">
                Products
              </Link>
              <Link to="/admin/collections" className="text-sm font-medium hover:text-primary transition-colors">
                Collections
              </Link>
              <Link to="/admin/orders" className="text-sm font-medium hover:text-primary transition-colors">
                Orders
              </Link>
              <Link to="/">
                <Button variant="outline" size="sm">
                  View Store
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Unauthenticated>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageIcon />
              </EmptyMedia>
              <EmptyTitle>Please sign in to access admin</EmptyTitle>
              <EmptyDescription>
                You need to be logged in to manage products
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <SignInButton />
            </EmptyContent>
          </Empty>
        </Unauthenticated>
        <AuthLoading>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </AuthLoading>
        <Authenticated>
          <AdminProductsPageInner />
        </Authenticated>
      </div>
    </div>
  );
}
