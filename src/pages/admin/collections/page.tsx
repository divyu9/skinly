import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Link } from "react-router-dom";
import { FolderIcon, PlusIcon, EditIcon, TrashIcon, SparklesIcon, XIcon, PackageIcon, SearchIcon } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { useState } from "react";

type CollectionRule = {
  field: "productName" | "sku";
  condition: "contains" | "startsWith" | "notContains";
  value: string;
};

function AdminCollectionsPageInner() {
  const collections = useQuery(api.collections.getAllCollections, {});
  const createCollection = useMutation(api.collections.createCollection);
  const deleteCollection = useMutation(api.collections.deleteCollection);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAutoCollection, setIsAutoCollection] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    image: "",
  });
  const [rules, setRules] = useState<CollectionRule[]>([
    { field: "productName", condition: "contains", value: "" },
  ]);
  const [previewCollectionId, setPreviewCollectionId] = useState<Id<"collections"> | null>(null);
  const [showCreatePreview, setShowCreatePreview] = useState(false);
  const [previewSearch, setPreviewSearch] = useState("");

  const previewProducts = useQuery(
    api.collections.getCollectionProducts,
    previewCollectionId ? { collectionId: previewCollectionId } : "skip"
  );

  // Preview products while creating collection
  const createPreviewProducts = useQuery(
    api.collections.previewCollectionProducts,
    isAutoCollection && showCreatePreview ? { rules } : "skip"
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate rules if auto collection
    if (isAutoCollection) {
      const validRules = rules.filter((rule) => rule.value.trim() !== "");
      if (validRules.length === 0) {
        toast.error("Please add at least one rule with a value");
        return;
      }

      try {
        await createCollection({
          name: formData.name,
          slug: formData.slug,
          description: formData.description || undefined,
          image: formData.image || undefined,
          isAuto: true,
          rules: validRules,
        });
        toast.success("Auto-collection created successfully");
        setIsDialogOpen(false);
        resetForm();
      } catch (error) {
        toast.error("Failed to create collection");
      }
    } else {
      try {
        await createCollection({
          name: formData.name,
          slug: formData.slug,
          description: formData.description || undefined,
          image: formData.image || undefined,
          isAuto: false,
        });
        toast.success("Collection created successfully");
        setIsDialogOpen(false);
        resetForm();
      } catch (error) {
        toast.error("Failed to create collection");
      }
    }
  };

  const resetForm = () => {
    setFormData({ name: "", slug: "", description: "", image: "" });
    setRules([{ field: "productName", condition: "contains", value: "" }]);
    setIsAutoCollection(false);
    setShowCreatePreview(false);
    setPreviewSearch("");
  };

  // Filter preview products by search query
  const filteredCreatePreviewProducts = createPreviewProducts?.filter((product) => {
    if (!previewSearch.trim()) return true;
    const query = previewSearch.toLowerCase();
    return (
      product.title.toLowerCase().includes(query) ||
      product.variants.some((v) => v.sku.toLowerCase().includes(query))
    );
  }) || [];

  const handleDelete = async (collectionId: Id<"collections">) => {
    if (!confirm("Are you sure you want to delete this collection?")) {
      return;
    }

    try {
      await deleteCollection({ collectionId });
      toast.success("Collection deleted successfully");
    } catch (error) {
      toast.error("Failed to delete collection");
    }
  };

  const addRule = () => {
    setRules([...rules, { field: "productName", condition: "contains", value: "" }]);
  };

  const removeRule = (index: number) => {
    if (rules.length === 1) {
      toast.error("At least one rule is required");
      return;
    }
    setRules(rules.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, updates: Partial<CollectionRule>) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], ...updates };
    setRules(newRules);
  };

  const getConditionLabel = (condition: string) => {
    switch (condition) {
      case "contains":
        return "contains";
      case "startsWith":
        return "starts with";
      case "notContains":
        return "does not contain";
      default:
        return condition;
    }
  };

  if (collections === undefined) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Collections</h1>
          <p className="text-muted-foreground">
            Organize products into collections or use smart auto-collections
          </p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="size-4 mr-2" />
              Add Collection
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Create Collection</DialogTitle>
                <DialogDescription>
                  Add a new collection to organize your products
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Collection Type Toggle */}
                <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="autoCollection"
                      checked={isAutoCollection}
                      onChange={(e) => setIsAutoCollection(e.target.checked)}
                      className="size-4 rounded"
                    />
                    <Label htmlFor="autoCollection" className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <SparklesIcon className="size-4 text-primary" />
                        <span className="font-semibold">Smart Auto-Collection</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Automatically populate based on rules
                      </p>
                    </Label>
                  </div>
                </div>

                <div>
                  <Label htmlFor="name">Collection Name *</Label>
                  <Input
                    id="name"
                    required
                    placeholder="Matte Finish"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="slug">Slug *</Label>
                  <Input
                    id="slug"
                    required
                    placeholder="matte-finish"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Smooth matte finish phone skins"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="image">Image URL</Label>
                  <Input
                    id="image"
                    placeholder="https://..."
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  />
                </div>

                {/* Conditional Rules Section */}
                {isAutoCollection && (
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Collection Rules</Label>
                        <p className="text-xs text-muted-foreground">
                          All rules must match for a product to be included
                        </p>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={addRule}>
                        <PlusIcon className="size-3 mr-1" />
                        Add Rule
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {rules.map((rule, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-3 border rounded-lg bg-muted/20"
                        >
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <Select
                              value={rule.field}
                              onValueChange={(value: "productName" | "sku") =>
                                updateRule(index, { field: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="productName">Product Name</SelectItem>
                                <SelectItem value="sku">SKU</SelectItem>
                              </SelectContent>
                            </Select>

                            <Select
                              value={rule.condition}
                              onValueChange={(
                                value: "contains" | "startsWith" | "notContains"
                              ) => updateRule(index, { condition: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="contains">contains</SelectItem>
                                <SelectItem value="startsWith">starts with</SelectItem>
                                <SelectItem value="notContains">does not contain</SelectItem>
                              </SelectContent>
                            </Select>

                            <Input
                              placeholder="value"
                              value={rule.value}
                              onChange={(e) => updateRule(index, { value: e.target.value })}
                            />
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeRule(index)}
                            disabled={rules.length === 1}
                          >
                            <XIcon className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    {/* Preview Button */}
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      onClick={() => setShowCreatePreview(true)}
                      disabled={rules.every((rule) => !rule.value.trim())}
                    >
                      <PackageIcon className="size-4 mr-2" />
                      Preview Matching Products
                    </Button>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="submit">
                  {isAutoCollection ? "Create Auto-Collection" : "Create Collection"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {collections.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderIcon />
            </EmptyMedia>
            <EmptyTitle>No collections yet</EmptyTitle>
            <EmptyDescription>
              Create your first collection to organize products
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setIsDialogOpen(true)}>
              <PlusIcon className="size-4 mr-2" />
              Create Collection
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.map((collection) => (
            <Card key={collection._id}>
              <CardContent className="p-6">
                {collection.image && (
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden mb-4">
                    <img
                      src={collection.image}
                      alt={collection.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-lg">{collection.name}</h3>
                  {collection.isAuto && (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      <SparklesIcon className="size-3 mr-1" />
                      Auto
                    </Badge>
                  )}
                </div>
                {collection.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {collection.description}
                  </p>
                )}

                {/* Show rules for auto-collections */}
                {collection.isAuto && collection.rules && collection.rules.length > 0 && (
                  <div className="mb-4 p-3 bg-muted/30 rounded-lg space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                      Rules
                    </p>
                    {collection.rules.map((rule, idx) => (
                      <p key={idx} className="text-xs">
                        {rule.field === "productName" ? "Product name" : "SKU"}{" "}
                        <span className="font-medium">{getConditionLabel(rule.condition)}</span>{" "}
                        &quot;{rule.value}&quot;
                      </p>
                    ))}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full mt-2 text-xs"
                      onClick={() => setPreviewCollectionId(collection._id)}
                    >
                      <PackageIcon className="size-3 mr-1" />
                      Preview Products
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(collection._id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <TrashIcon className="size-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog for existing collections */}
      <Dialog
        open={!!previewCollectionId}
        onOpenChange={() => setPreviewCollectionId(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Matching Products</DialogTitle>
            <DialogDescription>
              {previewProducts === undefined
                ? "Loading..."
                : `${previewProducts.length} product${previewProducts.length !== 1 ? "s" : ""} match the collection rules`}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh]">
            {previewProducts === undefined ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : previewProducts.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <PackageIcon />
                  </EmptyMedia>
                  <EmptyTitle>No matching products</EmptyTitle>
                  <EmptyDescription>
                    No products match the current collection rules
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-3">
                {previewProducts.map((product) => (
                  <div
                    key={product._id}
                    className="flex items-center gap-4 p-4 border rounded-lg"
                  >
                    {product.images.length > 0 && (
                      <div className="size-16 bg-muted rounded overflow-hidden shrink-0">
                        <img
                          src={product.images[0].url}
                          alt={product.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{product.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {product.variants.length} variant
                        {product.variants.length !== 1 ? "s" : ""}
                        {product.variants.length > 0 &&
                          ` • SKU: ${product.variants[0].sku}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog for creating collection */}
      <Dialog
        open={showCreatePreview}
        onOpenChange={(open) => {
          setShowCreatePreview(open);
          if (!open) setPreviewSearch("");
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Preview Matching Products</DialogTitle>
            <DialogDescription>
              {createPreviewProducts === undefined
                ? "Loading..."
                : `${createPreviewProducts.length} product${createPreviewProducts.length !== 1 ? "s" : ""} will be added to this collection`}
            </DialogDescription>
          </DialogHeader>

          {/* Search Bar */}
          {createPreviewProducts && createPreviewProducts.length > 0 && (
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search products by name or SKU..."
                value={previewSearch}
                onChange={(e) => setPreviewSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          )}

          <div className="overflow-y-auto max-h-[55vh]">
            {createPreviewProducts === undefined ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : filteredCreatePreviewProducts.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <PackageIcon />
                  </EmptyMedia>
                  <EmptyTitle>
                    {previewSearch ? "No matching products" : "No products match"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {previewSearch
                      ? `No products match your search "${previewSearch}"`
                      : "No products match the current rules. Try adjusting the rules or adding products to your catalog."}
                  </EmptyDescription>
                </EmptyHeader>
                {previewSearch && (
                  <EmptyContent>
                    <Button variant="outline" onClick={() => setPreviewSearch("")}>
                      Clear Search
                    </Button>
                  </EmptyContent>
                )}
              </Empty>
            ) : (
              <div className="space-y-3">
                {filteredCreatePreviewProducts.map((product) => (
                  <div
                    key={product._id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    {product.images.length > 0 && (
                      <div className="size-16 bg-muted rounded overflow-hidden shrink-0">
                        <img
                          src={product.images[0].url}
                          alt={product.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{product.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {product.variants.length} variant
                        {product.variants.length !== 1 ? "s" : ""}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {product.variants.slice(0, 3).map((variant) => (
                          <Badge key={variant._id} variant="outline" className="text-xs">
                            {variant.sku}
                          </Badge>
                        ))}
                        {product.variants.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{product.variants.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {createPreviewProducts && createPreviewProducts.length > 0 && (
            <DialogFooter>
              <p className="text-sm text-muted-foreground">
                {previewSearch && filteredCreatePreviewProducts.length !== createPreviewProducts.length
                  ? `Showing ${filteredCreatePreviewProducts.length} of ${createPreviewProducts.length} products`
                  : `${createPreviewProducts.length} total product${createPreviewProducts.length !== 1 ? "s" : ""}`}
              </p>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminCollectionsPage() {
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
              <Link
                to="/admin/products"
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                Products
              </Link>
              <Link to="/admin/collections" className="text-sm font-medium text-primary">
                Collections
              </Link>
              <Link
                to="/admin/orders"
                className="text-sm font-medium hover:text-primary transition-colors"
              >
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
                <FolderIcon />
              </EmptyMedia>
              <EmptyTitle>Please sign in to access admin</EmptyTitle>
              <EmptyDescription>
                You need to be logged in to manage collections
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <SignInButton />
            </EmptyContent>
          </Empty>
        </Unauthenticated>
        <AuthLoading>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </AuthLoading>
        <Authenticated>
          <AdminCollectionsPageInner />
        </Authenticated>
      </div>
    </div>
  );
}
