import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Sparkles, CheckCircle2, AlertCircle, Tag, Layers, Package } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";

export default function ProductClassificationPage() {
  type GadgetCategory = "phone" | "laptop" | "camera" | "accessory" | "tablet" | "lens" | "drone" | "charger" | "console" | "mac-mini" | "cover";
  
  const [selectedGadget, setSelectedGadget] = useState<string>("all");
  const [selectedFinish, setSelectedFinish] = useState<string>("all");
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);

  // Queries
  const stats = useQuery(api.productClassification.getClassificationStats, {});
  const finishTypes = useQuery(api.finishTypes.listActive, {});
  const preview = useQuery(api.productClassification.previewAutoClassification, {});
  const unclassified = useQuery(api.productClassification.getUnclassifiedProducts, {});
  const filtered = useQuery(
    api.productClassification.getProductsByClassification,
    selectedGadget === "all" && selectedFinish === "all"
      ? "skip"
      : {
          gadgetCategory: selectedGadget === "all" ? undefined : (selectedGadget as GadgetCategory),
          finishTypeId: selectedFinish === "all" ? undefined : (selectedFinish as Id<"finishTypes">),
        }
  );

  // Mutations
  const applyAutoClassification = useMutation(api.productClassification.applyAutoClassification);
  const bulkUpdate = useMutation(api.productClassification.bulkUpdateClassification);
  const seedInitialFinishTypes = useMutation(api.finishTypes.seedInitialFinishTypes);

  const gadgetCategories = [
    "Phone",
    "Laptop",
    "Tablet",
    "iPad",
    "Smartwatch",
    "Earbuds",
    "Camera",
    "Gaming Console",
    "Speaker",
    "Other",
  ];

  const handleSeedFinishTypes = async () => {
    try {
      await seedInitialFinishTypes({});
      toast.success("Finish types seeded successfully");
    } catch (error) {
      toast.error("Failed to seed finish types");
      console.error(error);
    }
  };

  const handleApplyAutoClassification = async () => {
    try {
      const result = await applyAutoClassification({});
      toast.success(`Auto-classified ${result.classified} products`);
      setIsApplyDialogOpen(false);
    } catch (error) {
      toast.error("Failed to apply auto-classification");
      console.error(error);
    }
  };

  const handleBulkUpdateGadget = async (productIds: Id<"products">[], gadgetCategory: GadgetCategory) => {
    try {
      await bulkUpdate({ productIds, gadgetCategory, finishTypeId: undefined });
      toast.success(`Updated ${productIds.length} products`);
    } catch (error) {
      toast.error("Failed to update products");
      console.error(error);
    }
  };

  const handleBulkUpdateFinish = async (productIds: Id<"products">[], finishTypeId: Id<"finishTypes">) => {
    try {
      await bulkUpdate({ productIds, gadgetCategory: undefined, finishTypeId });
      toast.success(`Updated ${productIds.length} products`);
    } catch (error) {
      toast.error("Failed to update products");
      console.error(error);
    }
  };

  return (
    <AdminLayout>
      <div className="container mx-auto space-y-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Product Classification</h1>
            <p className="text-muted-foreground">
              Auto-classify products by gadget type and finish
            </p>
          </div>
          <Button onClick={handleSeedFinishTypes} variant="outline" size="sm">
            <Layers className="mr-2 h-4 w-4" />
            Seed Finish Types
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stats === undefined ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.classified} classified
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unclassified</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              {stats === undefined ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-yellow-600">
                    {stats.unclassified}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Need classification
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gadget Types</CardTitle>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stats === undefined ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {stats.byGadget ? Object.keys(stats.byGadget).length : 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Categories in use
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Finish Types</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stats === undefined ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {stats.byFinish ? Object.keys(stats.byFinish).length : 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Finishes available
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Auto-Classification Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Auto-Classification
            </CardTitle>
            <CardDescription>
              Automatically classify products based on their titles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button
                onClick={() => setIsPreviewDialogOpen(true)}
                variant="outline"
                disabled={preview === undefined}
              >
                Preview Changes
              </Button>
              <Button
                onClick={() => setIsApplyDialogOpen(true)}
                disabled={preview === undefined || preview.results.length === 0}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Apply Auto-Classification
              </Button>
            </div>
            {preview !== undefined && preview.results.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Ready to classify {preview.results.length} products
              </p>
            )}
          </CardContent>
        </Card>

        {/* Tabs for different views */}
        <Tabs defaultValue="browse" className="space-y-4">
          <TabsList>
            <TabsTrigger value="browse">Browse by Filter</TabsTrigger>
            <TabsTrigger value="unclassified">
              Unclassified ({unclassified?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Filter Products</CardTitle>
                <CardDescription>
                  Browse products by gadget type and finish
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="mb-2 block text-sm font-medium">
                      Gadget Type
                    </label>
                    <Select value={selectedGadget} onValueChange={setSelectedGadget}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Gadgets</SelectItem>
                        {gadgetCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <label className="mb-2 block text-sm font-medium">
                      Finish Type
                    </label>
                    <Select value={selectedFinish} onValueChange={setSelectedFinish}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Finishes</SelectItem>
                        {finishTypes?.map((finish) => (
                          <SelectItem key={finish._id} value={finish._id}>
                            {finish.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(selectedGadget !== "all" || selectedFinish !== "all") && (
                  <div className="rounded-lg border">
                    {filtered === undefined ? (
                      <div className="p-8">
                        <Skeleton className="h-20 w-full" />
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        No products found with selected filters
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Gadget</TableHead>
                            <TableHead>Finish</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.map((product) => (
                            <TableRow key={product._id}>
                              <TableCell className="font-medium">
                                {product.title}
                              </TableCell>
                              <TableCell>
                                {product.gadgetCategory ? (
                                  <Badge variant="secondary">
                                    {product.gadgetCategory}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {product.finishTypeId ? (
                                  <Badge variant="outline">
                                    Finish assigned
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="unclassified" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Unclassified Products</CardTitle>
                <CardDescription>
                  Products missing gadget type or finish classification
                </CardDescription>
              </CardHeader>
              <CardContent>
                {unclassified === undefined ? (
                  <Skeleton className="h-40 w-full" />
                ) : unclassified.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <CheckCircle2 className="mb-4 h-12 w-12 text-green-500" />
                    <h3 className="mb-2 text-lg font-semibold">All Classified!</h3>
                    <p className="text-sm text-muted-foreground">
                      All products have been classified
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product Name</TableHead>
                        <TableHead>Missing</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unclassified.map((product) => (
                        <TableRow key={product._id}>
                          <TableCell className="font-medium">
                            {product.title}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {!product.gadgetCategory && (
                                <Badge variant="destructive">No Gadget</Badge>
                              )}
                              {!product.finishTypeId && (
                                <Badge variant="destructive">No Finish</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() =>
                                window.open(
                                  `/backend-skinly/products/${product._id}`,
                                  "_blank"
                                )
                              }
                            >
                              Edit Product
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>By Gadget Type</CardTitle>
                </CardHeader>
                <CardContent>
                  {stats === undefined ? (
                    <Skeleton className="h-40 w-full" />
                  ) : stats.byGadget ? (
                    <div className="space-y-2">
                      {Object.entries(stats.byGadget).map(([gadget, count]) => (
                        <div
                          key={gadget}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <span className="font-medium">{gadget}</span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No data available</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>By Finish Type</CardTitle>
                </CardHeader>
                <CardContent>
                  {stats === undefined ? (
                    <Skeleton className="h-40 w-full" />
                  ) : stats.byFinish ? (
                    <div className="space-y-2">
                      {Object.entries(stats.byFinish).map(([finish, count]) => (
                        <div
                          key={finish}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <span className="font-medium">{finish}</span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No data available</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Preview Dialog */}
        <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
          <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Preview Auto-Classification</DialogTitle>
              <DialogDescription>
                Review the changes before applying auto-classification
              </DialogDescription>
            </DialogHeader>
            {preview && preview.results.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Gadget</TableHead>
                    <TableHead>Finish</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.results.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell>
                        {item.detectedGadget ? (
                          <Badge variant="secondary">{item.detectedGadget}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.detectedFinishDisplayName ? (
                          <Badge variant="outline">{item.detectedFinishDisplayName}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="py-8 text-center text-muted-foreground">
                No products to auto-classify
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Apply Confirmation Dialog */}
        <Dialog open={isApplyDialogOpen} onOpenChange={setIsApplyDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply Auto-Classification?</DialogTitle>
              <DialogDescription>
                This will automatically classify {preview?.results.length ?? 0} products based
                on their titles. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsApplyDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleApplyAutoClassification}>
                Apply Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
