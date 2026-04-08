import { useState } from "react";
import { useQuery, useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
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
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import {
  PlusIcon,
  Pencil,
  Trash2,
  GripVertical,
  Package2,
  Shield,
  Video,
  Zap,
  Glasses,
  ShoppingBag,
  Package,
  Sparkles,
  Star,
  Heart,
  Gem,
  Crown,
  Award,
  Tag,
  Home,
  Eye,
  EyeOff,
  Smartphone,
  Loader2Icon,
} from "lucide-react";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/firebase-hooks";
import { SignInButton } from "@/components/ui/signin.tsx";
import type { Id } from "@/lib/firebase-api";

// Icon options for categories
const ICON_OPTIONS = [
  { value: "Package2", label: "Package", icon: Package2 },
  { value: "Shield", label: "Shield", icon: Shield },
  { value: "Video", label: "Camera", icon: Video },
  { value: "Zap", label: "Lightning", icon: Zap },
  { value: "Glasses", label: "Glasses", icon: Glasses },
  { value: "ShoppingBag", label: "Shopping Bag", icon: ShoppingBag },
  { value: "Package", label: "Box", icon: Package },
  { value: "Sparkles", label: "Sparkles", icon: Sparkles },
  { value: "Star", label: "Star", icon: Star },
  { value: "Heart", label: "Heart", icon: Heart },
  { value: "Gem", label: "Gem", icon: Gem },
  { value: "Crown", label: "Crown", icon: Crown },
  { value: "Award", label: "Award", icon: Award },
  { value: "Tag", label: "Tag", icon: Tag },
  { value: "Smartphone", label: "Phone", icon: Smartphone },
];

// Get icon component by name
function getIconComponent(iconName: string) {
  const iconOption = ICON_OPTIONS.find((opt) => opt.value === iconName);
  return iconOption?.icon || Package;
}

interface CategoryFormData {
  slug: string;
  name: string;
  description: string;
  icon: string;
  image: string;
  homepageImage: string;
  homepageTitle: string;
  homepageSubtitle: string;
  homepageButtonText: string;
  homepageLink: string;
  showOnHomepage: boolean;
  requiresDevice: boolean;
  isActive: boolean;
}

const defaultFormData: CategoryFormData = {
  slug: "",
  name: "",
  description: "",
  icon: "Package",
  image: "",
  homepageImage: "",
  homepageTitle: "",
  homepageSubtitle: "",
  homepageButtonText: "Shop Now",
  homepageLink: "",
  showOnHomepage: true,
  requiresDevice: false,
  isActive: true,
};

function ProductCategoriesPageInner() {
  const categories = useQuery(api.productCategories.listAll);
  const categoryStats = useQuery(api.productCategories.listAllCategories);
  const createCategory = useMutation(api.productCategories.create);
  const updateCategory = useMutation(api.productCategories.update);
  const deleteCategory = useMutation(api.productCategories.remove);
  const reorderCategories = useMutation(api.productCategories.reorder);
  const seedDefaults = useMutation(api.productCategories.seedDefaults);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Id<"productCategoriesConfig"> | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(defaultFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Get product count for a category
  const getProductCount = (slug: string) => {
    if (!categoryStats?.categories) return 0;
    const cat = categoryStats.categories.find((c) => c.id === slug);
    return cat?.count || 0;
  };

  // Handle opening dialog for new category
  const handleAddNew = () => {
    setEditingCategory(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  // Handle opening dialog for editing
  const handleEdit = (categoryId: Id<"productCategoriesConfig">) => {
    const category = categories?.find((c) => c._id === categoryId);
    if (!category) return;

    setEditingCategory(categoryId);
    setFormData({
      slug: category.slug,
      name: category.name,
      description: category.description || "",
      icon: category.icon || "Package",
      image: category.image || "",
      homepageImage: category.homepageImage || "",
      homepageTitle: category.homepageTitle || "",
      homepageSubtitle: category.homepageSubtitle || "",
      homepageButtonText: category.homepageButtonText || "Shop Now",
      homepageLink: category.homepageLink || "",
      showOnHomepage: category.showOnHomepage,
      requiresDevice: category.requiresDevice || false,
      isActive: category.isActive,
    });
    setIsDialogOpen(true);
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!formData.slug || !formData.name) {
      toast.error("Slug and name are required");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCategory) {
        await updateCategory({
          id: editingCategory,
          ...formData,
        });
        toast.success("Category updated successfully");
      } else {
        await createCategory(formData);
        toast.success("Category created successfully");
      }
      setIsDialogOpen(false);
      setFormData(defaultFormData);
      setEditingCategory(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to save category");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (categoryId: Id<"productCategoriesConfig">) => {
    const category = categories?.find((c) => c._id === categoryId);
    if (!category) return;

    const productCount = getProductCount(category.slug);
    if (productCount > 0) {
      toast.error(`Cannot delete. ${productCount} products are using this category.`);
      return;
    }

    if (!confirm(`Are you sure you want to delete "${category.name}"?`)) return;

    try {
      await deleteCategory({ id: categoryId });
      toast.success("Category deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete category");
    }
  };

  // Handle drag reorder
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index || !categories) return;

    // Reorder in UI immediately for responsiveness
    const newCategories = [...categories];
    const [draggedItem] = newCategories.splice(draggedIndex, 1);
    newCategories.splice(index, 0, draggedItem);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null || !categories) return;

    try {
      await reorderCategories({
        categoryIds: categories.map((c) => c._id),
      });
      toast.success("Categories reordered");
    } catch (error) {
      toast.error("Failed to reorder categories");
    }
    setDraggedIndex(null);
  };

  // Handle seed defaults
  const handleSeedDefaults = async () => {
    try {
      const result = await seedDefaults();
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.info(result.message);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to seed defaults");
    }
  };

  if (categories === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Product Categories</h1>
          <p className="text-muted-foreground">
            Manage product categories displayed across the site
          </p>
        </div>
        <div className="flex items-center gap-2">
          {categories.length === 0 && (
            <Button variant="outline" onClick={handleSeedDefaults}>
              <Sparkles className="size-4 mr-2" />
              Seed Defaults
            </Button>
          )}
          <Button onClick={handleAddNew}>
            <PlusIcon className="size-4 mr-2" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      {categoryStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{categoryStats.totalProducts}</div>
              <p className="text-sm text-muted-foreground">Total Products</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{categories.length}</div>
              <p className="text-sm text-muted-foreground">Categories</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {categories.filter((c) => c.isActive).length}
              </div>
              <p className="text-sm text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-amber-500">
                {categoryStats.uncategorizedCount}
              </div>
              <p className="text-sm text-muted-foreground">Uncategorized</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Categories List */}
      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="size-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No categories yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first category or seed the default ones.
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" onClick={handleSeedDefaults}>
                <Sparkles className="size-4 mr-2" />
                Seed Defaults
              </Button>
              <Button onClick={handleAddNew}>
                <PlusIcon className="size-4 mr-2" />
                Add Category
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {categories.map((category, index) => {
            const IconComponent = getIconComponent(category.icon || "Package");
            const productCount = getProductCount(category.slug);

            return (
              <Card
                key={category._id}
                className={`${draggedIndex === index ? "ring-2 ring-primary" : ""}`}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
              >
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    {/* Drag Handle */}
                    <div className="cursor-move text-muted-foreground hover:text-foreground">
                      <GripVertical className="size-5" />
                    </div>

                    {/* Icon */}
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
                      <IconComponent className="size-5" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{category.name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {category.slug}
                        </Badge>
                        {category.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                        {!category.isActive && (
                          <Badge variant="destructive" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {category.description || "No description"}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="font-semibold">{productCount}</div>
                        <div className="text-muted-foreground text-xs">Products</div>
                      </div>
                      <div className="flex items-center gap-1">
                        {category.showOnHomepage ? (
                          <Home className="size-4 text-green-500" />
                        ) : (
                          <Home className="size-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {category.requiresDevice ? (
                          <Smartphone className="size-4 text-blue-500" />
                        ) : (
                          <Smartphone className="size-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {category.isActive ? (
                          <Eye className="size-4 text-green-500" />
                        ) : (
                          <EyeOff className="size-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(category._id)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(category._id)}
                        disabled={productCount > 0}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Category" : "Add New Category"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Update the category details below."
                : "Create a new product category."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="font-medium">Basic Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Slug *</Label>
                  <Input
                    placeholder="e.g., skin"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                      })
                    }
                    disabled={!!editingCategory}
                  />
                  <p className="text-xs text-muted-foreground">
                    URL-safe identifier (cannot be changed after creation)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Display Name *</Label>
                  <Input
                    placeholder="e.g., Skins"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Brief description of this category..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <Select
                    value={formData.icon}
                    onValueChange={(v) => setFormData({ ...formData, icon: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <opt.icon className="size-4" />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category Image URL</Label>
                  <Input
                    placeholder="https://..."
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Homepage Settings */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium">Homepage Display</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Homepage Image URL</Label>
                  <Input
                    placeholder="https://..."
                    value={formData.homepageImage}
                    onChange={(e) =>
                      setFormData({ ...formData, homepageImage: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Homepage Title (optional)</Label>
                  <Input
                    placeholder="Defaults to display name"
                    value={formData.homepageTitle}
                    onChange={(e) =>
                      setFormData({ ...formData, homepageTitle: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Homepage Subtitle</Label>
                  <Input
                    placeholder="e.g., Premium quality wraps"
                    value={formData.homepageSubtitle}
                    onChange={(e) =>
                      setFormData({ ...formData, homepageSubtitle: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Button Text</Label>
                  <Input
                    placeholder="Shop Now"
                    value={formData.homepageButtonText}
                    onChange={(e) =>
                      setFormData({ ...formData, homepageButtonText: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Custom Link (optional)</Label>
                <Input
                  placeholder="Defaults to /products?category=slug"
                  value={formData.homepageLink}
                  onChange={(e) => setFormData({ ...formData, homepageLink: e.target.value })}
                />
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium">Settings</h4>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show on Homepage</Label>
                    <p className="text-xs text-muted-foreground">
                      Display this category in the homepage explorer section
                    </p>
                  </div>
                  <Switch
                    checked={formData.showOnHomepage}
                    onCheckedChange={(v) =>
                      setFormData({ ...formData, showOnHomepage: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Requires Device Selection</Label>
                    <p className="text-xs text-muted-foreground">
                      Users must select a device model (for skins, cases, etc.)
                    </p>
                  </div>
                  <Switch
                    checked={formData.requiresDevice}
                    onCheckedChange={(v) =>
                      setFormData({ ...formData, requiresDevice: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Active</Label>
                    <p className="text-xs text-muted-foreground">
                      Inactive categories are hidden from the site
                    </p>
                  </div>
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2Icon className="size-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingCategory ? (
                "Update Category"
              ) : (
                "Create Category"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ProductCategoriesPage() {
  return (
    <AdminLayout>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Package className="size-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Sign in required</h2>
          <p className="text-muted-foreground mb-6">
            Please sign in to manage product categories
          </p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </AuthLoading>
      <Authenticated>
        <ProductCategoriesPageInner />
      </Authenticated>
    </AdminLayout>
  );
}
