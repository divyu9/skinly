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
import { Sparkles, CheckCircle2, AlertCircle, Tag, Layers, Package, Plus, Edit, Trash2, RefreshCw, Save, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";

export default function ProductClassificationPage() {
  type GadgetCategory = "phone" | "laptop" | "camera" | "accessory" | "tablet" | "lens" | "drone" | "charger" | "console" | "mac-mini" | "cover";
  
  const [selectedGadget, setSelectedGadget] = useState<string>("all");
  const [selectedFinish, setSelectedFinish] = useState<string>("all");
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);
  
  // Finish type management state
  const [isCreateFinishTypeOpen, setIsCreateFinishTypeOpen] = useState(false);
  const [isEditFinishTypeOpen, setIsEditFinishTypeOpen] = useState(false);
  const [isDeleteFinishTypeOpen, setIsDeleteFinishTypeOpen] = useState(false);
  const [selectedFinishType, setSelectedFinishType] = useState<Id<"finishTypes"> | null>(null);
  const [finishTypeForm, setFinishTypeForm] = useState({ name: "", displayName: "" });

  // Gadget type management state
  const [isCreateGadgetTypeOpen, setIsCreateGadgetTypeOpen] = useState(false);
  const [isEditGadgetTypeOpen, setIsEditGadgetTypeOpen] = useState(false);
  const [isDeleteGadgetTypeOpen, setIsDeleteGadgetTypeOpen] = useState(false);
  const [selectedGadgetType, setSelectedGadgetType] = useState<Id<"gadgetTypes"> | null>(null);
  const [gadgetTypeForm, setGadgetTypeForm] = useState({ name: "", displayName: "" });
  
  // Inline editing state for unclassified products
  const [editingProducts, setEditingProducts] = useState<Record<string, {
    gadgetCategory?: GadgetCategory;
    finishTypeId?: Id<"finishTypes"> | null;
  }>>({});
  const [savingProductId, setSavingProductId] = useState<Id<"products"> | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Queries
  const stats = useQuery(api.productClassification.getClassificationStats, {});
  const finishTypes = useQuery(api.finishTypes.listAllActive, {}); // Use listAllActive for dropdowns
  const allFinishTypes = useQuery(api.finishTypes.list, {}); // For management tab
  const gadgetTypes = useQuery(api.gadgetTypes.listAllActive, {}); // Use listAllActive for dropdowns
  const allGadgetTypes = useQuery(api.gadgetTypes.list, {}); // For management tab
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
  const updateSingleProduct = useMutation(api.productClassification.updateSingleProductClassification);
  const seedInitialFinishTypes = useMutation(api.finishTypes.seedInitialFinishTypes);
  const createFinishType = useMutation(api.finishTypes.create);
  const updateFinishType = useMutation(api.finishTypes.update);
  const deleteFinishType = useMutation(api.finishTypes.remove);
  const recalculateCounts = useMutation(api.finishTypes.recalculateAllCounts);
  
  // Gadget type mutations
  const seedGadgetTypes = useMutation(api.gadgetTypes.seed);
  const createGadgetType = useMutation(api.gadgetTypes.create);
  const updateGadgetType = useMutation(api.gadgetTypes.update);
  const deleteGadgetType = useMutation(api.gadgetTypes.remove);
  const recalculateGadgetCounts = useMutation(api.gadgetTypes.recalculateProductCounts);
  const migrateGadgetTypes = useMutation(api.gadgetTypes.migrateProductGadgetTypes);

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

  // Finish type management handlers
  const handleCreateFinishType = async () => {
    try {
      if (!finishTypeForm.displayName) {
        toast.error("Display name is required");
        return;
      }
      
      // Auto-generate name from display name if not provided
      const name = finishTypeForm.name || finishTypeForm.displayName.toLowerCase().replace(/\s+/g, "-");
      
      await createFinishType({ name, displayName: finishTypeForm.displayName });
      toast.success("Finish type created successfully");
      setIsCreateFinishTypeOpen(false);
      setFinishTypeForm({ name: "", displayName: "" });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create finish type";
      toast.error(errorMessage);
      console.error(error);
    }
  };

  const handleEditFinishType = async () => {
    if (!selectedFinishType) return;
    
    try {
      await updateFinishType({
        id: selectedFinishType,
        displayName: finishTypeForm.displayName || undefined,
      });
      toast.success("Finish type updated successfully");
      setIsEditFinishTypeOpen(false);
      setFinishTypeForm({ name: "", displayName: "" });
      setSelectedFinishType(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update finish type";
      toast.error(errorMessage);
      console.error(error);
    }
  };

  const handleDeleteFinishType = async () => {
    if (!selectedFinishType) return;
    
    try {
      await deleteFinishType({ id: selectedFinishType });
      toast.success("Finish type deleted successfully");
      setIsDeleteFinishTypeOpen(false);
      setSelectedFinishType(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete finish type";
      toast.error(errorMessage);
      console.error(error);
    }
  };

  const handleSyncProductCounts = async () => {
    try {
      await recalculateCounts({});
      toast.success("Product counts synced successfully");
    } catch (error) {
      toast.error("Failed to sync product counts");
      console.error(error);
    }
  };

  const openEditDialog = (finishType: { _id: Id<"finishTypes">; name: string; displayName: string }) => {
    setSelectedFinishType(finishType._id);
    setFinishTypeForm({ name: finishType.name, displayName: finishType.displayName });
    setIsEditFinishTypeOpen(true);
  };

  const openDeleteDialog = (finishTypeId: Id<"finishTypes">) => {
    setSelectedFinishType(finishTypeId);
    setIsDeleteFinishTypeOpen(true);
  };

  // Gadget type management handlers
  const handleSeedGadgetTypes = async () => {
    try {
      await seedGadgetTypes({});
      toast.success("Gadget types seeded successfully");
    } catch (error) {
      toast.error("Failed to seed gadget types");
      console.error(error);
    }
  };

  const handleCreateGadgetType = async () => {
    try {
      if (!gadgetTypeForm.displayName) {
        toast.error("Display name is required");
        return;
      }
      
      // Auto-generate name from display name if not provided
      const name = gadgetTypeForm.name || gadgetTypeForm.displayName.toLowerCase().replace(/\s+/g, "-");
      
      await createGadgetType({ name, displayName: gadgetTypeForm.displayName, isActive: true });
      toast.success("Gadget type created successfully");
      setIsCreateGadgetTypeOpen(false);
      setGadgetTypeForm({ name: "", displayName: "" });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create gadget type";
      toast.error(errorMessage);
      console.error(error);
    }
  };

  const handleEditGadgetType = async () => {
    if (!selectedGadgetType) return;
    
    try {
      await updateGadgetType({
        id: selectedGadgetType,
        displayName: gadgetTypeForm.displayName || undefined,
      });
      toast.success("Gadget type updated successfully");
      setIsEditGadgetTypeOpen(false);
      setGadgetTypeForm({ name: "", displayName: "" });
      setSelectedGadgetType(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update gadget type";
      toast.error(errorMessage);
      console.error(error);
    }
  };

  const handleDeleteGadgetType = async () => {
    if (!selectedGadgetType) return;
    
    try {
      await deleteGadgetType({ id: selectedGadgetType });
      toast.success("Gadget type deleted successfully");
      setIsDeleteGadgetTypeOpen(false);
      setSelectedGadgetType(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete gadget type";
      toast.error(errorMessage);
      console.error(error);
    }
  };

  const handleSyncGadgetCounts = async () => {
    try {
      await recalculateGadgetCounts({});
      toast.success("Gadget type product counts synced successfully");
    } catch (error) {
      toast.error("Failed to sync gadget type product counts");
      console.error(error);
    }
  };

  const handleMigrateGadgetTypes = async () => {
    try {
      const result = await migrateGadgetTypes({});
      toast.success(result.message);
      // Refresh counts after migration
      await recalculateGadgetCounts({});
    } catch (error) {
      toast.error("Failed to migrate gadget types");
      console.error(error);
    }
  };

  const openEditGadgetDialog = (gadgetType: { _id: Id<"gadgetTypes">; name: string; displayName: string }) => {
    setSelectedGadgetType(gadgetType._id);
    setGadgetTypeForm({ name: gadgetType.name, displayName: gadgetType.displayName });
    setIsEditGadgetTypeOpen(true);
  };

  const openDeleteGadgetDialog = (gadgetTypeId: Id<"gadgetTypes">) => {
    setSelectedGadgetType(gadgetTypeId);
    setIsDeleteGadgetTypeOpen(true);
  };

  // Inline editing handlers
  const handleInlineGadgetChange = (productId: Id<"products">, gadgetCategory: GadgetCategory | "none") => {
    setEditingProducts(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        gadgetCategory: gadgetCategory === "none" ? undefined : gadgetCategory,
      },
    }));
  };

  const handleInlineFinishChange = (productId: Id<"products">, finishTypeId: string) => {
    setEditingProducts(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        finishTypeId: finishTypeId === "none" ? null : (finishTypeId as Id<"finishTypes">),
      },
    }));
  };

  const handleSaveInlineEdit = async (productId: Id<"products">) => {
    const edits = editingProducts[productId];
    if (!edits || (edits.gadgetCategory === undefined && edits.finishTypeId === undefined)) {
      toast.error("Please select at least one field to update");
      return;
    }

    setSavingProductId(productId);
    try {
      await updateSingleProduct({
        productId,
        gadgetCategory: edits.gadgetCategory,
        finishTypeId: edits.finishTypeId,
      });
      toast.success("Product classification updated");
      
      // Clear editing state for this product
      setEditingProducts(prev => {
        const newState = { ...prev };
        delete newState[productId];
        return newState;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update product";
      toast.error(errorMessage);
      console.error(error);
    } finally {
      setSavingProductId(null);
    }
  };

  const handleRefreshUnclassified = async () => {
    setIsRefreshing(true);
    try {
      // Force refetch by toggling between tabs or using a timeout
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success("Unclassified products refreshed");
    } catch (error) {
      toast.error("Failed to refresh");
    } finally {
      setIsRefreshing(false);
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
                    {stats.totalFinishTypes || 0}
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
            <TabsTrigger value="manage">Manage Finish Types</TabsTrigger>
            <TabsTrigger value="manage-gadgets">Manage Gadget Types</TabsTrigger>
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Unclassified Products</CardTitle>
                    <CardDescription>
                      Products missing gadget type or finish classification
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshUnclassified}
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? (
                      <Spinner className="mr-2 h-4 w-4" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Refresh
                  </Button>
                </div>
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[300px]">Product Name</TableHead>
                          <TableHead className="min-w-[150px]">Current Status</TableHead>
                          <TableHead className="min-w-[180px]">Gadget Type</TableHead>
                          <TableHead className="min-w-[180px]">Finish Type</TableHead>
                          <TableHead className="min-w-[140px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unclassified.map((product) => {
                          const edits = editingProducts[product._id] || {};
                          const isSaving = savingProductId === product._id;
                          
                          return (
                            <TableRow key={product._id}>
                              <TableCell className="font-medium">
                                <div className="break-words">
                                  {product.title}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {!product.gadgetCategory && (
                                    <Badge variant="destructive" className="text-xs">No Gadget</Badge>
                                  )}
                                  {!product.finishTypeId && (
                                    <Badge variant="destructive" className="text-xs">No Finish</Badge>
                                  )}
                                  {product.gadgetCategory && (
                                    <Badge variant="secondary" className="text-xs">{product.gadgetCategory}</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={edits.gadgetCategory ?? product.gadgetCategory ?? "none"}
                                  onValueChange={(value) => handleInlineGadgetChange(product._id, value as GadgetCategory | "none")}
                                  disabled={isSaving}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select gadget" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">-- Select --</SelectItem>
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
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={
                                    edits.finishTypeId === null 
                                      ? "none" 
                                      : edits.finishTypeId ?? product.finishTypeId ?? "none"
                                  }
                                  onValueChange={(value) => handleInlineFinishChange(product._id, value)}
                                  disabled={isSaving}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select finish" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">-- Select --</SelectItem>
                                    {finishTypes?.map((finish) => (
                                      <SelectItem key={finish._id} value={finish._id}>
                                        {finish.displayName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleSaveInlineEdit(product._id)}
                                    disabled={isSaving || (!edits.gadgetCategory && edits.finishTypeId === undefined)}
                                  >
                                    {isSaving ? (
                                      <Spinner className="h-3 w-3" />
                                    ) : (
                                      <>
                                        <Save className="mr-1 h-3 w-3" />
                                        Save
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const productUrl = product.slug 
                                        ? `/products/${product.slug}`
                                        : `/products/detail?id=${product._id}`;
                                      window.open(productUrl, "_blank");
                                    }}
                                    disabled={isSaving}
                                    title="View on frontend"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
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

          <TabsContent value="manage" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Finish Types Management</CardTitle>
                    <CardDescription>
                      Create and manage finish types for product classification
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSyncProductCounts}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync Product Counts
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setFinishTypeForm({ name: "", displayName: "" });
                        setIsCreateFinishTypeOpen(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create Finish Type
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {allFinishTypes === undefined ? (
                  <Skeleton className="h-40 w-full" />
                ) : allFinishTypes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Layers className="mb-4 h-12 w-12 text-muted-foreground" />
                    <h3 className="mb-2 text-lg font-semibold">No Finish Types</h3>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Create your first finish type to get started
                    </p>
                    <Button
                      size="sm"
                      onClick={() => {
                        setFinishTypeForm({ name: "", displayName: "" });
                        setIsCreateFinishTypeOpen(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create Finish Type
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Display Name</TableHead>
                        <TableHead>Internal Name</TableHead>
                        <TableHead>Product Count</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allFinishTypes.map((finishType) => (
                        <TableRow key={finishType._id}>
                          <TableCell className="font-medium">
                            {finishType.displayName}
                          </TableCell>
                          <TableCell>
                            <code className="rounded bg-muted px-2 py-1 text-sm">
                              {finishType.name}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{finishType.productCount}</Badge>
                          </TableCell>
                          <TableCell>
                            {finishType.isActive ? (
                              <Badge variant="default">Active</Badge>
                            ) : (
                              <Badge variant="outline">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(finishType)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDeleteDialog(finishType._id)}
                                disabled={finishType.productCount > 0}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manage-gadgets" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Gadget Types Management</CardTitle>
                    <CardDescription>
                      Create and manage gadget types for product classification
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleMigrateGadgetTypes}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Migrate Products
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSyncGadgetCounts}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync Product Counts
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setGadgetTypeForm({ name: "", displayName: "" });
                        setIsCreateGadgetTypeOpen(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create Gadget Type
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {allGadgetTypes === undefined ? (
                  <Skeleton className="h-40 w-full" />
                ) : allGadgetTypes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Package className="mb-4 h-12 w-12 text-muted-foreground" />
                    <h3 className="mb-2 text-lg font-semibold">No Gadget Types</h3>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Seed gadget types to get started
                    </p>
                    <Button size="sm" onClick={handleSeedGadgetTypes}>
                      <Plus className="mr-2 h-4 w-4" />
                      Seed Gadget Types
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Display Name</TableHead>
                        <TableHead>Internal Name</TableHead>
                        <TableHead>Product Count</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allGadgetTypes.map((gadgetType) => (
                        <TableRow key={gadgetType._id}>
                          <TableCell className="font-medium">
                            {gadgetType.displayName}
                          </TableCell>
                          <TableCell>
                            <code className="rounded bg-muted px-2 py-1 text-sm">
                              {gadgetType.name}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{gadgetType.productCount}</Badge>
                          </TableCell>
                          <TableCell>
                            {gadgetType.isActive ? (
                              <Badge variant="default">Active</Badge>
                            ) : (
                              <Badge variant="outline">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditGadgetDialog(gadgetType)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDeleteGadgetDialog(gadgetType._id)}
                                disabled={gadgetType.productCount > 0}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
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

        {/* Create Finish Type Dialog */}
        <Dialog open={isCreateFinishTypeOpen} onOpenChange={setIsCreateFinishTypeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Finish Type</DialogTitle>
              <DialogDescription>
                Add a new finish type for product classification
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  placeholder="e.g., Glossy, Metallic, etc."
                  value={finishTypeForm.displayName}
                  onChange={(e) =>
                    setFinishTypeForm({ ...finishTypeForm, displayName: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  This is the name that will be shown to users
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Internal Name (Optional)</Label>
                <Input
                  id="name"
                  placeholder="Auto-generated from display name"
                  value={finishTypeForm.name}
                  onChange={(e) =>
                    setFinishTypeForm({ ...finishTypeForm, name: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to auto-generate. Use lowercase with hyphens (e.g., glossy, metallic)
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateFinishTypeOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateFinishType}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Finish Type Dialog */}
        <Dialog open={isEditFinishTypeOpen} onOpenChange={setIsEditFinishTypeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Finish Type</DialogTitle>
              <DialogDescription>
                Update the finish type details
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-displayName">Display Name</Label>
                <Input
                  id="edit-displayName"
                  value={finishTypeForm.displayName}
                  onChange={(e) =>
                    setFinishTypeForm({ ...finishTypeForm, displayName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Internal Name</Label>
                <Input
                  id="edit-name"
                  value={finishTypeForm.name}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Internal name cannot be changed
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditFinishTypeOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditFinishType}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Finish Type Dialog */}
        <Dialog open={isDeleteFinishTypeOpen} onOpenChange={setIsDeleteFinishTypeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Finish Type</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this finish type? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteFinishTypeOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteFinishType}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Gadget Type Dialog */}
        <Dialog open={isCreateGadgetTypeOpen} onOpenChange={setIsCreateGadgetTypeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Gadget Type</DialogTitle>
              <DialogDescription>
                Add a new gadget type for product classification
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="gadget-displayName">Display Name</Label>
                <Input
                  id="gadget-displayName"
                  placeholder="e.g., Phone, Laptop, etc."
                  value={gadgetTypeForm.displayName}
                  onChange={(e) =>
                    setGadgetTypeForm({ ...gadgetTypeForm, displayName: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  This is the name that will be shown to users
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gadget-name">Internal Name (Optional)</Label>
                <Input
                  id="gadget-name"
                  placeholder="Auto-generated from display name"
                  value={gadgetTypeForm.name}
                  onChange={(e) =>
                    setGadgetTypeForm({ ...gadgetTypeForm, name: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to auto-generate. Use lowercase with hyphens (e.g., phone, laptop)
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateGadgetTypeOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateGadgetType}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Gadget Type Dialog */}
        <Dialog open={isEditGadgetTypeOpen} onOpenChange={setIsEditGadgetTypeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Gadget Type</DialogTitle>
              <DialogDescription>
                Update the gadget type details
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-gadget-displayName">Display Name</Label>
                <Input
                  id="edit-gadget-displayName"
                  value={gadgetTypeForm.displayName}
                  onChange={(e) =>
                    setGadgetTypeForm({ ...gadgetTypeForm, displayName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-gadget-name">Internal Name</Label>
                <Input
                  id="edit-gadget-name"
                  value={gadgetTypeForm.name}
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Internal name cannot be changed
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditGadgetTypeOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditGadgetType}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Gadget Type Dialog */}
        <Dialog open={isDeleteGadgetTypeOpen} onOpenChange={setIsDeleteGadgetTypeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Gadget Type</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this gadget type? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteGadgetTypeOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteGadgetType}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
