import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Link } from "react-router-dom";
import { PackageIcon, PlusIcon, EditIcon, TrashIcon, DownloadIcon, SearchIcon, CheckCircleIcon, XCircleIcon, AlertCircleIcon, SaveIcon } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";

// Variant editor component for inline editing
function VariantEditor({ 
  variant, 
  onUpdate 
}: { 
  variant: { 
    _id: Id<"variants">; 
    title: string; 
    sku: string; 
    price: number; 
    inventoryQuantity: number; 
  }; 
  onUpdate: () => void;
}) {
  const updateVariant = useMutation(api.products.updateVariant);
  const [price, setPrice] = useState(variant.price.toString());
  const [stock, setStock] = useState(variant.inventoryQuantity.toString());
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handlePriceChange = (value: string) => {
    setPrice(value);
    setHasChanges(true);
  };

  const handleStockChange = (value: string) => {
    setStock(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    const priceNum = parseFloat(price);
    const stockNum = parseInt(stock, 10);

    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Please enter a valid price");
      return;
    }

    if (isNaN(stockNum) || stockNum < 0) {
      toast.error("Please enter a valid stock quantity");
      return;
    }

    setIsSaving(true);
    try {
      await updateVariant({
        variantId: variant._id,
        price: priceNum,
        inventoryQuantity: stockNum,
      });
      toast.success("Variant updated successfully");
      setHasChanges(false);
      onUpdate();
    } catch (error) {
      toast.error("Failed to update variant");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{variant.title}</p>
        <p className="text-xs text-muted-foreground">SKU: {variant.sku}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Price (₹)</label>
          <Input
            type="number"
            value={price}
            onChange={(e) => handlePriceChange(e.target.value)}
            className="w-24 h-8 text-sm"
            min="0"
            step="0.01"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Stock</label>
          <Input
            type="number"
            value={stock}
            onChange={(e) => handleStockChange(e.target.value)}
            className="w-20 h-8 text-sm"
            min="0"
            step="1"
          />
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="h-8 mt-5"
        >
          <SaveIcon className="size-4 mr-1" />
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

function AdminProductsPageInner() {
  const products = useQuery(api.products.getAllProducts, {});
  const deleteProduct = useMutation(api.products.deleteProduct);
  const deleteAllProducts = useMutation(api.products.deleteAllProducts);
  const migrateFromShopify = useAction(api.migration.migrateFromShopify);
  const checkProductCount = useAction(api.migration.checkShopifyProductCount);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCheckingCount, setIsCheckingCount] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [migrationReport, setMigrationReport] = useState<{
    total: number;
    successful: number;
    skipped: number;
    failed: number;
    successfulProducts: string[];
    skippedProducts: Array<{ title: string; reason: string }>;
    failedProducts: Array<{ title: string; reason: string }>;
  } | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);

  const handleCheckCount = async () => {
    setIsCheckingCount(true);
    try {
      const result = await checkProductCount({});
      const message = `
Shopify: ${result.shopifyTotal} products
Local DB: ${result.localTotal} products
Missing: ${result.missing} products

${result.missing > 0 ? "Click 'Import from Shopify' to import missing products." : "All products are synced!"}
      `.trim();
      
      if (result.missing > 0) {
        toast.warning(message);
      } else {
        toast.success(message);
      }
    } catch (error) {
      toast.error(`Failed to check product count: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsCheckingCount(false);
    }
  };

  const handleMigration = async () => {
    if (!confirm("This will import all active products from Shopify. Products already in your database will be skipped automatically. Continue?")) {
      return;
    }

    setIsMigrating(true);
    try {
      const result = await migrateFromShopify({ forceReimport: false });
      
      // Store the full report
      setMigrationReport(result);
      
      const parts = [
        `${result.successful} imported`,
        result.skipped > 0 ? `${result.skipped} skipped` : null,
        result.failed > 0 ? `${result.failed} failed` : null,
      ].filter(Boolean);
      
      toast.success(
        `Migration complete! ${parts.join(", ")}. Click "View Details" to see full report.`
      );
      
      // Show the dialog with detailed report
      setShowReportDialog(true);
    } catch (error) {
      toast.error(`Migration failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("⚠️ WARNING: This will permanently delete ALL products and variants from your database. This action cannot be undone. Are you absolutely sure?")) {
      return;
    }

    // Double confirmation for safety
    if (!confirm("Last chance! Type 'DELETE' in the next dialog to confirm.")) {
      return;
    }

    const userInput = prompt("Type 'DELETE' to confirm deletion of all products:");
    if (userInput !== "DELETE") {
      toast.error("Deletion cancelled - confirmation text did not match.");
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteAllProducts({});
      toast.success(
        `All products cleared! Deleted ${result.deletedProducts} products and ${result.deletedVariants} variants.`
      );
    } catch (error) {
      toast.error(`Failed to delete products: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsDeleting(false);
    }
  };

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

  const toggleProductExpanded = (productId: string) => {
    setExpandedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  // Filter products based on search query
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchQuery.trim()) return products;
    
    const query = searchQuery.toLowerCase().trim();
    return products.filter((product) => {
      return (
        product.title.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.slug.toLowerCase().includes(query) ||
        product.tags.some((tag) => tag.toLowerCase().includes(query)) ||
        (product.collection?.name.toLowerCase().includes(query))
      );
    });
  }, [products, searchQuery]);

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
          <p className="text-muted-foreground">
            {searchQuery 
              ? `${filteredProducts.length} of ${products.length} products` 
              : `Manage your product catalog (${products.length} products)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {products && products.length > 0 && (
            <Button 
              variant="outline" 
              onClick={handleClearAll} 
              disabled={isDeleting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <TrashIcon className="size-4 mr-2" />
              {isDeleting ? "Clearing..." : "Clear All"}
            </Button>
          )}
          <Button variant="secondary" onClick={handleCheckCount} disabled={isCheckingCount}>
            <PackageIcon className="size-4 mr-2" />
            {isCheckingCount ? "Checking..." : "Check Product Count"}
          </Button>
          <Button variant="outline" onClick={handleMigration} disabled={isMigrating}>
            <DownloadIcon className="size-4 mr-2" />
            {isMigrating ? "Importing..." : "Import from Shopify"}
          </Button>
          {migrationReport && (
            <Button 
              variant="ghost" 
              onClick={() => setShowReportDialog(true)}
              className="text-xs"
            >
              View Last Report
            </Button>
          )}
          <Link to="/admin/products/new">
            <Button>
              <PlusIcon className="size-4 mr-2" />
              Add Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      {products.length > 0 && (
        <div className="max-w-md">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search products by title, description, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      )}

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
      ) : filteredProducts.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon />
            </EmptyMedia>
            <EmptyTitle>No products found</EmptyTitle>
            <EmptyDescription>
              No products match your search &quot;{searchQuery}&quot;
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setSearchQuery("")} variant="outline">
              Clear Search
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-4">
          {filteredProducts.map((product) => (
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

                    {/* Variants - Inline Editing */}
                    {expandedProducts.has(product._id) && product.variants.length > 0 && (
                      <div className="space-y-2 mb-4">
                        <div className="text-sm font-medium text-muted-foreground mb-2">
                          Variants - Edit Price & Stock:
                        </div>
                        {product.variants.map((variant) => (
                          <VariantEditor
                            key={variant._id}
                            variant={variant}
                            onUpdate={() => {
                              // The data will auto-refresh via Convex reactivity
                            }}
                          />
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {product.variants.length > 0 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => toggleProductExpanded(product._id)}
                        >
                          {expandedProducts.has(product._id) ? "Hide" : "Show"} Variants
                        </Button>
                      )}
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

      {/* Migration Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Import Report</DialogTitle>
            <DialogDescription>
              {migrationReport && (
                <>
                  Imported {migrationReport.successful} of {migrationReport.total} products from Shopify
                  {migrationReport.skipped > 0 && ` (${migrationReport.skipped} skipped)`}
                  {migrationReport.failed > 0 && ` (${migrationReport.failed} failed)`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {migrationReport && (
            <Tabs defaultValue="skipped" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="skipped" className="flex items-center gap-2">
                  <AlertCircleIcon className="size-4" />
                  Skipped ({migrationReport.skipped})
                </TabsTrigger>
                <TabsTrigger value="successful" className="flex items-center gap-2">
                  <CheckCircleIcon className="size-4" />
                  Imported ({migrationReport.successful})
                </TabsTrigger>
                <TabsTrigger value="failed" className="flex items-center gap-2">
                  <XCircleIcon className="size-4" />
                  Failed ({migrationReport.failed})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="skipped">
                <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                  {migrationReport.skippedProducts.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No products were skipped
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {migrationReport.skippedProducts.map((product, idx) => (
                        <Card key={idx}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <AlertCircleIcon className="size-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm">{product.title}</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {product.reason}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="successful">
                <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                  {migrationReport.successfulProducts.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No products were imported
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {migrationReport.successfulProducts.map((title, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                          <CheckCircleIcon className="size-4 text-green-500 flex-shrink-0" />
                          <span className="text-sm">{title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="failed">
                <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                  {migrationReport.failedProducts.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No products failed to import
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {migrationReport.failedProducts.map((product, idx) => (
                        <Card key={idx}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <XCircleIcon className="size-5 text-red-500 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm">{product.title}</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {product.reason}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
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
