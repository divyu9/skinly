import { useState } from "react";
import { useQuery, useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { RichTextEditor } from "@/components/ui/rich-text-editor.tsx";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import {
  PlusIcon,
  Pencil,
  Trash2,
  Layout,
  Sparkles,
  TrendingUp,
  ImageIcon,
  Loader2Icon,
  Package,
} from "lucide-react";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/firebase-hooks";
import { SignInButton } from "@/components/ui/signin.tsx";
import type { Id } from "@/lib/firebase-api";

// Section Types
const SECTION_TYPES = [
  { value: "hero", label: "Hero Section", description: "Large image with centered text" },
  { value: "feature-left", label: "Feature Left", description: "Image left, text right" },
  { value: "feature-right", label: "Feature Right", description: "Image right, text left" },
  { value: "full-width", label: "Full Width", description: "Full-width image with overlay" },
  { value: "specs", label: "Specifications", description: "Grid layout for specs" },
];

// Source Types for suggested/trending
const SOURCE_TYPES = {
  suggested: [
    { value: "same-category", label: "Same Category (Auto)", description: "Show products from same category" },
    { value: "manual", label: "Manual Selection", description: "Manually pick specific products" },
    { value: "tag-based", label: "Tag Based", description: "Show products with specific tags" },
  ],
  trending: [
    { value: "manual", label: "Manual Selection", description: "Manually pick specific products" },
    { value: "tag-based", label: "Tag Based", description: "Show products with specific tags" },
    { value: "auto", label: "Auto (Trending Tags)", description: "Products tagged as trending/bestseller" },
  ],
};

export default function ProductSectionsPage() {
  return (
    <AdminLayout>
      <AuthLoading>
        <LoadingSkeleton />
      </AuthLoading>
      <Unauthenticated>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold">Sign in Required</h2>
            <p className="text-muted-foreground">Please sign in to manage product sections.</p>
            <SignInButton />
          </div>
        </div>
      </Unauthenticated>
      <Authenticated>
        <ProductSectionsContent />
      </Authenticated>
    </AdminLayout>
  );
}

function ProductSectionsContent() {
  const [activeTab, setActiveTab] = useState<"descriptions" | "suggested" | "trending">("descriptions");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Product Page Sections</h1>
        <p className="text-muted-foreground mt-2">
          Configure the sections that appear on product detail pages. Set defaults by category or override for specific products.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="descriptions" className="flex items-center gap-2">
            <Layout className="size-4" />
            Descriptions
          </TabsTrigger>
          <TabsTrigger value="suggested" className="flex items-center gap-2">
            <Sparkles className="size-4" />
            Suggested
          </TabsTrigger>
          <TabsTrigger value="trending" className="flex items-center gap-2">
            <TrendingUp className="size-4" />
            Trending
          </TabsTrigger>
        </TabsList>

        <TabsContent value="descriptions" className="mt-6">
          <DescriptionSectionsTab />
        </TabsContent>

        <TabsContent value="suggested" className="mt-6">
          <SuggestedProductsTab />
        </TabsContent>

        <TabsContent value="trending" className="mt-6">
          <TrendingProductsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// Description Sections Tab (Apple-like content)
// ============================================
function DescriptionSectionsTab() {
  const categories = useQuery(api.productCategories.listActive);
  const allSections = useQuery(api.productSections.listSectionContent, {});
  const createSection = useMutation(api.productSections.createSectionContent);
  const updateSection = useMutation(api.productSections.updateSectionContent);
  const deleteSection = useMutation(api.productSections.deleteSectionContent);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Id<"productSectionContent"> | null>(null);
  const [scopeType, setScopeType] = useState<"category" | "product">("category");
  const [formData, setFormData] = useState({
    productCategorySlug: "",
    productId: "",
    sectionType: "hero" as "hero" | "feature-left" | "feature-right" | "full-width" | "specs",
    title: "",
    descriptionHtml: "",
    imageUrl: "",
    ctaText: "",
    ctaLink: "",
    order: 0,
    isActive: true,
  });

  const resetForm = () => {
    setFormData({
      productCategorySlug: "",
      productId: "",
      sectionType: "hero",
      title: "",
      descriptionHtml: "",
      imageUrl: "",
      ctaText: "",
      ctaLink: "",
      order: 0,
      isActive: true,
    });
    setEditingSection(null);
    setScopeType("category");
  };

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleOpenEdit = (section: NonNullable<typeof allSections>[number]) => {
    setFormData({
      productCategorySlug: section.productCategorySlug || "",
      productId: section.productId || "",
      sectionType: section.sectionType,
      title: section.title,
      descriptionHtml: section.descriptionHtml,
      imageUrl: section.imageUrl || "",
      ctaText: section.ctaText || "",
      ctaLink: section.ctaLink || "",
      order: section.order,
      isActive: section.isActive,
    });
    setScopeType(section.productId ? "product" : "category");
    setEditingSection(section._id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingSection) {
        await updateSection({
          id: editingSection,
          sectionType: formData.sectionType,
          title: formData.title,
          descriptionHtml: formData.descriptionHtml,
          imageUrl: formData.imageUrl || undefined,
          ctaText: formData.ctaText || undefined,
          ctaLink: formData.ctaLink || undefined,
          order: formData.order,
          isActive: formData.isActive,
        });
        toast.success("Section updated");
      } else {
        await createSection({
          productCategorySlug: scopeType === "category" ? formData.productCategorySlug : undefined,
          productId: scopeType === "product" ? (formData.productId as Id<"products">) : undefined,
          sectionType: formData.sectionType,
          title: formData.title,
          descriptionHtml: formData.descriptionHtml,
          imageUrl: formData.imageUrl || undefined,
          ctaText: formData.ctaText || undefined,
          ctaLink: formData.ctaLink || undefined,
          order: formData.order,
          isActive: formData.isActive,
        });
        toast.success("Section created");
      }
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to save section");
    }
  };

  const handleDelete = async (id: Id<"productSectionContent">) => {
    if (!confirm("Are you sure you want to delete this section?")) return;
    try {
      await deleteSection({ id });
      toast.success("Section deleted");
    } catch (error) {
      toast.error("Failed to delete section");
    }
  };

  if (allSections === undefined || categories === undefined) {
    return <LoadingSkeleton />;
  }

  // Group sections by category
  const categorySections = allSections.filter((s) => s.productCategorySlug && !s.productId);
  const productSections = allSections.filter((s) => s.productId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Apple-like Description Sections</h2>
          <p className="text-sm text-muted-foreground">
            Create rich content sections with images and text for product pages.
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <PlusIcon className="size-4 mr-2" />
          Add Section
        </Button>
      </div>

      {/* Category-level sections */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Category Defaults</CardTitle>
          <CardDescription>
            These sections will show on all products in the category (unless overridden).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categorySections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No category sections created yet.
            </p>
          ) : (
            <div className="space-y-3">
              {categorySections.map((section) => (
                <SectionCard
                  key={section._id}
                  section={section}
                  onEdit={() => handleOpenEdit(section)}
                  onDelete={() => handleDelete(section._id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product-specific sections */}
      {productSections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Product-Specific Overrides</CardTitle>
            <CardDescription>
              These sections override category defaults for specific products.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {productSections.map((section) => (
                <SectionCard
                  key={section._id}
                  section={section}
                  onEdit={() => handleOpenEdit(section)}
                  onDelete={() => handleDelete(section._id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSection ? "Edit Section" : "Create Section"}
            </DialogTitle>
            <DialogDescription>
              Create Apple-style content sections for product pages.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Scope Selection */}
            {!editingSection && (
              <div className="space-y-2">
                <Label>Apply to</Label>
                <Select value={scopeType} onValueChange={(v) => setScopeType(v as "category" | "product")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="category">All products in a category</SelectItem>
                    <SelectItem value="product">Specific product (override)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Category Selection */}
            {scopeType === "category" && !editingSection && (
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.productCategorySlug}
                  onValueChange={(v) => setFormData({ ...formData, productCategorySlug: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.slug} value={cat.slug}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Product ID (for product-specific) */}
            {scopeType === "product" && !editingSection && (
              <div className="space-y-2">
                <Label>Product ID</Label>
                <Input
                  value={formData.productId}
                  onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                  placeholder="Paste product ID from product list..."
                />
              </div>
            )}

            {/* Section Type */}
            <div className="space-y-2">
              <Label>Section Type</Label>
              <Select
                value={formData.sectionType}
                onValueChange={(v) => setFormData({ ...formData, sectionType: v as typeof formData.sectionType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <span className="font-medium">{type.label}</span>
                        <span className="text-muted-foreground ml-2">- {type.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Premium Protection for Your Device"
              />
            </div>

            {/* Description (WYSIWYG) */}
            <div className="space-y-2">
              <Label>Description</Label>
              <RichTextEditor
                content={formData.descriptionHtml}
                onChange={(html) => setFormData({ ...formData, descriptionHtml: html })}
                placeholder="Write your Apple-style product description..."
              />
            </div>

            {/* Image URL */}
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://..."
              />
              {formData.imageUrl && (
                <img
                  src={formData.imageUrl}
                  alt="Preview"
                  className="mt-2 max-h-32 rounded-lg object-cover"
                />
              )}
            </div>

            {/* CTA */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CTA Button Text (optional)</Label>
                <Input
                  value={formData.ctaText}
                  onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })}
                  placeholder="Learn More"
                />
              </div>
              <div className="space-y-2">
                <Label>CTA Link (optional)</Label>
                <Input
                  value={formData.ctaLink}
                  onChange={(e) => setFormData({ ...formData, ctaLink: e.target.value })}
                  placeholder="/products"
                />
              </div>
            </div>

            {/* Order */}
            <div className="space-y-2">
              <Label>Display Order</Label>
              <Input
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">Lower numbers appear first</p>
            </div>

            {/* Active */}
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingSection ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionCard({
  section,
  onEdit,
  onDelete,
}: {
  section: {
    _id: Id<"productSectionContent">;
    sectionType: string;
    title: string;
    productCategorySlug?: string;
    productId?: Id<"products">;
    isActive: boolean;
    order: number;
  };
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-muted rounded-lg">
          <ImageIcon className="size-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{section.title}</span>
            <Badge variant="outline" className="text-xs">
              {section.sectionType}
            </Badge>
            {section.productCategorySlug && (
              <Badge variant="secondary" className="text-xs">
                {section.productCategorySlug}
              </Badge>
            )}
            {!section.isActive && (
              <Badge variant="destructive" className="text-xs">
                Inactive
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Order: {section.order}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

// ============================================
// Suggested Products Tab
// ============================================
function SuggestedProductsTab() {
  const categories = useQuery(api.productCategories.listActive);
  const allConfigs = useQuery(api.productSections.listSuggestedProductsConfigs);
  const createConfig = useMutation(api.productSections.createSuggestedProductsConfig);
  const updateConfig = useMutation(api.productSections.updateSuggestedProductsConfig);
  const deleteConfig = useMutation(api.productSections.deleteSuggestedProductsConfig);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"suggestedProductsConfig"> | null>(null);
  const [scopeType, setScopeType] = useState<"category" | "product">("category");
  const [formData, setFormData] = useState({
    productCategorySlug: "",
    productId: "",
    sectionTitle: "Complete Your Setup",
    sectionDescription: "",
    sourceType: "same-category" as "same-category" | "manual" | "tag-based",
    manualProductIds: "",
    filterTags: "",
    maxProducts: 6,
    isActive: true,
  });

  const resetForm = () => {
    setFormData({
      productCategorySlug: "",
      productId: "",
      sectionTitle: "Complete Your Setup",
      sectionDescription: "",
      sourceType: "same-category",
      manualProductIds: "",
      filterTags: "",
      maxProducts: 6,
      isActive: true,
    });
    setEditingId(null);
    setScopeType("category");
  };

  const handleSave = async () => {
    try {
      const tags = formData.filterTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const productIds = formData.manualProductIds
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean) as Id<"products">[];

      if (editingId) {
        await updateConfig({
          id: editingId,
          sectionTitle: formData.sectionTitle,
          sectionDescription: formData.sectionDescription || undefined,
          sourceType: formData.sourceType,
          manualProductIds: productIds.length > 0 ? productIds : undefined,
          filterTags: tags.length > 0 ? tags : undefined,
          maxProducts: formData.maxProducts,
          isActive: formData.isActive,
        });
        toast.success("Config updated");
      } else {
        await createConfig({
          productCategorySlug: scopeType === "category" ? formData.productCategorySlug : undefined,
          productId: scopeType === "product" ? (formData.productId as Id<"products">) : undefined,
          sectionTitle: formData.sectionTitle,
          sectionDescription: formData.sectionDescription || undefined,
          sourceType: formData.sourceType,
          manualProductIds: productIds.length > 0 ? productIds : undefined,
          filterTags: tags.length > 0 ? tags : undefined,
          maxProducts: formData.maxProducts,
          isActive: formData.isActive,
        });
        toast.success("Config created");
      }
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to save config");
    }
  };

  const handleDelete = async (id: Id<"suggestedProductsConfig">) => {
    if (!confirm("Delete this configuration?")) return;
    try {
      await deleteConfig({ id });
      toast.success("Config deleted");
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  if (allConfigs === undefined || categories === undefined) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Suggested Products Section</h2>
          <p className="text-sm text-muted-foreground">
            Show complementary products on product pages. Default is auto-suggest from same category.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <PlusIcon className="size-4 mr-2" />
          Add Config
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {allConfigs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No configurations yet. Add one to enable suggested products.
            </p>
          ) : (
            <div className="space-y-3">
              {allConfigs.map((config) => (
                <div
                  key={config._id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-muted rounded-lg">
                      <Sparkles className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{config.sectionTitle}</span>
                        <Badge variant="outline" className="text-xs">
                          {config.sourceType}
                        </Badge>
                        {config.productCategorySlug && (
                          <Badge variant="secondary" className="text-xs">
                            {config.productCategorySlug}
                          </Badge>
                        )}
                        {!config.isActive && (
                          <Badge variant="destructive" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Max: {config.maxProducts} products
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFormData({
                          productCategorySlug: config.productCategorySlug || "",
                          productId: config.productId || "",
                          sectionTitle: config.sectionTitle,
                          sectionDescription: config.sectionDescription || "",
                          sourceType: config.sourceType,
                          manualProductIds: config.manualProductIds?.join(", ") || "",
                          filterTags: config.filterTags?.join(", ") || "",
                          maxProducts: config.maxProducts,
                          isActive: config.isActive,
                        });
                        setScopeType(config.productId ? "product" : "category");
                        setEditingId(config._id);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(config._id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Create"} Suggested Products Config</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!editingId && (
              <>
                <div className="space-y-2">
                  <Label>Apply to</Label>
                  <Select value={scopeType} onValueChange={(v) => setScopeType(v as "category" | "product")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="category">All products in a category</SelectItem>
                      <SelectItem value="product">Specific product</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {scopeType === "category" && (
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={formData.productCategorySlug}
                      onValueChange={(v) => setFormData({ ...formData, productCategorySlug: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.slug} value={cat.slug}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {scopeType === "product" && (
                  <div className="space-y-2">
                    <Label>Product ID</Label>
                    <Input
                      value={formData.productId}
                      onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                      placeholder="Paste product ID..."
                    />
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label>Section Title</Label>
              <Input
                value={formData.sectionTitle}
                onChange={(e) => setFormData({ ...formData, sectionTitle: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={formData.sectionDescription}
                onChange={(e) => setFormData({ ...formData, sectionDescription: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Source Type</Label>
              <Select
                value={formData.sourceType}
                onValueChange={(v) => setFormData({ ...formData, sourceType: v as typeof formData.sourceType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.suggested.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.sourceType === "manual" && (
              <div className="space-y-2">
                <Label>Product IDs (comma-separated)</Label>
                <Input
                  value={formData.manualProductIds}
                  onChange={(e) => setFormData({ ...formData, manualProductIds: e.target.value })}
                  placeholder="id1, id2, id3..."
                />
              </div>
            )}

            {formData.sourceType === "tag-based" && (
              <div className="space-y-2">
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={formData.filterTags}
                  onChange={(e) => setFormData({ ...formData, filterTags: e.target.value })}
                  placeholder="recommended, bundle..."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Max Products</Label>
              <Input
                type="number"
                value={formData.maxProducts}
                onChange={(e) => setFormData({ ...formData, maxProducts: parseInt(e.target.value) || 6 })}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// Trending Products Tab
// ============================================
function TrendingProductsTab() {
  const categories = useQuery(api.productCategories.listActive);
  const allConfigs = useQuery(api.productSections.listTrendingProductsConfigs);
  const createConfig = useMutation(api.productSections.createTrendingProductsConfig);
  const updateConfig = useMutation(api.productSections.updateTrendingProductsConfig);
  const deleteConfig = useMutation(api.productSections.deleteTrendingProductsConfig);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"trendingProductsConfig"> | null>(null);
  const [scopeType, setScopeType] = useState<"category" | "product">("category");
  const [formData, setFormData] = useState({
    productCategorySlug: "",
    productId: "",
    sectionTitle: "Trending Now",
    sectionDescription: "",
    sourceType: "tag-based" as "manual" | "tag-based" | "auto",
    manualProductIds: "",
    filterTags: "trending, bestseller",
    maxProducts: 8,
    isActive: true,
  });

  const resetForm = () => {
    setFormData({
      productCategorySlug: "",
      productId: "",
      sectionTitle: "Trending Now",
      sectionDescription: "",
      sourceType: "tag-based",
      manualProductIds: "",
      filterTags: "trending, bestseller",
      maxProducts: 8,
      isActive: true,
    });
    setEditingId(null);
    setScopeType("category");
  };

  const handleSave = async () => {
    try {
      const tags = formData.filterTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const productIds = formData.manualProductIds
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean) as Id<"products">[];

      if (editingId) {
        await updateConfig({
          id: editingId,
          sectionTitle: formData.sectionTitle,
          sectionDescription: formData.sectionDescription || undefined,
          sourceType: formData.sourceType,
          manualProductIds: productIds.length > 0 ? productIds : undefined,
          filterTags: tags.length > 0 ? tags : undefined,
          maxProducts: formData.maxProducts,
          isActive: formData.isActive,
        });
        toast.success("Config updated");
      } else {
        await createConfig({
          productCategorySlug: scopeType === "category" ? formData.productCategorySlug : undefined,
          productId: scopeType === "product" ? (formData.productId as Id<"products">) : undefined,
          sectionTitle: formData.sectionTitle,
          sectionDescription: formData.sectionDescription || undefined,
          sourceType: formData.sourceType,
          manualProductIds: productIds.length > 0 ? productIds : undefined,
          filterTags: tags.length > 0 ? tags : undefined,
          maxProducts: formData.maxProducts,
          isActive: formData.isActive,
        });
        toast.success("Config created");
      }
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to save config");
    }
  };

  const handleDelete = async (id: Id<"trendingProductsConfig">) => {
    if (!confirm("Delete this configuration?")) return;
    try {
      await deleteConfig({ id });
      toast.success("Config deleted");
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  if (allConfigs === undefined || categories === undefined) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Trending Products Section</h2>
          <p className="text-sm text-muted-foreground">
            Show trending/popular products on product pages.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <PlusIcon className="size-4 mr-2" />
          Add Config
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {allConfigs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No configurations yet. Add one to enable trending products.
            </p>
          ) : (
            <div className="space-y-3">
              {allConfigs.map((config) => (
                <div
                  key={config._id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-muted rounded-lg">
                      <TrendingUp className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{config.sectionTitle}</span>
                        <Badge variant="outline" className="text-xs">
                          {config.sourceType}
                        </Badge>
                        {config.productCategorySlug && (
                          <Badge variant="secondary" className="text-xs">
                            {config.productCategorySlug}
                          </Badge>
                        )}
                        {!config.isActive && (
                          <Badge variant="destructive" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Max: {config.maxProducts} products
                        {config.filterTags && config.filterTags.length > 0 && (
                          <span> | Tags: {config.filterTags.join(", ")}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFormData({
                          productCategorySlug: config.productCategorySlug || "",
                          productId: config.productId || "",
                          sectionTitle: config.sectionTitle,
                          sectionDescription: config.sectionDescription || "",
                          sourceType: config.sourceType,
                          manualProductIds: config.manualProductIds?.join(", ") || "",
                          filterTags: config.filterTags?.join(", ") || "",
                          maxProducts: config.maxProducts,
                          isActive: config.isActive,
                        });
                        setScopeType(config.productId ? "product" : "category");
                        setEditingId(config._id);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(config._id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Create"} Trending Products Config</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!editingId && (
              <>
                <div className="space-y-2">
                  <Label>Apply to</Label>
                  <Select value={scopeType} onValueChange={(v) => setScopeType(v as "category" | "product")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="category">All products in a category</SelectItem>
                      <SelectItem value="product">Specific product</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {scopeType === "category" && (
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={formData.productCategorySlug}
                      onValueChange={(v) => setFormData({ ...formData, productCategorySlug: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.slug} value={cat.slug}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {scopeType === "product" && (
                  <div className="space-y-2">
                    <Label>Product ID</Label>
                    <Input
                      value={formData.productId}
                      onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                      placeholder="Paste product ID..."
                    />
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label>Section Title</Label>
              <Input
                value={formData.sectionTitle}
                onChange={(e) => setFormData({ ...formData, sectionTitle: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={formData.sectionDescription}
                onChange={(e) => setFormData({ ...formData, sectionDescription: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Source Type</Label>
              <Select
                value={formData.sourceType}
                onValueChange={(v) => setFormData({ ...formData, sourceType: v as typeof formData.sourceType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.trending.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.sourceType === "manual" && (
              <div className="space-y-2">
                <Label>Product IDs (comma-separated)</Label>
                <Input
                  value={formData.manualProductIds}
                  onChange={(e) => setFormData({ ...formData, manualProductIds: e.target.value })}
                  placeholder="id1, id2, id3..."
                />
              </div>
            )}

            {formData.sourceType === "tag-based" && (
              <div className="space-y-2">
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={formData.filterTags}
                  onChange={(e) => setFormData({ ...formData, filterTags: e.target.value })}
                  placeholder="trending, bestseller..."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Max Products</Label>
              <Input
                type="number"
                value={formData.maxProducts}
                onChange={(e) => setFormData({ ...formData, maxProducts: parseInt(e.target.value) || 8 })}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// Loading Skeleton
// ============================================
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-6 w-96" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
