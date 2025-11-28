import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { AdminHeader } from "@/components/admin-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Combobox } from "@/components/ui/combobox.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { toast } from "sonner";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  SmartphoneIcon,
  TabletIcon,
  LaptopIcon,
  GamepadIcon,
  BatteryChargingIcon,
  PlaneIcon,
  CameraIcon,
  PackageIcon,
  TagIcon,
  MergeIcon,
  CheckIcon,
  XIcon,
  InboxIcon,
} from "lucide-react";

const CATEGORIES = [
  { value: "phone", label: "Phone", icon: SmartphoneIcon },
  { value: "tablet", label: "Tablet", icon: TabletIcon },
  { value: "laptop", label: "Laptop", icon: LaptopIcon },
  { value: "console", label: "Console", icon: GamepadIcon },
  { value: "charger", label: "Charger", icon: BatteryChargingIcon },
  { value: "drone", label: "Drone", icon: PlaneIcon },
  { value: "camera", label: "Camera", icon: CameraIcon },
  { value: "lens", label: "Lens", icon: CameraIcon },
  { value: "mac-mini", label: "Mac Mini", icon: PackageIcon },
] as const;

type Category = typeof CATEGORIES[number]["value"];

interface ModelFormData {
  brandName: string;
  modelName: string;
  category: Category;
  isActive: boolean;
}

