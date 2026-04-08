import { useQuery, useAction } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
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
  ExternalLinkIcon,
  EyeIcon,
} from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/firebase-hooks";
import { SignInButton } from "@/components/ui/signin.tsx";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { toast } from "sonner";
import type { Id } from "@/lib/firebase-api";
import { useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Progress } from "@/components/ui/progress.tsx";

function SEOGeneratorPageInner() {
  const products = useQuery(api.products.getAllProductsBasic, { status: "active" });
  const bulkGenerateSEO = useAction(api.seoProductGenerator.bulkGenerateProductSEO);

  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTab, setCurrentTab] = useState<"complete" | "pending">("pending");
  const [generationProgress, setGenerationProgress] = useState<{
    total: number;
    current: number;
    percentage: number;
  } | null>(null);
  const [generationResults, setGenerationResults] = useState<{
    success: { productId: string; title: string }[];
    failed: { productId: string; title: string; error: string }[];
  } | null>(null);

  // Separate products into complete and pending
  const { completeProducts, pendingProducts } = useMemo(() => {
    if (!products) return { completeProducts: [], pendingProducts: [] };
    
    const complete: typeof products = [];
    const pending: typeof products = [];
    
    products.forEach(product => {
      const hasSEO = product.metaTitle && product.metaDescription;
      if (hasSEO) {
        complete.push(product);
      } else {
        pending.push(product);
      }
    });
    
    return { completeProducts: complete, pendingProducts: pending };
  }, [products]);

  // Filter products based on current tab and filters
  const filteredProducts = useMemo(() => {
    const sourceProducts = currentTab === "complete" ? completeProducts : pendingProducts;
    
    return sourceProducts.filter(product => {
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
  }, [completeProducts, pendingProducts, currentTab, searchQuery, categoryFilter]);

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
    
    const productIds = Array.from(selectedProducts) as Id<"products">[];
    const total = productIds.length;
    
    setGenerationProgress({ total, current: 0, percentage: 0 });

    const results: {
      success: { productId: string; title: string }[];
      failed: { productId: string; title: string; error: string }[];
    } = {
      success: [],
      failed: [],
    };

    try {
      // Process products one by one to show progress
      for (let i = 0; i < productIds.length; i++) {
        const productId = productIds[i];
        
        try {
          // Get product info
          const product = products?.find(p => p._id === productId);
          if (!product) {
            results.failed.push({
              productId,
              title: "Unknown",
              error: "Product not found",
            });
            continue;
          }

          // Generate SEO content for single product
          await bulkGenerateSEO({ productIds: [productId] });
          
          results.success.push({
            productId,
            title: product.title,
          });
        } catch (error) {
          const product = products?.find(p => p._id === productId);
          results.failed.push({
            productId,
            title: product?.title || "Unknown",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
        
        // Update progress
        const current = i + 1;
        const percentage = Math.round((current / total) * 100);
        setGenerationProgress({ total, current, percentage });
      }
      
      setGenerationResults(results);
      
      if (results.success.length > 0) {
        toast.success(`Successfully generated SEO content for ${results.success.length} product(s)`);
      }
      
      if (results.failed.length > 0) {
        toast.error(`Failed to generate SEO for ${results.failed.length} product(s)`);
      }

      // Clear selection after generation
      setSelectedProducts(new Set());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to generate SEO content";
      toast.error(errorMessage);
      console.error("Bulk generation error:", error);
    } finally {
      setIsGenerating(false);
      setGenerationProgress(null);
    }
  };

  const handleSelectAllPending = () => {
    if (selectedProducts.size === pendingProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(pendingProducts.map(p => p._id)));
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

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <SparklesIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SEO Complete</CardTitle>
            <CheckCircleIcon className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completeProducts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending SEO</CardTitle>
            <AlertCircleIcon className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pendingProducts.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>
            Search products and filter by category to find and manage SEO content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products by name or tag..."
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
        </CardContent>
      </Card>

      {/* Progress Bar */}
      {generationProgress && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LoaderIcon className="h-5 w-5 animate-spin" />
              Generating SEO Content...
            </CardTitle>
            <CardDescription>
              Processing {generationProgress.current} of {generationProgress.total} products
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={generationProgress.percentage} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">
              {generationProgress.percentage}% complete
            </p>
          </CardContent>
        </Card>
      )}

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

      {/* Tabbed Product List */}
      <Tabs value={currentTab} onValueChange={(v) => setCurrentTab(v as "complete" | "pending")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="pending">
            Pending SEO ({pendingProducts.length})
          </TabsTrigger>
          <TabsTrigger value="complete">
            SEO Complete ({completeProducts.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending Tab */}
        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pending Products</CardTitle>
                  <CardDescription>
                    Products missing meta title or meta description
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllPending}
                  >
                    {selectedProducts.size === pendingProducts.length ? "Deselect All" : "Select All Pending"}
                  </Button>
                  <Button
                    onClick={handleBulkGenerate}
                    disabled={selectedProducts.size === 0 || isGenerating}
                    size="sm"
                  >
                    {isGenerating ? (
                      <>
                        <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="h-4 w-4 mr-2" />
                        Generate SEO ({selectedProducts.size})
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-2">
                  {filteredProducts.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircleIcon className="h-12 w-12 text-green-600 mx-auto mb-3" />
                      <h3 className="font-semibold mb-1">All products have SEO!</h3>
                      <p className="text-sm text-muted-foreground">
                        No pending products match your filters
                      </p>
                    </div>
                  ) : (
                    filteredProducts.map((product) => (
                      <ProductRow
                        key={product._id}
                        product={product}
                        isSelected={selectedProducts.has(product._id)}
                        onToggle={() => handleToggleProduct(product._id)}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Complete Tab */}
        <TabsContent value="complete" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SEO Complete Products</CardTitle>
              <CardDescription>
                Products with complete SEO information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-2">
                  {filteredProducts.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      No products match your filters
                    </div>
                  ) : (
                    filteredProducts.map((product) => (
                      <ProductRow
                        key={product._id}
                        product={product}
                        isSelected={selectedProducts.has(product._id)}
                        onToggle={() => handleToggleProduct(product._id)}
                        showCheckbox={false}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Product Row Component
function ProductRow({
  product,
  isSelected,
  onToggle,
  showCheckbox = true,
}: {
  product: {
    _id: string;
    title: string;
    slug?: string;
    gadgetCategory?: string;
    variantCount: number;
    tags: string[];
    metaTitle?: string;
    metaDescription?: string;
  };
  isSelected: boolean;
  onToggle: () => void;
  showCheckbox?: boolean;
}) {
  const hasSEO = product.metaTitle && product.metaDescription;
  const productUrl = product.slug 
    ? `/products/${product.slug}`
    : `/products/detail?id=${product._id}`;
  
  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      {showCheckbox && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggle}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-medium truncate">{product.title}</h3>
          {product.gadgetCategory && (
            <Badge variant="secondary" className="text-xs">
              {product.gadgetCategory}
            </Badge>
          )}
          {hasSEO ? (
            <Badge variant="default" className="text-xs bg-green-600">
              <CheckCircleIcon className="h-3 w-3 mr-1" />
              SEO Complete
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-xs">
              <AlertCircleIcon className="h-3 w-3 mr-1" />
              Pending
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{product.variantCount} variant(s)</span>
          <span>•</span>
          <span>{product.tags.length} tag(s)</span>
          {!product.metaTitle && (
            <>
              <span>•</span>
              <span className="text-amber-600">Missing meta title</span>
            </>
          )}
          {!product.metaDescription && (
            <>
              <span>•</span>
              <span className="text-amber-600">Missing meta description</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(productUrl, "_blank")}
        >
          <EyeIcon className="h-4 w-4 mr-1" />
          View
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(`/backend-skinly/products/${product._id}`, "_blank")}
        >
          <ExternalLinkIcon className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </div>
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
