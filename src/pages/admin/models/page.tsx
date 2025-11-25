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
  const createModel = useMutation(api.supportedModels.create);
  const updateModel = useMutation(api.supportedModels.update);
  const deleteModel = useMutation(api.supportedModels.remove);

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

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
    </div>
  );
}