export default function AdminModelsPage() {
  const models = useQuery(api.supportedModels.listAll, {});
  const stats = useQuery(api.supportedModels.getStats, {});
  const brands = useQuery(api.supportedModels.getBrands, {});
  const brandsWithCounts = useQuery(api.supportedModels.getBrandsWithCounts, {});
  const createModel = useMutation(api.supportedModels.create);
  const updateModel = useMutation(api.supportedModels.update);
  const deleteModel = useMutation(api.supportedModels.remove);
  const renameBrand = useMutation(api.supportedModels.renameBrand);
  const mergeBrands = useMutation(api.supportedModels.mergeBrands);
  const deleteBrand = useMutation(api.supportedModels.deleteBrand);
  
  // Model requests
  const allModelRequests = useQuery(api.modelRequests.getAllModelRequests, {});
  const approveRequests = useMutation(api.modelRequests.approveModelRequests);
  const rejectRequest = useMutation(api.modelRequests.rejectModelRequest);

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<{ id: Id<"supportedModels">; data: ModelFormData } | null>(null);
  const [formData, setFormData] = useState<ModelFormData>({
    brandName: "",
    modelName: "",
    category: "phone",
    isActive: true,
  });

  // Brand management state
  const [brandSearchQuery, setBrandSearchQuery] = useState("");
  const [renameDialog, setRenameDialog] = useState<{ open: boolean; brand: string | null }>({ open: false, brand: null });
  const [newBrandName, setNewBrandName] = useState("");
  const [mergeDialog, setMergeDialog] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [targetBrandName, setTargetBrandName] = useState("");
  
  // Model requests state
  const [requestStatusFilter, setRequestStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [selectedRequests, setSelectedRequests] = useState<Id<"modelRequests">[]>([]);

  // Filter models
  const filteredModels = models
    ?.filter((m: { category: Category; brandName: string; modelName: string; }) => {
      if (categoryFilter !== "all" && m.category !== categoryFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          m.brandName.toLowerCase().includes(query) ||
          m.modelName.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a: { _creationTime: number; }, b: { _creationTime: number; }) => b._creationTime - a._creationTime);

  const handleCreate = async () => {
    if (!formData.brandName.trim() || !formData.modelName.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await createModel(formData);
      toast.success("Model created successfully");
      setIsCreateDialogOpen(false);
      setFormData({ brandName: "", modelName: "", category: "phone", isActive: true });
    } catch (error) {
      toast.error("Failed to create model");
      console.error(error);
    }
  };

  const handleUpdate = async () => {
    if (!editingModel) return;
    if (!formData.brandName.trim() || !formData.modelName.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await updateModel({
        id: editingModel.id,
        ...formData,
      });
      toast.success("Model updated successfully");
      setEditingModel(null);
      setFormData({ brandName: "", modelName: "", category: "phone", isActive: true });
    } catch (error) {
      toast.error("Failed to update model");
      console.error(error);
    }
  };

  const handleDelete = async (id: Id<"supportedModels">) => {
    if (!confirm("Are you sure you want to delete this model?")) return;

    try {
      await deleteModel({ id });
      toast.success("Model deleted successfully");
    } catch (error) {
      toast.error("Failed to delete model");
      console.error(error);
    }
  };

  const openEditDialog = (model: {
    _id: Id<"supportedModels">;
    brandName: string;
    modelName: string;
    category: Category;
    isActive: boolean;
  }) => {
    if (!model) return;
    setFormData({
      brandName: model.brandName,
      modelName: model.modelName,
      category: model.category,
      isActive: model.isActive,
    });
    setEditingModel({ id: model._id, data: formData });
  };

  const getCategoryIcon = (category: Category) => {
    const cat = CATEGORIES.find((c) => c.value === category);
    const Icon = cat?.icon || PackageIcon;
    return <Icon className="size-4" />;
  };

  // Brand management handlers
  const handleRenameBrand = async () => {
    if (!renameDialog.brand || !newBrandName.trim()) {
      toast.error("Please enter a valid brand name");
      return;
    }

    try {
      const count = await renameBrand({
        oldName: renameDialog.brand,
        newName: newBrandName.trim(),
      });
      toast.success(`Updated ${count} model(s) to "${newBrandName}"`);
      setRenameDialog({ open: false, brand: null });
      setNewBrandName("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rename brand");
      console.error(error);
    }
  };

  const handleMergeBrands = async () => {
    if (selectedBrands.length < 2) {
      toast.error("Please select at least 2 brands to merge");
      return;
    }
    if (!targetBrandName.trim()) {
      toast.error("Please enter a target brand name");
      return;
    }

    try {
      const count = await mergeBrands({
        sourceNames: selectedBrands,
        targetName: targetBrandName.trim(),
      });
      toast.success(`Merged ${selectedBrands.length} brands into "${targetBrandName}" (${count} models updated)`);
      setMergeDialog(false);
      setSelectedBrands([]);
      setTargetBrandName("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to merge brands");
      console.error(error);
    }
  };

  const handleDeleteBrand = async (brandName: string, count: number) => {
    if (count > 0) {
      toast.error(`Cannot delete "${brandName}" because ${count} model(s) are using it`);
      return;
    }

    if (!confirm(`Are you sure you want to delete the brand "${brandName}"?`)) {
      return;
    }

    try {
      await deleteBrand({ name: brandName });
      toast.success(`Deleted brand "${brandName}"`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete brand");
      console.error(error);
    }
  };

  // Filter brands
  const filteredBrands = brandsWithCounts?.filter((b) => {
    if (brandSearchQuery) {
      return b.brand.toLowerCase().includes(brandSearchQuery.toLowerCase());
    }
    return true;
  });
  
  // Filter model requests
  const filteredRequests = allModelRequests?.filter((req) => {
    if (requestStatusFilter !== "all" && req.status !== requestStatusFilter) {
      return false;
    }
    return true;
  });
  
  // Handle bulk approve requests
  const handleBulkApprove = async () => {
    if (selectedRequests.length === 0) {
      toast.error("Please select at least one request");
      return;
    }
    
    try {
      const result = await approveRequests({ requestIds: selectedRequests });
      toast.success(`Approved ${result.successCount} request(s) and added to database`);
      setSelectedRequests([]);
    } catch (error) {
      toast.error("Failed to approve requests");
      console.error(error);
    }
  };
  
  // Handle reject single request
  const handleRejectRequest = async (requestId: Id<"modelRequests">) => {
    if (!confirm("Are you sure you want to reject this request?")) return;
    
    try {
      await rejectRequest({ requestId });
      toast.success("Request rejected");
    } catch (error) {
      toast.error("Failed to reject request");
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="models" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="models">
              <SmartphoneIcon className="size-4 mr-2" />
              Models
            </TabsTrigger>
            <TabsTrigger value="brands">
              <TagIcon className="size-4 mr-2" />
              Brands
            </TabsTrigger>
            <TabsTrigger value="requests">
              <InboxIcon className="size-4 mr-2" />
              Requested Models
              {allModelRequests?.filter(r => r.status === "pending").length ? (
                <Badge variant="secondary" className="ml-2">
                  {allModelRequests.filter(r => r.status === "pending").length}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          {/* MODELS TAB */}
          <TabsContent value="models" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Models
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Models
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats?.active || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{Object.keys(stats?.categoryBreakdown || {}).length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex-1 w-full md:max-w-md">
                <Input
                  placeholder="Search by brand or model..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <Select
                  value={categoryFilter}
                  onValueChange={(value) => setCategoryFilter(value as Category | "all")}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <PlusIcon className="size-4 mr-2" />
                  Add Model
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Models Table */}
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredModels?.map((model) => (
                  <TableRow key={model._id}>
                    <TableCell className="font-medium">{model.brandName}</TableCell>
                    <TableCell>{model.modelName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(model.category)}
                        <span className="capitalize">{model.category}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {model.isActive ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-500/10 text-gray-600 border-gray-500/20">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(model)}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(model._id)}
                        >
                          <TrashIcon className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredModels?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No models found. Add your first model to get started.
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          {/* BRANDS TAB */}
          <TabsContent value="brands" className="space-y-6">
            {/* Brand Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Brands
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{brandsWithCounts?.length || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Models
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats?.total || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Avg Models/Brand
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {brandsWithCounts?.length ? Math.round((stats?.total || 0) / brandsWithCounts.length) : 0}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Brand Controls */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <div className="flex-1 w-full md:max-w-md">
                    <Input
                      placeholder="Search brands..."
                      value={brandSearchQuery}
                      onChange={(e) => setBrandSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button onClick={() => setMergeDialog(true)} disabled={selectedBrands.length < 2}>
                    <MergeIcon className="size-4 mr-2" />
                    Merge Brands ({selectedBrands.length})
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Brands Table */}
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Input
                          type="checkbox"
                          className="size-4"
                          checked={selectedBrands.length === brandsWithCounts?.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBrands(brandsWithCounts?.map((b) => b.brand) || []);
                            } else {
                              setSelectedBrands([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Brand Name</TableHead>
                      <TableHead>Model Count</TableHead>
                      <TableHead>Categories</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBrands?.map((brand) => (
                      <TableRow key={brand.brand}>
                        <TableCell>
                          <Input
                            type="checkbox"
                            className="size-4"
                            checked={selectedBrands.includes(brand.brand)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedBrands([...selectedBrands, brand.brand]);
                              } else {
                                setSelectedBrands(selectedBrands.filter((b) => b !== brand.brand));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{brand.brand}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{brand.count}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {brand.categories.map((cat) => (
                              <Badge key={cat} variant="secondary" className="text-xs">
                                {cat}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setRenameDialog({ open: true, brand: brand.brand });
                                setNewBrandName(brand.brand);
                              }}
                            >
                              <PencilIcon className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteBrand(brand.brand, brand.count)}
                              disabled={brand.count > 0}
                            >
                              <TrashIcon className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {filteredBrands?.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    No brands found.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* REQUESTED MODELS TAB */}
          <TabsContent value="requests" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Pending Requests
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-yellow-600">
                    {allModelRequests?.filter(r => r.status === "pending").length || 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Approved
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {allModelRequests?.filter(r => r.status === "approved").length || 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Rejected
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">
                    {allModelRequests?.filter(r => r.status === "rejected").length || 0}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Controls */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant={requestStatusFilter === "all" ? "default" : "outline"}
                      onClick={() => setRequestStatusFilter("all")}
                      size="sm"
                    >
                      All
                    </Button>
                    <Button
                      variant={requestStatusFilter === "pending" ? "default" : "outline"}
                      onClick={() => setRequestStatusFilter("pending")}
                      size="sm"
                    >
                      Pending
                    </Button>
                    <Button
                      variant={requestStatusFilter === "approved" ? "default" : "outline"}
                      onClick={() => setRequestStatusFilter("approved")}
                      size="sm"
                    >
                      Approved
                    </Button>
                    <Button
                      variant={requestStatusFilter === "rejected" ? "default" : "outline"}
                      onClick={() => setRequestStatusFilter("rejected")}
                      size="sm"
                    >
                      Rejected
                    </Button>
                  </div>
                  <Button 
                    onClick={handleBulkApprove} 
                    disabled={selectedRequests.length === 0}
                  >
                    <CheckIcon className="size-4 mr-2" />
                    Approve Selected ({selectedRequests.length})
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Requests Table */}
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Input
                          type="checkbox"
                          className="size-4"
                          checked={selectedRequests.length === filteredRequests?.filter(r => r.status === "pending").length}
                          onChange={(e) => {
                            const pendingRequests = filteredRequests?.filter(r => r.status === "pending") || [];
                            if (e.target.checked) {
                              setSelectedRequests(pendingRequests.map((r) => r._id));
                            } else {
                              setSelectedRequests([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Requested Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests?.map((request) => (
                      <TableRow key={request._id}>
                        <TableCell>
                          <Input
                            type="checkbox"
                            className="size-4"
                            checked={selectedRequests.includes(request._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRequests([...selectedRequests, request._id]);
                              } else {
                                setSelectedRequests(selectedRequests.filter((id) => id !== request._id));
                              }
                            }}
                            disabled={request.status !== "pending"}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{request.brandName}</TableCell>
                        <TableCell>{request.modelName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(request.category as Category)}
                            <span className="capitalize">{request.category}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <a 
                            href={`https://wa.me/${request.whatsappPhone.replace(/[^\d]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {request.whatsappPhone}
                          </a>
                        </TableCell>
                        <TableCell>
                          {new Date(request.requestedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {request.status === "pending" && (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                              Pending
                            </Badge>
                          )}
                          {request.status === "approved" && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                              Approved
                            </Badge>
                          )}
                          {request.status === "rejected" && (
                            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                              Rejected
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {request.status === "pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleBulkApprove()}
                                  title="Approve"
                                >
                                  <CheckIcon className="size-4 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRejectRequest(request._id)}
                                  title="Reject"
                                >
                                  <XIcon className="size-4 text-red-600" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {filteredRequests?.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    No model requests found.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreateDialogOpen || editingModel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingModel(null);
            setFormData({ brandName: "", modelName: "", category: "phone", isActive: true });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingModel ? "Edit Model" : "Add New Model"}</DialogTitle>
            <DialogDescription>
              {editingModel
                ? "Update the model details below."
                : "Add a new supported device model."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="brandName">Brand Name *</Label>
              <Combobox
                options={brands || []}
                value={formData.brandName}
                onValueChange={(value) =>
                  setFormData({ ...formData, brandName: value })
                }
                placeholder="Select or add brand..."
                searchPlaceholder="Search brands..."
                emptyText="No brands found."
                allowCustom={true}
                customText="+ Add new brand:"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modelName">Model Name *</Label>
              <Input
                id="modelName"
                placeholder="e.g., iPhone 15 Pro Max, Galaxy S24 Ultra"
                value={formData.modelName}
                onChange={(e) =>
                  setFormData({ ...formData, modelName: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value as Category })
                }
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Active</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setEditingModel(null);
                setFormData({ brandName: "", modelName: "", category: "phone", isActive: true });
              }}
            >
              Cancel
            </Button>
            <Button onClick={editingModel ? handleUpdate : handleCreate}>
              {editingModel ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Brand Dialog */}
      <Dialog open={renameDialog.open} onOpenChange={(open) => {
        if (!open) {
          setRenameDialog({ open: false, brand: null });
          setNewBrandName("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Brand</DialogTitle>
            <DialogDescription>
              Rename "{renameDialog.brand}" across all models
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newBrandName">New Brand Name</Label>
              <Input
                id="newBrandName"
                placeholder="Enter new brand name"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRenameDialog({ open: false, brand: null });
                setNewBrandName("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleRenameBrand}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Brands Dialog */}
      <Dialog open={mergeDialog} onOpenChange={(open) => {
        if (!open) {
          setMergeDialog(false);
          setTargetBrandName("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Brands</DialogTitle>
            <DialogDescription>
              Merge {selectedBrands.length} selected brands into one
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Selected Brands ({selectedBrands.length})</Label>
              <div className="flex flex-wrap gap-2">
                {selectedBrands.map((brand) => (
                  <Badge key={brand} variant="secondary">
                    {brand}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetBrandName">Target Brand Name</Label>
              <Input
                id="targetBrandName"
                placeholder="Enter the final brand name"
                value={targetBrandName}
                onChange={(e) => setTargetBrandName(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                All selected brands will be renamed to this name
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMergeDialog(false);
                setTargetBrandName("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleMergeBrands}>Merge Brands</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
