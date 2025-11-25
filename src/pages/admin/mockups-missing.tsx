import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { AdminHeader } from "@/components/admin-header.tsx";
import { 
  AlertTriangleIcon, 
  RefreshCwIcon, 
  SearchIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PackageIcon,
  SmartphoneIcon
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";

export default function MissingMockupsPage() {
  const [category, setCategory] = useState("phone");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  const data = useQuery(api.mockups.getMissingMockups, { category });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const toggleModel = (modelKey: string) => {
    setExpandedModels(prev => {
      const next = new Set(prev);
      if (next.has(modelKey)) {
        next.delete(modelKey);
      } else {
        next.add(modelKey);
      }
      return next;
    });
  };

  const filteredResults = data?.results.filter(result => {
    // Filter by brand
    if (selectedBrand !== "all" && result.brand !== selectedBrand) {
      return false;
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        result.brand.toLowerCase().includes(query) ||
        result.model.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  const uniqueBrands = data?.results 
    ? Array.from(new Set(data.results.map(r => r.brand))).sort()
    : [];

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      
      <div className="container mx-auto py-8 px-4">
        <Authenticated>
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold">Missing Mockups</h1>
                  <p className="text-muted-foreground mt-1">
                    Identify which phone models are missing mockup images for specific SKUs
                  </p>
                </div>
                <Button onClick={handleRefresh} variant="outline">
                  <RefreshCwIcon className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            {data === undefined ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Missing
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {data.stats.totalMissingCombinations.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Model + SKU combinations
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Models Affected
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {data.stats.modelsAffected.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Phone models
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Brands Affected
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {data.stats.brandsAffected}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Unique brands
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total SKUs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {data.stats.totalSKUs.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Product variants
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Filters */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Category Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Category</label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="phone">
                          <div className="flex items-center gap-2">
                            <SmartphoneIcon className="h-4 w-4" />
                            Phones
                          </div>
                        </SelectItem>
                        <SelectItem value="tablet">Tablets</SelectItem>
                        <SelectItem value="drone">Drones</SelectItem>
                        <SelectItem value="camera">Cameras</SelectItem>
                        <SelectItem value="lens">Lenses</SelectItem>
                        <SelectItem value="console">Consoles</SelectItem>
                        <SelectItem value="charger">Chargers</SelectItem>
                        <SelectItem value="mac-mini">Mac Mini</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Brand Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Brand</label>
                    <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Brands</SelectItem>
                        {uniqueBrands.map(brand => (
                          <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Search */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Search Model</label>
                    <div className="relative">
                      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by model name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PackageIcon className="h-5 w-5" />
                  Missing Mockups by Model
                  {filteredResults && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({filteredResults.length} models)
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data === undefined ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : filteredResults && filteredResults.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertTriangleIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No missing mockups found</h3>
                    <p className="text-muted-foreground">
                      All phone models have complete mockup coverage for all SKUs!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredResults?.map(result => {
                      const modelKey = `${result.brand}|${result.model}`;
                      const isExpanded = expandedModels.has(modelKey);
                      
                      return (
                        <div key={modelKey} className="border rounded-lg overflow-hidden">
                          {/* Model Row */}
                          <button
                            onClick={() => toggleModel(modelKey)}
                            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3">
                              {isExpanded ? (
                                <ChevronDownIcon className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <ChevronRightIcon className="h-5 w-5 text-muted-foreground" />
                              )}
                              <div>
                                <div className="font-medium">
                                  {result.brand} {result.model}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {result.totalMissing} missing SKU{result.totalMissing !== 1 ? 's' : ''}
                                </div>
                              </div>
                            </div>
                            <div className="bg-destructive/10 text-destructive px-3 py-1 rounded-full text-sm font-medium">
                              {result.totalMissing}
                            </div>
                          </button>

                          {/* Expanded SKU List */}
                          {isExpanded && (
                            <div className="border-t bg-muted/30 p-4">
                              <h4 className="text-sm font-medium mb-3">Missing SKUs:</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                {result.missingSKUs.map(sku => (
                                  <div
                                    key={sku}
                                    className="bg-background border rounded px-3 py-2 text-sm font-mono"
                                  >
                                    {sku}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </Authenticated>

        <Unauthenticated>
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <h2 className="text-2xl font-bold mb-4">Sign in required</h2>
            <p className="text-muted-foreground mb-6">
              Please sign in to access the missing mockups page
            </p>
            <SignInButton />
          </div>
        </Unauthenticated>

        <AuthLoading>
          <div className="flex items-center justify-center min-h-[60vh]">
            <Skeleton className="h-64 w-full max-w-md" />
          </div>
        </AuthLoading>
      </div>
    </div>
  );
}
