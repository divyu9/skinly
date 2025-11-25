import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Link } from "react-router-dom";
import { FolderIcon, PlusIcon, EditIcon, TrashIcon, SparklesIcon, XIcon, PackageIcon, SearchIcon, ImageIcon } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { AdminHeader } from "@/components/admin-header.tsx";
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
import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";

type CollectionRule = {
  field: "productName" | "sku";
  condition: "contains" | "startsWith" | "notContains";
  value: string;
};

function AdminCollectionsPageInner() {
  const collections = useQuery(api.collections.getAllCollections, {});
  const createCollection = useMutation(api.collections.createCollection);
  const updateCollection = useMutation(api.collections.updateCollection);
  const deleteCollection = useMutation(api.collections.deleteCollection);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Id<"collections"> | null>(null);
  const [isAutoCollection, setIsAutoCollection] = useState(false);
  const [matchLogic, setMatchLogic] = useState<"all" | "any">("all");
  const [searchQuery, setSearchQuery] = useState("");
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
    isAutoCollection && showCreatePreview ? { rules, matchLogic } : "skip"
  );

  // Get product counts for all collections
  const collectionProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    collections?.forEach((collection) => {
      // We'll fetch this individually for each collection
      counts[collection._id] = 0;
    });
    return counts;
  }, [collections]);

  // Filter collections by search query
  const filteredCollections = useMemo(() => {
    if (!collections) return [];
    if (!searchQuery.trim()) return collections;
    
    const query = searchQuery.toLowerCase();
    return collections.filter((collection) =>
      collection.name.toLowerCase().includes(query) ||
      collection.slug.toLowerCase().includes(query) ||
      collection.description?.toLowerCase().includes(query)
    );
  }, [collections, searchQuery]);

  const handleEdit = (collection: NonNullable<typeof collections>[0]) => {
    setEditingCollection(collection._id);
    setFormData({
      name: collection.name,
      slug: collection.slug,
      description: collection.description || "",
      image: collection.image || "",
    });
    setIsAutoCollection(collection.isAuto || false);
    setMatchLogic(collection.matchLogic || "all");
    setRules(
      collection.rules && collection.rules.length > 0
        ? collection.rules
        : [{ field: "productName", condition: "contains", value: "" }]
    );
    setIsDialogOpen(true);
  };

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
        if (editingCollection) {
          await updateCollection({
            collectionId: editingCollection,
            name: formData.name,
            slug: formData.slug,
            description: formData.description || undefined,
            image: formData.image || undefined,
            isAuto: true,
            matchLogic,
            rules: validRules,
          });
          toast.success("Collection updated successfully");
        } else {
          await createCollection({
            name: formData.name,
            slug: formData.slug,
            description: formData.description || undefined,
            image: formData.image || undefined,
            isAuto: true,
            matchLogic,
            rules: validRules,
          });
          toast.success("Auto-collection created successfully");
        }
        setIsDialogOpen(false);
        resetForm();
      } catch (error) {
        toast.error(editingCollection ? "Failed to update collection" : "Failed to create collection");
      }
    } else {
      try {
        if (editingCollection) {
          await updateCollection({
            collectionId: editingCollection,
            name: formData.name,
            slug: formData.slug,
            description: formData.description || undefined,
            image: formData.image || undefined,
            isAuto: false,
          });
          toast.success("Collection updated successfully");
        } else {
          await createCollection({
            name: formData.name,
            slug: formData.slug,
            description: formData.description || undefined,
            image: formData.image || undefined,
            isAuto: false,
          });
          toast.success("Collection created successfully");
        }
        setIsDialogOpen(false);
        resetForm();
      } catch (error) {
        toast.error(editingCollection ? "Failed to update collection" : "Failed to create collection");
      }
    }
  };

  const resetForm = () => {
    setFormData({ name: "", slug: "", description: "", image: "" });
    setRules([{ field: "productName", condition: "contains", value: "" }]);
    setIsAutoCollection(false);
    setMatchLogic("all");
    setShowCreatePreview(false);
    setPreviewSearch("");
    setEditingCollection(null);
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

  // Component for fetching product count for a collection
  function CollectionProductCount({ collectionId }: { collectionId: Id<"collections"> }) {
    const products = useQuery(api.collections.getCollectionProducts, { collectionId });
    
    if (products === undefined) {
      return <span className="text-muted-foreground">Loading...</span>;
    }
    
    return <span className="font-medium">{products.length}</span>;
  }

  if (collections === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                <DialogTitle>{editingCollection ? "Edit Collection" : "Create Collection"}</DialogTitle>
                <DialogDescription>
                  {editingCollection ? "Update your collection details" : "Add a new collection to organize your products"}
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
                          Configure which products are automatically included
                        </p>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={addRule}>
                        <PlusIcon className="size-3 mr-1" />
                        Add Rule
                      </Button>
                    </div>

                    {/* Match Logic Selector */}
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <Label className="text-sm mb-2 block">Match Logic</Label>
                      <Select
                        value={matchLogic}
                        onValueChange={(value: "all" | "any") => setMatchLogic(value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All conditions must match (AND)</SelectItem>
                          <SelectItem value="any">Any condition matches (OR)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-2">
                        {matchLogic === "all"
                          ? "Products must satisfy all rules below"
                          : "Products need to satisfy at least one rule below"}
                      </p>
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
                  {editingCollection
                    ? "Update Collection"
                    : isAutoCollection
                      ? "Create Auto-Collection"
                      : "Create Collection"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search Bar */}
      {collections.length > 0 && (
        <div className="relative max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search collections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

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
      ) : filteredCollections.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon />
            </EmptyMedia>
            <EmptyTitle>No collections found</EmptyTitle>
            <EmptyDescription>
              No collections match your search &quot;{searchQuery}&quot;
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => setSearchQuery("")}>
              Clear Search
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Conditions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCollections.map((collection) => (
                <TableRow key={collection._id}>
                  <TableCell>
                    {collection.image ? (
                      <div className="size-16 bg-muted rounded overflow-hidden">
                        <img
                          src={collection.image}
                          alt={collection.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="size-16 bg-muted rounded flex items-center justify-center">
                        <ImageIcon className="size-6 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{collection.name}</p>
                        {collection.isAuto && (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                            <SparklesIcon className="size-3 mr-1" />
                            Auto
                          </Badge>
                        )}
                      </div>
                      {collection.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {collection.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {collection.isAuto ? (
                      <CollectionProductCount collectionId={collection._id} />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {collection.isAuto && collection.rules && collection.rules.length > 0 ? (
                      <div className="space-y-1">
                        <Badge variant="secondary" className="text-xs mb-1">
                          {collection.matchLogic === "any" ? "Any" : "All"}
                        </Badge>
                        {collection.rules.map((rule, idx) => (
                          <div key={idx} className="text-xs text-muted-foreground">
                            {rule.field === "productName" ? "Name" : "SKU"}{" "}
                            <span className="font-medium text-foreground">
                              {getConditionLabel(rule.condition)}
                            </span>{" "}
                            &quot;{rule.value}&quot;
                          </div>
                        ))}
                        {collection.rules.length > 2 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs px-2 mt-1"
                            onClick={() => setPreviewCollectionId(collection._id)}
                          >
                            View all rules
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">No conditions</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-2 justify-end">
                      {collection.isAuto && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPreviewCollectionId(collection._id)}
                        >
                          <PackageIcon className="size-4 mr-1" />
                          Preview
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(collection)}
                      >
                        <EditIcon className="size-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(collection._id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <TrashIcon className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
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
      <AdminHeader />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
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
          <div className="space-y-4">
            <Skeleton className="h-10 w-full max-w-md" />
            <Skeleton className="h-64 w-full" />
          </div>
        </AuthLoading>
        <Authenticated>
          <AdminCollectionsPageInner />
        </Authenticated>
      </div>
    </div>
  );
}
