import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { 
  SparklesIcon, 
  SearchIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  LoaderIcon,
  AlertCircleIcon,
} from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";

function SEOGeneratorPageInner() {
  const products = useQuery(api.products.getAllProductsBasic, { status: "active" });
  const bulkGenerateSEO = useAction(api.seoProductGenerator.bulkGenerateProductSEO);

  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResults, setGenerationResults] = useState<{
    success: { productId: string; title: string }[];
    failed: { productId: string; title: string; error: string }[];
  } | null>(null);

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    return products.filter(product => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = product.title.toLowerCase().includes(query);
        const matchesTag = product.tags.some(tag => tag.toLowerCase().includes(query));
        if (!matchesTitle && !matchesTag) return false;
      }
      
      // Category filter
      if (categoryFilter !== "all" && product.gadgetCategory !== categoryFilter) {
        return false;
      }
      
      return true;
    });
  }, [products, searchQuery, categoryFilter]);

  const handleSelectAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p._id)));
    }
  };

  const handleToggleProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleBulkGenerate = async () => {
    if (selectedProducts.size === 0) {
      toast.error("Please select at least one product");
      return;
    }

    setIsGenerating(true);
    setGenerationResults(null);

    try {
      const productIds = Array.from(selectedProducts) as Id<"products">[];
      const results = await bulkGenerateSEO({ productIds });
      
      setGenerationResults(results);
      
      if (results.success.length > 0) {
        toast.success(`Successfully generated SEO content for ${results.success.length} product(s)`);
      }
      
      if (results.failed.length > 0) {
        toast.error(`Failed to generate SEO for ${results.failed.length} product(s)`);
      }

      // Clear selection after successful generation
      if (results.success.length > 0) {
        setSelectedProducts(new Set());
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to generate SEO content";
      toast.error(errorMessage);
      console.error("Bulk generation error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (products === undefined) {
    return <Skeleton className="h-screen w-full" />;
  }

  if (products.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SparklesIcon />
          </EmptyMedia>
          <EmptyTitle>No products found</EmptyTitle>
          <EmptyDescription>
            Create some products first before generating SEO content
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <SparklesIcon className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">AI SEO Content Generator</h1>
        </div>
        <p className="text-muted-foreground">
          Generate high-quality, SEO-optimized content for your products in bulk using AI
        </p>
      </div>

      {/* Filters and Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Products</CardTitle>
          <CardDescription>
            Choose products to generate SEO content for. AI will create meta titles, descriptions, meta descriptions, and tags.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter */}
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="laptop">Laptop</SelectItem>
                <SelectItem value="tablet">Tablet</SelectItem>
                <SelectItem value="camera">Camera</SelectItem>
                <SelectItem value="lens">Lens</SelectItem>
                <SelectItem value="drone">Drone</SelectItem>
                <SelectItem value="charger">Charger</SelectItem>
                <SelectItem value="console">Console</SelectItem>
                <SelectItem value="mac-mini">Mac Mini</SelectItem>
                <SelectItem value="cover">Cover</SelectItem>
                <SelectItem value="accessory">Accessory</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Selection Controls */}
          <div className="flex items-center justify-between py-2 border-t">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedProducts.size === filteredProducts.length ? "Deselect All" : "Select All"}
              </Button>
              <span className="text-sm text-muted-foreground">
                {selectedProducts.size} of {filteredProducts.length} selected
              </span>
            </div>
            <Button
              onClick={handleBulkGenerate}
              disabled={selectedProducts.size === 0 || isGenerating}
            >
              {isGenerating ? (
                <>
                  <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
                  Generating... ({selectedProducts.size})
                </>
              ) : (
                <>
                  <SparklesIcon className="h-4 w-4 mr-2" />
                  Generate SEO for Selected ({selectedProducts.size})
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      {generationResults && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Generation Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {generationResults.success.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                  <CheckCircleIcon className="h-4 w-4" />
                  Successfully Generated ({generationResults.success.length})
                </div>
                <div className="space-y-1 pl-6">
                  {generationResults.success.map((item) => (
                    <div key={item.productId} className="text-sm text-muted-foreground">
                      • {item.title}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {generationResults.failed.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                  <XCircleIcon className="h-4 w-4" />
                  Failed ({generationResults.failed.length})
                </div>
                <div className="space-y-2 pl-6">
                  {generationResults.failed.map((item) => (
                    <div key={item.productId} className="space-y-1">
                      <div className="text-sm font-medium">{item.title}</div>
                      <div className="text-xs text-red-600">{item.error}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Product List */}
      <Card>
        <CardHeader>
          <CardTitle>Products ({filteredProducts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-2">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No products match your filters
                </div>
              ) : (
                filteredProducts.map((product) => (
                  <div
                    key={product._id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedProducts.has(product._id)}
                      onCheckedChange={() => handleToggleProduct(product._id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate">{product.title}</h3>
                        {product.gadgetCategory && (
                          <Badge variant="secondary" className="text-xs">
                            {product.gadgetCategory}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{product.variantCount} variant(s)</span>
                        <span>•</span>
                        <span>{product.tags.length} tag(s)</span>
                        {!product.metaTitle && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-amber-600">
                              <AlertCircleIcon className="h-3 w-3" />
                              Missing meta title
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SEOGeneratorPage() {
  return (
    <AdminLayout>
      <Unauthenticated>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SparklesIcon />
            </EmptyMedia>
            <EmptyTitle>Please sign in to access admin</EmptyTitle>
            <EmptyDescription>
              You need to be logged in to generate SEO content
            </EmptyDescription>
          </EmptyHeader>
          <SignInButton />
        </Empty>
      </Unauthenticated>
      <AuthLoading>
        <Skeleton className="h-screen w-full" />
      </AuthLoading>
      <Authenticated>
        <SEOGeneratorPageInner />
      </Authenticated>
    </AdminLayout>
  );
}
